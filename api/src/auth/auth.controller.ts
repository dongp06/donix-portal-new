import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService, AuthUser } from './auth.service';
import { ok, fail } from '../common/api-response';

export const AUTH_COOKIE = 'donix_token';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('google')
  async googleLogin(
    @Body() body: { idToken: string; role?: 'renter' | 'provider' },
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!body?.idToken) {
      return fail('Thiếu idToken.');
    }
    try {
      const user = await this.auth.authenticate(body.idToken, body.role);
      const token = this.auth.signToken(user);
      res.cookie(AUTH_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 ngày
        path: '/',
      });
      return ok(user);
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      return fail('Đăng nhập Google thất bại.');
    }
  }

  @Get('me')
  async me(@Req() req: Request) {
    const token = (req.cookies as Record<string, string> | undefined)?.[AUTH_COOKIE];
    if (!token) return fail('Chưa đăng nhập.');
    try {
      const payload = this.auth.verifyToken(token);
      const user = await this.auth.findByEmail(payload.email);
      if (!user) return fail('Tài khoản không tồn tại.');
      return ok(user);
    } catch {
      return fail('Phiên đăng nhập không hợp lệ.');
    }
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(AUTH_COOKIE, { path: '/' });
    return ok(true);
  }
}
