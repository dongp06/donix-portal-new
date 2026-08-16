import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { User } from '../../prisma/generated/prisma/client.js';
import { TrustService } from '../trust/trust.service.js';
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

/** User công khai trên trang seller — kèm trust */
function userToOut(u: User, trust: { score: number; tier: string; slug: string; verifiedAt?: string }) {
  return {
    id: u.id,
    name: u.name,
    avatar: u.avatar,
    role: u.role,
    isVerified: u.isVerified,
    bio: u.bio ?? undefined,
    joinedDate: u.joinedDate,
    contact: safeParse<Record<string, string>>(u.contact),
    trustScore: trust.score,
    tier: trust.tier,
    slug: trust.slug,
    verifiedAt: trust.verifiedAt,
  };
}

@Injectable()
export class SellersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trust: TrustService,
  ) {}

  /** Tìm user theo id hoặc slug của SellerProfile */
  async findUserByIdentifier(identifier: string): Promise<User> {
    const byId = await this.prisma.user.findUnique({ where: { id: identifier } });
    if (byId) return byId;
    const profile = await this.prisma.sellerProfile.findUnique({ where: { slug: identifier } });
    if (profile) {
      const u = await this.prisma.user.findUnique({ where: { id: profile.userId } });
      if (u) return u;
    }
    throw new NotFoundException('Hồ sơ người bán không tồn tại.');
  }

  /** Hồ sơ seller công khai: user + bots + forum posts + trust */
  async getProfile(identifier: string) {
    const user = await this.findUserByIdentifier(identifier);
    const [botRows, postRows, profile, timeline, verifiedAt] = await Promise.all([
      this.prisma.bot.findMany({ where: { sellerId: user.id }, orderBy: { updatedAt: 'desc' } }),
      this.prisma.forumPost.findMany({ where: { authorId: user.id }, orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }] }),
      this.prisma.sellerProfile.findUnique({ where: { userId: user.id } }),
      this.trust.getTimeline(user.id),
      this.trust.getStatus(user.id).then((s) => (s.status === 'approved' ? s.expiresAt : undefined)),
    ]);

    const bots = botRows.map(botToOut);

    return {
      user: userToOut(user, {
        score: user.trustScore,
        tier: user.tier,
        slug: profile?.slug ?? '',
        verifiedAt,
      }),
      bots,
      posts: postRows.map(postToOut),
      trustEvents: timeline,
    };
  }
}
