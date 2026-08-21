'use client';

import Link from 'next/link';
import { Bookmark, Clock3, Eye, Heart, MessageCircle, Pin, ShieldAlert } from 'lucide-react';
import type { Post } from '@shared/types';
import { cn } from '@/lib/utils';
import { TrustedBadge } from '@/components/trust/TrustedBadge';
import { OfficialBadge } from '@/components/trust/OfficialBadge';
import { MediaImage } from '@/components/media/MediaImage';

const TYPE_LABELS: Record<string, string> = {
  share: 'Chia sẻ',
  question: 'Hỏi đáp',
  bot_update: 'Seller update',
  warning: 'Cảnh báo',
  discussion: 'Thảo luận',
  announcement: 'Thông báo',
  resource: 'Tài nguyên',
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diff = Date.now() - date.getTime();
  if (diff >= 0 && diff < 60 * 60 * 1000) return `${Math.max(1, Math.floor(diff / 60_000))} phút trước`;
  if (diff >= 0 && diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3_600_000)} giờ trước`;
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function PostCard({ post, compact = false }: { post: Post; compact?: boolean }) {
  const author = post.author;
  const authorHref = author.slug ? `/sellers/${encodeURIComponent(author.slug)}` : author.id ? `/sellers/${encodeURIComponent(author.id)}` : undefined;
  const hasTrust = Boolean(author.isTrusted);
  const isOfficial = Boolean(author.isOfficial);
  // Official posts use the platform mark even when the Owner authored them;
  // the public identity is thuebot.org, not the staff member's avatar.
  const isSystemOfficial = isOfficial;
  const isSecurityPost = isOfficial && (post.type === 'warning' || post.tags.some((tag) => ['security', 'bảo mật', 'policy'].includes(tag.trim().toLowerCase())));
  const isOfficialHighlight = isOfficial && (['announcement', 'warning', 'security', 'policy', 'system_update'].includes(String(post.type)) || isSecurityPost);
  const typeLabel = isSecurityPost ? 'Cảnh báo · Bảo mật' : (TYPE_LABELS[post.type] ?? 'Bài viết');
  const showCategory = !isSecurityPost && post.categoryName.trim().toLowerCase() !== typeLabel.toLowerCase();
  const avatarSource = isSystemOfficial ? '/favicon.svg' : author.avatar;

  return (
    <article
      className={cn(
        'group rounded-2xl border border-border bg-card transition-colors hover:border-brand/40',
        compact ? 'p-4' : 'p-5 sm:p-6',
        isOfficialHighlight && 'border-t-[3px] border-t-[#1677FF] border-[#1677FF]/25 bg-[#1677FF]/[0.035] hover:border-[#1677FF]/55',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          {avatarSource ? (
            <MediaImage src={avatarSource} fallbackSrc="/avt.png" alt="" className={cn('h-10 w-10 rounded-full border border-border object-cover', isOfficial && 'ring-2 ring-[#1677FF]/20 ring-offset-2 ring-offset-card')} />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
              {author.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
                {authorHref ? (
                  <Link href={authorHref} className={cn('text-foreground hover:text-brand', isOfficial ? 'font-bold' : 'font-semibold')}>
                    {author.name}
                  </Link>
                ) : (
                  <span className={cn('text-foreground', isOfficial ? 'font-bold' : 'font-semibold')}>{author.name}</span>
                )}
                {isOfficial ? <>
                  <OfficialBadge size="sm" />
                  <OfficialBadge size="sm" showLabel showMark={false} className="uppercase" />
                </> : hasTrust ? <TrustedBadge size="sm" interactive={false} info={{ isTrusted: true }} /> : null}
              </div>
              <p className={cn('mt-1 text-[11px]', isOfficial ? 'font-medium text-[#0B5CCC] dark:text-[#75AEFF]' : 'text-muted-foreground')}>
                {isOfficial ? 'Tài khoản chính thức của thuebot.org' : hasTrust ? (author.tier === 'top' ? 'Top Seller' : 'Trusted Seller') : 'Thành viên thuebot.org'}
              </p>
            </div>
            <time dateTime={post.createdAt} className="shrink-0 pt-0.5 text-right text-xs text-muted-foreground" title={post.createdAt}>
              {formatDate(post.createdAt)}
            </time>
          </div>

          <div className={cn('mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]', isSecurityPost ? 'text-amber-600 dark:text-amber-400' : 'text-brand')}>
            <span className="inline-flex items-center gap-1.5">
              {isSecurityPost ? <ShieldAlert className="h-3.5 w-3.5" aria-hidden /> : null}
              {typeLabel}
            </span>
            {showCategory ? <><span className="text-muted-foreground">·</span><span className="text-muted-foreground">{post.categoryName}</span></> : null}
            {post.isPinned ? (
              <span className="inline-flex items-center gap-1 text-amber-500">
                <Pin className="h-3 w-3" aria-hidden /> Ghim
              </span>
            ) : null}
          </div>

          <Link href={`/posts/${encodeURIComponent(post.slug)}`} className="mt-2 block">
            <h2 className={cn('text-balance font-display font-bold leading-tight text-foreground transition-colors group-hover:text-brand', compact ? 'text-base' : 'text-xl')}>
              {post.title}
            </h2>
          </Link>
          <p className={cn('mt-2 leading-relaxed text-muted-foreground', compact ? 'line-clamp-2 text-sm' : 'line-clamp-3 text-sm sm:text-[15px]')}>
            {post.excerpt}
          </p>

          {post.resource ? <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand/5 px-2.5 py-1.5 text-xs font-semibold text-brand">{post.resource.currentVersion.files.length} files · v{post.resource.currentVersion.version}</div> : null}

          {post.tags.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {post.tags.slice(0, 5).map((tag) => (
                <span key={tag} className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Heart className="h-3.5 w-3.5" aria-hidden />{post.reactionCount}</span>
            <span className="inline-flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5" aria-hidden />{post.commentsCount}</span>
            <span className="inline-flex items-center gap-1.5"><Bookmark className="h-3.5 w-3.5" aria-hidden />{post.bookmarkCount}</span>
            <span className="inline-flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" aria-hidden />{post.views}</span>
            <span className="ml-auto inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" aria-hidden />{post.readTimeMinutes} phút đọc</span>
          </div>
        </div>
      </div>
    </article>
  );
}
