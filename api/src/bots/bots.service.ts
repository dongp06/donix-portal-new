import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { TrustService } from '../trust/trust.service.js';
import { MOCK_CATEGORIES } from '../data/mock-data.js';
import { BotCategory } from '../data/types.js';
import type { Bot } from '../../prisma/generated/prisma/client.js';

/** BotItem API shape (khớp shared/types.ts) */
export interface BotItemOut {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  categorySlug: string;
  categoryName: string;
  seller: {
    id: string;
    name: string;
    avatar: string;
    rating: number;
    reputation: number;
    totalSales: number;
    isVerified: boolean;
    joinedDate: string;
    contact?: {
      zalo?: string;
      telegram?: string;
      phone?: string;
      messenger?: string;
      facebook?: string;
    };
  };
  coverImage: string;
  gallery: string[];
  features: string[];
  pricing: { hourly: number; daily: number; monthly: number };
  status: string;
  rating: number;
  reviewCount: number;
  views: number;
  tags: string[];
  version: string;
  systemReqs: string;
  updatedAt: string;
}

function safeParse<T>(value: string | null): T {
  if (!value) return [] as unknown as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return value as unknown as T;
  }
}

export function toOut(b: Bot): BotItemOut {
  const contact = {
    zalo: b.contactZalo ?? undefined,
    telegram: b.contactTelegram ?? undefined,
    phone: b.contactPhone ?? undefined,
    messenger: b.contactMessenger ?? undefined,
    facebook: b.contactFacebook ?? undefined,
  };
  const hasContact = Object.values(contact).some(Boolean);
  return {
    id: b.id,
    slug: b.slug,
    title: b.title,
    tagline: b.tagline,
    description: b.description,
    categorySlug: b.categorySlug,
    categoryName: b.categoryName,
    seller: {
      id: b.sellerId,
      name: b.sellerName,
      avatar: b.sellerAvatar,
      rating: b.sellerRating,
      reputation: Math.round(b.sellerRating * 20),
      totalSales: b.sellerSales,
      isVerified: b.sellerVerified,
      joinedDate: b.sellerJoinedDate,
      ...(hasContact ? { contact } : {}),
    },
    coverImage: b.coverImage,
    gallery: safeParse<string[]>(b.gallery),
    features: safeParse<string[]>(b.features),
    pricing: { hourly: b.priceHourly, daily: b.priceDaily, monthly: b.priceMonthly },
    status: b.status,
    rating: b.rating,
    reviewCount: b.reviewCount,
    views: b.views,
    tags: safeParse<string[]>(b.tags),
    version: b.version,
    systemReqs: b.systemReqs,
    updatedAt: b.updatedAt,
  };
}

@Injectable()
export class BotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trust: TrustService,
  ) {}

  getCategories(): BotCategory[] {
    return MOCK_CATEGORIES;
  }

  async findAll(query?: {
    category?: string;
    search?: string;
    status?: string;
    sort?: string;
  }): Promise<BotItemOut[]> {
    const where: Record<string, unknown> = {};
    if (query?.category && query.category !== 'all') {
      where.categorySlug = query.category;
    }
    if (query?.status) {
      where.status = query.status;
    }
    if (query?.search) {
      const q = query.search.toLowerCase();
      where.OR = [
        { title: { contains: q } },
        { description: { contains: q } },
        { tags: { contains: q } },
      ];
    }

    const rows = await this.prisma.bot.findMany({ where });
    let result = rows.map(toOut);
    if (query?.sort) {
      if (query.sort === 'rating') {
        result.sort((a, b) => b.rating - a.rating);
      } else if (query.sort === 'price_asc') {
        result.sort((a, b) => a.pricing.daily - b.pricing.daily);
      } else if (query.sort === 'price_desc') {
        result.sort((a, b) => b.pricing.daily - a.pricing.daily);
      } else if (query.sort === 'newest' || query.sort === 'popular') {
        result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      }
    }
    return result;
  }

  async findOne(idOrSlug: string): Promise<BotItemOut> {
    const bot = await this.prisma.bot.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    });
    if (!bot) {
      throw new NotFoundException(`Bot '${idOrSlug}' không tồn tại.`);
    }
    return toOut(bot);
  }

  /**
   * Tạo bot — seller là user thật đã đăng nhập (gắn từ controller).
   * Nếu người tạo là buyer, controller nâng họ lên seller trước khi gọi.
   */
  async create(
    botData: Partial<BotItemOut>,
    seller: {
      id: string;
      name: string;
      avatar: string;
      joinedDate: string;
      isVerified: boolean;
      contact?: Partial<Record<string, string>>;
    },
  ): Promise<BotItemOut> {
    const coverImage =
      botData.coverImage ||
      'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80';
    const c = seller.contact ?? {};
    const created = await this.prisma.bot.create({
      data: {
        id: `bot-${Date.now()}`,
        slug:
          (botData.title || 'new-bot').toLowerCase().replace(/[^a-z0-9]+/g, '-') +
          `-${Date.now().toString(36).slice(-4)}`,
        title: botData.title || 'Bot Mới Tải Lên',
        tagline: botData.tagline || '',
        description: botData.description || '',
        categorySlug: botData.categorySlug || 'messenger',
        categoryName: botData.categoryName || 'Bot Facebook Messenger',
        sellerId: seller.id,
        sellerName: seller.name,
        sellerAvatar: seller.avatar,
        sellerRating: 5.0,
        sellerSales: 0,
        sellerVerified: seller.isVerified,
        sellerJoinedDate: seller.joinedDate,
        contactZalo: c.zalo ?? null,
        contactTelegram: c.telegram ?? null,
        contactPhone: c.phone ?? null,
        contactMessenger: c.messenger ?? null,
        contactFacebook: c.facebook ?? null,
        coverImage,
        gallery: JSON.stringify(botData.gallery?.length ? botData.gallery : [coverImage]),
        features: JSON.stringify(botData.features ?? []),
        priceHourly: botData.pricing?.hourly ?? 0,
        priceDaily: botData.pricing?.daily ?? 0,
        priceMonthly: botData.pricing?.monthly ?? 0,
        status: botData.status || 'online',
        rating: 5.0,
        reviewCount: 0,
        views: 0,
        tags: JSON.stringify(botData.tags ?? []),
        version: botData.version || 'v1.0.0',
        systemReqs: botData.systemReqs || 'Windows 10/11 64-bit',
        updatedAt: new Date().toISOString().split('T')[0],
      },
    });
    return toOut(created);
  }

  async update(
    id: string,
    updateData: Partial<BotItemOut>,
    actor: { id: string; role: string },
  ): Promise<BotItemOut> {
    const existing = await this.prisma.bot.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Bot với ID '${id}' không tồn tại.`);
    }
    this.assertOwner(existing.sellerId, actor, 'sửa');
    const c = updateData.seller?.contact ?? {};
    const data: Record<string, unknown> = {
      updatedAt: new Date().toISOString().split('T')[0],
    };
    if (updateData.title !== undefined) data.title = updateData.title;
    if (updateData.tagline !== undefined) data.tagline = updateData.tagline;
    if (updateData.description !== undefined) data.description = updateData.description;
    if (updateData.categorySlug !== undefined) data.categorySlug = updateData.categorySlug;
    if (updateData.categoryName !== undefined) data.categoryName = updateData.categoryName;
    if (updateData.coverImage !== undefined) data.coverImage = updateData.coverImage;
    if (updateData.gallery !== undefined) data.gallery = JSON.stringify(updateData.gallery);
    if (updateData.features !== undefined) data.features = JSON.stringify(updateData.features);
    if (updateData.pricing !== undefined) {
      data.priceHourly = updateData.pricing.hourly;
      data.priceDaily = updateData.pricing.daily;
      data.priceMonthly = updateData.pricing.monthly;
    }
    if (updateData.status !== undefined) data.status = updateData.status;
    if (updateData.tags !== undefined) data.tags = JSON.stringify(updateData.tags);
    if (updateData.version !== undefined) data.version = updateData.version;
    if (updateData.systemReqs !== undefined) data.systemReqs = updateData.systemReqs;
    // Contact
    if (c.zalo !== undefined) data.contactZalo = c.zalo;
    if (c.telegram !== undefined) data.contactTelegram = c.telegram;
    if (c.phone !== undefined) data.contactPhone = c.phone;
    if (c.messenger !== undefined) data.contactMessenger = c.messenger;
    if (c.facebook !== undefined) data.contactFacebook = c.facebook;

    const updated = await this.prisma.bot.update({ where: { id }, data });
    return toOut(updated);
  }

  async delete(id: string, actor: { id: string; role: string }): Promise<void> {
    const existing = await this.prisma.bot.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Bot với ID '${id}' không tồn tại.`);
    }
    this.assertOwner(existing.sellerId, actor, 'xóa');
    await this.prisma.bot.delete({ where: { id } });
  }

  /** Chỉ chủ bot (sellerId khớp) hoặc admin mới được sửa/xóa */
  private assertOwner(
    sellerId: string,
    actor: { id: string; role: string },
    action: string,
  ) {
    if (actor.role === 'admin' || sellerId === actor.id) return;
    throw new ForbiddenException(
      `Bạn không có quyền ${action} bot của người khác.`,
    );
  }

  // ── Đánh giá bot ──────────────────────────────────────────────

  /** GET reviews cho bot — viewerId để đánh dấu isOwn */
  async getReviews(botId: string, viewerId: string | null) {
    const bot = await this.prisma.bot.findUnique({ where: { id: botId }, select: { id: true } });
    if (!bot) throw new NotFoundException('Bot không tồn tại.');
    const rows = await this.prisma.botReview.findMany({
      where: { botId },
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });
    return rows.map((r) => ({
      id: r.id,
      userName: r.user?.name ?? 'Người dùng',
      userAvatar: r.user?.avatar ?? '',
      rating: r.rating,
      date: r.createdAt,
      comment: r.comment,
      images: safeParse<string[]>(r.images),
      isOwn: Boolean(viewerId && r.userId === viewerId),
    }));
  }

  /** Tạo review — yêu cầu login; recalc rating bot */
  async createReview(
    botId: string,
    input: { rating: number; comment?: string; images?: string[] },
    author: { id: string; name: string; avatar: string },
  ) {
    const bot = await this.prisma.bot.findUnique({ where: { id: botId }, select: { id: true } });
    if (!bot) throw new NotFoundException('Bot không tồn tại.');
    const rating = Number(input?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('Đánh giá phải từ 1 đến 5 sao.');
    }
    const comment = (input?.comment ?? '').trim();
    if (comment.length > 1000) {
      throw new BadRequestException('Nội dung đánh giá tối đa 1000 ký tự.');
    }
    const images = Array.isArray(input?.images) ? input.images.slice(0, 5) : [];
    if ((input?.images ?? []).length > 5) {
      throw new BadRequestException('Tối đa 5 ảnh cho mỗi đánh giá.');
    }
    const id = `rv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const created = await this.prisma.botReview.create({
      data: {
        id,
        botId,
        userId: author.id,
        rating,
        comment,
        images: JSON.stringify(images),
        createdAt: new Date().toISOString().slice(0, 10),
      },
      include: { user: true },
    });
    await this.recalcBotRating(botId);
    return {
      id: created.id,
      userName: created.user?.name ?? author.name,
      userAvatar: created.user?.avatar ?? author.avatar,
      rating: created.rating,
      date: created.createdAt,
      comment: created.comment,
      images: safeParse<string[]>(created.images),
      isOwn: true,
    };
  }

  /** Sửa review — chỉ chủ */
  async updateReview(botId: string, reviewId: string, input: any, actor: { id: string }) {
    const review = await this.prisma.botReview.findUnique({
      where: { id: reviewId, botId },
    });
    if (!review) throw new NotFoundException('Đánh giá không tồn tại.');
    if (review.userId !== actor.id) {
      throw new ForbiddenException('Bạn chỉ có thể sửa đánh giá của mình.');
    }
    const data: Record<string, unknown> = {};
    if (input?.rating !== undefined) {
      const rating = Number(input.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new BadRequestException('Đánh giá phải từ 1 đến 5 sao.');
      }
      data.rating = rating;
    }
    if (input?.comment !== undefined) {
      const comment = (input.comment ?? '').trim();
      if (comment.length > 1000) {
        throw new BadRequestException('Nội dung đánh giá tối đa 1000 ký tự.');
      }
      data.comment = comment;
    }
    if (input?.images !== undefined) {
      const images = Array.isArray(input.images) ? input.images.slice(0, 5) : [];
      data.images = JSON.stringify(images);
    }
    const updated = await this.prisma.botReview.update({
      where: { id: reviewId },
      data,
      include: { user: true },
    });
    await this.recalcBotRating(botId);
    return {
      id: updated.id,
      userName: updated.user?.name ?? 'Người dùng',
      userAvatar: updated.user?.avatar ?? '',
      rating: updated.rating,
      date: updated.createdAt,
      comment: updated.comment,
      images: safeParse<string[]>(updated.images),
      isOwn: true,
    };
  }

  /** Xóa review — chỉ chủ; recalc rating bot */
  async deleteReview(botId: string, reviewId: string, actor: { id: string }) {
    const review = await this.prisma.botReview.findUnique({
      where: { id: reviewId, botId },
    });
    if (!review) throw new NotFoundException('Đánh giá không tồn tại.');
    if (review.userId !== actor.id) {
      throw new ForbiddenException('Bạn chỉ có thể xóa đánh giá của mình.');
    }
    await this.prisma.botReview.delete({ where: { id: reviewId } });
    await this.recalcBotRating(botId);
    return true;
  }

  /** Tính lại rating = AVG(rating), reviewCount = COUNT; sau đó recalc trust cho seller */
  private async recalcBotRating(botId: string) {
    const agg = await this.prisma.botReview.aggregate({
      where: { botId },
      _avg: { rating: true },
      _count: true,
    });
    await this.prisma.bot.update({
      where: { id: botId },
      data: {
        rating: agg._avg.rating ?? 5,
        reviewCount: agg._count,
      },
    });
    const bot = await this.prisma.bot.findUnique({
      where: { id: botId },
      select: { sellerId: true },
    });
    if (bot) await this.trust.applyReview(bot.sellerId);
  }
}
