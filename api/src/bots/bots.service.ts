import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MOCK_CATEGORIES } from '../data/mock-data';
import { BotCategory } from '../data/types';
import type { Bot } from '@prisma/client';

/** BotItem API shape (khớp shared/types.ts) */
export interface BotItemOut {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  categorySlug: string;
  categoryName: string;
  provider: {
    id: string;
    name: string;
    avatar: string;
    rating: number;
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
  totalRentals: number;
  activeRentals: number;
  rating: number;
  reviewCount: number;
  tags: string[];
  licenseType: string;
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

function toOut(b: Bot): BotItemOut {
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
    provider: {
      id: b.providerId,
      name: b.providerName,
      avatar: b.providerAvatar,
      rating: b.providerRating,
      totalSales: b.providerSales,
      isVerified: b.providerVerified,
      joinedDate: b.providerJoinedDate,
      ...(hasContact ? { contact } : {}),
    },
    coverImage: b.coverImage,
    gallery: safeParse<string[]>(b.gallery),
    features: safeParse<string[]>(b.features),
    pricing: { hourly: b.priceHourly, daily: b.priceDaily, monthly: b.priceMonthly },
    status: b.status,
    totalRentals: b.totalRentals,
    activeRentals: b.activeRentals,
    rating: b.rating,
    reviewCount: b.reviewCount,
    tags: safeParse<string[]>(b.tags),
    licenseType: b.licenseType,
    version: b.version,
    systemReqs: b.systemReqs,
    updatedAt: b.updatedAt,
  };
}

@Injectable()
export class BotsService {
  constructor(private readonly prisma: PrismaService) {}

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
      if (query.sort === 'popular') {
        result.sort((a, b) => b.totalRentals - a.totalRentals);
      } else if (query.sort === 'rating') {
        result.sort((a, b) => b.rating - a.rating);
      } else if (query.sort === 'price_asc') {
        result.sort((a, b) => a.pricing.daily - b.pricing.daily);
      } else if (query.sort === 'price_desc') {
        result.sort((a, b) => b.pricing.daily - a.pricing.daily);
      } else if (query.sort === 'newest') {
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

  async create(botData: Partial<BotItemOut>): Promise<BotItemOut> {
    const provider = botData.provider ?? {
      id: 'prov-01',
      name: 'DevNguyen_Pro',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      rating: 4.9,
      totalSales: 1420,
      isVerified: true,
      joinedDate: '2024-03-15',
    };
    const coverImage =
      botData.coverImage ||
      'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80';
    const c = provider.contact ?? {};
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
        providerId: provider.id,
        providerName: provider.name,
        providerAvatar: provider.avatar,
        providerRating: provider.rating,
        providerSales: provider.totalSales,
        providerVerified: provider.isVerified,
        providerJoinedDate: provider.joinedDate,
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
        totalRentals: 0,
        activeRentals: 0,
        rating: 5.0,
        reviewCount: 0,
        tags: JSON.stringify(botData.tags ?? []),
        licenseType: botData.licenseType || 'key',
        version: botData.version || 'v1.0.0',
        systemReqs: botData.systemReqs || 'Windows 10/11 64-bit',
        updatedAt: new Date().toISOString().split('T')[0],
      },
    });
    return toOut(created);
  }

  async update(id: string, updateData: Partial<BotItemOut>): Promise<BotItemOut> {
    const existing = await this.prisma.bot.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Bot với ID '${id}' không tồn tại.`);
    }
    const c = updateData.provider?.contact ?? {};
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
    if (updateData.licenseType !== undefined) data.licenseType = updateData.licenseType;
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

  async delete(id: string): Promise<void> {
    const existing = await this.prisma.bot.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Bot với ID '${id}' không tồn tại.`);
    }
    await this.prisma.bot.delete({ where: { id } });
  }
}
