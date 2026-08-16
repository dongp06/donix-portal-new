'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRole } from '../context/RoleContext';
import { BotItem } from '@shared/types';
import { BotCard } from '../components/bot/BotCard';
import { ContactModal } from '../components/modals/ContactModal';
import {
  Bot,
  Zap,
  ShieldCheck,
  Search,
  Users,
  Cpu,
  ArrowRight,
  Sparkles,
  MessageSquare,
  CheckCircle2,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function HomePage() {
  const { bots } = useRole();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBotForContact, setSelectedBotForContact] = useState<BotItem | null>(null);

  const categories = [
    { id: 'all', name: 'Tất cả bot', icon: Sparkles },
    { id: 'messenger', name: 'Bot Messenger', icon: MessageSquare },
    { id: 'telegram', name: 'Bot Telegram', icon: Zap },
    { id: 'discord', name: 'Bot Discord', icon: Users },
    { id: 'zalo', name: 'Bot Zalo OA', icon: ShieldCheck },
    { id: 'instagram', name: 'Bot Instagram DM', icon: Bot },
  ];

  const filteredBots = bots.filter((bot) => {
    const matchesCat = selectedCategory === 'all' || bot.categorySlug === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      bot.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bot.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bot.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  return (
    <div className="bg-background text-foreground">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border">
        {/* Ambient brand glow — subtle, single hue */}
        <div
          className="pointer-events-none absolute -top-40 left-1/2 h-[30rem] w-[52rem] -translate-x-1/2 rounded-full bg-brand/10 blur-[120px]"
          aria-hidden
        />

        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-14 text-center sm:px-6 sm:pb-20 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/5 px-3.5 py-1.5 text-xs font-semibold text-brand">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Diễn đàn & chợ rao bán bot tự động hóa
          </div>

          <h1 className="text-display mx-auto mt-6 max-w-4xl text-balance">
            Mua bán bot tự động, giao dịch an toàn 24/7
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Nơi chủ bot đăng tin rao bán và cộng đồng trao đổi. Người mua liên hệ
            trực tiếp người bán, giao dịch tự thỏa thuận.
          </p>

          {/* Search */}
          <div className="relative mx-auto mt-8 max-w-xl">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm bot Messenger, Telegram, Zalo, Discord..."
              className="h-12 w-full rounded-xl border border-border bg-card pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/30"
              aria-label="Tìm kiếm bot"
            />
          </div>

          {/* Stats */}
          <dl className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: 'Bot đang hoạt động', value: '105+', icon: Cpu },
              { label: 'Giao dịch kết nối', value: '8.490+', icon: Zap },
              { label: 'Chủ bot đăng bán', value: '32+', icon: Users },
              { label: 'Bài thảo luận', value: '1.200+', icon: MessageSquare },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="rounded-2xl border border-border bg-card p-4 text-center">
                  <Icon className="mx-auto mb-2 h-5 w-5 text-brand" aria-hidden />
                  <dd className="font-display text-2xl font-bold tracking-tight">{stat.value}</dd>
                  <dt className="mt-0.5 text-[11px] text-muted-foreground">{stat.label}</dt>
                </div>
              );
            })}
          </dl>
        </div>
      </section>

      {/* MARKETPLACE */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">Danh mục bot</p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight md:text-3xl">
              Bot tự động hóa nổi bật
            </h2>
          </div>
          <Link
            href="/bots"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
          >
            Xem toàn bộ chợ bot ({bots.length})
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        {/* Category pills */}
        <div className="mb-8 flex items-center gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Lọc theo danh mục">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const selected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                aria-pressed={selected}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors',
                  selected
                    ? 'border-brand/50 bg-brand/10 text-brand'
                    : 'border-border bg-card text-muted-foreground hover:border-brand/30 hover:text-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* Bot grid */}
        {filteredBots.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredBots.map((bot) => (
              <BotCard key={bot.id} bot={bot} onContactClick={(b) => setSelectedBotForContact(b)} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <p className="text-sm text-muted-foreground">Không tìm thấy bot phù hợp với tìm kiếm của bạn.</p>
          </div>
        )}
      </section>

      {/* DUAL-ROLE */}
      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
              Một sàn, hai chiều: mua bot & bán bot
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Dù bạn cần bot chạy tự động hay muốn kinh doanh bot, Donix đều có giải pháp.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Người mua */}
            <div className="rounded-2xl border border-border bg-card p-7">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-xl bg-brand/10 p-2.5 text-brand">
                  <Search className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Người mua bot</h3>
                  <p className="text-xs text-muted-foreground">Dành cho người cần tự động hóa</p>
                </div>
              </div>
              <ul className="mb-7 space-y-2.5 text-sm text-muted-foreground">
                {[
                  'Duyệt bot theo danh mục: Messenger, Telegram, Zalo, Discord',
                  'Xem thông tin, đánh giá và giá tham khảo của từng bot',
                  'Liên hệ trực tiếp người bán qua Zalo / Telegram để chốt',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/bots"
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold transition-colors hover:border-brand/40 hover:text-foreground"
              >
                Khám phá danh sách bot
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>

            {/* Chủ bot */}
            <div className="rounded-2xl border border-brand/30 bg-card p-7">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-xl bg-brand/10 p-2.5 text-brand">
                  <Building2 className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Người bán bot / developer</h3>
                  <p className="text-xs text-muted-foreground">Dành cho người đăng bán bot</p>
                </div>
              </div>
              <ul className="mb-7 space-y-2.5 text-sm text-muted-foreground">
                {[
                  'Miễn phí đăng tin rao bán bot',
                  'Hiển thị thông tin liên hệ để khách chủ động nhắn tin',
                  'Quản lý tất cả tin đăng của bạn trong một trang',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/dashboard"
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:brightness-110"
              >
                Đăng tin bot bán
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* COMMUNITY PREVIEW */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="eyebrow">Cộng đồng</p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight md:text-3xl">
              Thảo luận mới nhất
            </h2>
          </div>
          <Link href="/community" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
            Vào diễn đàn
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {[
            {
              title: 'Kinh nghiệm chống khóa nick Zalo khi dùng bot spam tin nhắn',
              author: 'CyberBot_Studio',
              category: 'Chia sẻ kinh nghiệm',
              replies: 15,
            },
            {
              title: '[Yêu cầu làm bot] Cần đặt bot tự động crawl tin tuyển dụng IT',
              author: 'MinhTu_Game99',
              category: 'Yêu cầu làm bot',
              replies: 8,
            },
            {
              title: 'Đã cập nhật Auto Võ Lâm v4.8.2: sửa lỗi đơ màn hình khi vượt ải 80',
              author: 'DevNguyen_Pro',
              category: 'Thảo luận Dev',
              replies: 12,
            },
          ].map((topic) => (
            <Link
              key={topic.title}
              href="/community"
              className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 transition-colors hover:border-brand/40"
            >
              <div>
                <span className="rounded-full border border-brand/30 bg-brand/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand">
                  {topic.category}
                </span>
                <h4 className="mt-3 line-clamp-2 text-sm font-semibold leading-snug">{topic.title}</h4>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[11px] text-muted-foreground">
                <span>Bởi {topic.author}</span>
                <span>{topic.replies} phản hồi</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <ContactModal
        bot={selectedBotForContact}
        isOpen={!!selectedBotForContact}
        onClose={() => setSelectedBotForContact(null)}
      />
    </div>
  );
}
