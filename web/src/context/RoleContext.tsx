'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile, UserRole, BotItem } from '@shared/types';
import { MOCK_USER, MOCK_BOTS } from '@shared/mock-data';
import { toast } from 'sonner';

/** User trả về từ API /auth/me — role từ DB (string) */
export interface ApiAuthUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: UserRole;
  isVerified: boolean;
  bio: string | null;
  joinedDate: string;
  contact?: BotContactInfo;
  isNewUser?: boolean;
}

function toUserProfile(u: ApiAuthUser): UserProfile {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    avatar: u.avatar,
    role: u.role,
    isVerifiedSeller: u.isVerified,
    bio: u.bio ?? undefined,
    joinedDate: u.joinedDate,
    contact: u.contact,
  };
}

export interface BotContactInfo {
  zalo?: string;
  telegram?: string;
  phone?: string;
  messenger?: string;
  facebook?: string;
}

interface BotContextType {
  user: UserProfile;
  bots: BotItem[];
  botsLoading: boolean;
  addNewBot: (botData: Partial<BotItem>, contact?: BotContactInfo) => Promise<BotItem>;
  updateBot: (id: string, botData: Partial<BotItem>, contact?: BotContactInfo) => Promise<BotItem>;
  deleteBot: (id: string) => Promise<void>;
  registerUser: (info: { name: string; email: string; role: UserRole }) => UserProfile;
  /** Sửa hồ sơ của chính mình (bio + liên hệ) */
  updateProfile: (bio: string, contact: BotContactInfo) => Promise<void>;
  /** Trạng thái auth: null = đang kiểm tra, false = chưa đăng nhập, true = đã đăng nhập */
  isAuthenticated: boolean | null;
  loginWithGoogle: (role?: UserRole) => Promise<ApiAuthUser>;
  logout: () => Promise<void>;
}

const BotContext = createContext<BotContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile>({ ...MOCK_USER });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [bots, setBots] = useState<BotItem[]>([...MOCK_BOTS]);
  const [botsLoading, setBotsLoading] = useState(true);

  // Load trạng thái đăng nhập + danh sách bot từ API khi mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        const json = await res.json();
        if (!cancelled) {
          if (json.success && json.data) {
            setUser(toUserProfile(json.data));
            setIsAuthenticated(true);
          } else {
            setIsAuthenticated(false);
          }
        }
      } catch {
        if (!cancelled) setIsAuthenticated(false);
      }
    })();

    // Load bots từ API (lên chợ từ DB). Lỗi thì giữ mock local.
    (async () => {
      try {
        const res = await fetch('/api/bots', { credentials: 'include' });
        const json = await res.json();
        if (!cancelled && json.success && Array.isArray(json.data)) {
          setBots(json.data as BotItem[]);
        }
      } catch {
        // giữ mock
      } finally {
        if (!cancelled) setBotsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const registerUser = (info: { name: string; email: string; role: UserRole }) => {
    const isSeller = info.role === 'seller';
    const newUser: UserProfile = {
      id: `usr-${Date.now()}`,
      name: info.name.trim() || 'Người dùng Donix',
      email: info.email.trim() || `${Date.now()}@donix.vn`,
      avatar:
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      role: info.role,
      isVerifiedSeller: isSeller,
      bio: isSeller ? 'Người bán bot tại Donix' : 'Người mua bot tại Donix',
      joinedDate: new Date().toISOString().split('T')[0],
    };
    setUser(newUser);
    toast.success(`Đã tạo tài khoản ${isSeller ? 'Người bán' : 'Người mua'} thành công`);
    return newUser;
  };

  const loginWithGoogle = async (role?: UserRole): Promise<ApiAuthUser> => {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ idToken: '__GOOGLE__', role: role === 'seller' ? 'seller' : 'buyer' }),
    });
    const json = await res.json();
    if (!res.ok || !json.success || !json.data) {
      throw new Error(json.error || 'Đăng nhập thất bại');
    }
    const u = json.data as ApiAuthUser;
    setUser(toUserProfile(u));
    setIsAuthenticated(true);
    return u;
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // ignore
    }
    setUser({ ...MOCK_USER });
    setIsAuthenticated(false);
    toast.success('Đã đăng xuất');
  };

  /** Gửi bot lên API (lưu DB) rồi cập nhật state — seller gắn từ cookie trên backend */
  const addNewBot = async (botData: Partial<BotItem>, contact?: BotContactInfo) => {
    const payload = {
      title: botData.title,
      tagline: botData.tagline,
      description: botData.description,
      categorySlug: botData.categorySlug,
      categoryName: botData.categoryName,
      coverImage: botData.coverImage,
      gallery: botData.gallery,
      features: botData.features,
      pricing: botData.pricing,
      tags: botData.tags,
      contact: contact
        ? {
            zalo: contact.zalo?.trim() || undefined,
            telegram: contact.telegram?.trim() || undefined,
            phone: contact.phone?.trim() || undefined,
            messenger: contact.messenger?.trim() || undefined,
            facebook: contact.facebook?.trim() || undefined,
          }
        : undefined,
    };
    const res = await fetch('/api/bots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success || !json.data) {
      throw new Error(json.error || 'Đăng bot thất bại');
    }
    const created = json.data as BotItem;
    setBots((prev) => [created, ...prev]);
    toast.success('Đã đăng bot lên chợ thành công');
    return created;
  };

  /** Cập nhật bot qua PUT /api/bots/:id */
  const updateBot = async (id: string, botData: Partial<BotItem>, contact?: BotContactInfo) => {
    const payload: Record<string, unknown> = {
      title: botData.title,
      tagline: botData.tagline,
      description: botData.description,
      categorySlug: botData.categorySlug,
      categoryName: botData.categoryName,
      coverImage: botData.coverImage,
      gallery: botData.gallery,
      features: botData.features,
      pricing: botData.pricing,
      status: botData.status,
      tags: botData.tags,
      version: botData.version,
      systemReqs: botData.systemReqs,
      seller: {
        contact: contact
          ? {
              zalo: contact.zalo?.trim() || undefined,
              telegram: contact.telegram?.trim() || undefined,
              phone: contact.phone?.trim() || undefined,
              messenger: contact.messenger?.trim() || undefined,
              facebook: contact.facebook?.trim() || undefined,
            }
          : undefined,
      },
    };
    const res = await fetch(`/api/bots/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success || !json.data) {
      throw new Error(json.error || 'Cập nhật bot thất bại');
    }
    const updated = json.data as BotItem;
    setBots((prev) => prev.map((b) => (b.id === id ? updated : b)));
    toast.success('Đã cập nhật bot');
    return updated;
  };

  const deleteBot = async (id: string) => {
    const res = await fetch(`/api/bots/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Xóa bot thất bại');
    }
    setBots((prev) => prev.filter((b) => b.id !== id));
    toast.success('Đã xóa bot');
  };

  /** Sửa hồ sơ của chính mình — bio + liên hệ (PATCH /api/users/me) */
  const updateProfile = async (bio: string, contact: BotContactInfo) => {
    const res = await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        bio,
        contact: {
          zalo: contact.zalo?.trim() ?? '',
          telegram: contact.telegram?.trim() ?? '',
          phone: contact.phone?.trim() ?? '',
          messenger: contact.messenger?.trim() ?? '',
          facebook: contact.facebook?.trim() ?? '',
        },
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.success || !json.data) {
      throw new Error(json.error || 'Cập nhật hồ sơ thất bại');
    }
    setUser(toUserProfile(json.data as ApiAuthUser));
    toast.success('Đã cập nhật hồ sơ');
  };

  return (
    <BotContext.Provider
      value={{
        user,
        bots,
        botsLoading,
        addNewBot,
        updateBot,
        deleteBot,
        registerUser,
        updateProfile,
        isAuthenticated,
        loginWithGoogle,
        logout,
      }}
    >
      {children}
    </BotContext.Provider>
  );
}

export function useRole() {
  const context = useContext(BotContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
