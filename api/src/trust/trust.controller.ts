import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service.js';
import { requireUser } from '../auth/current-user.js';
import { ok } from '../common/api-response.js';
import { TrustService } from './trust.service.js';

@Controller('sellers/me')
export class TrustController {
  constructor(
    private readonly trust: TrustService,
    private readonly auth: AuthService,
  ) {}

  @Put('profile')
  async updateProfile(@Body() body: any, @Req() req: Request) {
    const user = await requireUser(req, this.auth);
    const profile = await this.trust.updateProfile(user.id, {
      shopName: body?.shopName,
      bio: body?.bio,
      avatar: body?.avatar,
      banner: body?.banner,
      contact: body?.contact,
    });
    return ok({
      id: profile?.id,
      userId: profile?.userId,
      shopName: profile?.shopName,
      slug: profile?.slug,
      bio: profile?.bio ?? undefined,
      avatar: profile?.avatar ?? undefined,
      banner: profile?.banner ?? undefined,
      contact: profile?.contact
        ? (JSON.parse(profile.contact) as Record<string, string>)
        : undefined,
      profileCompleteness: profile?.profileCompleteness,
    });
  }

  @Get('trust-status')
  async trustStatus(@Req() req: Request) {
    const user = await requireUser(req, this.auth);
    const [status, checklist, score, recomputed] = await Promise.all([
      this.trust.getStatus(user.id),
      this.trust.getChecklist(user.id),
      this.trust.getScoreBreakdown(user.id),
      this.trust.recompute(user.id),
    ]);
    return ok({ status, checklist, score, tier: recomputed.tier });
  }

  @Post('verification')
  async submitVerification(
    @Body() body: { note?: string },
    @Req() req: Request,
  ) {
    const user = await requireUser(req, this.auth);
    if (user.role !== 'seller') {
      throw new ForbiddenException('Chỉ seller mới nộp hồ sơ xác minh.');
    }
    return ok(await this.trust.submitVerification(user.id, body?.note));
  }
}
