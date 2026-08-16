import { Controller, Patch, Body, Req } from '@nestjs/common';
import type { Request } from 'express';
import { UsersService } from './users.service.js';
import { AuthService } from '../auth/auth.service.js';
import { requireUser } from '../auth/current-user.js';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly auth: AuthService,
  ) {}

  /** Sửa hồ sơ của chính mình (bio + liên hệ) */
  @Patch('me')
  async updateMe(
    @Body() body: { bio?: string; contact?: Record<string, string> },
    @Req() req: Request,
  ) {
    const user = await requireUser(req, this.auth);
    const updated = await this.usersService.updateMe(user.id, {
      bio: body?.bio,
      contact: body?.contact,
    });
    return { success: true, data: updated };
  }
}
