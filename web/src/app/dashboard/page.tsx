'use client';

import React, { useState } from 'react';
import { useRole } from '../../context/RoleContext';
import { BotRental, BotItem } from '@shared/types';
import { CreateBotModal } from '../../components/modals/CreateBotModal';
import { DepositModal } from '../../components/modals/DepositModal';
import {
  Key,
  Building2,
  Plus,
  DollarSign,
  Copy,
  ExternalLink,
  RefreshCw,
  TrendingUp,
  Users,
  Zap,
  LayoutDashboard,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const { role, setRole, rentals, bots, wallet, user, renewRental } = useRole();
  const [activeTab, setActiveTab] = useState<'renter' | 'provider'>(
    role === 'provider' ? 'provider' : 'renter',
  );
  const [isCreateBotOpen, setIsCreateBotOpen] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);

  const renterRentals = rentals.filter((r) => r.renterId === user.id);
  const providerBots = bots.filter(
    (b) => b.provider.id === user.id || b.provider.name === 'DevNguyen_Pro',
  );
  const totalEarnings = providerBots.reduce(
    (sum, b) => sum + b.pricing.monthly * b.activeRentals,
    0,
  );

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('Đã sao chép license key');
  };

  const handleRenew = (rentalId: string) => {
    renewRental(rentalId, 1);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow">Bảng điều khiển</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
              Quản lý hoạt động & giao dịch
            </h1>
          </div>

          {/* Mode switch */}
          <div className="flex rounded-xl border border-border bg-card p-1" role="tablist" aria-label="Chế độ xem">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'renter'}
              onClick={() => {
                setActiveTab('renter');
                if (role !== 'renter') setRole('renter');
              }}
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors',
                activeTab === 'renter'
                  ? 'bg-brand text-brand-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Key className="h-4 w-4" aria-hidden />
              Khách thuê ({renterRentals.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'provider'}
              onClick={() => {
                setActiveTab('provider');
                if (role !== 'provider') setRole('provider');
              }}
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors',
                activeTab === 'provider'
                  ? 'bg-brand text-brand-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Building2 className="h-4 w-4" aria-hidden />
              Chủ bot ({providerBots.length})
            </button>
          </div>
        </div>

        {/* VIEW: RENTER */}
        {activeTab === 'renter' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-xl font-bold">
                <Zap className="h-5 w-5 text-brand" aria-hidden />
                Bot đang thuê & kích hoạt
              </h2>
            </div>

            {renterRentals.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {renterRentals.map((item) => (
                  <div key={item.id} className="space-y-4 rounded-2xl border border-border bg-card p-6">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={item.botCover}
                          alt={item.botTitle}
                          className="h-12 w-12 rounded-xl border border-border object-cover"
                        />
                        <div>
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-brand">
                            {item.botCategory}
                          </span>
                          <h3 className="line-clamp-1 text-sm font-semibold">{item.botTitle}</h3>
                        </div>
                      </div>
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-500">
                        Đang chạy
                      </span>
                    </div>

                    {/* License key */}
                    <div className="space-y-1 rounded-xl border border-border bg-background p-3">
                      <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Mã license key
                      </span>
                      <div className="flex items-center justify-between gap-2 rounded-lg bg-muted p-2 font-mono text-sm text-brand">
                        <span className="truncate">{item.licenseKey}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyKey(item.licenseKey)}
                          className="shrink-0 rounded bg-brand/10 px-2 py-1 text-[11px] font-sans font-semibold text-brand transition-colors hover:bg-brand/20"
                          aria-label="Sao chép license key"
                        >
                          <Copy className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="block text-[11px] text-muted-foreground">Hạn sử dụng đến</span>
                        <span className="font-semibold text-foreground">{item.endDate}</span>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      {item.accessUrl && (
                        <a
                          href={item.accessUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-brand/30 bg-brand/10 px-3 py-2 text-xs font-semibold text-brand transition-colors hover:bg-brand/15"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                          Vào trang treo bot
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRenew(item.id)}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold transition-colors hover:border-brand/40 hover:text-foreground"
                      >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                        Gia hạn thuê
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card p-12 text-center">
                <p className="text-sm text-muted-foreground">
                  Bạn chưa thuê bot nào. Hãy ghé chợ bot để chọn bot phù hợp.
                </p>
              </div>
            )}
          </div>
        )}

        {/* VIEW: PROVIDER */}
        {activeTab === 'provider' && (
          <div className="space-y-8">
            {/* Stats */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Tổng bot đã đăng', value: `${providerBots.length} Bot`, icon: Building2 },
                { label: 'Khách đang thuê active', value: '148 Khách', icon: Users },
                { label: 'Doanh thu ước tính / tháng', value: `${totalEarnings.toLocaleString('vi-VN')} đ`, icon: TrendingUp },
                { label: 'Số dư chờ rút về ví', value: '2.100.000 đ', icon: DollarSign },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="rounded-2xl border border-border bg-card p-5">
                    <div className="mb-2 flex items-center justify-between text-muted-foreground">
                      <span className="text-xs font-semibold">{stat.label}</span>
                      <Icon className="h-4 w-4 text-brand" aria-hidden />
                    </div>
                    <span className="font-display text-2xl font-bold tracking-tight">{stat.value}</span>
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="flex items-center gap-2 font-display text-xl font-bold">
                <Building2 className="h-5 w-5 text-brand" aria-hidden />
                Danh sách bot đã đăng cho thuê
              </h2>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => alert('Đã gửi yêu cầu rút 2.100.000 VNĐ về tài khoản ngân hàng của bạn')}
                  className="inline-flex items-center rounded-xl border border-border bg-background px-4 py-2 text-xs font-semibold transition-colors hover:border-brand/40 hover:text-foreground"
                >
                  Rút doanh thu về ví
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreateBotOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground transition-colors hover:brightness-110"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Đăng bot mới cho thuê
                </button>
              </div>
            </div>

            {/* Provider bots table */}
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="p-4">Tên bot / phần mềm</th>
                    <th className="p-4">Danh mục</th>
                    <th className="p-4">Giá</th>
                    <th className="p-4">Khách active</th>
                    <th className="p-4">Trạng thái</th>
                    <th className="p-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {providerBots.map((b) => (
                    <tr key={b.id} className="transition-colors hover:bg-muted/40">
                      <td className="p-4 font-semibold">
                        <div className="flex items-center gap-3">
                          <img src={b.coverImage} alt={b.title} className="h-10 w-10 rounded-lg object-cover" />
                          <span className="line-clamp-1">{b.title}</span>
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground">{b.categoryName}</td>
                      <td className="p-4">
                        {b.pricing.daily.toLocaleString('vi-VN')} đ / {b.pricing.monthly.toLocaleString('vi-VN')} đ
                      </td>
                      <td className="p-4 font-bold text-emerald-500">{b.activeRentals} Khách</td>
                      <td className="p-4">
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-500">
                          ONLINE 24/7
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          type="button"
                          onClick={() => toast.success(`Đã cập nhật cấu hình cho ${b.title}`)}
                          className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold transition-colors hover:border-brand/40 hover:text-foreground"
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
