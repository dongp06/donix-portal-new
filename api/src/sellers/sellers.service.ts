import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { User } from '../../prisma/generated/prisma/client.js';
import { toOut as botToOut } from '../bots/bots.service.js';
import { toOut as postToOut } from '../community/community.service.js';

function safeParse<T>(value: string | null): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

/** User công khai trên trang seller — kèm rating/sales tổng hợp */
function userToOut(u: User, rating: number, sales: number) {
  return {
    id: u.id,
    name: u.name,
    avatar: u.avatar,
    role: u.role,
    isVerified: u.isVerified,
    bio: u.bio ?? undefined,
    joinedDate: u.joinedDate,
    contact: safeParse<Record<string, string>>(u.contact),
    rating,
    sales,
  };
}

@Injectable()
export class SellersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Hồ sơ seller công khai: user + bots + forum posts đã đăng */
  async getProfile(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Hồ sơ người bán không tồn tại.');
    }

    const [botRows, postRows] = await Promise.all([
      this.prisma.bot.findMany({
        where: { sellerId: id },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.forumPost.findMany({
        where: { authorId: id },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    const bots = botRows.map(botToOut);
    const rating = bots.reduce((m, b) => Math.max(m, b.rating), 0);
    const sales = bots.reduce((sum, b) => sum + b.seller.totalSales, 0);

    return {
      user: userToOut(user, rating, sales),
      bots,
      posts: postRows.map(postToOut),
    };
  }
}
