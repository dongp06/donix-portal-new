'use client';

import React from 'react';
import Link from 'next/link';
import { BotItem } from '@shared/types';
import { Star, Eye, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BotCardProps {
  bot: BotItem;
  onContactClick: (bot: BotItem) => void;
}

const statusMeta: Record<BotItem['status'], { label: string; dot: string }> = {
  online: { label: 'Trực tuyến', dot: 'status-online' },
  maintenance: { label: 'Bảo trì', dot: 'status-maintenance' },
  offline: { label: 'Ngoại tuyến', dot: 'status-offline' },
};

export function BotCard({ bot, onContactClick }: BotCardProps) {
  const status = statusMeta[bot.status] ?? statusMeta.offline;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors duration-300 hover:border-brand/40">
      {/* Cover Image */}
      <div className="relative h-44 w-full overflow-hidden bg-muted">
        <img
          src={bot.coverImage}
          alt={bot.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/10 to-transparent" />

        {/* Status + category */}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm">
            <span className={status.dot} aria-hidden />
            <span className="text-foreground">{status.label}</span>
          </span>
          <span className="rounded-full border border-brand/30 bg-brand/10 px-2.5 py-1 text-[11px] font-semibold text-brand">
            {bot.categoryName}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-1 text-base font-semibold text-foreground">{bot.title}</h3>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {bot.tagline}
        </p>

        {/* Rating & stats */}
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 font-medium">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
            <span className="text-foreground">{bot.rating.toFixed(1)}</span>
            <span>({bot.reviewCount})</span>
          </span>
          <span>{bot.totalRentals} lượt thuê</span>
        </div>

        {/* Pricing & CTA */}
        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <div>
            <span className="block text-[11px] text-muted-foreground">Giá từ</span>
            <div className="text-base font-bold text-foreground">
              {bot.pricing.daily.toLocaleString('vi-VN')}
              <span className="text-xs font-normal text-muted-foreground"> đ/ngày</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/bots/${bot.id}`}
              aria-label={`Xem chi tiết ${bot.title}`}
              className={cn(
                'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground',
                'transition-colors hover:border-brand/40 hover:text-foreground',
              )}
            >
              <Eye className="h-4 w-4" aria-hidden />
            </Link>
            <button
              type="button"
              onClick={() => onContactClick(bot)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-xs font-semibold text-brand-foreground transition-colors hover:brightness-110 active:scale-[0.98]"
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden />
              Liên hệ
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
