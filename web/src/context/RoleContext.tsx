'use client';

import React, { createContext, useContext, useState } from 'react';
import { UserRole, UserProfile, WalletInfo, BotRental, BotItem, RentalPlan } from '@shared/types';
import { MOCK_USER, MOCK_WALLET, MOCK_RENTALS, MOCK_BOTS } from '@shared/mock-data';
import { toast } from 'sonner';

interface RoleContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  toggleRole: () => void;
  user: UserProfile;
  wallet: WalletInfo;
  rentals: BotRental[];
  bots: BotItem[];
  rentBot: (botId: string, plan: RentalPlan, duration: number) => boolean;
  renewRental: (rentalId: string, duration: number) => boolean;
  depositWallet: (amount: number, method: string) => void;
  addNewBot: (botData: Partial<BotItem>) => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<UserRole>('renter');
  const [user, setUser] = useState<UserProfile>({ ...MOCK_USER, role: 'renter' });
  const [wallet, setWallet] = useState<WalletInfo>({ ...MOCK_WALLET });
  const [rentals, setRentals] = useState<BotRental[]>([...MOCK_RENTALS]);
  const [bots, setBots] = useState<BotItem[]>([...MOCK_BOTS]);

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    setUser((prev) => ({ ...prev, role: newRole }));
    toast.success(`Đã chuyển sang ${newRole === 'provider' ? 'Chế độ Nhà Cung Cấp Bot (Cho thuê)' : 'Chế độ Khách Thuê Bot'}`);
  };

  const toggleRole = () => {
    setRole(role === 'renter' ? 'provider' : 'renter');
  };

  const rentBot = (botId: string, plan: RentalPlan, duration: number): boolean => {
    const targetBot = bots.find((b) => b.id === botId);
    if (!targetBot) {
      toast.error('Không tìm thấy bot!');
      return false;
    }

    const pricePerUnit = targetBot.pricing[plan] || targetBot.pricing.daily;
    const totalCost = pricePerUnit * duration;

    if (wallet.balance < totalCost) {
      toast.error(`Số dư ví không đủ! Cần ${totalCost.toLocaleString('vi-VN')} VNĐ (Hiện có: ${wallet.balance.toLocaleString('vi-VN')} VNĐ)`);
      return false;
    }

    // Deduct balance
    const updatedBalance = wallet.balance - totalCost;
    setWallet({
      ...wallet,
      balance: updatedBalance,
      transactions: [
        {
          id: `tx-${Date.now()}`,
          type: 'rental_payment',
          amount: -totalCost,
          description: `Thuê ${targetBot.title} (Gói ${plan === 'hourly' ? 'Giờ' : plan === 'daily' ? 'Ngày' : 'Tháng'})`,
          timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
          status: 'completed'
        },
        ...wallet.transactions
      ]
    });

    const now = new Date();
    const endDate = new Date(now);
    if (plan === 'hourly') endDate.setHours(endDate.getHours() + duration);
    else if (plan === 'daily') endDate.setDate(endDate.getDate() + duration);
    else if (plan === 'monthly') endDate.setMonth(endDate.getMonth() + duration);

    const keyChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let randKey = '';
    for (let i = 0; i < 12; i++) {
      if (i > 0 && i % 4 === 0) randKey += '-';
      randKey += keyChars.charAt(Math.floor(Math.random() * keyChars.length));
    }
    const licenseKey = `DNX-${targetBot.categorySlug.toUpperCase()}-${randKey}`;

    const newRental: BotRental = {
      id: `rent-${Date.now()}`,
      botId: targetBot.id,
      botTitle: targetBot.title,
      botCover: targetBot.coverImage,
      botCategory: targetBot.categoryName,
      renterId: user.id,
      renterName: user.name,
      plan,
      duration,
      totalCost,
      licenseKey,
      accessUrl: targetBot.licenseType === 'web_portal' ? `https://portal.donix.vn/instance/${targetBot.id}` : undefined,
      startDate: now.toISOString().replace('T', ' ').slice(0, 16),
      endDate: endDate.toISOString().replace('T', ' ').slice(0, 16),
      status: 'active',
      autoRenew: false,
      providerId: targetBot.provider.id,
      providerName: targetBot.provider.name
    };

    setRentals([newRental, ...rentals]);
    
    // Update bot active rentals count
    setBots(bots.map((b) => (b.id === botId ? { ...b, totalRentals: b.totalRentals + 1, activeRentals: b.activeRentals + 1 } : b)));

    toast.success(`Thuê bot thành công! Mã kích hoạt: ${licenseKey}`);
    return true;
  };

  const renewRental = (rentalId: string, duration: number): boolean => {
    const targetRental = rentals.find((r) => r.id === rentalId);
    if (!targetRental) return false;

    const targetBot = bots.find((b) => b.id === targetRental.botId);
    const unitPrice = targetBot ? targetBot.pricing[targetRental.plan] : 50000;
    const cost = unitPrice * duration;

    if (wallet.balance < cost) {
      toast.error('Số dư không đủ để gia hạn!');
      return false;
    }

    setWallet({
      ...wallet,
      balance: wallet.balance - cost,
      transactions: [
        {
          id: `tx-${Date.now()}`,
          type: 'rental_payment',
          amount: -cost,
          description: `Gia hạn ${targetRental.botTitle}`,
          timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
          status: 'completed'
        },
        ...wallet.transactions
      ]
    });

    setRentals(
      rentals.map((r) => {
        if (r.id === rentalId) {
          const end = new Date(r.endDate);
          if (r.plan === 'hourly') end.setHours(end.getHours() + duration);
          else if (r.plan === 'daily') end.setDate(end.getDate() + duration);
          else if (r.plan === 'monthly') end.setMonth(end.getMonth() + duration);
          return {
            ...r,
            endDate: end.toISOString().replace('T', ' ').slice(0, 16),
            status: 'active'
          };
        }
        return r;
      })
    );

    toast.success('Gia hạn bot thành công!');
    return true;
  };

  const depositWallet = (amount: number, method: string) => {
    setWallet({
      ...wallet,
      balance: wallet.balance + amount,
      transactions: [
        {
          id: `tx-${Date.now()}`,
          type: 'deposit',
          amount,
          description: `Nạp tiền qua ${method}`,
          timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
          status: 'completed'
        },
        ...wallet.transactions
      ]
    });
    toast.success(`Nạp thành công ${amount.toLocaleString('vi-VN')} VNĐ vào ví!`);
  };

  const addNewBot = (botData: Partial<BotItem>) => {
    const newBot: BotItem = {
      id: `bot-${Date.now()}`,
      slug: (botData.title || 'new-bot').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      title: botData.title || 'Bot Tự Động Mới',
      tagline: botData.tagline || 'Giải pháp tự động hóa',
      description: botData.description || 'Chưa có mô tả',
      categorySlug: botData.categorySlug || 'tools',
      categoryName: botData.categoryName || 'Công cụ & Tiện ích',
      provider: {
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        rating: 5.0,
        totalSales: 0,
        isVerified: true,
        joinedDate: user.joinedDate
      },
      coverImage: botData.coverImage || 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80',
      gallery: [botData.coverImage || 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80'],
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
      updatedAt: new Date().toISOString().split('T')[0]
    };

    setBots([newBot, ...bots]);
    toast.success('Đã đăng bot cho thuê mới thành công!');
  };

  return (
    <RoleContext.Provider
      value={{
        role,
        setRole,
        toggleRole,
        user,
        wallet,
        rentals,
        bots,
        rentBot,
        renewRental,
        depositWallet,
        addNewBot
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
