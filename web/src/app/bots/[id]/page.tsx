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
  Clock,
  ArrowLeft,
  Share2,
  MessageSquare,
  Sparkles,
  Zap
} from 'lucide-react';

export default function BotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { bots } = useRole();
  const [activeTab, setActiveTab] = useState<'overview' | 'features' | 'reviews'>('overview');
  const [isRentalOpen, setIsRentalOpen] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);

  const bot: BotItem | undefined = bots.find((b) => b.id === id || b.slug === id) || bots[0];

  if (!bot) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <p>Bot không tồn tại.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Back Link */}
        <Link
          href="/bots"
          className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-cyan-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại danh sách Bot
        </Link>

        {/* Hero Header Card */}
        <div className="rounded-3xl bg-zinc-900/90 border border-zinc-800 p-6 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cover Preview Image */}
          <div className="relative rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 h-64 lg:h-auto">
            <img src={bot.coverImage} alt={bot.title} className="w-full h-full object-cover" />
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900/80 backdrop-blur-md border border-zinc-700 text-xs font-semibold">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-400 capitalize">{bot.status}</span>
            </div>
            <div className="absolute top-3 right-3 text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              {bot.categoryName}
            </div>
          </div>

          {/* Bot Details Info */}
          <div className="lg:col-span-2 flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center gap-2 text-xs text-zinc-400 mb-2">
                <span>Phiên bản: <strong className="text-cyan-400">{bot.version}</strong></span>
                <span>•</span>
                <span>Loại license: <strong className="text-white capitalize">{bot.licenseType}</strong></span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-black text-white leading-snug mb-3">{bot.title}</h1>
              <p className="text-sm text-zinc-300 leading-relaxed mb-4">{bot.tagline}</p>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-6">
                {bot.tags.map((t, idx) => (
                  <span
                    key={idx}
                    className="text-xs bg-zinc-800 text-zinc-400 px-3 py-1 rounded-lg border border-zinc-700/60"
                  >
                    #{t}
                  </span>
                ))}
              </div>

              {/* Rating & Stats row */}
              <div className="flex flex-wrap items-center gap-6 border-y border-zinc-800 py-4 text-xs">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                  <Star className="w-4 h-4 fill-amber-400" />
                  <span className="text-sm">{bot.rating.toFixed(1)}</span>
                  <span className="text-zinc-500 font-normal">({bot.reviewCount} đánh giá từ khách)</span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span><strong>{bot.totalRentals}</strong> lượt thuê</span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <Zap className="w-4 h-4 text-emerald-400" />
                  <span><strong>{bot.activeRentals}</strong> người đang dùng</span>
                </div>
              </div>
            </div>

            {/* Price Box & CTA */}
            <div className="p-4 rounded-2xl bg-zinc-950 border border-cyan-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs text-zinc-400 block mb-0.5">Bảng giá niêm yết:</span>
                <div className="flex items-baseline gap-3 text-cyan-400">
                  <span className="text-2xl font-black">{bot.pricing.daily.toLocaleString('vi-VN')} đ/ngày</span>
                  <span className="text-xs text-zinc-400 font-normal">
                    (Hoặc {bot.pricing.monthly.toLocaleString('vi-VN')} đ/tháng)
                  </span>
                </div>
              </div>

              <button
                onClick={() => setIsRentalOpen(true)}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-bold text-sm text-white shadow-lg shadow-cyan-500/20 hover:opacity-95 transition-all flex items-center justify-center gap-2"
              >
                <Key className="w-4 h-4" />
                Thuê Bot Ngay
              </button>
            </div>
          </div>
        </div>

        {/* Content Tabs & Sidebar Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tab buttons */}
            <div className="flex border-b border-zinc-800 gap-4 text-sm font-semibold">
              {[
                { id: 'overview', label: 'Tổng Quan & Hướng Dẫn' },
                { id: 'features', label: 'Danh Sách Tính Năng' },
                { id: 'reviews', label: `Đánh Giá Từ Khách (${bot.reviews?.length || 0})` }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`pb-3 text-xs font-bold transition-all relative ${
                    activeTab === tab.id ? 'text-cyan-400 border-b-2 border-cyan-500' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab 1: Overview */}
            {activeTab === 'overview' && (
              <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4 text-xs leading-relaxed text-zinc-300">
                <h3 className="text-base font-bold text-white">Mô tả sản phẩm</h3>
                <p>{bot.description}</p>

                <h4 className="text-sm font-bold text-white pt-2">Yêu cầu hệ thống</h4>
                <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 font-mono text-cyan-400">
                  {bot.systemReqs}
                </div>
              </div>
            )}

            {/* Tab 2: Features */}
            {activeTab === 'features' && (
              <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3 text-xs text-zinc-300">
                <h3 className="text-base font-bold text-white mb-2">Tính năng chi tiết</h3>
                {bot.features.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Tab 3: Reviews */}
            {activeTab === 'reviews' && (
              <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4">
                <h3 className="text-base font-bold text-white">Đánh giá thực tế từ người thuê</h3>
                {bot.reviews && bot.reviews.length > 0 ? (
                  bot.reviews.map((rev) => (
                    <div key={rev.id} className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <img src={rev.userAvatar} alt={rev.userName} className="w-6 h-6 rounded-full object-cover" />
                          <span className="font-bold text-white">{rev.userName}</span>
                        </div>
                        <span className="text-zinc-500">{rev.date}</span>
                      </div>
                      <div className="flex text-amber-400">
                        {Array.from({ length: rev.rating }).map((_, i) => (
                          <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                        ))}
                      </div>
                      <p className="text-xs text-zinc-300">{rev.comment}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-zinc-400">Chưa có đánh giá nào cho bot này.</p>
                )}
              </div>
            )}
          </div>

          {/* Sidebar Provider Card (1 col) */}
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-4">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Thông tin Nhà Cung Cấp</span>
              <div className="flex items-center gap-3">
                <img
                  src={bot.provider.avatar}
                  alt={bot.provider.name}
                  className="w-12 h-12 rounded-full border-2 border-cyan-500/40 object-cover"
                />
                <div>
                  <div className="flex items-center gap-1 font-bold text-white text-sm">
                    {bot.provider.name}
                    {bot.provider.isVerified && <ShieldCheck className="w-4 h-4 text-cyan-400" />}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-amber-400">
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    <span>{bot.provider.rating} / 5.0</span>
                    <span className="text-zinc-500 font-normal">({bot.provider.totalSales} giao dịch)</span>
                  </div>
                </div>
              </div>

              <div className="text-xs text-zinc-400 space-y-2 pt-2 border-t border-zinc-800">
                <p>• Tham gia từ: <strong className="text-zinc-200">{bot.provider.joinedDate}</strong></p>
                <p>• Tốc độ hỗ trợ kỹ thuật: <strong className="text-emerald-400">Dưới 15 phút</strong></p>
              </div>

              <button
                onClick={() => alert(`Đã gửi yêu cầu chat với nhà cung cấp ${bot.provider.name}`)}
                className="w-full py-2.5 rounded-xl border border-zinc-700 bg-zinc-950 text-xs font-semibold text-zinc-300 hover:text-white hover:border-cyan-500 transition-colors"
              >
                Nhắn tin hỏi nhà cung cấp
              </button>
            </div>
          </div>
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
