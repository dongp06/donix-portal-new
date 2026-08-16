import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../common/admin.guard.js';
import { ok } from '../common/api-response.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TrustService } from './trust.service.js';

@Controller('admin/verifications')
@UseGuards(AdminGuard)
export class AdminVerificationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trust: TrustService,
  ) {}

  @Get()
  async list(@Query('status') status?: string) {
    const where = status ? { status } : {};
    const rows = await this.prisma.trustVerification.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            joinedDate: true,
            trustScore: true,
          },
        },
      },
    });
    const data = await Promise.all(
      rows.map(async (r) => {
        const reviewAgg = await this.prisma.botReview.aggregate({
          where: { bot: { sellerId: r.userId } },
          _avg: { rating: true },
          _count: true,
        });
        return {
          id: r.id,
          userId: r.userId,
          status: r.status,
          submittedAt: r.submittedAt,
          reviewedAt: r.reviewedAt ?? undefined,
          expiresAt: r.expiresAt ?? undefined,
          note: r.note ?? undefined,
          user: {
            id: r.user.id,
            name: r.user.name,
            email: r.user.email,
            avatar: r.user.avatar,
            joinedDate: r.user.joinedDate,
          },
          trustScore: r.user.trustScore,
          reviewCount: reviewAgg._count,
          avgRating: reviewAgg._avg.rating ?? 0,
        };
      }),
    );
    return ok(data);
  }

  @Patch(':id')
  async review(
    @Param('id') id: string,
    @Body() body: { action: 'approve' | 'reject'; note?: string },
  ) {
    const v = await this.prisma.trustVerification.findUnique({ where: { id } });
    if (!v) {
      throw new NotFoundException('Hồ sơ xác minh không tồn tại.');
    }
    if (body?.action !== 'approve' && body?.action !== 'reject') {
      throw new BadRequestException('Thiếu action (approve/reject).');
    }
    const now = new Date().toISOString();
    if (body.action === 'approve') {
      if (v.status !== 'pending') {
        throw new BadRequestException('Hồ sơ không ở trạng thái pending.');
      }
      const expiresAt = new Date(Date.now() + 180 * 86400000).toISOString();
      await this.prisma.trustVerification.update({
        where: { id },
        data: {
          status: 'approved',
          reviewedAt: now,
          reviewedBy: 'admin',
          expiresAt,
          note: body.note ?? v.note,
        },
      });
      await this.prisma.user.update({
        where: { id: v.userId },
        data: { isVerified: true },
      });
      await this.prisma.trustEvent.create({
        data: {
          id: `te-${Date.now()}`,
          userId: v.userId,
          type: 'verification_approved',
          detail: JSON.stringify({ expiresAt }),
          createdAt: now,
        },
      });
      await this.trust.recompute(v.userId);
    } else {
      if (v.status !== 'pending' && v.status !== 'under_review') {
        throw new BadRequestException('Hồ sơ không ở trạng thái xử lý.');
      }
      await this.prisma.trustVerification.update({
        where: { id },
        data: {
          status: 'rejected',
          reviewedAt: now,
          reviewedBy: 'admin',
          note: body.note ?? v.note,
        },
      });
      await this.prisma.user.update({
        where: { id: v.userId },
        data: { isVerified: false },
      });
      await this.prisma.trustEvent.create({
        data: {
          id: `te-${Date.now()}`,
          userId: v.userId,
          type: 'verification_rejected',
          detail: JSON.stringify({ note: body.note ?? '' }),
          createdAt: now,
        },
      });
      await this.trust.recompute(v.userId);
    }
    return ok(await this.prisma.trustVerification.findUnique({ where: { id } }));
  }
}
