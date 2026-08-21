'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export interface TrustedBadgeInfo {
  isTrusted: boolean;
  trustScore?: number;
  rating?: number | null;
  basicVerifiedCount?: number;
  basicVerifiedTotal?: number;
  trustedAt?: string;
  trustedUntil?: string;
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function BadgeMark({ size }: { size: 'sm' | 'md' | 'lg' }) {
  const className = size === 'lg' ? 'h-5 w-5' : size === 'md' ? 'h-[18px] w-[18px]' : 'h-4 w-4';
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path
        d="M12 2.5 14 3.8l2.4-.2 1.1 2.1 2.2 1.1-.2 2.4 1.5 1.8-1.5 2 .2 2.3-2.2 1.1-1.1 2.2-2.4-.2-2 1.4-2-1.4-2.4.2-1.1-2.2-2.2-1.1.2-2.3L3 11l1.5-1.8-.2-2.4 2.2-1.1 1.1-2.1 2.4.2Z"
        fill="#1677FF"
      />
      <path
        d="m8.3 11.1 2.4 2.4 5.1-5.1"
        fill="none"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Blue rosette reserved exclusively for an active Trusted Seller. */
export function TrustedBadge({
  info,
  size = 'md',
  interactive = true,
  className = '',
}: {
  info: TrustedBadgeInfo;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (!info.isTrusted) return null;

  const mark = <BadgeMark size={size} />;
  const trigger = interactive ? (
    <button
      type="button"
      className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677FF]/50"
      aria-label="Trusted Seller — xem chi tiết xác minh"
      aria-expanded={open}
      onClick={() => setOpen((current) => !current)}
    >
      {mark}
    </button>
  ) : (
    <span className="inline-flex items-center" title="Trusted Seller" role="img" aria-label="Trusted Seller">
      {mark}
    </span>
  );

  return (
    <span ref={rootRef} className={`relative inline-flex items-center ${className}`}>
      {trigger}
      {interactive && open ? (
        <span
          role="dialog"
          aria-label="Thông tin Trusted Seller"
          className="absolute left-0 top-full z-40 mt-2 w-72 rounded-2xl border border-border bg-card p-4 text-left shadow-xl"
        >
          <span className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex rounded-lg bg-[#1677FF]/10 p-1.5">
              <BadgeMark size="md" />
            </span>
            <span className="min-w-0">
              <strong className="block text-sm text-foreground">Trusted Seller</strong>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                Nhà cung cấp này đã được thuebot.org xác minh và đáp ứng các tiêu chí uy tín.
              </span>
            </span>
          </span>
          <span className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs">
            <span>
              <span className="block text-muted-foreground">Điểm uy tín</span>
              <strong className="mt-1 block text-foreground">{info.trustScore ?? '—'}/100</strong>
            </span>
            <span>
              <span className="block text-muted-foreground">Đánh giá</span>
              <strong className="mt-1 block text-foreground">{info.rating == null ? '—' : `${info.rating.toFixed(1)} ★`}</strong>
            </span>
            <span>
              <span className="block text-muted-foreground">Xác minh</span>
              <strong className="mt-1 block text-foreground">
                {info.basicVerifiedCount ?? '—'}/{info.basicVerifiedTotal ?? '—'}
              </strong>
            </span>
            <span>
              <span className="block text-muted-foreground">Xác minh gần nhất</span>
              <strong className="mt-1 block text-foreground">{formatDate(info.trustedAt)}</strong>
            </span>
          </span>
          <span className="mt-3 block text-[11px] leading-relaxed text-muted-foreground">
            Trạng thái xác minh không phải bảo đảm tuyệt đối cho giao dịch.
          </span>
        </span>
      ) : null}
    </span>
  );
}

/** Shield mark for a verified bot; intentionally different from the seller badge. */
export function VerifiedBotMark({ label = 'Bot đã xác minh' }: { label?: string }): ReactNode {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" focusable="false">
        <path d="M12 3 19 6v5c0 4.6-2.9 8.3-7 10-4.1-1.7-7-5.4-7-10V6Z" fill="currentColor" opacity=".18" />
        <path d="m8.5 12 2.2 2.2 4.8-4.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </span>
  );
}
