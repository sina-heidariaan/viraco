import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CookieOptions, Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { EnvironmentVariables } from '../../config/env.validation';
import { ACCESS_COOKIE, AuthUser, REFRESH_COOKIE } from './auth-user';
import { AuthService, IssuedTokens } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<AuthUser> {
    const { user, tokens } = await this.auth.login(dto.email, dto.password);
    this.setAuthCookies(res, tokens);
    return user;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthUser> {
    try {
      const { user, tokens } = await this.auth.refresh(this.readRefreshCookie(req));
      this.setAuthCookies(res, tokens);
      return user;
    } catch (err) {
      this.clearAuthCookies(res);
      throw err;
    }
  }

  /** Public so a user whose access token already expired can still log out. */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(this.readRefreshCookie(req));
    this.clearAuthCookies(res);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }

  private readRefreshCookie(req: Request): string | undefined {
    const value: unknown = req.cookies?.[REFRESH_COOKIE];
    return typeof value === 'string' && value !== '' ? value : undefined;
  }

  private cookieOptions(): { access: CookieOptions; refresh: CookieOptions } {
    const secure = this.config.get('COOKIE_SECURE', { infer: true });
    return {
      access: { httpOnly: true, secure, sameSite: 'lax', path: '/' },
      refresh: {
        httpOnly: true,
        secure,
        sameSite: 'strict',
        path: this.config.get('REFRESH_COOKIE_PATH', { infer: true }),
      },
    };
  }

  private setAuthCookies(res: Response, tokens: IssuedTokens): void {
    const { access, refresh } = this.cookieOptions();
    const accessTtlMs = this.config.get('JWT_ACCESS_TTL_SECONDS', { infer: true }) * 1000;
    res.cookie(ACCESS_COOKIE, tokens.accessToken, { ...access, maxAge: accessTtlMs });
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, { ...refresh, expires: tokens.refreshExpiresAt });
  }

  private clearAuthCookies(res: Response): void {
    const { access, refresh } = this.cookieOptions();
    res.clearCookie(ACCESS_COOKIE, access);
    res.clearCookie(REFRESH_COOKIE, refresh);
  }
}
