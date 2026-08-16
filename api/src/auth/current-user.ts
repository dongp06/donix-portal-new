import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, AuthUser } from './auth.service.js';
import { AUTH_COOKIE } from './auth.controller.js';

/** Đọc user từ cookie đăng nhập — trả null nếu chưa đăng nhập hoặc token sai */
export async function getCurrentUser(
  req: Request,
  auth: AuthService,
): Promise<AuthUser | null> {
  const token = (req.cookies as Record<string, string> | undefined)?.[AUTH_COOKIE];
  if (!token) return null;
  try {
    const payload = auth.verifyToken(token);
    return await auth.findByEmail(payload.email);
  } catch {
    return null;
  }
}

/** Yêu cầu đăng nhập — throw 401 nếu chưa */
export async function requireUser(
  req: Request,
  auth: AuthService,
): Promise<AuthUser> {
  const user = await getCurrentUser(req, auth);
  if (!user) {
    throw new UnauthorizedException(
      'Bạn cần đăng nhập để thực hiện thao tác này.',
    );
  }
  return user;
}
