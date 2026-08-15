'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Tag, ChevronRight, Grid, List } from 'lucide-react';
import { PostCard } from '@/components/shared/PostCard';
import { Sidebar } from '@/components/layout/Sidebar';
import { api } from '@/lib/api-client';
import type { Post, Category } from '@shared/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { usePersistedPostLayout } from '@/hooks/use-persisted-post-layout';

export function CategoryPage({ slug }: { slug: string }) {
  const { layout, setLayout } = usePersistedPostLayout();
  const { data: posts, isLoading } = useQuery({
    queryKey: ['posts', 'category', slug],
    queryFn: () => api<Post[]>(`/api/posts?category=${slug}`),
    enabled: !!slug,
  });
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api<Category[]>('/api/categories'),
  });
  const currentCategory = categories?.find((c) => c.slug === slug);
  const topic = currentCategory?.name?.toLowerCase() || 'công nghệ';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <div className="mb-12">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
          <Link href="/" className="hover:text-brand">
            Trang chủ
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">Chuyên mục</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/15 text-brand text-xs font-bold border border-brand/25">
              <Tag className="h-3 w-3" />
              <span>Chuyên mục</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-extrabold">
              {currentCategory?.name || 'Tất cả bài viết'}
            </h1>
            <p className="text-muted-foreground max-w-xl">
              Tổng hợp {posts?.length || 0} bài viết về chủ đề {topic} mới nhất giúp bạn nâng cao kỹ
              năng.
            </p>
          </div>
          <div
            className="flex shrink-0 items-center gap-2 self-start rounded-lg bg-secondary p-1"
            role="group"
            aria-label="Kiểu hiển thị bài viết"
          >
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className={cn('h-8 w-8', layout === 'grid' && 'bg-background shadow-sm')}
              aria-pressed={layout === 'grid'}
              aria-label="Dạng lưới"
              onClick={() => setLayout('grid')}
            >
              <Grid className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className={cn(
                'h-8 w-8',
                layout === 'list' && 'bg-background font-medium text-foreground shadow-sm',
              )}
              aria-pressed={layout === 'list'}
              aria-label="Dạng danh sách"
              onClick={() => setLayout('list')}
            >
              <List className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8">
          <div
            className={cn(
              layout === 'grid'
                ? 'grid grid-cols-1 gap-8 sm:grid-cols-2'
                : 'flex flex-col gap-3 sm:gap-4',
            )}
          >
            {isLoading ? (
              Array(6)
                .fill(0)
                .map((_, i) => (
                  <Skeleton
                    key={i}
                    className={cn(
                      'w-full',
                      layout === 'list' ? 'h-[5.5rem] rounded-xl sm:h-28' : 'h-80 rounded-2xl',
                    )}
                  />
                ))
            ) : posts && posts.length > 0 ? (
              posts.map((post) => (
                <PostCard key={post.id} post={post} variant={layout === 'list' ? 'list' : 'grid'} />
              ))
            ) : (
              <div className="col-span-full py-24 text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <Tag className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">Chưa có bài viết nào</h3>
                <p className="text-muted-foreground">Vui lòng quay lại sau hoặc xem các chuyên mục khác.</p>
              </div>
            )}
          </div>
          {posts && posts.length > 0 && (
            <div className="mt-12 flex justify-center">
              <Button
                variant="outline"
                className="rounded-full px-8"
                onClick={() => toast.info('Đã tải hết bài viết')}
              >
                Tải thêm bài viết
              </Button>
            </div>
          )}
        </div>
        <div className="lg:col-span-4">
          <Sidebar />
        </div>
      </div>
    </div>
  );
}
