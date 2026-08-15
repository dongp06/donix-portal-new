'use client';

import React, { useState } from 'react';
import { useRole } from '../../context/RoleContext';
import { DepositModal } from '../../components/modals/DepositModal';
import { Wallet, ArrowDownRight, ArrowUpRight, Plus, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function WalletPage() {
  const { wallet, user } = useRole();
  const [isDepositOpen, setIsDepositOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <div>
          <p className="eyebrow">Ví Donix</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Quản lý ví</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Theo dõi số dư, nạp tiền tự động và lịch sử thanh toán các gói thuê bot.
          </p>
        </div>

        {/* Balance card */}
        <div className="relative overflow-hidden rounded-2xl border border-brand/30 bg-card p-8">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand/10 blur-3xl"
            aria-hidden
          />
          <div className="relative z-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Số dư ví khả dụng
              </span>
              <div className="mt-1 text-4xl font-bold tracking-tight">
                {wallet.balance.toLocaleString('vi-VN')}{' '}
                <span className="text-xl font-medium text-muted-foreground">VNĐ</span>
              </div>
              <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-emerald-500" aria-hidden />
                Chủ tài khoản: <strong className="font-semibold text-foreground">{user.name}</strong>
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsDepositOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground transition-colors hover:brightness-110"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Nạp tiền vào ví
            </button>
          </div>
        </div>

        {/* Transaction history */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-6 py-4">
            <h2 className="flex items-center gap-2 font-semibold">
              <Wallet className="h-4 w-4 text-brand" aria-hidden />
              Lịch sử giao dịch
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="p-4">Loại giao dịch</th>
                  <th className="p-4">Nội dung</th>
                  <th className="p-4">Thời gian</th>
                  <th className="p-4 text-right">Số tiền</th>
                  <th className="p-4 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {wallet.transactions.map((tx) => {
                  const isPositive = tx.amount > 0;
                  return (
                    <tr key={tx.id} className="transition-colors hover:bg-muted/40">
                      <td className="p-4 font-medium">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'rounded p-1',
                              isPositive
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : 'bg-rose-500/10 text-rose-500',
                            )}
                          >
                            {isPositive ? (
                              <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />
                            ) : (
                              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                            )}
                          </span>
                          <span>{tx.type === 'deposit' ? 'Nạp tiền' : 'Thanh toán thuê bot'}</span>
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground">{tx.description}</td>
                      <td className="p-4 text-muted-foreground">{tx.timestamp}</td>
                      <td
                        className={cn(
                          'p-4 text-right font-bold',
                          isPositive ? 'text-emerald-500' : 'text-rose-500',
                        )}
                      >
                        {isPositive ? '+' : ''}
                        {tx.amount.toLocaleString('vi-VN')} đ
                      </td>
                      <td className="p-4 text-center">
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-500">
                          Thành công
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <DepositModal isOpen={isDepositOpen} onClose={() => setIsDepositOpen(false)} />
    </div>
  );
}
