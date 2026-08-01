'use client';

import React, { useState } from 'react';
import { BotItem, RentalPlan } from '@shared/types';
import { useRole } from '../../context/RoleContext';
import { Key, ShieldCheck, Zap, X, Check, ArrowRight } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-xl rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl text-white">
        <button
          onClick={handleCloseAll}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {!isSuccess ? (
          <div>
            <div className="flex items-center gap-3 mb-5 border-b border-zinc-800/80 pb-4">
              <img
                src={bot.coverImage}
                alt={bot.title}
                className="w-14 h-14 rounded-xl object-cover border border-zinc-700"
              />
              <div>
                <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">
                  {bot.categoryName}
                </span>
                <h3 className="text-lg font-bold text-white leading-snug line-clamp-1">{bot.title}</h3>
                <p className="text-xs text-zinc-400">Cung cấp bởi: {bot.provider.name}</p>
              </div>
            </div>

            {/* Plan selection */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  1. Chọn gói thời gian thuê
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'hourly', label: 'Theo Giờ', price: bot.pricing.hourly, unit: 'đ/giờ' },
                    { id: 'daily', label: 'Theo Ngày', price: bot.pricing.daily, unit: 'đ/ngày', tag: 'Phổ biến' },
                    { id: 'monthly', label: 'Theo Tháng', price: bot.pricing.monthly, unit: 'đ/tháng', tag: 'Tiết kiệm' }
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPlan(p.id as RentalPlan)}
                      className={`relative p-3 rounded-xl border text-left transition-all ${
                        plan === p.id
                          ? 'border-cyan-500 bg-cyan-500/10 text-white shadow-lg shadow-cyan-500/10'
                          : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      {p.tag && (
                        <span className="absolute -top-2 right-2 text-[9px] bg-cyan-500 text-black font-extrabold px-1.5 py-0.5 rounded-md">
                          {p.tag}
                        </span>
                      )}
                      <div className="text-xs font-medium mb-1">{p.label}</div>
                      <div className="text-sm font-bold text-cyan-400">
                        {p.price.toLocaleString('vi-VN')} {p.unit}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity / Duration selector */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  2. Chọn số lượng ({plan === 'hourly' ? 'giờ' : plan === 'daily' ? 'ngày' : 'tháng'})
                </label>
                <div className="flex items-center gap-3">
                  {[1, 3, 7, 30].map((d) => {
                    if (plan === 'hourly' && d === 30) return null;
                    if (plan === 'monthly' && d > 12) return null;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDuration(d)}
                        className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                          duration === d
                            ? 'border-cyan-500 bg-cyan-500 text-black'
                            : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700'
                        }`}
                      >
                        {d} {plan === 'hourly' ? 'giờ' : plan === 'daily' ? 'ngày' : 'tháng'}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Price calculation */}
            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800/80 mb-6 space-y-2 text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>Đơn giá:</span>
                <span>{unitPrice.toLocaleString('vi-VN')} VNĐ / {plan}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Thời gian:</span>
                <span>{duration} {plan === 'hourly' ? 'giờ' : plan === 'daily' ? 'ngày' : 'tháng'}</span>
              </div>
              <div className="flex justify-between border-t border-zinc-800 pt-2 text-sm">
                <span className="font-semibold text-zinc-200">Tổng thanh toán:</span>
                <span className="font-extrabold text-cyan-400 text-base">{totalCost.toLocaleString('vi-VN')} VNĐ</span>
              </div>
              <div className="text-[11px] text-emerald-400 font-medium pt-1">
                ✓ Cấp License Key & Kích hoạt dịch vụ tức thì 24/7
              </div>
            </div>

            {!isBalanceEnough ? (
              <div className="space-y-2">
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs text-center font-medium">
                  Số dư không đủ để thanh toán gói thuê này.
                </div>
                <button
                  onClick={() => {
                    onClose();
                    onOpenDeposit();
                  }}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 font-semibold text-black hover:opacity-95 transition-opacity text-sm flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  Nạp Tiền Ngay Vào Ví
                </button>
              </div>
            ) : (
              <button
                onClick={handleRent}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-extrabold text-white hover:opacity-95 transition-opacity text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
              >
                <Zap className="w-4 h-4 fill-current" />
                Xác Nhận Kích Hoạt & Lấy Mã Key Thuê
              </button>
            )}
          </div>
        ) : (
          /* Success state */
          <div className="text-center space-y-5 py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <Check className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-1">Kích Hoạt Bot Thành Công!</h3>
              <p className="text-xs text-zinc-400">
                Bạn đã đăng ký thành công gói thuê bot <span className="text-cyan-400 font-semibold">{bot.title}</span>
              </p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-950 border border-cyan-500/30 text-left space-y-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Mã License Key của bạn:</span>
                <div className="mt-1 flex items-center justify-between bg-zinc-900 p-2.5 rounded-lg border border-zinc-800 font-mono text-cyan-400 font-bold text-sm">
                  <span>{generatedKey}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedKey);
                      alert('Đã sao chép License Key!');
                    }}
                    className="text-xs bg-cyan-500/20 text-cyan-300 px-2 py-1 rounded hover:bg-cyan-500/40 font-sans"
                  >
                    Sao chép
                  </button>
                </div>
              </div>

              <div className="text-xs space-y-1 text-zinc-400">
                <p>• Hạn sử dụng: <strong>{duration} {plan === 'hourly' ? 'giờ' : plan === 'daily' ? 'ngày' : 'tháng'}</strong> kể từ thời điểm hiện tại.</p>
                <p>• Bạn có thể quản lý và xem hướng dẫn chi tiết tại mục <strong>Bảng Điều Khiển &gt; Bot Đã Thuê</strong>.</p>
              </div>
            </div>

            <button
              onClick={handleCloseAll}
              className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-600 font-semibold text-black text-sm flex items-center justify-center gap-2"
            >
              Hoàn Tất & Xem Bot Đã Thuê <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
