import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const configured = process.env.ADMIN_API_KEY?.trim();
    if (!configured) {
      return true;
    }
    const req = context.switchToHttp().getRequest<Request>();
    const header =
      (req.headers['x-admin-key'] as string | undefined)?.trim() ??
      (req.headers['authorization'] as string | undefined)
        ?.replace(/^Bearer\s+/i, '')
        .trim();
    if (header !== configured) {
      throw new UnauthorizedException({ success: false, error: 'Admin key invalid' });
    }
    return true;
  }
}
