import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { DataSource, IsNull, QueryFailedError } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { RefreshToken } from '../auth/refresh-token.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { removesLastActiveOwner } from './last-owner.rule';
import { Role } from './role.enum';
import { User } from './user.entity';
import { toUserResponse, UserOption, UserResponse } from './user.response';

const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class UsersService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async list(): Promise<UserResponse[]> {
    const users = await this.dataSource.getRepository(User).find({ order: { createdAt: 'ASC' } });
    return users.map(toUserResponse);
  }

  /** Active users for the assignee picker (AS4). */
  options(): Promise<UserOption[]> {
    return this.dataSource.getRepository(User).find({
      where: { isActive: true },
      select: { id: true, name: true },
      order: { name: 'ASC' },
    });
  }

  async create(dto: CreateUserDto): Promise<UserResponse> {
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const repo = this.dataSource.getRepository(User);
    try {
      const result = await repo.insert({ email: dto.email, name: dto.name, role: dto.role, passwordHash });
      const { id } = result.identifiers[0] as { id: string };
      return toUserResponse(await repo.findOneByOrFail({ id }));
    } catch (err) {
      // The unique index is the real guard; a pre-check could race with a parallel insert.
      const code = err instanceof QueryFailedError ? (err.driverError as { code?: string }).code : undefined;
      if (code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException({
          message: 'Email is already in use',
          details: [{ field: 'email', message: 'Email is already in use' }],
        });
      }
      throw err;
    }
  }

  /**
   * Disabling a user or changing their role bumps token_version and revokes their
   * refresh tokens in the same transaction, so old sessions stop at once (plan §5.2).
   */
  async update(id: string, dto: UpdateUserDto): Promise<UserResponse> {
    return this.dataSource.transaction(async (m) => {
      // Lock the active owners first, always in id order, so two owners demoting
      // each other wait in line instead of deadlocking; the second sees the first's result.
      const touchesAccess = dto.role !== undefined || dto.isActive !== undefined;
      const activeOwnerIds = touchesAccess
        ? (
            await m
              .getRepository(User)
              .createQueryBuilder('u')
              .select('u.id')
              .where('u.role = :owner AND u.isActive = true', { owner: Role.Owner })
              .orderBy('u.id')
              .setLock('pessimistic_write')
              .getMany()
          ).map((u) => u.id)
        : [];

      const user = await m.findOne(User, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!user) throw new NotFoundException('User not found');

      if (removesLastActiveOwner(user, dto, activeOwnerIds)) {
        throw new ConflictException('At least one active owner must remain');
      }

      const changes: QueryDeepPartialEntity<User> = {};
      if (dto.name !== undefined) changes.name = dto.name;
      if (dto.role !== undefined) changes.role = dto.role;
      if (dto.isActive !== undefined) changes.isActive = dto.isActive;

      const roleChanged = dto.role !== undefined && dto.role !== user.role;
      const disabled = dto.isActive === false && user.isActive;
      if (roleChanged || disabled) {
        changes.tokenVersion = () => 'token_version + 1';
        await m.update(RefreshToken, { userId: id, revokedAt: IsNull() }, { revokedAt: () => 'now()' });
      }

      if (Object.keys(changes).length > 0) await m.update(User, { id }, changes);
      return toUserResponse(await m.findOneByOrFail(User, { id }));
    });
  }
}
