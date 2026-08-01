'use client';

import React from 'react';
import Link from 'next/link';
import { BotItem } from '@shared/types';
import { Star, ShieldCheck, Key, Eye, UserCheck, Activity } from 'lucide-react';

interface BotCardProps {
  bot: BotItem;
  onRentClick: (bot: BotItem) => void;
}

export function BotCard({ bot, onRentClick }: BotCardProps) {
  return (
    <div className="group relative flex flex-col rounded-2xl bg-zinc-900/90 border border-zinc-800/90 overflow-hidden hover:border-cyan-500/50 hover:shadow-2xl hover:shadow-cyan-500/10 transition-all duration-300">
      {/* Cover Image & Badges */}
      <div className="relative h-44 w-full overflow-hidden bg-zinc-950">
        <img
          src={bot.coverImage}
          alt={bot.title}
          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/40 to-transparent" />

        {/* Live Status indicator */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900/80 backdrop-blur-md border border-zinc-700/80 text-[11px] font-semibold text-white">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-emerald-400 capitalize">{bot.status}</span>
        </div>

        {/* Category Badge */}
        <div className="absolute top-3 right-3 text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 backdrop-blur-md">
          {bot.categoryName}
        </div>

        {/* Provider Avatar */}
        <div className="absolute -bottom-3 left-4 flex items-center gap-2">
          <img
            src={bot.provider.avatar}
            alt={bot.provider.name}
            className="w-8 h-8 rounded-full border-2 border-zinc-900 object-cover shadow-md"
          />
          <span className="text-xs font-medium text-zinc-300 drop-shadow flex items-center gap-1">
            {bot.provider.name}
            {bot.provider.isVerified && <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 inline" />}
          </span>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-4 pt-5 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <Link href={`/bots/${bot.id}`}>
            <h3 className="text-base font-bold text-white group-hover:text-cyan-400 transition-colors line-clamp-1">
              {bot.title}
            </h3>
          </Link>
          <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">{bot.tagline}</p>
        </div>

        {/* Features pills */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {bot.tags.slice(0, 3).map((tag, idx) => (
            <span
              key={idx}
              className="text-[10px] font-medium bg-zinc-800/60 text-zinc-400 px-2 py-0.5 rounded-md border border-zinc-700/50"
            >
              #{tag}
            </span>
          ))}
        </div>

        {/* Rating & Stats */}
        <div className="flex items-center justify-between text-xs text-zinc-400 border-t border-zinc-800/80 pt-3">
          <div className="flex items-center gap-1 text-amber-400 font-semibold">
            <Star className="w-3.5 h-3.5 fill-amber-400" />
            <span>{bot.rating.toFixed(1)}</span>
            <span className="text-[10px] text-zinc-500">({bot.reviewCount})</span>
          </div>

          <div className="flex items-center gap-1 text-zinc-400 text-[11px]">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>{bot.totalRentals} lượt thuê</span>
          </div>
        </div>

        {/* Pricing & CTA */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <span className="text-[10px] text-zinc-500 uppercase block font-medium">Giá chỉ từ</span>
            <div className="text-sm font-extrabold text-cyan-400">
              {bot.pricing.daily.toLocaleString('vi-VN')} <span className="text-[10px] font-normal text-zinc-400">đ/ngày</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/bots/${bot.id}`}
              className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
              title="Xem chi tiết"
            >
              <Eye className="w-4 h-4" />
            </Link>
            <button
              onClick={() => onRentClick(bot)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-semibold text-xs text-white shadow-md shadow-cyan-500/20 hover:opacity-95 transition-all flex items-center gap-1.5"
            >
              <Key className="w-3.5 h-3.5" />
              Thuê Ngay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
