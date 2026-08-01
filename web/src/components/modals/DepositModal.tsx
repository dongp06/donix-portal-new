'use client';

import React, { useState } from 'react';
import { useRole } from '../../context/RoleContext';
import { QrCode, Wallet, CheckCircle2, ShieldCheck, X } from 'lucide-react';

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 text-cyan-400">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Nạp tiền vào ví Donix</h2>
            <p className="text-xs text-zinc-400">Nạp tức thì 24/7 - Không mất phí giao dịch</p>
          </div>
        </div>

        {step === 'select' ? (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Chọn số tiền nạp (VNĐ)
              </label>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {quickAmounts.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAmount(amt)}
                    className={`py-2.5 px-3 rounded-xl border text-sm font-medium transition-all ${
                      amount === amt
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400 shadow-lg shadow-cyan-500/10'
                        : 'border-zinc-800 bg-zinc-800/40 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    {amt.toLocaleString('vi-VN')} đ
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                placeholder="Nhập số tiền khác..."
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Phương thức thanh toán
              </label>
              <div className="space-y-2">
                {[
                  { id: 'VietQR (Ngân hàng)', name: 'Chuyển Khoản Ngân Hàng (VietQR)', badge: 'Khuyên dùng' },
                  { id: 'Ví MoMo', name: 'Ví Điện Tử MoMo / ZaloPay', badge: 'Tự động' }
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                      method === m.id
                        ? 'border-cyan-500 bg-cyan-500/10 text-white'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <span className="text-sm font-medium">{m.name}</span>
                    <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-500/30 font-semibold">
                      {m.badge}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setStep('qr')}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-semibold text-white shadow-lg shadow-cyan-500/20 hover:opacity-95 transition-opacity"
            >
              Tạo Mã QR Nạp Tiền
            </button>
          </div>
        ) : (
          <div className="space-y-5 text-center">
            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl inline-block mx-auto">
              {/* QR Mock image */}
              <div className="w-48 h-48 bg-white p-2 rounded-xl flex flex-col items-center justify-center text-zinc-900 mx-auto">
                <QrCode className="w-36 h-36 text-zinc-900" />
                <span className="text-[10px] font-bold tracking-widest uppercase text-cyan-600">DONIX PAY - VIETQR</span>
              </div>
            </div>

            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-400">Số tiền:</span>
                <span className="font-bold text-cyan-400 text-sm">{amount.toLocaleString('vi-VN')} VNĐ</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Nội dung chuyển khoản:</span>
                <span className="font-mono text-amber-400 font-semibold">DONIX NAP {amount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Ngân hàng:</span>
                <span className="font-medium text-white">MB Bank (888899992026)</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>Hệ thống tự động cộng tiền trong 5 - 10 giây</span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('select')}
                className="flex-1 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400 text-sm hover:text-white"
              >
                Quay lại
              </button>
              <button
                onClick={handleConfirmDeposit}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 font-semibold text-white text-sm shadow-lg shadow-emerald-500/20"
              >
                Xác Nhận Đã Nạp
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
