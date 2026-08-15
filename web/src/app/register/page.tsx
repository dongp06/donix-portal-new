'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRole } from '../../context/RoleContext';
import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton';
import { CheckCircle2, UserRound, Bot, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

type RoleOption = {
  value: 'renter' | 'provider';
  label: string;
  desc: string;
  icon: React.ElementType;
};

const ROLE_OPTIONS: RoleOption[] = [
  {
    value: 'renter',
    label: 'Người thuê bot',
    desc: 'Tìm & thuê bot phù hợp với công việc, chạy ngay không cần đăng ký nhà cung cấp.',
    icon: UserRound,
  },
  {
    value: 'provider',
    label: 'Người cho thuê bot',
    desc: 'Đăng bot lên chợ, nhận đơn thuê và quản lý tin đăng của mình.',
    icon: Bot,
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const { isAuthenticated } = useRole();
  const [role, setRole] = useState<'renter' | 'provider'>('renter');

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Decorative glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_-10%,hsl(var(--brand)/0.14),transparent)]"
      />
      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-10">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Về trang chủ
          </Link>
        </div>

        <div className="mx-auto w-full max-w-xl">
          <div className="mb-8 text-center">
            <p className="eyebrow">Tạo tài khoản mới</p>
            <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              Bạn muốn tham gia với vai trò nào?
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
              Đăng nhập nhanh bằng Google. Vai trò bạn chọn sẽ được dùng khi tạo tài khoản mới
              lần đầu.
            </p>
          </div>

          {/* Role selection */}
          <fieldset>
            <legend className="sr-only">Vai trò tài khoản</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ROLE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = role === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRole(opt.value)}
                    aria-pressed={active}
                    className={cn(
                      'group relative flex flex-col gap-3 rounded-2xl border p-4 text-left transition-all',
                      active
                        ? 'border-brand bg-brand/10 shadow-[0_0_24px_-12px_hsl(var(--brand)/0.5)]'
                        : 'border-border bg-card hover:border-brand/40',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-xl transition-colors',
                          active
                            ? 'bg-brand text-brand-foreground'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      {active && (
                        <CheckCircle2 className="h-5 w-5 text-brand" aria-hidden />
                      )}
                    </div>
                    <div>
                      <p
                        className={cn(
                          'text-sm font-bold',
                          active ? 'text-brand' : 'text-foreground',
                        )}
                      >
                        {opt.label}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {opt.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="my-8 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" aria-hidden />
            hoặc
            <span className="h-px flex-1 bg-border" aria-hidden />
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <GoogleLoginButton role={role} className="flex justify-center" />
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              Bằng cách đăng nhập, bạn đồng ý với Điều khoản sử dụng của {`Donix`}.
            </p>
          </div>

          {isAuthenticated === true && (
            <div className="mt-4 rounded-xl border border-brand/30 bg-brand/10 px-4 py-3 text-center text-sm text-brand">
              Bạn đã đăng nhập.{' '}
              <button
                type="button"
                onClick={() => router.push(role === 'provider' ? '/dashboard' : '/profile')}
                className="font-bold underline"
              >
                Tiếp tục
              </button>
            </div>
          )}

          <div className="mt-8 flex items-center justify-center gap-6 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-brand/70" aria-hidden />
              Không cần mật khẩu
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-brand/70" aria-hidden />
              Đăng ký miễn phí
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
