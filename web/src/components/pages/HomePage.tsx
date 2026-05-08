'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Pin, ShieldCheck, ArrowRight, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PostCard } from '@/components/shared/PostCard';
import { Sidebar } from '@/components/layout/Sidebar';
import { api } from '@/lib/api-client';
import type { Post } from '@shared/types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function HomePage() {
  const router = useRouter();
  const { data: posts, isLoading } = useQuery({
    queryKey: ['posts'],
    queryFn: () => api<Post[]>('/api/posts'),
  });
  const { data: pinnedPosts } = useQuery({
    queryKey: ['posts', 'pinned'],
    queryFn: () => api<Post[]>('/api/posts/pinned'),
  });
  const latestPosts =
    posts
      ?.filter((p) => !p.isPinned)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) || [];
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="py-8 md:py-10 lg:py-12">
        <div className="mb-12 text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/15 text-brand text-xs font-bold border border-brand/25">
            <Zap className="h-3 w-3 fill-current" />
            <span>Chia sẻ tài nguyên &amp; tool miễn phí</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-display font-extrabold tracking-tight">
            Khám phá tài nguyên <span className="text-brand">Công nghệ</span>
          </h1>
          <p className="max-w-2xl mx-auto text-muted-foreground text-lg">
            Tổng hợp các bài viết hướng dẫn lập trình, bản mod game chất lượng cao và bộ công cụ tối ưu cho developer.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button
              size="lg"
              className="rounded-full px-8 bg-brand text-brand-foreground hover:bg-brand/90 font-bold"
              onClick={() => router.push('/category/lap-trinh')}
            >
              Khám phá ngay
            </Button>
            <Button size="lg" variant="outline" className="rounded-full px-8 border-2">
              Gửi bài viết
            </Button>
          </div>
        </div>
        <div
          role="alert"
          className={cn(
            'relative isolate mb-12 overflow-hidden rounded-2xl border shadow-[0_0_40px_-18px_hsl(var(--brand)/0.18)]',
            'border-zinc-200/90 bg-zinc-50 dark:border-white/[0.08] dark:bg-[#121214]',
            'dark:shadow-[0_0_48px_-16px_hsl(var(--brand)/0.22)]',
          )}
        >
          <div
            className="pointer-events-none absolute -right-6 top-0 z-0 h-full w-[min(42%,300px)] opacity-25 dark:opacity-[0.42]"
            aria-hidden
          >
            <div className="h-full w-full origin-right -rotate-6 scale-[1.05] bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.45)_1.2px,transparent_1.2px)] bg-[length:13px_13px]" />
          </div>
          <div className="relative z-10 flex items-stretch p-4 pl-3 sm:p-5 sm:pl-4">
            <div
              className="mr-3 w-1 shrink-0 self-stretch rounded-full bg-gradient-to-b from-brand via-brand to-[#c2410c] shadow-[0_0_20px_hsl(var(--brand)/0.85),0_0_6px_hsl(var(--brand)/0.5)] sm:mr-4"
              aria-hidden
            />
            <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-inner sm:h-11 sm:w-11',
                  'border-zinc-200/90 bg-white text-orange-600',
                  'dark:border-white/[0.07] dark:bg-[#252528] dark:text-orange-400',
                )}
                aria-hidden
              >
                <ShieldCheck className="h-5 w-5 stroke-[2] sm:h-[1.35rem] sm:w-[1.35rem]" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold leading-snug text-brand">
                  Chú ý
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-[#9CA3AF]">
                  Tất cả tài nguyên tại{' '}
                  <span className="font-semibold text-brand">DONIX.NET</span>{' '}
                  đều được kiểm duyệt kỹ lưỡng. Tuy nhiên hãy luôn kiểm tra file
                  trước khi cài đặt để đảm bảo an toàn tuyệt đối.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-8 space-y-12">
            {(isLoading || (pinnedPosts && pinnedPosts.length > 0)) && (
              <section>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Pin
                      className="h-5 w-5 text-brand stroke-[2]"
                      aria-hidden
                    />
                    <h2 className="text-2xl font-bold">Bài viết đã ghim</h2>
                  </div>
                </div>
                <div className="space-y-6">
                  {isLoading ? (
                    Array(2)
                      .fill(0)
                      .map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-2xl" />)
                  ) : (
                    pinnedPosts?.map((post) => <PostCard key={post.id} post={post} large />)
                  )}
                </div>
              </section>
            )}
            <section>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-brand animate-pulse" />
                  <h2 className="text-2xl font-bold">Bài viết mới nhất</h2>
                </div>
                <Link href="/bai-moi">
                  <Button variant="ghost" className="text-muted-foreground hover:text-brand text-sm gap-1 group">
                    Xem tất cả{' '}
                    <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {isLoading ? (
                  Array(4)
                    .fill(0)
                    .map((_, i) => <Skeleton key={i} className="h-80 w-full rounded-2xl" />)
                ) : latestPosts.length > 0 ? (
                  latestPosts.map((post) => <PostCard key={post.id} post={post} />)
                ) : (
                  <div className="col-span-full py-12 text-center text-muted-foreground">
                    Không có bài viết nào khác để hiển thị.
                  </div>
                )}
              </div>
            </section>
          </div>
          <div className="lg:col-span-4">
            <Sidebar />
          </div>
        </div>
      </div>
    </div>
  );
}
