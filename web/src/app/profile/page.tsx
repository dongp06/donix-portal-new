'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRole } from '../../context/RoleContext';
import {
  UserRound,
  ShieldCheck,
  CalendarDays,
  Mail,
  LogOut,
  Bot,
  ArrowRight,
  CheckCircle2,
  Plus,
} from 'lucide-react';

const ROLE_LABEL: Record<string, string> = {
  buyer: 'Người mua bot',
  seller: 'Người bán bot',
  admin: 'Quản trị viên',
};

export default function ProfilePage() {
  const { user, bots, isAuthenticated, logout } = useRole();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (isAuthenticated === null) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Đang kiểm tra đăng nhập…</p>
      </div>
    );
  }

  if (isAuthenticated === false) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-background px-4 text-foreground">
        <div className="w-full max-w-md space-y-4 text-center">
          <UserRound className="mx-auto h-10 w-10 text-brand" aria-hidden />
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Bạn chưa đăng nhập
          </h1>
          <p className="text-sm text-muted-foreground">
            Đăng nhập để xem trang cá nhân và quản lý thông tin của bạn.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:brightness-110"
          >
            Đăng nhập / Đăng ký
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    );
  }

  const isSeller = user.role === 'seller';
  const myBots = bots.filter((b) => b.seller.id === user.id);
  const joinDate = new Date(user.joinedDate + 'T00:00:00');
  const joinLabel = Number.isNaN(joinDate.getTime())
    ? user.joinedDate
    : joinDate.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow">Trang cá nhân</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
              {user.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
          </div>
          {isSeller && (
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-brand/40 px-4 py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-brand/10"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Đăng bot
            </Link>
          )}
        </div>

        {/* Profile card */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <img
              src={user.avatar}
              alt={user.name}
              className="h-20 w-20 rounded-2xl border border-border object-cover"
            />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-brand/30 bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
                  {ROLE_LABEL[user.role] ?? user.role}
                </span>
                {user.isVerifiedSeller && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-500">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                    Đã xác thực
                  </span>
                )}
              </div>
              {user.bio ? (
                <p className="text-sm leading-relaxed text-muted-foreground">{user.bio}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Chưa có giới thiệu.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" aria-hidden />
                  {user.email}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                  Tham gia {joinLabel}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:border-red-500/40 hover:text-red-500"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              {isLoggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div
          className={`grid gap-4 ${
            isSeller ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
          }`}
        >
          <div className="rounded-2xl border border-border bg-card p-5">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-brand" aria-hidden />
              Tài khoản
            </span>
            <div className="mt-1 font-display text-2xl font-bold tracking-tight">
              {user.isVerifiedSeller ? 'Đã xác thực' : 'Cơ bản'}
            </div>
          </div>

          {isSeller && (
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5">
              <div>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <Bot className="h-3.5 w-3.5 text-brand" aria-hidden />
                  Bot của tôi
                </span>
                <div className="mt-1 font-display text-2xl font-bold tracking-tight">
                  {myBots.length} bot đang đăng
                </div>
              </div>
              <Link
                href="/dashboard"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-xs font-semibold text-brand-foreground transition-colors hover:brightness-110"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Đăng bot mới
              </Link>
            </div>
          )}
        </div>

        {/* Seller CTA */}
        {!isSeller && (
          <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display text-lg font-bold tracking-tight">
              Bạn muốn bán bot?
            </h2>
            <p className="text-sm text-muted-foreground">
              Chuyển sang tài khoản Người bán để đăng bot lên chợ, quản lý tin đăng
              và nhận liên hệ trực tiếp từ người mua.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:brightness-110"
            >
              Chuyển sang vai trò người bán
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
