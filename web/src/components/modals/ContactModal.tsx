'use client';

import React from 'react';
import Link from 'next/link';
import { BotItem } from '@shared/types';
import { X, MessageCircle, Send, Phone, ShieldCheck, Star } from 'lucide-react';
import { toast } from 'sonner';

interface ContactModalProps {
  bot: BotItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ContactModal({ bot, isOpen, onClose }: ContactModalProps) {
  if (!isOpen || !bot) return null;

  const contact = bot.seller.contact ?? {};
  const channels = [
    contact.zalo && { icon: MessageCircle, label: 'Zalo', value: contact.zalo },
    contact.messenger && { icon: MessageCircle, label: 'Messenger', value: contact.messenger },
    contact.facebook && { icon: MessageCircle, label: 'Facebook', value: contact.facebook },
    contact.telegram && { icon: Send, label: 'Telegram', value: contact.telegram },
    contact.phone && { icon: Phone, label: 'Điện thoại', value: contact.phone },
  ].filter(Boolean) as { icon: typeof Phone; label: string; value: string }[];

  const copy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`Đã sao chép ${label}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Liên hệ người bán ${bot.seller.name}`}
    >
      <div className="relative my-auto max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-6 text-foreground shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Đóng"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Seller header */}
        <div className="mb-5 flex items-center gap-3 border-b border-border pb-4">
          <img
            src={bot.seller.avatar}
            alt={bot.seller.name}
            className="h-12 w-12 rounded-full border border-border object-cover"
          />
          <div>
            <Link
              href={
                bot.seller.slug
                  ? `/sellers/${bot.seller.slug}`
                  : `/sellers/${bot.seller.id}`
              }
              className="flex items-center gap-1 font-semibold transition-colors hover:text-brand"
            >
              {bot.seller.name}
              {bot.seller.isVerified && (
                <ShieldCheck className="h-4 w-4 text-brand" aria-label="Đã xác thực" />
              )}
            </Link>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
              <span className="font-medium text-foreground">{bot.seller.rating}</span>
              <span>· Điểm uy tín {bot.seller.reputation ?? Math.round(bot.seller.rating * 20)}</span>
            </div>
          </div>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          Liên hệ trực tiếp người bán để trao đổi về{' '}
          <span className="font-semibold text-foreground">{bot.title}</span>. Giao dịch tự thỏa
          thuận giữa hai bên.
        </p>

        {/* Contact channels */}
        {channels.length > 0 ? (
          <div className="space-y-2">
            {channels.map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => copy(c.value, c.label)}
                  className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-left transition-colors hover:border-brand/40"
                >
                  <span className="flex items-center gap-3">
                    <span className="rounded-lg bg-brand/10 p-2 text-brand">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span>
                      <span className="block text-xs text-muted-foreground">{c.label}</span>
                      <span className="font-semibold">{c.value}</span>
                    </span>
                  </span>
                  <span className="text-xs font-medium text-brand">Sao chép</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
            Người bán chưa cung cấp thông tin liên hệ công khai.
          </p>
        )}

        <div className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          Hãy kiểm tra kỹ sản phẩm trước khi thanh toán cho người bán.
        </div>
      </div>
    </div>
  );
}
