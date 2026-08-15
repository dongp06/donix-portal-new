'use client';

import React, { useState } from 'react';
import { useRole } from '../../context/RoleContext';
import { QrCode, Wallet, ShieldCheck, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DepositModal({ isOpen, onClose }: DepositModalProps) {
  const { depositWallet } = useRole();
  const [amount, setAmount] = useState<number>(500000);
  const [method, setMethod] = useState<string>('VietQR (Ngân hàng)');
  const [step, setStep] = useState<'select' | 'qr'>('select');

  if (!isOpen) return null;

  const quickAmounts = [100000, 200000, 500000, 1000000, 2000000];

  const handleConfirmDeposit = () => {
    depositWallet(amount, method);
    onClose();
    setStep('select');
  };

  const inputClass =
    'w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/30';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Nạp tiền vào ví Donix"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 text-foreground shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Đóng"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-brand/10 p-3 text-brand">
            <Wallet className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold">Nạp tiền vào ví Donix</h2>
            <p className="text-xs text-muted-foreground">Nạp tức thì 24/7 - không mất phí giao dịch</p>
          </div>
        </div>

        {step === 'select' ? (
          <div className="space-y-5">
            <div>
              <label htmlFor="deposit-amount" className="mb-2 block text-xs font-semibold text-muted-foreground">
                Số tiền nạp
              </label>
              <input
                id="deposit-amount"
                type="number"
                min={10000}
                step={10000}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                className={inputClass}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {quickAmounts.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAmount(amt)}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                      amount === amt
                        ? 'border-brand/50 bg-brand/10 text-brand'
                        : 'border-border bg-background text-muted-foreground hover:border-brand/30',
                    )}
                  >
                    {amt.toLocaleString('vi-VN')} đ
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="mb-2 block text-xs font-semibold text-muted-foreground">
                Phương thức thanh toán
              </span>
              <div className="space-y-2">
                {[
                  { id: 'VietQR (Ngân hàng)', name: 'VietQR (Ngân hàng)', badge: 'Tức thì' },
                  { id: 'MoMo', name: 'MoMo / Ví điện tử', badge: 'Phổ biến' },
                  { id: 'Chuyển khoản thủ công', name: 'Chuyển khoản thủ công', badge: 'Thủ công' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-xl border p-3.5 transition-colors',
                      method === m.id
                        ? 'border-brand/50 bg-brand/10 text-foreground'
                        : 'border-border bg-background text-muted-foreground hover:border-brand/30',
                    )}
                  >
                    <span className="text-sm font-medium">{m.name}</span>
                    <span className="rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                      {m.badge}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep('qr')}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-brand-foreground transition-colors hover:brightness-110"
            >
              Tạo mã QR nạp tiền
            </button>
          </div>
        ) : (
          <div className="space-y-5 text-center">
            <div className="mx-auto inline-block rounded-2xl border border-border bg-background p-4">
              {/* QR mock */}
              <div className="mx-auto flex w-48 flex-col items-center justify-center rounded-xl bg-white p-2 text-zinc-900">
                <QrCode className="h-36 w-36 text-zinc-900" aria-hidden />
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
                  DONIX PAY - VIETQR
                </span>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-border bg-background p-4 text-left text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Số tiền</span>
                <span className="text-sm font-bold text-foreground">
                  {amount.toLocaleString('vi-VN')} VNĐ
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nội dung chuyển khoản</span>
                <span className="font-mono font-semibold text-brand">DONIX NAP {amount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ngân hàng</span>
                <span className="font-medium text-foreground">MB Bank (888899992026)</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-500">
              <ShieldCheck className="h-4 w-4" aria-hidden />
              Hệ thống tự động cộng tiền trong 5 - 10 giây
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep('select')}
                className="flex-1 rounded-xl border border-border bg-background py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Quay lại
              </button>
              <button
                type="button"
                onClick={handleConfirmDeposit}
                className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:brightness-110"
              >
                Xác nhận đã nạp
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
