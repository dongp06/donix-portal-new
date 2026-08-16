import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { TrustScoreService } from './trust-score.service.js';
import {
  SellerTier,
  SellerTrustEvent,
  SellerTrustEventType,
  TrustChecklistItem,
  TrustStatus,
} from '../shared/types.js';
import type { TrustScoreInfo } from './trust-score.service.js';

export type VerificationStatus =
  | 'pending'
  | 'approved'
  | 'under_review'
  | 'rejected'
  | 'expired';

const TIER_MIN_ACCOUNT_DAYS = 30;
const TIER_MIN_REVIEWS = 5;
const TIER_MIN_RATING = 4.5;
const TIER_MIN_SCORE = 75;
const TIER_MIN_PROFILE = 80;
const TOP_MIN_REVIEWS = 25;
const TOP_MIN_RATING = 4.7;
const TOP_RANK_LIMIT = 10;

interface SellerCounts {
  reviewCount: number;
  avgRating: number;
  botCount: number;
  onlineBotCount: number;
}

@Injectable()
export class TrustService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly score: TrustScoreService,
  ) {}

  private async getCounts(userId: string): Promise<SellerCounts> {
    const [reviewAgg, botAgg] = await Promise.all([
      this.prisma.botReview.aggregate({
        where: { bot: { sellerId: userId } },
        _avg: { rating: true },
        _count: true,
      }),
      this.prisma.bot.aggregate({
        where: { sellerId: userId },
        _count: true,
      }),
    ]);
    const online = await this.prisma.bot.count({
      where: { sellerId: userId, status: 'online' },
    });
    return {
      reviewCount: reviewAgg._count,
      avgRating: reviewAgg._avg.rating ?? 0,
      botCount: botAgg._count,
      onlineBotCount: online,
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- interface yêu cầu Promise<number>
  async computeProfileCompleteness(profile: {
    shopName: string | null;
    bio: string | null;
    avatar: string | null;
    banner: string | null;
    contact: Record<string, string>;
  }): Promise<number> {
    let score = 0;
    if (profile.shopName) score += 20;
    if (profile.bio) score += 15;
    if (profile.avatar) score += 15;
    if (profile.banner) score += 10;
    const contactCount = Object.values(profile.contact ?? {}).filter(
      Boolean,
    ).length;
    if (contactCount >= 1) score += 20;
    if (contactCount >= 2) score += 20;
    return score;
  }

  async getOrCreateProfile(userId: string) {
    let profile = await this.prisma.sellerProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException('Người dùng không tồn tại.');
      const baseSlug =
        user.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'seller';
      const existing = await this.prisma.sellerProfile.findFirst({
        where: { slug: { startsWith: baseSlug } },
        orderBy: { slug: 'desc' },
      });
      const slug = existing
        ? `${baseSlug}-${Date.now().toString(36).slice(-4)}`
        : baseSlug;
      profile = await this.prisma.sellerProfile.create({
        data: {
          id: `sp-${Date.now()}`,
          userId,
          shopName: user.name,
          slug,
          updatedAt: new Date().toISOString(),
        },
      });
    }
    return profile;
  }

  async computeTier(
    userId: string,
    score: number,
    counts: SellerCounts,
  ): Promise<SellerTier> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { joinedDate: true, tier: true },
    });
    if (!user) return 'new';
    const ageDays =
      (Date.now() - new Date(user.joinedDate).getTime()) / 86400000;
    // trusted chỉ khi có verification approved còn hạn
    const activeVerification = await this.prisma.trustVerification.findFirst({
      where: {
        userId,
        status: 'approved',
        expiresAt: { gte: new Date().toISOString() },
      },
    });
    const isTrusted = Boolean(activeVerification);
    if (!isTrusted) {
      if (
        ageDays >= TIER_MIN_ACCOUNT_DAYS &&
        counts.botCount >= 1 &&
        counts.reviewCount >= 1
      )
        return 'active';
      return 'new';
    }
    const topEligible =
      counts.avgRating >= TOP_MIN_RATING &&
      counts.reviewCount >= TOP_MIN_REVIEWS &&
      score >= TIER_MIN_SCORE;
    if (topEligible) {
      const ranked = await this.prisma.user.findMany({
        where: { role: 'seller', tier: 'trusted' },
        orderBy: { trustScore: 'desc' },
        select: { id: true, trustScore: true },
        take: TOP_RANK_LIMIT + 1,
      });
      const myRank = ranked.findIndex((r) => r.id === userId);
      if (myRank >= 0 && myRank < TOP_RANK_LIMIT) return 'top';
    }
    return 'trusted';
  }

  async syncBotSnapshots(userId: string) {
    const [user, profile, verification] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, avatar: true, isVerified: true },
      }),
      this.prisma.sellerProfile.findUnique({ where: { userId } }),
      this.prisma.trustVerification.findFirst({
        where: {
          userId,
          status: 'approved',
          expiresAt: { gte: new Date().toISOString() },
        },
      }),
    ]);
    if (!user) return;
    await this.prisma.bot.updateMany({
      where: { sellerId: userId },
      data: {
        sellerName: profile?.shopName || user.name,
        sellerAvatar: profile?.avatar || user.avatar,
        sellerVerified: Boolean(verification),
        sellerSlug: profile?.slug || '',
      },
    });
  }

  async recompute(userId: string) {
    const info = await this.score.computeAll(userId);
    const counts = await this.getCounts(userId);
    const tier = await this.computeTier(userId, info.score, counts);
    const prev = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { tier: true },
    });
    if (prev && prev.tier !== tier) {
      await this.prisma.trustEvent.create({
        data: {
          id: `te-${Date.now()}`,
          userId,
          type: 'tier_changed',
          detail: JSON.stringify({ from: prev.tier, to: tier }),
          createdAt: new Date().toISOString(),
        },
      });
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        trustScore: info.score,
        trustScoreUpdatedAt: new Date().toISOString(),
        tier,
      },
    });
    await this.syncBotSnapshots(userId);
    return { score: info.score, tier, breakdown: info.breakdown };
  }

  async getChecklist(userId: string): Promise<TrustChecklistItem[]> {
    const [user, counts, profile, scoreInfo] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { joinedDate: true },
      }),
      this.getCounts(userId),
      this.getOrCreateProfile(userId),
      this.score.computeAll(userId),
    ]);
    const ageDays = Math.floor(
      (Date.now() - new Date(user?.joinedDate ?? Date.now()).getTime()) /
        86400000,
    );
    return [
      {
        key: 'account_age',
        label: 'Tài khoản hoạt động ít nhất 30 ngày',
        passed: ageDays >= TIER_MIN_ACCOUNT_DAYS,
        current: `${ageDays} ngày`,
        required: '30 ngày',
      },
      {
        key: 'reviews',
        label: 'Ít nhất 5 đánh giá hợp lệ',
        passed: counts.reviewCount >= TIER_MIN_REVIEWS,
        current: `${counts.reviewCount} đánh giá`,
        required: '5 đánh giá',
      },
      {
        key: 'rating',
        label: 'Rating trung bình ≥ 4.5',
        passed: counts.avgRating >= TIER_MIN_RATING,
        current: `${counts.avgRating.toFixed(1)}/5`,
        required: '4.5/5',
      },
      {
        key: 'profile',
        label: 'Hồ sơ hoàn thiện ≥ 80%',
        passed: profile.profileCompleteness >= TIER_MIN_PROFILE,
        current: `${profile.profileCompleteness}%`,
        required: '80%',
      },
      {
        key: 'trust_score',
        label: 'Điểm uy tín ≥ 75',
        passed: scoreInfo.score >= TIER_MIN_SCORE,
        current: `${scoreInfo.score}/100`,
        required: '75/100',
      },
    ];
  }

  async getStatus(userId: string): Promise<TrustStatus> {
    const latest = await this.prisma.trustVerification.findFirst({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
    });
    if (!latest) return { status: 'none', canCancel: false };
    return {
      status: latest.status as TrustStatus['status'],
      submittedAt: latest.submittedAt,
      reviewedAt: latest.reviewedAt ?? undefined,
      expiresAt: latest.expiresAt ?? undefined,
      note: latest.note ?? undefined,
      canCancel: latest.status === 'pending',
    };
  }

  async submitVerification(userId: string, note?: string) {
    const checklist = await this.getChecklist(userId);
    if (!checklist.every((c) => c.passed)) {
      throw new BadRequestException('Bạn chưa đáp ứng đủ điều kiện xác minh.');
    }
    const status = await this.getStatus(userId);
    if (status.status === 'pending' || status.status === 'approved') {
      throw new BadRequestException('Đã có hồ sơ xác minh đang xử lý.');
    }
    await this.prisma.trustVerification.create({
      data: {
        id: `tv-${Date.now()}`,
        userId,
        status: 'pending',
        note: note ?? null,
        submittedAt: new Date().toISOString(),
      },
    });
    await this.prisma.trustEvent.create({
      data: {
        id: `te-${Date.now()}`,
        userId,
        type: 'verification_submitted',
        detail: '{}',
        createdAt: new Date().toISOString(),
      },
    });
    return this.getStatus(userId);
  }

  /** Cập nhật hồ sơ seller + tính lại profileCompleteness + recompute trust score */
  async updateProfile(
    userId: string,
    body: {
      shopName?: string;
      bio?: string;
      avatar?: string;
      banner?: string;
      contact?: Record<string, string>;
    },
  ) {
    await this.getOrCreateProfile(userId);
    const data: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (body.shopName !== undefined) data.shopName = String(body.shopName);
    if (body.bio !== undefined) data.bio = body.bio === '' ? null : String(body.bio);
    if (body.avatar !== undefined) data.avatar = body.avatar === '' ? null : String(body.avatar);
    if (body.banner !== undefined) data.banner = body.banner === '' ? null : String(body.banner);
    if (body.contact === null) {
      data.contact = '{}';
    } else if (body.contact && typeof body.contact === 'object') {
      data.contact = JSON.stringify(body.contact);
    }
    const updated = await this.prisma.sellerProfile.update({ where: { userId }, data });
    const parsedContact = updated.contact ? (JSON.parse(updated.contact) as Record<string, string>) : {};
    const completeness = await this.computeProfileCompleteness({
      shopName: updated.shopName,
      bio: updated.bio,
      avatar: updated.avatar,
      banner: updated.banner,
      contact: parsedContact,
    });
    await this.prisma.sellerProfile.update({
      where: { userId },
      data: { profileCompleteness: completeness },
    });
    await this.recompute(userId);
    return this.prisma.sellerProfile.findUnique({ where: { userId } });
  }

  async expireOverdue() {
    const now = new Date().toISOString();
    const overdue = await this.prisma.trustVerification.findMany({
      where: { status: 'approved', expiresAt: { lt: now } },
    });
    for (const v of overdue) {
      await this.prisma.trustVerification.update({
        where: { id: v.id },
        data: { status: 'expired' },
      });
      await this.prisma.user.update({
        where: { id: v.userId },
        data: { isVerified: false },
      });
      await this.prisma.trustEvent.create({
        data: {
          id: `te-${Date.now()}`,
          userId: v.userId,
          type: 'verification_expired',
          detail: '{}',
          createdAt: now,
        },
      });
      await this.recompute(v.userId);
    }
    return overdue.length;
  }

  async getTimeline(userId: string): Promise<SellerTrustEvent[]> {
    const rows = await this.prisma.trustEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      type: r.type as SellerTrustEventType,
      detail: r.detail
        ? (JSON.parse(r.detail) as Record<string, unknown>)
        : undefined,
      createdAt: r.createdAt,
    }));
  }

  async getScoreBreakdown(userId: string): Promise<TrustScoreInfo> {
    const info = await this.score.computeAll(userId);
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { trustScoreUpdatedAt: true },
    });
    return { ...info, updatedAt: u?.trustScoreUpdatedAt ?? undefined };
  }

  /** Gọi lại sau khi review thay đổi (từ BotsService) */
  async applyReview(userId: string) {
    return this.recompute(userId);
  }

  /** Cho cron: tính lại score + tier cho tất cả seller */
  async recomputeAll() {
    const sellers = await this.prisma.user.findMany({
      where: { role: 'seller' },
      select: { id: true },
    });
    for (const s of sellers) {
      await this.recompute(s.id);
    }
    return sellers.length;
  }
}
