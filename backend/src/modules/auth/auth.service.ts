import { Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { EnvironmentVariables } from '../../config/env.validation';
import { User } from '../users/user.entity';
import { AccessTokenPayload, AuthUser, toAuthUser } from './auth-user';
import { RefreshToken } from './refresh-token.entity';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface AuthResult {
  user: AuthUser;
  tokens: IssuedTokens;
}

const INVALID_LOGIN = 'Invalid email or password';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  /** Verified against when the email is unknown, so both failures take the same time. */
  private dummyHash = '';

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyHash = await argon2.hash(randomBytes(16).toString('hex'), { type: argon2.argon2id });
  }

  /** Wrong email, wrong password and disabled account all give the same 401. */
  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.dataSource
      .getRepository(User)
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :email', { email })
      .getOne();

    const passwordOk = await argon2.verify(user?.passwordHash ?? this.dummyHash, password);
    if (!user || !passwordOk || !user.isActive) {
      const reason = !user ? 'unknown email' : !passwordOk ? 'wrong password' : 'inactive user';
      this.logger.warn(`Login failed: ${reason}`);
      throw new UnauthorizedException(INVALID_LOGIN);
    }

    const tokens = await this.issueTokens(this.dataSource.manager, user);
    return { user: toAuthUser(user), tokens };
  }

  /**
   * Rotates the refresh token. The old token is claimed with one atomic UPDATE,
   * so two requests cannot both use it. A token that was already revoked means
   * it was stolen or replayed: every refresh token of that user is revoked.
   */
  async refresh(rawToken: string | undefined): Promise<AuthResult> {
    if (!rawToken) throw new UnauthorizedException();
    const tokenHash = sha256(rawToken);

    const outcome = await this.dataSource.transaction(async (m) => {
      const claimed = await m
        .createQueryBuilder()
        .update(RefreshToken)
        .set({ revokedAt: () => 'now()' })
        .where('token_hash = :tokenHash AND revoked_at IS NULL AND expires_at > now()', {
          tokenHash,
        })
        .returning('user_id')
        .execute();
      const userId = (claimed.raw as Array<{ user_id: string }>)[0]?.user_id;
      if (!userId) return 'not-claimed' as const;

      const user = await m.findOneBy(User, { id: userId });
      if (!user || !user.isActive) return 'inactive' as const;
      return { user: toAuthUser(user), tokens: await this.issueTokens(m, user) };
    });

    if (outcome === 'not-claimed') await this.revokeAllOnReuse(tokenHash);
    if (typeof outcome === 'string') throw new UnauthorizedException();
    return outcome;
  }

  /** Revokes the given refresh token if it is still active. Always succeeds. */
  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    await this.dataSource
      .getRepository(RefreshToken)
      .update({ tokenHash: sha256(rawToken), revokedAt: IsNull() }, { revokedAt: () => 'now()' });
  }

  private async revokeAllOnReuse(tokenHash: string): Promise<void> {
    const repo = this.dataSource.getRepository(RefreshToken);
    const token = await repo.findOneBy({ tokenHash });
    if (!token?.revokedAt) return; // unknown or merely expired: nothing to punish
    await repo.update({ userId: token.userId, revokedAt: IsNull() }, { revokedAt: () => 'now()' });
    this.logger.warn(`Refresh token reuse detected; all sessions revoked for user ${token.userId}`);
  }

  private async issueTokens(m: EntityManager, user: User): Promise<IssuedTokens> {
    const payload: AccessTokenPayload = { sub: user.id, tv: user.tokenVersion };
    const accessToken = await this.jwt.signAsync(payload);

    const refreshToken = randomBytes(32).toString('base64url');
    const ttlDays = this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true });
    const refreshExpiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
    await m.insert(RefreshToken, {
      userId: user.id,
      tokenHash: sha256(refreshToken),
      expiresAt: refreshExpiresAt,
    });
    return { accessToken, refreshToken, refreshExpiresAt };
  }
}
