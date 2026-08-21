'use client';

import React, { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton';
import { ThuebotLogo } from '@/components/brand/ThuebotLogo';
import { useRole } from '@/context/RoleContext';
import { safeInternalPath } from '@/lib/safe-redirect';

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = safeInternalPath(params.get('returnTo'));
  const { isAuthenticated, onboardingCompleted, staffRole } = useRole();

  // Đã đăng nhập mà vào /login → không render form, redirect ngay.
  useEffect(() => {
    if (isAuthenticated !== true) return;
    if (staffRole) {
      router.replace('/admin');
      return;
    }
    if (!onboardingCompleted) {
      const qs = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '';
      router.replace(`/onboarding/account-type${qs}`);
    } else {
      router.replace(returnTo || '/');
    }
  }, [isAuthenticated, onboardingCompleted, returnTo, router, staffRole]);

  return (
    <div className="relative flex min-h-screen flex-col bg-[#FAFAF8] text-foreground dark:bg-[#0A0C0F]">
      {/* Glow rất nhẹ phía sau auth block */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,hsl(var(--brand)/0.09),transparent_30%)] dark:bg-[radial-gradient(circle_at_50%_38%,hsl(var(--brand)/0.07),transparent_30%)]"
      />

      {/* Auth header — chỉ logo + quay lại, KHÔNG dùng navbar marketplace */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link
          href="/"
          aria-label="thuebot.org — về trang chủ"
          className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAFAF8] dark:focus-visible:ring-offset-[#0A0C0F]"
        >
          <ThuebotLogo size="md" />
        </Link>
        <Link
          href="/"
          className="rounded-lg px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAFAF8] dark:focus-visible:ring-offset-[#0A0C0F]"
        >
          ← Trang chủ
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-20 pt-12 sm:pt-0">
        <div className="w-full max-w-[440px] text-center">
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-[2.625rem]">
            Chào mừng trở lại
          </h1>
          <p className="mx-auto mt-3 max-w-[34rem] text-[15px] leading-6 text-muted-foreground">
            Đăng nhập để tìm bot, lưu bot yêu thích và quản lý tài khoản của bạn.
          </p>

          <div className="mt-9">
            <GoogleLoginButton
              redirectTo={returnTo}
              buttonText="signin_with"
              variant="plain"
              className="flex justify-center"
            />
            <p className="mt-5 text-sm text-muted-foreground">
              Không cần mật khẩu <span className="px-1 text-border dark:text-[#3A414D]">·</span>{' '}
              Đăng ký tự động
            </p>
          </div>

          <p className="mt-9 text-xs leading-5 text-muted-foreground">
            Bằng việc tiếp tục, bạn đồng ý với{' '}
            <Link
              href="/terms"
              className="text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              Điều khoản
            </Link>{' '}
            và{' '}
            <Link
              href="/privacy"
              className="text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              Chính sách quyền riêng tư
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
