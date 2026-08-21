'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { UserProfile, UserRole, BotItem } from '@shared/types';
import { toast } from 'sonner';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { resetSecurityClient } from '@/lib/security-client';

const EMPTY_USER: UserProfile = {
  id: 'anonymous',
  name: 'Khách',
  email: '',
  avatar: '/favicon-192.png',
  role: 'buyer',
  verificationState: 'unverified',
  joinedDate: '',
};

/** User trả về từ API /auth/me — role từ DB (string) */
export interface ApiAuthUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: UserRole;
  isTrusted: boolean;
  verificationState: string;
  trustedAt: string | null;
  trustedUntil: string | null;
  bio: string | null;
  joinedDate: string;
  contact?: BotContactInfo;
  isNewUser?: boolean;
  /** false khi user mới chưa chọn vai trò → cần vào /onboarding/account-type */
  onboardingCompleted?: boolean;
  /** Vai trò nhân sự (owner/admin/moderator) — tách khỏi role công khai */
  staffRole?: 'owner' | 'admin' | 'moderator';
}

function toUserProfile(u: ApiAuthUser): UserProfile {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    avatar: u.avatar,
    role: u.role,
    isTrustedSeller: u.isTrusted,
    verificationState: u.verificationState as UserProfile['verificationState'],
    bio: u.bio ?? undefined,
    joinedDate: u.joinedDate,
    contact: u.contact,
  };
}

function getApiErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const body = payload as Record<string, unknown>;
  for (const candidate of [body.message, body.error]) {
    if (typeof candidate === 'string' && candidate && candidate !== 'Bad Request') return candidate;
    if (candidate && typeof candidate === 'object') {
      const nested = candidate as Record<string, unknown>;
      if (typeof nested.message === 'string' && nested.message) return nested.message;
      if (nested.code === 'SELLER_CONTACT_REQUIRED') {
        return 'Bạn cần thêm ít nhất một phương thức liên hệ vào hồ sơ seller trước khi đăng bot.';
      }
    }
  }
  return fallback;
}

export interface BotContactInfo {
  zalo?: string;
  telegram?: string;
  phone?: string;
  messenger?: string;
  facebook?: string;
  website?: string;
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface BotContextType {
  user: UserProfile;
  bots: BotItem[];
  botsLoading: boolean;
  botsError: string | null;
  reloadBots: () => Promise<void>;
  addNewBot: (botData: Partial<BotItem>) => Promise<BotItem>;
  updateBot: (id: string, botData: Partial<BotItem>) => Promise<BotItem>;
  deleteBot: (id: string) => Promise<void>;
  registerUser: (info: { name: string; email: string; role: UserRole }) => UserProfile;
  /** Sửa hồ sơ của chính mình (bio + liên hệ) */
  updateProfile: (bio: string, contact: BotContactInfo) => Promise<void>;
  /** Trạng thái auth: null = đang kiểm tra, false = chưa đăng nhập, true = đã đăng nhập */
  authStatus: AuthStatus;
  isAuthenticated: boolean | null;
  /** false khi user mới đăng nhập nhưng chưa chọn vai trò (cần onboarding) */
  onboardingCompleted: boolean;
  /** Vai trò nhân sự nếu có — dùng để hiện link /admin */
  staffRole?: 'owner' | 'admin' | 'moderator';
  loginWithGoogle: () => Promise<ApiAuthUser>;
  /** Hoàn tất onboarding: chọn vai trò buyer/seller cho user mới */
  completeOnboarding: (role: 'buyer' | 'seller') => Promise<ApiAuthUser>;
  /** Nâng buyer hiện tại lên seller */
  becomeSeller: () => Promise<ApiAuthUser>;
  logout: () => Promise<void>;
}

const BotContext = createContext<BotContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile>({ ...EMPTY_USER });
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const isAuthenticated = authStatus === 'loading' ? null : authStatus === 'authenticated';
  const [onboardingCompleted, setOnboardingCompleted] = useState(true);
  const [staffRole, setStaffRole] = useState<
    'owner' | 'admin' | 'moderator' | undefined
  >(undefined);
  const [bots, setBots] = useState<BotItem[]>([]);
  const [botsLoading, setBotsLoading] = useState(true);
  const [botsError, setBotsError] = useState<string | null>(null);

  const loadBots = useCallback(async (signal?: AbortSignal) => {
    setBotsLoading(true);
    setBotsError(null);
    try {
      const res = await fetchWithTimeout('/api/bots', { credentials: 'include', signal }, 20_000);
      const json = await res.json().catch(() => null) as { success?: boolean; data?: unknown; error?: string } | null;
      if (!res.ok || !json?.success || !Array.isArray(json.data)) {
        throw new Error(json?.error || `Không tải được danh sách bot (${res.status}).`);
      }
      if (!signal?.aborted) setBots(json.data as BotItem[]);
    } catch (cause) {
      if (signal?.aborted) return;
      setBotsError(cause instanceof Error ? cause.message : 'Không tải được danh sách bot.');
    } finally {
      if (!signal?.aborted) setBotsLoading(false);
    }
  }, []);

  // Load trạng thái đăng nhập + danh sách bot từ API khi mount
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8_000);
    let resolvedStatus: AuthStatus = 'unauthenticated';
    let authResponseStatus: number | undefined;

    (async () => {
      try {
        // Probe the anonymous-safe bootstrap endpoint first.  A guest should
        // not produce a red 401 auth/me request merely because the shared
        // provider mounted on a public page.
        const sessionProbe = await fetchWithTimeout('/api/bootstrap', {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        });
        const sessionProbeJson = await sessionProbe.json().catch(() => null) as {
          success?: boolean;
          data?: { authenticated?: boolean };
        } | null;
        if (
          sessionProbe.ok &&
          sessionProbeJson?.success &&
          sessionProbeJson.data?.authenticated === false
        ) {
          return;
        }

        const res = await fetchWithTimeout('/api/auth/me', {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        });
        authResponseStatus = res.status;
        if (!res.ok) throw new Error(`Auth request failed: ${res.status}`);
        const json = await res.json();
        if (!cancelled) {
          if (json.success && json.data) {
            const u = json.data as ApiAuthUser;
            setUser(toUserProfile(u));
            setOnboardingCompleted(u.onboardingCompleted ?? true);
            setStaffRole(u.staffRole);
            resolvedStatus = 'authenticated';
          } else {
            setUser({ ...EMPTY_USER });
            setOnboardingCompleted(true);
            setStaffRole(undefined);
          }
        }
      } catch {
        if (!cancelled) {
          if (authResponseStatus !== 401 && authResponseStatus !== 403) {
            toast.error('Không thể kiểm tra phiên đăng nhập. Một số thao tác có thể cần thử lại.');
          }
          setUser({ ...EMPTY_USER });
          setOnboardingCompleted(true);
          setStaffRole(undefined);
        }
      } finally {
        window.clearTimeout(timeoutId);
        if (!cancelled) setAuthStatus(resolvedStatus);
      }
    })();

    // Load bots từ API (lên chợ từ DB). Lỗi phải được hiển thị để người dùng có thể thử lại.
    const botsController = new AbortController();
    void loadBots(botsController.signal);

    return () => {
      cancelled = true;
      controller.abort();
      botsController.abort();
      window.clearTimeout(timeoutId);
    };
  }, [loadBots]);

  const registerUser = (info: { name: string; email: string; role: UserRole }) => {
    const isSeller = info.role === 'seller';
    const newUser: UserProfile = {
      id: `usr-${Date.now()}`,
      name: info.name.trim() || 'Người dùng thuebot',
      email: info.email.trim() || `${Date.now()}@thuebot.org`,
      avatar:
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      role: info.role,
      isTrustedSeller: false,
      verificationState: 'unverified',
      bio: isSeller ? 'Người bán bot tại thuebot.org' : 'Người mua bot tại thuebot.org',
      joinedDate: new Date().toISOString().split('T')[0],
    };
    setUser(newUser);
    toast.success(`Đã tạo tài khoản ${isSeller ? 'Người bán' : 'Người mua'} thành công`);
    return newUser;
  };

  const loginWithGoogle = async (): Promise<ApiAuthUser> => {
    window.location.assign('/api/auth/google/start?returnTo=%2Fprofile');
    return new Promise<ApiAuthUser>(() => undefined);
  };

  /** Hoàn tất onboarding: gửi vai trò đã chọn lên backend. */
  const completeOnboarding = async (
    role: 'buyer' | 'seller',
  ): Promise<ApiAuthUser> => {
    const res = await fetchWithTimeout('/api/auth/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ role }),
    }, 20_000);
    const json = await res.json().catch(() => null) as { success?: boolean; data?: ApiAuthUser; error?: string } | null;
    if (!res.ok || !json?.success || !json.data) {
      throw new Error(json?.error || 'Không thể hoàn tất thiết lập tài khoản');
    }
    const u = json.data as ApiAuthUser;
    setUser(toUserProfile(u));
    setAuthStatus('authenticated');
    setOnboardingCompleted(u.onboardingCompleted ?? true);
    setStaffRole(u.staffRole);
    return u;
  };

  /** Nâng buyer hiện tại lên seller. */
  const becomeSeller = async (): Promise<ApiAuthUser> => {
    const res = await fetchWithTimeout('/api/auth/become-seller', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }, 20_000);
    const json = await res.json().catch(() => null) as { success?: boolean; data?: ApiAuthUser; error?: string } | null;
    if (!res.ok || !json?.success || !json.data) {
      throw new Error(json?.error || 'Không thể nâng cấp tài khoản');
    }
    const u = json.data as ApiAuthUser;
    setUser(toUserProfile(u));
    return u;
  };

  const logout = async () => {
    try {
      await fetchWithTimeout('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      }, 15_000);
    } catch {
      // ignore
    }
    setUser({ ...EMPTY_USER });
    resetSecurityClient();
    setAuthStatus('unauthenticated');
    setOnboardingCompleted(true);
    setStaffRole(undefined);
    toast.success('Đã đăng xuất');
  };

  /** Gửi bot lên API (lưu DB) rồi cập nhật state — seller gắn từ cookie trên backend */
  const addNewBot = async (botData: Partial<BotItem>) => {
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
      status: botData.status,
      tags: botData.tags,
      targetAudience: botData.targetAudience,
    };
    const res = await fetchWithTimeout('/api/bots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    }, 30_000);
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success || !json.data) {
      throw new Error(getApiErrorMessage(json, res.status ? `Đăng bot thất bại (${res.status})` : 'Đăng bot thất bại'));
    }
    const created = json.data as BotItem;
    setBots((prev) => [created, ...prev]);
    toast.success('Đã đăng bot lên chợ thành công');
    return created;
  };

  /** Cập nhật bot qua PUT /api/bots/:id */
  const updateBot = async (id: string, botData: Partial<BotItem>) => {
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
      targetAudience: botData.targetAudience,
    };
    const res = await fetchWithTimeout(`/api/bots/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    }, 30_000);
    const json = await res.json().catch(() => null);
    if (!res.ok || !json.success || !json.data) {
      throw new Error(getApiErrorMessage(json, 'Cập nhật bot thất bại'));
    }
    const updated = json.data as BotItem;
    setBots((prev) => prev.map((b) => (b.id === id ? updated : b)));
    toast.success('Đã cập nhật bot');
    return updated;
  };

  const deleteBot = async (id: string) => {
    const res = await fetchWithTimeout(`/api/bots/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    }, 30_000);
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      throw new Error(json?.error || 'Xóa bot thất bại');
    }
    setBots((prev) => prev.filter((b) => b.id !== id));
    toast.success('Đã xóa bot');
  };

  /** Sửa hồ sơ của chính mình — bio + liên hệ (PATCH /api/users/me) */
  const updateProfile = async (bio: string, contact: BotContactInfo) => {
    const res = await fetchWithTimeout('/api/users/me', {
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
          website: contact.website?.trim() ?? '',
        },
      }),
    }, 20_000);
    const json = await res.json().catch(() => null);
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
        botsError,
        reloadBots: async () => loadBots(),
        addNewBot,
        updateBot,
        deleteBot,
        registerUser,
        updateProfile,
        authStatus,
        isAuthenticated,
        onboardingCompleted,
        staffRole,
        loginWithGoogle,
        completeOnboarding,
        becomeSeller,
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
