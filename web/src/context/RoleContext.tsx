'use client';

import React, { createContext, useContext, useState } from 'react';
import { UserProfile, BotItem } from '@shared/types';
import { MOCK_USER, MOCK_BOTS } from '@shared/mock-data';
import { toast } from 'sonner';

interface BotContextType {
  user: UserProfile;
  bots: BotItem[];
  addNewBot: (botData: Partial<BotItem>, contact?: string) => void;
}

const BotContext = createContext<BotContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [user] = useState<UserProfile>({ ...MOCK_USER });
  const [bots, setBots] = useState<BotItem[]>([...MOCK_BOTS]);

  const addNewBot = (botData: Partial<BotItem>, contact?: string) => {
    const contactInfo = contact
      ? contact.startsWith('@')
        ? { telegram: contact }
        : { zalo: contact }
      : { zalo: '0900 000 000' };
    const newBot: BotItem = {
      id: `bot-${Date.now()}`,
      slug: (botData.title || 'new-bot').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      title: botData.title || 'Bot Tự Động Mới',
      tagline: botData.tagline || 'Giải pháp tự động hóa',
      description: botData.description || 'Chưa có mô tả',
      categorySlug: botData.categorySlug || 'messenger',
      categoryName: botData.categoryName || 'Bot Facebook Messenger',
      provider: {
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        rating: 5.0,
        totalSales: 0,
        isVerified: true,
        joinedDate: user.joinedDate,
        contact: contactInfo,
      },
      coverImage:
        botData.coverImage ||
        'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80',
      gallery: [
        botData.coverImage ||
          'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80',
      ],
      features: botData.features || ['Hỗ trợ 24/7', 'Chạy mượt mà'],
      pricing: botData.pricing || { hourly: 5000, daily: 30000, monthly: 350000 },
      status: 'online',
      totalRentals: 0,
      activeRentals: 0,
      rating: 5.0,
      reviewCount: 0,
      tags: botData.tags || ['Auto Bot'],
      licenseType: botData.licenseType || 'key',
      version: 'v1.0.0',
      systemReqs: 'Windows 10/11 64-bit',
      updatedAt: new Date().toISOString().split('T')[0],
    };

    setBots([newBot, ...bots]);
    toast.success('Đã đăng tin bot mới thành công');
  };

  return (
    <BotContext.Provider value={{ user, bots, addNewBot }}>{children}</BotContext.Provider>
  );
}

export function useRole() {
  const context = useContext(BotContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
