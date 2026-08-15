'use client';

import React from 'react';
import Link from 'next/link';
import { Shield, Zap, MessageSquare, Server } from 'lucide-react';
import { DonixLogo } from '@/components/brand/DonixLogo';

const exploreLinks = [
  { href: '/bots', label: 'Chợ bot cho thuê' },
  { href: '/bai-moi', label: 'Bài viết mới' },
  { href: '/bai-ghim', label: 'Bài ghim nổi bật' },
  { href: '/community', label: 'Cộng đồng' },
];

const supportLinks = [
  { href: '/dashboard', label: 'Tin đăng của tôi' },
  { href: '/community', label: 'Báo lỗi & hỗ trợ' },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4 md:col-span-2">
            <Link href="/" aria-label="Donix — về trang chủ">
              <DonixLogo size="md" />
            </Link>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Diễn đàn & chợ rao bán, cho thuê bot tự động hóa. Kết nối chủ bot và người mua,
              liên hệ giao dịch trực tiếp.
            </p>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Shield className="h-4 w-4 text-brand" aria-hidden />
              <span>Cộng đồng bot tự động hóa Việt Nam</span>
            </div>
          </div>

          {/* Explore */}
          <nav className="space-y-3" aria-label="Khám phá">
            <h4 className="text-sm font-semibold text-foreground">Khám phá</h4>
            <ul className="space-y-2 text-sm">
              {exploreLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Support */}
          <nav className="space-y-3" aria-label="Hỗ trợ">
            <h4 className="text-sm font-semibold text-foreground">Hỗ trợ</h4>
            <ul className="space-y-2 text-sm">
              {supportLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <MessageSquare className="h-4 w-4" aria-hidden />
                  t.me/donix_bot_dev
                </span>
              </li>
              <li>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Server className="h-4 w-4" aria-hidden />
                  Uptime 99.94%
                </span>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Donix Portal. Bảo lưu mọi quyền.</p>
          <p className="flex items-center gap-1">
            <Zap className="h-3.5 w-3.5 text-brand" aria-hidden />
            Cho cộng đồng bot tự động hóa Việt Nam
          </p>
        </div>
      </div>
    </footer>
  );
}
