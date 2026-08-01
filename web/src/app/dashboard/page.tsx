'use client';

import React, { useState } from 'react';
import { useRole } from '../../context/RoleContext';
import { BotRental, BotItem } from '@shared/types';
import { CreateBotModal } from '../../components/modals/CreateBotModal';
import { DepositModal } from '../../components/modals/DepositModal';
import {
  LayoutDashboard,
  Key,
  Building2,
  Activity,
  PlusCircle,
  DollarSign,
  Copy,
  ExternalLink,
  RefreshCw,
  Power,
  ShieldCheck,
  Zap,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Users
} from 'lucide-react';
import { toast } from 'sonner';

export default function DashboardPage() {
  const { role, setRole, rentals, bots, wallet, user, renewRental } = useRole();
  const [activeTab, setActiveTab] = useState<'renter' | 'provider'>(role === 'provider' ? 'provider' : 'renter');
  const [isCreateBotOpen, setIsCreateBotOpen] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);

  const renterRentals = rentals.filter((r) => r.renterId === user.id);
  const providerBots = bots.filter((b) => b.provider.id === user.id || b.provider.name === 'DevNguyen_Pro');

  const totalEarnings = providerBots.reduce((sum, b) => sum + b.pricing.monthly * b.activeRentals, 0);

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('Đã sao chép License Key vào khay nhớ tạm!');
  };

  const handleRenew = (rentalId: string) => {
    renewRental(rentalId, 1);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-widest mb-1">
              <LayoutDashboard className="w-4 h-4" /> Bảng Điều Khiển Donix
            </div>
            <h1 className="text-3xl font-black text-white">Quản Lý Hoạt Động & Giao Dịch</h1>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex p-1 rounded-2xl bg-zinc-900 border border-zinc-800">
            <button
              onClick={() => {
                setActiveTab('renter');
                if (role !== 'renter') setRole('renter');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'renter'
                  ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Key className="w-4 h-4" />
              Khách Thuê Bot ({renterRentals.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('provider');
                if (role !== 'provider') setRole('provider');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'provider'
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Building2 className="w-4 h-4" />
              Cho Thuê Bot ({providerBots.length})
            </button>
          </div>
        </div>

        {/* VIEW 1: KHÁCH THUÊ BOT */}
        {activeTab === 'renter' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-cyan-400" /> Danh Sách Bot Đang Thuê & Kích Hoạt
              </h2>
            </div>

            {renterRentals.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {renterRentals.map((item) => (
                  <div
                    key={item.id}
                    className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-cyan-500/40 transition-all space-y-4 shadow-xl"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={item.botCover}
                          alt={item.botTitle}
                          className="w-12 h-12 rounded-xl object-cover border border-zinc-700"
                        />
                        <div>
                          <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">
                            {item.botCategory}
                          </span>
                          <h3 className="text-sm font-bold text-white line-clamp-1">{item.botTitle}</h3>
                        </div>
                      </div>

                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold">
                        Đang Chạy
                      </span>
                    </div>

                    {/* License Key Box */}
                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Mã License Key:</span>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-cyan-400 font-bold text-xs">{item.licenseKey}</span>
                        <button
                          onClick={() => handleCopyKey(item.licenseKey)}
                          className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs"
                          title="Sao chép key"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Dates & Auto Renew */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
                      <div>
                        <span className="block text-[10px] text-zinc-500">Ngày thuê:</span>
                        <span>{item.startDate}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-zinc-500">Hạn sử dụng đến:</span>
                        <span className="text-amber-400 font-semibold">{item.endDate}</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-3 pt-2">
                      {item.accessUrl && (
                        <a
                          href={item.accessUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 py-2 px-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-semibold text-xs text-center hover:bg-cyan-500/20 flex items-center justify-center gap-1"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Vào Trang Treo Bot
                        </a>
                      )}
                      <button
                        onClick={() => handleRenew(item.id)}
                        className="flex-1 py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs text-center flex items-center justify-center gap-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Gia Hạn Thuê
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 rounded-2xl bg-zinc-900/40 border border-zinc-800 text-center">
                <p className="text-zinc-400 text-sm">Bạn chưa thuê bot nào. Hãy ghé Chợ Bot để chọn bot phù hợp!</p>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: NHÀ CUNG CẤP CHO THUÊ BOT */}
        {activeTab === 'provider' && (
          <div className="space-y-8">
            {/* Overview Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800">
                <div className="flex items-center justify-between mb-2 text-zinc-400">
                  <span className="text-xs font-semibold">Tổng Bot Đã Đăng</span>
                  <Building2 className="w-4 h-4 text-violet-400" />
                </div>
                <span className="text-2xl font-black text-white">{providerBots.length} Bot</span>
              </div>

              <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800">
                <div className="flex items-center justify-between mb-2 text-zinc-400">
                  <span className="text-xs font-semibold">Khách Đang Thuê Active</span>
                  <Users className="w-4 h-4 text-cyan-400" />
                </div>
                <span className="text-2xl font-black text-cyan-400">148 Khách</span>
              </div>

              <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800">
                <div className="flex items-center justify-between mb-2 text-zinc-400">
                  <span className="text-xs font-semibold">Doanh Thu Uớc Tính / Tháng</span>
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-2xl font-black text-emerald-400">
                  {totalEarnings.toLocaleString('vi-VN')} đ
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800">
                <div className="flex items-center justify-between mb-2 text-zinc-400">
                  <span className="text-xs font-semibold">Số Dư Chờ Rút Về Ví</span>
                  <DollarSign className="w-4 h-4 text-amber-400" />
                </div>
                <span className="text-2xl font-black text-amber-400">2,100,000 đ</span>
              </div>
            </div>

            {/* Provider Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-violet-400" /> Danh Sách Bot Đã Đăng Cho Thuê
              </h2>

              <div className="flex gap-3">
                <button
                  onClick={() => alert('Đã gửi yêu cầu rút 2.100.000 VNĐ về tài khoản ngân hàng của bạn!')}
                  className="px-4 py-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold hover:bg-amber-500/30 transition-colors"
                >
                  Rút Doanh Thu Về Ví Ngân Hàng
                </button>
                <button
                  onClick={() => setIsCreateBotOpen(true)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold shadow-lg shadow-violet-500/20 hover:opacity-95 transition-opacity flex items-center gap-1.5"
                >
                  <PlusCircle className="w-4 h-4" /> Đăng Bot Mới Cho Thuê
                </button>
              </div>
            </div>

            {/* Provider Bots Table */}
            <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/80">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950 text-zinc-400 font-semibold border-b border-zinc-800 uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Tên Bot / Phần Mềm</th>
                    <th className="p-4">Danh Mục</th>
                    <th className="p-4">Giá Ngày / Tháng</th>
                    <th className="p-4">Lượt Thuê Active</th>
                    <th className="p-4">Trạng Thái</th>
                    <th className="p-4 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 text-zinc-300">
                  {providerBots.map((b) => (
                    <tr key={b.id} className="hover:bg-zinc-800/40">
                      <td className="p-4 font-bold text-white flex items-center gap-3">
                        <img src={b.coverImage} alt={b.title} className="w-10 h-10 rounded-lg object-cover" />
                        <span>{b.title}</span>
                      </td>
                      <td className="p-4 text-cyan-400 font-medium">{b.categoryName}</td>
                      <td className="p-4 font-semibold">
                        {b.pricing.daily.toLocaleString('vi-VN')} đ / {b.pricing.monthly.toLocaleString('vi-VN')} đ
                      </td>
                      <td className="p-4 font-bold text-emerald-400">{b.activeRentals} Khách</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                          ONLINE 24/7
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => toast.success(`Đã cập nhật cấu hình cho ${b.title}`)}
                          className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs"
                        >
                          Cấu hình
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <CreateBotModal isOpen={isCreateBotOpen} onClose={() => setIsCreateBotOpen(false)} />
      <DepositModal isOpen={isDepositOpen} onClose={() => setIsDepositOpen(false)} />
    </div>
  );
}
