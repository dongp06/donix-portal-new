'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import { useRole } from '../../../context/RoleContext';
import { BotItem } from '@shared/types';
import { RentalModal } from '../../../components/modals/RentalModal';
import { DepositModal } from '../../../components/modals/DepositModal';
import {
  Star,
  ShieldCheck,
  Key,
  CheckCircle2,
  Activity,
  Cpu,
  ArrowLeft,
  MessageSquare,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function BotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { bots } = useRole();
  const [activeTab, setActiveTab] = useState<'overview' | 'features' | 'reviews'>('overview');
  const [isRentalOpen, setIsRentalOpen] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);

  const bot: BotItem | undefined = bots.find((b) => b.id === id || b.slug === id) || bots[0];

  if (!bot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <p>Bot không tồn tại.</p>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Tổng quan & hướng dẫn' },
    { id: 'features', label: 'Danh sách tính năng' },
    { id: 'reviews', label: `Đánh giá (${bot.reviews?.length || 0})` },
  ] as const;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        {/* Back */}
        <Link
          href="/bots"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Quay lại danh sách bot
        </Link>

        {/* Hero header */}
        <div className="grid grid-cols-1 gap-6 rounded-2xl border border-border bg-card p-6 md:p-8 lg:grid-cols-3">
          {/* Cover */}
          <div className="relative overflow-hidden rounded-xl border border-border bg-muted lg:col-span-1">
            <img src={bot.coverImage} alt={bot.title} className="h-64 w-full object-cover lg:h-full" />
            <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-2.5 py-1 text-xs font-semibold backdrop-blur-sm">
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  bot.status === 'online'
                    ? 'bg-emerald-500'
                    : bot.status === 'maintenance'
                      ? 'bg-amber-500'
                      : 'bg-zinc-500',
                )}
                aria-hidden
              />
              <span className="capitalize">{bot.status}</span>
            </div>
            <span className="absolute right-3 top-3 rounded-full border border-brand/30 bg-brand/10 px-2.5 py-1 text-[11px] font-semibold text-brand">
              {bot.categoryName}
            </span>
          </div>

          {/* Info */}
          <div className="flex flex-col justify-between space-y-6 lg:col-span-2">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  Phiên bản: <strong className="font-semibold text-foreground">{bot.version}</strong>
                </span>
                <span aria-hidden>•</span>
                <span>
                  License: <strong className="font-semibold text-foreground capitalize">{bot.licenseType}</strong>
                </span>
              </div>
              <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{bot.title}</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{bot.tagline}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {bot.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-lg border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    #{t}
                  </span>
                ))}
              </div>

              {/* Rating & stats */}
              <div className="mt-6 flex flex-wrap items-center gap-6 border-y border-border py-4 text-sm">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden />
                  {bot.rating.toFixed(1)}
                  <span className="font-normal text-muted-foreground">({bot.reviewCount} đánh giá)</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Activity className="h-4 w-4 text-brand" aria-hidden />
                  <strong className="font-semibold text-foreground">{bot.totalRentals}</strong> lượt thuê
                </span>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Zap className="h-4 w-4 text-brand" aria-hidden />
                  <strong className="font-semibold text-foreground">{bot.activeRentals}</strong> người đang dùng
                </span>
              </div>
            </div>

            {/* Price + CTA */}
            <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-brand/30 bg-background p-4 sm:flex-row sm:items-center">
              <div>
                <span className="block text-xs text-muted-foreground">Bảng giá niêm yết</span>
                <div className="mt-0.5 flex items-baseline gap-3">
                  <span className="text-2xl font-bold text-foreground">
                    {bot.pricing.daily.toLocaleString('vi-VN')} đ<span className="text-sm font-normal text-muted-foreground">/ngày</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    hoặc {bot.pricing.monthly.toLocaleString('vi-VN')} đ/tháng
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRentalOpen(true)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-8 py-3 text-sm font-semibold text-brand-foreground transition-colors hover:brightness-110 sm:w-auto"
              >
                <Key className="h-4 w-4" aria-hidden />
                Thuê bot ngay
              </button>
            </div>
          </div>
        </div>

        {/* Tabs + sidebar */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main */}
          <div className="space-y-6 lg:col-span-2">
            <div className="flex gap-4 border-b border-border text-sm font-semibold" role="tablist" aria-label="Chi tiết bot">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    '-mb-px border-b-2 pb-3 text-sm font-semibold transition-colors',
                    activeTab === tab.id
                      ? 'border-brand text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'overview' && (
              <div className="space-y-4 rounded-2xl border border-border bg-card p-6 text-sm leading-relaxed text-muted-foreground">
                <h3 className="font-display text-base font-semibold text-foreground">Mô tả sản phẩm</h3>
                <p>{bot.description}</p>
                <h4 className="pt-2 font-semibold text-foreground">Yêu cầu hệ thống</h4>
                <pre className="overflow-x-auto rounded-xl border border-border bg-background p-3 font-mono text-xs text-brand">
                  {bot.systemReqs}
                </pre>
              </div>
            )}

            {activeTab === 'features' && (
              <div className="space-y-3 rounded-2xl border border-border bg-card p-6">
                <h3 className="font-display text-base font-semibold text-foreground">Tính năng chi tiết</h3>
                {bot.features.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-3 rounded-xl border border-border bg-background p-3 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
                <h3 className="font-display text-base font-semibold text-foreground">Đánh giá từ người thuê</h3>
                {bot.reviews && bot.reviews.length > 0 ? (
                  bot.reviews.map((rev) => (
                    <div key={rev.id} className="space-y-2 rounded-xl border border-border bg-background p-4">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <img src={rev.userAvatar} alt={rev.userName} className="h-6 w-6 rounded-full object-cover" />
                          <span className="font-semibold text-foreground">{rev.userName}</span>
                        </div>
                        <span className="text-muted-foreground">{rev.date}</span>
                      </div>
                      <div className="flex text-amber-400">
                        {Array.from({ length: rev.rating }).map((_, i) => (
                          <Star key={i} className="h-3.5 w-3.5 fill-amber-400" aria-hidden />
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground">{rev.comment}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Chưa có đánh giá nào cho bot này.</p>
                )}
              </div>
            )}
          </div>

          {/* Provider sidebar */}
          <aside className="space-y-6">
            <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
              <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Thông tin nhà cung cấp
              </span>
              <div className="flex items-center gap-3">
                <img
                  src={bot.provider.avatar}
                  alt={bot.provider.name}
                  className="h-11 w-11 rounded-full border border-border object-cover"
                />
                <div>
                  <div className="flex items-center gap-1 text-sm font-semibold">
                    {bot.provider.name}
                    {bot.provider.isVerified && (
                      <ShieldCheck className="h-4 w-4 text-brand" aria-label="Đã xác thực" />
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
                    <span className="font-medium text-foreground">{bot.provider.rating} / 5.0</span>
                    <span>({bot.provider.totalSales} giao dịch)</span>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5 border-t border-border pt-4 text-xs text-muted-foreground">
                <p>
                  Tham gia: <strong className="font-semibold text-foreground">{bot.provider.joinedDate}</strong>
                </p>
                <p>
                  Hỗ trợ kỹ thuật: <strong className="font-semibold text-emerald-500">dưới 15 phút</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => alert(`Đã gửi yêu cầu chat với ${bot.provider.name}`)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold transition-colors hover:border-brand/40 hover:text-foreground"
              >
                <MessageSquare className="h-4 w-4" aria-hidden />
                Nhắn tin hỏi nhà cung cấp
              </button>
            </div>

            {/* System reqs quick card */}
            <div className="space-y-2 rounded-2xl border border-border bg-card p-6">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Cpu className="h-4 w-4 text-brand" aria-hidden /> Yêu cầu tối thiểu
              </span>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Win 7 / 10 / 11, RAM 4 GB, kết nối Internet ổn định. Chi tiết tại tab tổng quan.
              </p>
            </div>
          </aside>
        </div>
      </div>

      <RentalModal
        bot={bot}
        isOpen={isRentalOpen}
        onClose={() => setIsRentalOpen(false)}
        onOpenDeposit={() => setIsDepositOpen(true)}
      />
      <DepositModal isOpen={isDepositOpen} onClose={() => setIsDepositOpen(false)} />
    </div>
  );
}
