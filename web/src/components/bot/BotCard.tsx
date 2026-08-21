'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Eye, Star } from 'lucide-react';
import type { BotCategorySlug, BotItem } from '@shared/types';
import { TrustedBadge } from '@/components/trust/TrustedBadge';
import { MediaImage } from '@/components/media/MediaImage';
import { getBotPriceDisplay } from '@/lib/bot-pricing';
import { cn } from '@/lib/utils';

interface BotCardProps {
  bot: BotItem;
}

const statusMeta: Record<BotItem['status'], { label: string; dot: string }> = {
  online: { label: 'Hoạt động', dot: 'bg-emerald-500' },
  maintenance: { label: 'Bảo trì', dot: 'bg-amber-500' },
  offline: { label: 'Ngoại tuyến', dot: 'bg-zinc-400' },
};

const platformLabels: Partial<Record<BotCategorySlug, string>> = {
  messenger: 'Facebook',
  telegram: 'Telegram',
  discord: 'Discord',
  zalo: 'Zalo',
  instagram: 'Instagram',
  ai: 'AI',
  automation: 'Automation',
  other: 'Khác',
};

function BotCover({ bot }: { bot: BotItem }) {
  return <MediaImage src={bot.coverImage} fallbackSrc="/favicon.svg" alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />;
}

export function BotCard({ bot }: BotCardProps) {
  const status = statusMeta[bot.status] ?? statusMeta.offline;
  const platform = platformLabels[bot.categorySlug] ?? bot.categoryName;
  const sellerHref = bot.seller.slug ? `/sellers/${bot.seller.slug}` : `/sellers/${bot.seller.id}`;

  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card transition-[border-color,box-shadow] duration-200 hover:border-brand/40 hover:shadow-[0_10px_30px_-20px_rgba(0,0,0,0.45)]">
      <Link
        href={`/bots/${encodeURIComponent(bot.id)}`}
        aria-label={`Xem ${bot.title}`}
        className="relative block aspect-video overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
      >
        <BotCover bot={bot} />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
            <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} aria-hidden />
            {status.label}
          </span>
          <span className="max-w-[48%] truncate rounded-full border border-white/20 bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
            {platform}
          </span>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <Link href={`/bots/${encodeURIComponent(bot.id)}`} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
          <h3 className="line-clamp-1 text-[15px] font-bold leading-snug text-foreground transition-colors group-hover:text-brand">
            {bot.title}
          </h3>
        </Link>
        <p className="mt-1 line-clamp-1 text-xs leading-relaxed text-muted-foreground">{bot.tagline}</p>

        <Link
          href={sellerHref}
          title={`Hồ sơ nhà cung cấp ${bot.seller.name}`}
          className="mt-3 inline-flex min-w-0 items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <MediaImage src={bot.seller.avatar} fallbackSrc="/avt.png" alt="" className="h-6 w-6 shrink-0 rounded-full border border-border object-cover" />
          <span className="min-w-0 truncate font-semibold text-foreground">{bot.seller.name}</span>
          {bot.seller.isTrusted ? (
            <TrustedBadge
              size="sm"
              interactive={false}
              info={{ isTrusted: true, trustScore: bot.seller.reputation, rating: bot.seller.rating }}
            />
          ) : null}
        </Link>

        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 font-semibold text-foreground">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
            {bot.rating.toFixed(1)} <span className="font-normal text-muted-foreground">({bot.reviewCount})</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5" aria-hidden />
            {bot.views.toLocaleString('vi-VN')}
          </span>
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-border pt-4">
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground">Giá thuê</p>
            <p className="mt-0.5 truncate text-sm font-bold text-foreground">{getBotPriceDisplay(bot.pricing)}</p>
          </div>
          <Link
            href={`/bots/${encodeURIComponent(bot.id)}`}
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-bold text-brand-foreground transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            Xem bot
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}
