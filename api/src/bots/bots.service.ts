import { Injectable, NotFoundException } from '@nestjs/common';
import { MOCK_BOTS, MOCK_CATEGORIES } from '../data/mock-data';
import { BotItem, BotCategory } from '../data/types';

@Injectable()
export class BotsService {
  private bots: BotItem[] = [...MOCK_BOTS];

  getCategories(): BotCategory[] {
    return MOCK_CATEGORIES;
  }

  findAll(query?: { category?: string; search?: string; status?: string; sort?: string }): BotItem[] {
    let result = [...this.bots];

    if (query?.category && query.category !== 'all') {
      result = result.filter((b) => b.categorySlug === query.category);
    }

    if (query?.status) {
      result = result.filter((b) => b.status === query.status);
    }

    if (query?.search) {
      const q = query.search.toLowerCase();
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q) ||
          b.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

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

  findOne(idOrSlug: string): BotItem {
    const bot = this.bots.find((b) => b.id === idOrSlug || b.slug === idOrSlug);
    if (!bot) {
      throw new NotFoundException(`Bot '${idOrSlug}' không tồn tại.`);
    }
    return bot;
  }

  create(botData: Partial<BotItem>): BotItem {
    const newBot: BotItem = {
      id: `bot-${Date.now()}`,
      slug: (botData.title || 'new-bot').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      title: botData.title || 'Bot Mới Tải Lên',
      tagline: botData.tagline || 'Tự động hóa thông minh',
      description: botData.description || 'Chưa có mô tả chi tiết',
      categorySlug: botData.categorySlug || 'tools',
      categoryName: botData.categoryName || 'Công cụ & Tiện ích',
      provider: botData.provider || {
        id: 'prov-01',
        name: 'DevNguyen_Pro',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        rating: 4.9,
        totalSales: 1420,
        isVerified: true,
        joinedDate: '2024-03-15'
      },
      coverImage: botData.coverImage || 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80',
      gallery: botData.gallery || ['https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80'],
      features: botData.features || ['Tự động hóa 24/7', 'Hỗ trợ kỹ thuật'],
      pricing: botData.pricing || { hourly: 5000, daily: 30000, monthly: 350000 },
      status: botData.status || 'online',
      totalRentals: 0,
      activeRentals: 0,
      rating: 5.0,
      reviewCount: 0,
      tags: botData.tags || ['Auto Bot'],
      licenseType: botData.licenseType || 'key',
      version: botData.version || 'v1.0.0',
      systemReqs: botData.systemReqs || 'Windows 10/11 64-bit',
      updatedAt: new Date().toISOString().split('T')[0]
    };

    this.bots.unshift(newBot);
    return newBot;
  }

  update(id: string, updateData: Partial<BotItem>): BotItem {
    const index = this.bots.findIndex((b) => b.id === id);
    if (index === -1) {
      throw new NotFoundException(`Bot với ID '${id}' không tồn tại.`);
    }
    this.bots[index] = { ...this.bots[index], ...updateData, updatedAt: new Date().toISOString().split('T')[0] };
    return this.bots[index];
  }
}
