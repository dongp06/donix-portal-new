'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Loader2,
  Save,
  Building2,
  UserRound,
  Image as ImageIcon,
  MessageCircle,
  Send,
  Phone,
  Facebook,
  Link2,
} from 'lucide-react';
import { useRole } from '@/context/RoleContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { SellerProfile } from '@shared/types';

/** Schema form Hồ sơ shop — khớp với body PUT /api/sellers/me/profile */
const profileSchema = z.object({
  shopName: z.string().trim().min(1, 'Vui lòng nhập tên shop'),
  bio: z.string().trim().max(500, 'Tối đa 500 ký tự'),
  avatar: z.union([z.string().trim().url('Địa chỉ URL không hợp lệ'), z.literal('')]),
  banner: z.union([z.string().trim().url('Địa chỉ URL không hợp lệ'), z.literal('')]),
  contact: z.object({
    zalo: z.string().trim().max(200, 'Tối đa 200 ký tự'),
    telegram: z.string().trim().max(200, 'Tối đa 200 ký tự'),
    phone: z.string().trim().max(50, 'Tối đa 50 ký tự'),
    facebook: z.string().trim().max(200, 'Tối đa 200 ký tự'),
  }),
});

type ProfileFormValues = z.input<typeof profileSchema>;

/** Response của PUT /api/sellers/me/profile */
export interface SellerMeProfile {
  id?: string;
  userId?: string;
  shopName?: string;
  slug?: string;
  bio?: string;
  avatar?: string;
  banner?: string;
  contact?: Record<string, string>;
  profileCompleteness?: number;
}

/**
 * Cache theo phiên: sau khi lưu profile, giữ response để prefill cho lần sau
 * (Radix Tabs unmount tab khi chuyển — cần cache để không mất dữ liệu vừa lưu).
 */
let cachedProfile: { userId: string; profile: SellerMeProfile } | null = null;

const CONTACT_FIELDS = [
  { key: 'zalo', label: 'Zalo', icon: MessageCircle, placeholder: 'Số điện thoại hoặc ID Zalo' },
  { key: 'telegram', label: 'Telegram', icon: Send, placeholder: 'Username hoặc số điện thoại' },
  { key: 'phone', label: 'Số điện thoại', icon: Phone, placeholder: 'Số điện thoại liên hệ' },
  { key: 'facebook', label: 'Facebook', icon: Facebook, placeholder: 'Link hoặc username Facebook' },
] as const;

export function ProfileTab() {
  const { user } = useRole();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slug, setSlug] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      shopName: '',
      bio: '',
      avatar: '',
      banner: '',
      contact: { zalo: '', telegram: '', phone: '', facebook: '' },
    },
  });

  // Prefill dữ liệu hiện tại khi mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Đã lưu trong phiên này — dùng cache để không gọi API lại
        if (cachedProfile?.userId === user.id) {
          const p = cachedProfile.profile;
          if (!cancelled) {
            reset({
              shopName: p.shopName ?? user.name,
              bio: p.bio ?? user.bio ?? '',
              avatar: p.avatar ?? user.avatar ?? '',
              banner: p.banner ?? '',
              contact: {
                zalo: p.contact?.zalo ?? user.contact?.zalo ?? '',
                telegram: p.contact?.telegram ?? user.contact?.telegram ?? '',
                phone: p.contact?.phone ?? user.contact?.phone ?? '',
                facebook: p.contact?.facebook ?? user.contact?.facebook ?? '',
              },
            });
            setSlug(p.slug ?? '');
          }
          return;
        }

        // Không có GET profile riêng — dùng API công khai /api/sellers/:id để prefill
        const res = await fetch(`/api/sellers/${user.id}`, { credentials: 'include' });
        const json = await res.json();
        if (!cancelled) {
          if (res.ok && json.success && json.data) {
            const profile = json.data as SellerProfile;
            const u = profile.user;
            reset({
              shopName: u.name ?? '',
              bio: u.bio ?? '',
              avatar: u.avatar ?? '',
              banner: '',
              contact: {
                zalo: u.contact?.zalo ?? '',
                telegram: u.contact?.telegram ?? '',
                phone: u.contact?.phone ?? '',
                facebook: u.contact?.facebook ?? '',
              },
            });
            setSlug(u.slug ?? '');
          }
        }
      } catch {
        // API lỗi — giữ form rỗng để user tự nhập
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const onSubmit = async (values: ProfileFormValues) => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/sellers/me/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          shopName: values.shopName,
          bio: values.bio,
          avatar: values.avatar,
          banner: values.banner,
          contact: {
            zalo: values.contact.zalo,
            telegram: values.contact.telegram,
            phone: values.contact.phone,
            facebook: values.contact.facebook,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || 'Lưu hồ sơ thất bại');
      }
      const profile = json.data as SellerMeProfile;
      cachedProfile = { userId: user.id, profile };
      if (profile.slug) setSlug(profile.slug);
      toast.success('Đã lưu hồ sơ');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lưu hồ sơ thất bại');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-2xl border border-border bg-card">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Đang tải hồ sơ…
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 font-display text-xl font-bold">
          <UserRound className="h-5 w-5 text-brand" aria-hidden />
          Hồ sơ shop
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Thông tin hiển thị công khai trên trang hồ sơ người bán và trong bot của bạn.
        </p>
        {slug && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
            <Link2 className="h-3.5 w-3.5" aria-hidden />
            thuebot.org/sellers/{slug}
          </p>
        )}
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="space-y-6 rounded-2xl border border-border bg-card p-6"
      >
        {/* Tên shop */}
        <div className="grid gap-2">
          <Label htmlFor="profile-shopName">
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" aria-hidden />
              Tên shop <span className="text-destructive">*</span>
            </span>
          </Label>
          <Input
            id="profile-shopName"
            placeholder="VD: Minox Bot Store"
            maxLength={120}
            aria-invalid={!!errors.shopName}
            {...register('shopName')}
          />
          {errors.shopName && (
            <p className="text-xs font-medium text-destructive">{errors.shopName.message}</p>
          )}
        </div>

        {/* Giới thiệu */}
        <div className="grid gap-2">
          <Label htmlFor="profile-bio">Giới thiệu về shop</Label>
          <Textarea
            id="profile-bio"
            rows={4}
            placeholder="Kể về kinh nghiệm, dịch vụ và cách bạn hỗ trợ người mua…"
            maxLength={500}
            aria-invalid={!!errors.bio}
            {...register('bio')}
          />
          {errors.bio ? (
            <p className="text-xs font-medium text-destructive">{errors.bio.message}</p>
          ) : (
            <p className="text-xs text-muted-foreground">Tối đa 500 ký tự.</p>
          )}
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* Avatar */}
          <div className="grid gap-2">
            <Label htmlFor="profile-avatar">Ảnh đại diện (URL)</Label>
            <Input
              id="profile-avatar"
              type="url"
              placeholder="https://…/avatar.jpg"
              maxLength={500}
              aria-invalid={!!errors.avatar}
              {...register('avatar')}
            />
            {errors.avatar && (
              <p className="text-xs font-medium text-destructive">{errors.avatar.message}</p>
            )}
          </div>

          {/* Banner */}
          <div className="grid gap-2">
            <Label htmlFor="profile-banner">Ảnh bìa (URL, tùy chọn)</Label>
            <Input
              id="profile-banner"
              type="url"
              placeholder="https://…/banner.jpg"
              maxLength={500}
              aria-invalid={!!errors.banner}
              {...register('banner')}
            />
            {errors.banner && (
              <p className="text-xs font-medium text-destructive">{errors.banner.message}</p>
            )}
          </div>
        </div>

        {/* Liên hệ */}
        <fieldset className="space-y-4">
          <legend className="mb-1 text-sm font-medium text-foreground">
            Thông tin liên hệ (tùy chọn)
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {CONTACT_FIELDS.map((f) => {
              const Icon = f.icon;
              const error = errors.contact?.[f.key];
              return (
                <div key={f.key} className="grid gap-2">
                  <Label htmlFor={`profile-contact-${f.key}`}>
                    <span className="inline-flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                      {f.label}
                    </span>
                  </Label>
                  <Input
                    id={`profile-contact-${f.key}`}
                    type="text"
                    placeholder={f.placeholder}
                    maxLength={200}
                    aria-invalid={!!error}
                    {...register(`contact.${f.key}`)}
                  />
                  {error && <p className="text-xs font-medium text-destructive">{error.message}</p>}
                </div>
              );
            })}
          </div>
        </fieldset>

        <div className="flex items-center gap-3 border-t border-border pt-5">
          <Button
            type="submit"
            disabled={saving}
            className="min-w-[9rem] bg-brand text-brand-foreground hover:brightness-110"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            <Save className="h-4 w-4" aria-hidden />
            {saving ? 'Đang lưu…' : 'Lưu hồ sơ'}
          </Button>
          <p className="text-xs text-muted-foreground">
            Hồ sơ hoàn thiện giúp tăng điểm uy tín của bạn.
          </p>
        </div>
      </form>
    </div>
  );
}
