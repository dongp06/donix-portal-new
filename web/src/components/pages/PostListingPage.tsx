'use client';

import { useQuery } from '@tanstack/react-query';
import { Grid, List } from 'lucide-react';
import { PostCard } from '@/components/shared/PostCard';
import { Sidebar } from '@/components/layout/Sidebar';
import { api } from '@/lib/api-client';
import type { Post } from '@shared/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePersistedPostLayout } from '@/hooks/use-persisted-post-layout';

export function PostListingPage({
  title,
  description,
  queryPath,
}: {
  title: string;
  description?: string;
  queryPath: string;
}) {
  const { layout, setLayout } = usePersistedPostLayout();
  const { data: posts, isLoading } = useQuery({
    queryKey: ['post-list', queryPath],
    queryFn: () => api<Post[]>(queryPath),
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <header className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="eyebrow">Bài viết</p>
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <div
          className="flex shrink-0 items-center gap-2 self-start rounded-lg bg-secondary p-1 sm:self-auto"
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
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8">
          <div
            className={cn(
              layout === 'grid'
                ? 'grid grid-cols-1 gap-6 sm:grid-cols-2'
                : 'flex flex-col gap-3 sm:gap-4',
            )}
          >
            {isLoading
              ? Array(4)
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
              : posts?.map((post) => (
                  <PostCard key={post.id} post={post} variant={layout === 'list' ? 'list' : 'grid'} />
                ))}
          </div>
          {!isLoading && (!posts || posts.length === 0) ? (
            <p className="text-muted-foreground py-12 text-center">Chưa có bài viết.</p>
          ) : null}
        </div>
        <div className="lg:col-span-4">
          <Sidebar />
        </div>
      </div>
    </div>
  );
}
