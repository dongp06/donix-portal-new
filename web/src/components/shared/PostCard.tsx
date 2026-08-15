import Link from 'next/link';
import React from 'react';
import { Calendar, Eye, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Post } from '@shared/types';
import { cn } from '@/lib/utils';
import { formatPostDate, formatViewCount } from '@/lib/format';

interface PostCardProps {
  post: Post;
  large?: boolean;
  /** Lưới (mặc định) hoặc hàng ngang gọn cho chế độ danh sách */
  variant?: 'grid' | 'list';
}

export function PostCard({ post, large = false, variant = 'grid' }: PostCardProps) {
  const isList = variant === 'list';

  return (
    <Card
      className={cn(
        'overflow-hidden border border-border bg-card transition-all duration-300',
        isList
          ? 'flex flex-row gap-0 rounded-xl hover:border-brand/35 hover:shadow-md'
          : cn(
              'rounded-2xl hover:shadow-lg hover:border-brand/30 hover:-translate-y-0.5',
              large ? 'flex flex-col md:flex-row md:h-64' : 'h-full flex flex-col',
            ),
      )}
    >
      <div
        className={cn(
          'relative overflow-hidden',
          isList
            ? 'min-h-[5.25rem] w-[5.25rem] shrink-0 self-stretch sm:min-h-[7rem] sm:w-36'
            : large
              ? 'w-full md:w-2/5 h-48 md:h-full'
              : 'w-full aspect-video',
        )}
      >
        <Link
          href={`/posts/${post.slug}`}
          className={cn('block', isList ? 'absolute inset-0' : 'h-full')}
        >
          <img
            src={post.coverImage}
            alt={post.title}
            className={cn(
              'h-full w-full object-cover transition-transform duration-500',
              !isList && 'hover:scale-110',
              isList && 'sm:hover:scale-105',
            )}
          />
        </Link>
        <Badge
          variant="outline"
          className={cn(
            'absolute border-brand/30 text-brand bg-background/90 backdrop-blur-sm font-semibold',
            isList
              ? 'left-1.5 top-1.5 max-w-[calc(100%-0.75rem)] truncate border px-1.5 py-0 text-[9px] sm:left-2 sm:top-2 sm:text-[10px]'
              : 'left-3 top-3 text-[10px]',
          )}
        >
          {post.tagLine ?? post.categoryName}
        </Badge>
      </div>
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col',
          isList ? 'justify-center p-3 sm:p-4' : large ? 'p-6' : 'p-4',
        )}
      >
        <div
          className={cn(
            'mb-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground sm:mb-2.5',
            isList && 'mb-1.5 sm:mb-2',
          )}
        >
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3 shrink-0" />
            {formatPostDate(post.date)}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3 shrink-0" />
            {formatViewCount(post.views)} lượt xem
          </span>
        </div>
        <Link href={`/posts/${post.slug}`}>
          <h3
            className={cn(
              'line-clamp-2 font-bold leading-snug text-foreground transition-colors hover:text-brand',
              isList ? 'text-sm sm:text-base' : large ? 'mb-3 text-xl' : 'mb-2 text-base',
            )}
          >
            {post.title}
          </h3>
        </Link>
        <p
          className={cn(
            'leading-relaxed text-muted-foreground',
            isList
              ? 'mb-0 line-clamp-2 text-xs sm:mb-2 sm:text-sm'
              : 'mb-4 line-clamp-2 text-sm',
          )}
        >
          {post.excerpt}
        </p>
        <div
          className={cn(
            'mt-auto flex items-center pt-2',
            isList ? 'pt-1 sm:pt-3' : 'pt-4',
          )}
        >
          <Link
            href={`/posts/${post.slug}`}
            className="group flex items-center gap-1 text-xs font-bold text-brand"
          >
            Xem chi tiết
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </Card>
  );
}
