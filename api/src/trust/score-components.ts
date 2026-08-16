import { PrismaService } from '../prisma/prisma.service.js';

/** Một thành phần điểm uy tín — compute trả 0..1 */
export interface ScoreComponent {
  key: string;
  label: string;
  weight: number;
  compute(userId: string): Promise<number>;
}

const DAY_MS = 86400000;

export class ReviewsComponent implements ScoreComponent {
  key = 'reviews';
  label = 'Đánh giá khách hàng';
  weight = 45;
  constructor(private readonly prisma: PrismaService) {}
  async compute(userId: string): Promise<number> {
    const agg = await this.prisma.botReview.aggregate({
      where: { bot: { sellerId: userId } },
      _avg: { rating: true },
      _count: true,
    });
    const count = agg._count;
    if (count === 0) return 0;
    const avg = (agg._avg.rating ?? 0) / 5;
    const confidence = Math.min(count, 20) / 20;
    return avg * confidence;
  }
}

export class AccountAgeComponent implements ScoreComponent {
  key = 'account_age';
  label = 'Thời gian hoạt động';
  weight = 20;
  constructor(private readonly prisma: PrismaService) {}
  async compute(userId: string): Promise<number> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { joinedDate: true },
    });
    if (!u?.joinedDate) return 0;
    const ageDays = (Date.now() - new Date(u.joinedDate).getTime()) / DAY_MS;
    return Math.min(Math.max(ageDays / 365, 0), 1);
  }
}

export class ProfileComponent implements ScoreComponent {
  key = 'profile';
  label = 'Xác minh hồ sơ';
  weight = 20;
  constructor(private readonly prisma: PrismaService) {}
  async compute(userId: string): Promise<number> {
    const p = await this.prisma.sellerProfile.findUnique({
      where: { userId },
      select: { profileCompleteness: true },
    });
    if (!p) return 0;
    return p.profileCompleteness / 100;
  }
}

export class ActiveBotsComponent implements ScoreComponent {
  key = 'active_bots';
  label = 'Số bot hoạt động';
  weight = 15;
  constructor(private readonly prisma: PrismaService) {}
  async compute(userId: string): Promise<number> {
    const count = await this.prisma.bot.count({
      where: { sellerId: userId, status: 'online' },
    });
    return Math.min(count, 5) / 5;
  }
}
