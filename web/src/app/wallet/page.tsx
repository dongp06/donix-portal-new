'use client';

import React, { useState } from 'react';
import { useRole } from '../../context/RoleContext';
import { DepositModal } from '../../components/modals/DepositModal';
import { Wallet, ArrowDownRight, ArrowUpRight, Plus, ShieldCheck, History } from 'lucide-react';

export default function WalletPage() {
  const { wallet, user } = useRole();
  const [isDepositOpen, setIsDepositOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-950 text-white py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <h1 className="text-3xl font-black text-white">Quản Lý Ví Donix</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Theo dõi số dư, nạp tiền tự động và lịch sử thanh toán các gói thuê bot.
          </p>
        </div>

        {/* Balance Card */}
        <div className="p-8 rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border border-cyan-500/30 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
            <div>
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest block mb-1">
                Số Dư Ví Khả Dụng
              </span>
              <div className="text-4xl font-black text-cyan-400 tracking-tight">
                {wallet.balance.toLocaleString('vi-VN')} <span className="text-xl font-bold text-white">VNĐ</span>
              </div>
              <p className="text-xs text-zinc-500 mt-2 flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Chủ tài khoản: <strong>{user.name}</strong>
              </p>
            </div>

            <button
              onClick={() => setIsDepositOpen(true)}
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 font-bold text-sm text-white shadow-xl shadow-cyan-500/20 hover:opacity-95 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" /> Nạp Tiền Vào Ví
            </button>
          </div>
        </div>

        {/* Transaction History */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-cyan-400" /> Lịch Sử Giao Dịch
          </h2>

          <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/80">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950 text-zinc-400 font-semibold border-b border-zinc-800 uppercase tracking-wider">
                <tr>
                  <th className="p-4">Loại Giao Dịch</th>
                  <th className="p-4">Nội Dung</th>
                  <th className="p-4">Thời Gian</th>
                  <th className="p-4 text-right">Số Tiền</th>
                  <th className="p-4 text-center">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 text-zinc-300">
                {wallet.transactions.map((tx) => {
                  const isPositive = tx.amount > 0;
                  return (
                    <tr key={tx.id} className="hover:bg-zinc-800/40">
                      <td className="p-4 font-semibold">
                        <div className="flex items-center gap-2">
                          {isPositive ? (
                            <span className="p-1 rounded bg-emerald-500/20 text-emerald-400">
                              <ArrowDownRight className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <span className="p-1 rounded bg-rose-500/20 text-rose-400">
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </span>
                          )}
                          <span>{tx.type === 'deposit' ? 'Nạp tiền' : 'Thanh toán thuê bot'}</span>
                        </div>
                      </td>
                      <td className="p-4">{tx.description}</td>
                      <td className="p-4 text-zinc-400">{tx.timestamp}</td>
                      <td className={`p-4 text-right font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isPositive ? '+' : ''}
                        {tx.amount.toLocaleString('vi-VN')} đ
                      </td>
                      <td className="p-4 text-center">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
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
