'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';
import { Search, TrendingUp, FolderOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MOCK_CATEGORIES, MOCK_BOTS } from '@shared/mock-data';
import { cn } from '@/lib/utils';
import { formatViewCount } from '@/lib/format';

export function Sidebar() {
  const pathname = usePathname();
  const popularPosts = [...MOCK_BOTS].sort((a, b) => b.totalRentals - a.totalRentals).slice(0, 4);

  return (
    <aside className="space-y-8 sticky top-28">
      <Card className="border border-border bg-card/90 shadow-none">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm..."
              className="pl-9 bg-muted/40 border-border rounded-full focus-visible:ring-brand"
            />
          </div>
        </CardContent>
      </Card>
      <section>
        <div className="flex items-center gap-2 mb-4">
          <FolderOpen className="h-4 w-4 text-brand" />
          <h3 className="font-bold text-lg uppercase tracking-wide text-foreground">Chuyên mục</h3>
        </div>
        <div className="grid gap-2">
          {MOCK_CATEGORIES.map((cat) => {
            const href = `/category/${cat.slug}`;
            const active = pathname === href;
            return (
              <Link
                key={cat.id}
                href={href}
                className={cn(
                  'group flex items-center justify-between p-3 rounded-xl bg-card border transition-all duration-200',
                  active
                    ? 'border-brand shadow-[0_0_16px_hsl(var(--brand)/0.25)] bg-brand/5'
                    : 'border-border hover:border-brand/60 hover:shadow-[0_0_14px_hsl(var(--brand)/0.2)] hover:bg-brand/[0.04]',
                )}
              >
                <span
                  className={cn(
                    'text-sm font-semibold flex items-center gap-2 transition-colors group-hover:text-brand',
                    active ? 'text-brand' : 'text-foreground',
                  )}
                >
                  <FolderOpen className={cn('h-3.5 w-3.5', active ? 'text-brand' : 'text-brand/70')} />
                  {cat.navLabel ?? cat.name}
                </span>
                <span
                  className={cn(
                    'flex h-8 min-w-8 px-2 items-center justify-center rounded-full text-[11px] font-black tabular-nums',
                    active
                      ? 'bg-brand text-brand-foreground'
                      : 'bg-brand/90 text-brand-foreground shadow-sm',
                  )}
                >
                  {cat.count}
                </span>
              </Link>
            );
          })}
        </div>
      </section>
      <section>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-brand" />
          <h3 className="font-bold text-lg">Bài viết phổ biến</h3>
        </div>
        <div className="space-y-4">
          {popularPosts.map((post) => (
            <Link key={post.id} href={`/bots/${post.id}`} className="flex gap-3 group items-start">
              <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-border">
                <img
                  src={post.coverImage}
                  alt={post.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
              </div>
              <div className="space-y-1 min-w-0">
                <h4 className="text-xs font-semibold leading-snug group-hover:text-brand transition-colors line-clamp-2">
                  {post.title}
                </h4>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground tabular-nums">
                  <span>{formatViewCount(post.totalRentals)} lượt thuê</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <Card className="bg-brand border-none text-brand-foreground overflow-hidden">
        <CardContent className="p-6 relative">
          <div className="relative z-10 space-y-3">
            <h4 className="font-bold leading-tight">Đăng ký nhận tin mới nhất</h4>
            <p className="text-xs text-brand-foreground/85">
              Cập nhật công cụ, script và bài hướng dẫn hot hàng tuần.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="w-full font-bold text-brand bg-background hover:bg-background/90"
            >
              Tham gia ngay
            </Button>
          </div>
          <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
        </CardContent>
      </Card>
    </aside>
  );
}
