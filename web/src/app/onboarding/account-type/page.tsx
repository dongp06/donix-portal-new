'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRole } from '@/context/RoleContext';
import { CheckCircle2, Search, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type RoleOption = {
  value: 'buyer' | 'seller';
  title: string;
  desc: string;
  tag: string;
  icon: React.ElementType;
};

const ROLE_OPTIONS: RoleOption[] = [
  {
    value: 'buyer',
    title: 'Tôi muốn thuê bot',
    desc: 'Tìm bot, lưu bot và đánh giá seller.',
    tag: 'Người dùng',
    icon: Search,
  },
  {
    value: 'seller',
    title: 'Tôi cung cấp bot',
    desc: 'Đăng bot, xây dựng uy tín và tìm khách.',
    tag: 'Nhà cung cấp',
    icon: Bot,
  },
];

function OnboardingInner() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params.get('returnTo');
  const { completeOnboarding, isAuthenticated } = useRole();
  const [role, setRole] = useState<'buyer' | 'seller'>('buyer');
  const [busy, setBusy] = useState(false);

  const handleContinue = async () => {
    setBusy(true);
    try {
      await completeOnboarding(role);
      if (role === 'seller') {
        router.push('/dashboard');
      } else {
        router.push(returnTo || '/bots');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không thể hoàn tất thiết lập');
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_-10%,hsl(var(--brand)/0.14),transparent)]"
      />
      <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-10 sm:px-6">
        <div className="mb-8 text-center">
          <p className="eyebrow">Thiết lập tài khoản</p>
          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            Bạn đến thuebot.org để làm gì?
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            Chọn mục phù hợp nhất với bạn. Bạn vẫn có thể sử dụng các tính năng
            khác sau này.
          </p>
        </div>

        <fieldset>
          <legend className="sr-only">Vai trò tài khoản</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                    'group relative flex flex-col gap-4 rounded-2xl border p-6 text-left transition-all',
                    active
                      ? 'border-brand bg-brand/10 shadow-[0_0_28px_-12px_hsl(var(--brand)/0.6)]'
                      : 'border-border bg-card hover:border-brand/40',
                  )}
                >
                  <div className="flex items-start justify-between">
                    <span
                      className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-xl transition-colors',
                        active
                          ? 'bg-brand text-brand-foreground'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <Icon className="h-6 w-6" aria-hidden />
                    </span>
                    {active && (
                      <CheckCircle2 className="h-6 w-6 text-brand" aria-hidden />
                    )}
                  </div>
                  <div>
                    <p
                      className={cn(
                        'text-base font-bold',
                        active ? 'text-brand' : 'text-foreground',
                      )}
                    >
                      {opt.title}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {opt.desc}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'mt-auto inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold',
                      active
                        ? 'bg-brand/15 text-brand'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {opt.tag}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={handleContinue}
            disabled={busy || isAuthenticated === false}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-8 py-3 text-sm font-semibold text-brand-foreground transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Đang thiết lập…' : 'Tiếp tục →'}
          </button>
        </div>

        {isAuthenticated === false && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Bạn cần đăng nhập trước.{' '}
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="font-semibold text-brand underline"
            >
              Đăng nhập
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

export default function OnboardingAccountTypePage() {
  return (
    <Suspense fallback={null}>
      <OnboardingInner />
    </Suspense>
  );
}
