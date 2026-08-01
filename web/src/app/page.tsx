'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRole } from '../context/RoleContext';
import { BotItem } from '@shared/types';
import { BotCard } from '../components/bot/BotCard';
import { RentalModal } from '../components/modals/RentalModal';
import { DepositModal } from '../components/modals/DepositModal';
import {
  Bot,
  Zap,
  ShieldCheck,
  TrendingUp,
  Search,
  Key,
  Users,
  Cpu,
  ArrowRight,
  Sparkles,
  Gamepad2,
  Share2,
  ShoppingBag,
  Wrench,
  CheckCircle2,
  Building2,
  DollarSign,
  Lock,
  MessageSquare
} from 'lucide-react';

export default function HomePage() {
  const { bots, role, toggleRole } = useRole();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBotForRent, setSelectedBotForRent] = useState<BotItem | null>(null);
  const [isDepositOpen, setIsDepositOpen] = useState<boolean>(false);

  const categories = [
    { id: 'all', name: 'Tất cả Bot', icon: Sparkles },
    { id: 'messenger', name: 'Bot Messenger', icon: MessageSquare },
    { id: 'telegram', name: 'Bot Telegram', icon: Zap },
    { id: 'discord', name: 'Bot Discord', icon: Users },
    { id: 'zalo', name: 'Bot Zalo OA', icon: ShieldCheck },
    { id: 'instagram', name: 'Bot Instagram DM', icon: Bot }
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
    <div className="min-h-screen bg-zinc-950 text-white selection:bg-cyan-500 selection:text-black">
      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28 border-b border-zinc-800/80">
        {/* Glow Gradients Background */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-cyan-500/15 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[400px] h-[250px] bg-violet-500/15 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          {/* Top Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900/90 border border-cyan-500/30 text-xs font-semibold text-cyan-400 mb-6 shadow-lg shadow-cyan-500/10">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Sàn Trung Gian & Cộng Đồng Cho Thuê Bot Tự Động Hóa</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.15] mb-6">
            Sàn Trung Gian Cho Thuê Bot <br />
            <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 bg-clip-text text-transparent">
              Cộng Đồng Đăng Bán & Thuê Bot Tự Động 24/7
            </span>
          </h1>

          <p className="mx-auto max-w-3xl text-sm sm:text-base text-zinc-400 leading-relaxed mb-8">
            Nền tảng <strong>sàn giao dịch trung gian</strong> kết nối giữa các <strong>Chủ Bot (Developers)</strong> và <strong>Khách Thuê (Users)</strong>. Bảo hộ giao dịch an toàn 100%, tự động cấp License Key & giữ tiền trung gian đến khi bot hoạt động ổn định.
          </p>

          {/* Search bar */}
          <div className="mx-auto max-w-2xl relative mb-10">
            <div className="relative flex items-center">
              <Search className="absolute left-4 w-5 h-5 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm Bot Messenger, Telegram spam, Bot Discord, Bot Zalo SĐT, Instagram DM..."
                className="w-full pl-12 pr-32 py-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 shadow-2xl transition-all"
              />
              <button className="absolute right-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-bold text-xs text-white shadow-md shadow-cyan-500/20 hover:opacity-95 transition-opacity">
                Tìm Kiếm
              </button>
            </div>
          </div>

          {/* Live Platform Counters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              { label: 'Bot Đang Hoạt Động', value: '105+', icon: Cpu, color: 'text-cyan-400' },
              { label: 'Lượt Thuê Thành Công', value: '8,490+', icon: Zap, color: 'text-emerald-400' },
              { label: 'Chủ Bot / Provider', value: '32+', icon: Users, color: 'text-violet-400' },
              { label: 'Tổng Doanh Thu Chi Trả', value: '145 Tr VNĐ', icon: DollarSign, color: 'text-amber-400' }
            ].map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md flex flex-col items-center"
                >
                  <Icon className={`w-5 h-5 ${stat.color} mb-1`} />
                  <span className="text-xl sm:text-2xl font-black text-white">{stat.value}</span>
                  <span className="text-[11px] text-zinc-400 font-medium">{stat.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* BOT MARKETPLACE SECTION */}
      <section className="py-16 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-widest mb-1">
              <Zap className="w-4 h-4" /> Danh Mục Bot Cho Thuê
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Khám Phá Bot Tự Động Hóa Nổi Bật</h2>
          </div>

          <Link
            href="/bots"
            className="inline-flex items-center gap-2 text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            Xem toàn bộ chợ Bot ({bots.length}) <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-none mb-8">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                  isSelected
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400 shadow-lg shadow-cyan-500/10'
                    : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>

        {/* Bot Cards Grid */}
        {filteredBots.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBots.map((bot) => (
              <BotCard key={bot.id} bot={bot} onRentClick={(b) => setSelectedBotForRent(b)} />
            ))}
          </div>
        ) : (
          <div className="p-12 rounded-2xl bg-zinc-900/40 border border-zinc-800 text-center">
            <p className="text-zinc-400 text-sm">Không tìm thấy bot phù hợp với tìm kiếm của bạn.</p>
          </div>
        )}
      </section>

      {/* DUAL ROLE COMPARISON SECTION (KHÁCH THUÊ VS NGƯỜI CHO THUÊ) */}
      <section className="py-16 bg-zinc-900/50 border-y border-zinc-800/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="text-3xl font-black text-white mb-3">
              Mô Hình Kết Nối 2 Chiều: Thuê Bot & Cho Thuê Bot
            </h2>
            <p className="text-sm text-zinc-400">
              Dù bạn là người cần phần mềm chạy tự động hay là lập trình viên muốn kinh doanh bot, Donix đều mang lại giải pháp tối ưu nhất.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Box 1: Người Thuê Bot */}
            <div className="p-8 rounded-3xl bg-zinc-900 border border-cyan-500/30 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  <Key className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-widest">
                    Dành cho Người Thuê Bot
                  </span>
                  <h3 className="text-xl font-bold text-white">Khách Thuê Phổ Thông & Doanh Nghiệp</h3>
                </div>
              </div>

              <ul className="space-y-3 text-xs text-zinc-300 mb-8">
                {[
                  'Cấp mã License Key hoặc Web Portal tức thì 24/7 sau khi thanh toán',
                  'Thuê theo Giờ, Ngày hoặc Tháng tùy theo nhu cầu thực tế',
                  'Không cần máy cấu hình cao, hỗ trợ thuê VPS Cloud treo bot 24/7',
                  'Được hoàn tiền 100% nếu bot gặp sự cố không thể khắc phục'
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/bots"
                className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-600 font-bold text-black text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-cyan-500/20"
              >
                Khám Phá Danh Sách Bot Ngay <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Box 2: Người Cho Thuê Bot */}
            <div className="p-8 rounded-3xl bg-zinc-900 border border-violet-500/30 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-2xl bg-violet-500/20 text-violet-400 border border-violet-500/30">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-violet-400 uppercase tracking-widest">
                    Dành cho Chủ Bot / Developer
                  </span>
                  <h3 className="text-xl font-bold text-white">Nhà Phát Triển & Chủ Thuê Bot</h3>
                </div>
              </div>

              <ul className="space-y-3 text-xs text-zinc-300 mb-8">
                {[
                  'Miễn phí 0% chi phí niêm yết bot ban đầu',
                  'Hệ thống tự động phát sinh & xác thực License Key cho từng khách thuê',
                  'Quản lý số lượng máy active, ngắt quyền sử dụng khi hết hạn',
                  'Rút tiền doanh thu ví về Ngân hàng / MoMo tức thì không chờ duyệt lâu'
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => {
                  if (role !== 'provider') toggleRole();
                }}
                className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 font-bold text-white text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-violet-500/20"
              >
                Bật Chế Độ Cho Thuê Bot <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* COMMUNITY DISCUSSIONS PREVIEW */}
      <section className="py-16 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-widest mb-1">
              <MessageSquare className="w-4 h-4" /> Thảo Luận Mới Nhất
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Cộng Đồng Dev & Khách Thuê Bot</h2>
          </div>
          <Link href="/community" className="text-xs font-bold text-cyan-400 hover:underline">
            Vào Diễn Đàn &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              title: 'Kinh nghiệm chống khóa nick Zalo khi dùng Bot Spam tin nhắn',
              author: 'CyberBot_Studio',
              category: 'Chia sẻ kinh nghiệm',
              replies: 15,
              date: '2026-07-30'
            },
            {
              title: '[Yêu cầu làm bot] Cần thuê Bot tự động crawl tin tuyển dụng IT',
              author: 'MinhTu_Game99',
              category: 'Yêu cầu làm bot',
              replies: 8,
              date: '2026-07-29'
            },
            {
              title: 'Đã cập nhật Auto Võ Lâm v4.8.2: Sửa lỗi đơ màn hình khi vượt ải 80',
              author: 'DevNguyen_Pro',
              category: 'Thảo luận Dev',
              replies: 12,
              date: '2026-07-28'
            }
          ].map((topic, idx) => (
            <Link
              key={idx}
              href="/community"
              className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-cyan-500/40 transition-all flex flex-col justify-between"
            >
              <div>
                <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded font-semibold">
                  {topic.category}
                </span>
                <h4 className="text-sm font-bold text-white mt-2 mb-2 line-clamp-2">{topic.title}</h4>
              </div>
              <div className="flex items-center justify-between text-[11px] text-zinc-500 border-t border-zinc-800/80 pt-3">
                <span>Bởi {topic.author}</span>
                <span>{topic.replies} phản hồi</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* RENTAL MODAL */}
      <RentalModal
        bot={selectedBotForRent}
        isOpen={!!selectedBotForRent}
        onClose={() => setSelectedBotForRent(null)}
        onOpenDeposit={() => setIsDepositOpen(true)}
      />

      <DepositModal isOpen={isDepositOpen} onClose={() => setIsDepositOpen(false)} />
    </div>
  );
}
