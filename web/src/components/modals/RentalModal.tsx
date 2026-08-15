'use client';

import React, { useState } from 'react';
import { BotItem, RentalPlan } from '@shared/types';
import { useRole } from '../../context/RoleContext';
import { Key, Zap, X, Check, ArrowRight, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface RentalModalProps {
  bot: BotItem | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenDeposit: () => void;
}

export function RentalModal({ bot, isOpen, onClose, onOpenDeposit }: RentalModalProps) {
  const { wallet, rentBot } = useRole();
  const [plan, setPlan] = useState<RentalPlan>('daily');
  const [duration, setDuration] = useState<number>(1);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [generatedKey, setGeneratedKey] = useState<string>('');

  if (!isOpen || !bot) return null;

  const unitPrice = bot.pricing[plan] || bot.pricing.daily;
  const totalCost = unitPrice * duration;
  const isBalanceEnough = wallet.balance >= totalCost;

  const handleRent = () => {
    const success = rentBot(bot.id, plan, duration);
    if (success) {
      const keyChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let randKey = '';
      for (let i = 0; i < 12; i++) {
        if (i > 0 && i % 4 === 0) randKey += '-';
        randKey += keyChars.charAt(Math.floor(Math.random() * keyChars.length));
      }
      setGeneratedKey(`DNX-${bot.categorySlug.toUpperCase()}-${randKey}`);
      setIsSuccess(true);
    }
  };

  const handleCloseAll = () => {
    setIsSuccess(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Thuê ${bot.title}`}
    >
      <div className="relative w-full max-w-xl rounded-2xl border border-border bg-card p-6 text-foreground shadow-2xl">
        <button
          type="button"
          onClick={handleCloseAll}
          className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Đóng"
        >
          <X className="h-5 w-5" />
        </button>

        {!isSuccess ? (
          <div>
            <div className="mb-5 flex items-center gap-3 border-b border-border pb-4">
              <img
                src={bot.coverImage}
                alt={bot.title}
                className="h-14 w-14 rounded-xl border border-border object-cover"
              />
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-brand">
                  {bot.categoryName}
                </span>
                <h3 className="line-clamp-1 text-lg font-bold leading-snug">{bot.title}</h3>
                <p className="text-xs text-muted-foreground">Cung cấp bởi: {bot.provider.name}</p>
              </div>
            </div>

            {/* Plan selection */}
            <div className="mb-6 space-y-4">
              <div>
                <span className="mb-2 block text-xs font-semibold text-muted-foreground">
                  1. Chọn gói thời gian thuê
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'hourly', label: 'Theo giờ', price: bot.pricing.hourly, unit: 'đ/giờ' },
                    { id: 'daily', label: 'Theo ngày', price: bot.pricing.daily, unit: 'đ/ngày', tag: 'Phổ biến' },
                    { id: 'monthly', label: 'Theo tháng', price: bot.pricing.monthly, unit: 'đ/tháng', tag: 'Tiết kiệm' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPlan(p.id as RentalPlan)}
                      className={cn(
                        'relative rounded-xl border p-3 text-left transition-colors',
                        plan === p.id
                          ? 'border-brand/50 bg-brand/10 text-foreground'
                          : 'border-border bg-background text-muted-foreground hover:border-brand/30',
                      )}
                    >
                      {p.tag && (
                        <span className="absolute -top-2 right-2 rounded-full bg-brand px-2 py-0.5 text-[9px] font-bold text-brand-foreground">
                          {p.tag}
                        </span>
                      )}
                      <span className="block text-xs font-bold">{p.label}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {p.price.toLocaleString('vi-VN')} {p.unit}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="mb-2 block text-xs font-semibold text-muted-foreground">
                  2. Thời lượng thuê
                </span>
                <div className="flex gap-2">
                  {[1, 3, 7, 30].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDuration(d)}
                      className={cn(
                        'flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors',
                        duration === d
                          ? 'border-brand/50 bg-brand text-brand-foreground'
                          : 'border-border bg-background text-muted-foreground hover:border-brand/30',
                      )}
                    >
                      {d} {plan === 'hourly' ? 'giờ' : plan === 'daily' ? 'ngày' : 'tháng'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Price calculation */}
            <div className="mb-6 space-y-2 rounded-xl border border-border bg-background p-4 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Đơn giá</span>
                <span>
                  {unitPrice.toLocaleString('vi-VN')} VNĐ / {plan}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Thời gian</span>
                <span>
                  {duration} {plan === 'hourly' ? 'giờ' : plan === 'daily' ? 'ngày' : 'tháng'}
                </span>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="font-semibold">Tổng thanh toán</span>
                <span className="text-base font-bold text-foreground">
                  {totalCost.toLocaleString('vi-VN')} VNĐ
                </span>
              </div>
              <p className="pt-1 text-[11px] font-medium text-emerald-500">
                ✓ Cấp license key & kích hoạt tức thì 24/7
              </p>
            </div>

            {!isBalanceEnough ? (
              <div className="space-y-2">
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-center text-xs font-medium text-rose-500">
                  Số dư không đủ để thanh toán gói thuê này.
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenDeposit();
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-brand-foreground transition-colors hover:brightness-110"
                >
                  <Zap className="h-4 w-4" aria-hidden />
                  Nạp tiền ngay vào ví
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleRent}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-bold text-brand-foreground transition-colors hover:brightness-110"
              >
                <Zap className="h-4 w-4" aria-hidden />
                Xác nhận kích hoạt & lấy mã key thuê
              </button>
            )}
          </div>
        ) : (
          /* Success */
          <div className="space-y-5 py-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-500">
              <Check className="h-8 w-8" aria-hidden />
            </div>
            <div>
              <h3 className="mb-1 font-display text-xl font-bold">Kích hoạt bot thành công</h3>
              <p className="text-xs text-muted-foreground">
                Bạn đã đăng ký gói thuê bot{' '}
                <span className="font-semibold text-foreground">{bot.title}</span>
              </p>
            </div>

            <div className="space-y-3 rounded-xl border border-border bg-background p-4 text-left">
              <div>
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Mã license key của bạn
                </span>
                <div className="mt-1 flex items-center justify-between rounded-lg border border-border bg-muted p-2.5 font-mono text-sm font-bold text-brand">
                  <span>{generatedKey}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedKey);
                      toast.success('Đã sao chép license key');
                    }}
                    className="shrink-0 rounded bg-brand/10 px-2 py-1 text-xs font-sans font-semibold text-brand transition-colors hover:bg-brand/20"
                    aria-label="Sao chép license key"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </div>

              <div className="space-y-1 text-xs text-muted-foreground">
                <p>
                  • Hạn sử dụng:{' '}
                  <strong className="font-semibold text-foreground">
                    {duration} {plan === 'hourly' ? 'giờ' : plan === 'daily' ? 'ngày' : 'tháng'}
                  </strong>{' '}
                  kể từ thời điểm hiện tại.
                </p>
                <p>
                  • Bạn có thể quản lý và xem hướng dẫn tại mục{' '}
                  <strong className="font-semibold text-foreground">Bảng điều khiển &gt; Bot đã thuê</strong>.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCloseAll}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-brand-foreground transition-colors hover:brightness-110"
            >
              Hoàn tất & xem bot đã thuê
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
