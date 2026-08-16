'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  ChevronRight,
  User,
  Home,
  Code2,
  Image as ImageIcon,
  FileText,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sidebar } from '@/components/layout/Sidebar';
import { api } from '@/lib/api-client';
import type { Post } from '@shared/types';
import { MOCK_BLOG_CATEGORIES } from '@shared/mock-data';
import { Skeleton } from '@/components/ui/skeleton';
import { PostResourceDownloads } from '@/components/post/PostResourceDownloads';
import { RelatedPosts } from '@/components/post/RelatedPosts';
import { CommentSection } from '@/components/comments/CommentSection';
import { formatPostDate, formatViewCount, toSentenceCase } from '@/lib/format';
import { PythonLogoMark } from '@/components/icons/PythonLogoMark';
import { fetchPostPagePayload, type PostPagePayload } from '@/lib/post-payload';

function metaStackLabel(post: Post): string {
  if (post.stackLabel) return post.stackLabel;
  const lang = post.codeExample?.language;
  if (lang) return lang.charAt(0).toUpperCase() + lang.slice(1).toLowerCase();
  const first = post.categoryName.split(/\s+/)[0];
  return first ?? 'Bài viết';
}

function metaReadMinutes(post: Post, articleHtmlLen = 0): number {
  if (post.readTimeMinutes != null) return post.readTimeMinutes;
  const contentLen = post.content?.length || articleHtmlLen;
  const len = contentLen + (post.excerpt?.length ?? 0);
  return Math.max(1, Math.min(20, Math.ceil(len / 1500)));
}

function showPythonHeroIcon(post: Post): boolean {
  const s = metaStackLabel(post).toLowerCase();
  const lang = post.codeExample?.language?.toLowerCase();
  return s === 'python' || lang === 'python';
}

export function PostPage({
  slug,
  initialPayload,
}: {
  slug: string;
  initialPayload?: PostPagePayload | null;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['post', slug],
    queryFn: () => fetchPostPagePayload(slug),
    enabled: !!slug,
    initialData: initialPayload ?? undefined,
    staleTime: initialPayload ? 120_000 : 0,
  });

  const post = data?.post;
  const articleHtml = data?.articleHtml ?? '';

  const { data: related = [] } = useQuery({
    queryKey: ['post', slug, 'related'],
    queryFn: () => api<Post[]>(`/api/posts/${slug}/related`),
    enabled: !!slug && !!post,
  });

  const categorySlug =
    post && MOCK_BLOG_CATEGORIES.find((c) => c.id === post.categoryId)?.slug;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-3 py-8 sm:px-6 md:py-12 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-8 space-y-8">
            <Skeleton className="h-[400px] w-full rounded-3xl" />
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="lg:col-span-4">
            <Sidebar />
          </div>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <h1 className="text-4xl font-bold mb-4">404 - Không tìm thấy bài viết</h1>
        <p className="text-muted-foreground mb-8">
          Có vẻ bài viết này đã bị gỡ hoặc đường dẫn không chính xác.
        </p>
        <Link href="/">
          <Button className="bg-brand text-brand-foreground hover:bg-brand/90">Về trang chủ</Button>
        </Link>
      </div>
    );
  }

  const catUpper = post.categoryName.toUpperCase();
  const stack = metaStackLabel(post);
  const readM = metaReadMinutes(post, articleHtml.length);
  const pyIcon = showPythonHeroIcon(post);

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 md:py-12 lg:px-8">
      <header className="mb-4 md:mb-6">
        <nav
          className="flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-1 rounded-xl border border-white/[0.08] bg-[#111113]/92 px-3 py-2 text-xs text-[#9CA3AF] sm:gap-y-1.5 sm:px-4 sm:py-2.5 sm:text-sm"
          aria-label="Breadcrumb"
        >
          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-1 hover:text-brand transition-colors sm:gap-1.5"
          >
            <Home className="h-3.5 w-3.5 text-brand sm:h-4 sm:w-4" aria-hidden />
            Trang chủ
          </Link>
          <ChevronRight className="h-3 w-3 shrink-0 text-[#555] sm:h-3.5 sm:w-3.5" aria-hidden />
          {categorySlug ? (
            <Link
              href={`/category/${categorySlug}`}
              className="shrink-0 font-medium uppercase hover:text-brand transition-colors"
            >
              {catUpper}
            </Link>
          ) : (
            <span className="shrink-0 font-medium uppercase">{catUpper}</span>
          )}
          {post.tagLine ? (
            <>
              <ChevronRight className="h-3 w-3 shrink-0 text-[#555] sm:h-3.5 sm:w-3.5" aria-hidden />
              <span className="shrink-0 font-semibold text-brand">
                {post.tagLine.toUpperCase()}
              </span>
            </>
          ) : null}
          <ChevronRight className="h-3 w-3 shrink-0 text-[#555] max-sm:hidden sm:h-3.5 sm:w-3.5" aria-hidden />
          <span className="w-full min-w-0 text-[13px] font-medium leading-snug text-white sm:w-auto sm:max-w-md sm:text-sm">
            {post.title}
          </span>
        </nav>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-10">
        <div className="space-y-4 lg:col-span-8 md:space-y-5">
          {/* Hero — vạch cam glow, icon Python, tag viền, tiêu đề trắng, meta, họa tiết chấm bên phải */}
          <section
            className="relative isolate overflow-hidden rounded-xl border border-white/[0.08] bg-[#121214] shadow-[0_0_48px_-16px_hsl(var(--brand)/0.22)] sm:rounded-2xl"
            aria-labelledby="post-hero-title"
          >
            <div
              className="pointer-events-none absolute -right-6 top-0 z-0 h-full w-[min(52%,360px)] opacity-[0.28] sm:opacity-[0.42]"
              aria-hidden
            >
              <div className="h-full w-full origin-right -rotate-6 scale-[1.08] bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.45)_1.2px,transparent_1.2px)] bg-[length:13px_13px]" />
            </div>

            <div className="relative z-10 flex gap-0 p-3 pl-2.5 sm:p-5 sm:pl-4 md:p-7 md:pl-5">
              <div
                className="mr-2.5 w-0.5 shrink-0 self-stretch rounded-full bg-gradient-to-b from-brand via-brand to-[#c2410c] shadow-[0_0_20px_hsl(var(--brand)/0.85),0_0_6px_hsl(var(--brand)/0.5)] sm:mr-4 sm:w-0.5 md:mr-5 md:w-1"
                aria-hidden
              />

              <div className="flex min-w-0 flex-1 flex-row items-start gap-2.5 sm:gap-4 md:gap-6">
                <div className="shrink-0">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/[0.07] bg-[#252528] shadow-inner sm:h-[4.5rem] sm:w-[4.5rem] sm:rounded-2xl md:h-[5.5rem] md:w-[5.5rem]">
                    {pyIcon ? (
                      <PythonLogoMark className="h-7 w-7 sm:h-11 sm:w-11 md:h-14 md:w-14" />
                    ) : (
                      <Code2 className="h-6 w-6 text-brand/85 sm:h-10 sm:w-10 md:h-12 md:w-12" aria-hidden />
                    )}
                  </div>
                </div>

                <div className="min-w-0 flex-1 space-y-2 sm:space-y-3 md:space-y-4">
                  <div className="inline-flex items-center gap-1 rounded-full border border-brand/90 bg-transparent px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand sm:gap-1.5 sm:px-3.5 sm:py-2 sm:text-xs md:text-sm">
                    <Code2 className="h-2.5 w-2.5 shrink-0 opacity-95 sm:h-3.5 sm:w-3.5" aria-hidden />
                    {(post.tagLine ?? post.categoryName).toUpperCase()}
                  </div>
                  <h1
                    id="post-hero-title"
                    className="text-balance text-base font-bold leading-tight text-white sm:text-xl md:text-[1.75rem] md:leading-tight"
                  >
                    {post.title}
                  </h1>
                  <div className="flex flex-col gap-1 text-[12px] text-[#9CA3AF] sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-2 sm:text-sm">
                    <span className="inline-flex items-center gap-1 sm:gap-2">
                      <FileText className="h-3 w-3 shrink-0 text-brand/75 sm:h-4 sm:w-4" aria-hidden />
                      {stack}
                    </span>
                    <span className="inline-flex items-center gap-1 sm:gap-2">
                      <Calendar className="h-3 w-3 shrink-0 text-brand/75 sm:h-4 sm:w-4" aria-hidden />
                      Cập nhật: {formatPostDate(post.date)}
                    </span>
                    <span className="inline-flex items-center gap-1 tabular-nums sm:gap-2">
                      <Clock className="h-3 w-3 shrink-0 text-brand/75 sm:h-4 sm:w-4" aria-hidden />
                      Đọc: {readM} phút
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="flex gap-3 rounded-xl border border-white/[0.08] bg-[#121214] px-4 py-4 sm:gap-4 sm:px-5 sm:py-5 md:px-6">
            <div
              className="w-0.5 shrink-0 self-stretch min-h-[2.5rem] rounded-full bg-brand shadow-[0_0_12px_hsl(var(--brand)/0.45)]"
              aria-hidden
            />
            <p className="text-[13px] leading-relaxed text-white sm:text-[15px] md:text-base">
              {post.excerpt}
            </p>
          </section>

          <article className="rounded-2xl border border-border bg-card overflow-hidden shadow-lg shadow-black/25">
            <div className="space-y-6 p-4 text-foreground/90 md:space-y-8 md:p-7">
              <section className="space-y-2 sm:space-y-3">
                <h2 className="flex items-center gap-2 text-base font-semibold uppercase tracking-wide text-white not-prose md:gap-2.5 md:text-xl">
                  <ImageIcon className="h-5 w-5 shrink-0 text-brand md:h-6 md:w-6" aria-hidden />
                  Hình ảnh mô tả
                </h2>
                <div className="rounded-xl overflow-hidden border border-white/[0.08] bg-muted/15 shadow-inner">
                  <img
                    src={post.coverImage}
                    alt={post.title}
                    className="w-full h-auto object-cover max-h-[min(85vh,720px)]"
                  />
                </div>
              </section>

              <div
                className="prose prose-invert max-w-none prose-headings:font-bold prose-p:leading-relaxed prose-a:text-brand prose-strong:text-foreground prose-li:marker:text-brand"
                dangerouslySetInnerHTML={{ __html: articleHtml }}
              />

              {post.codeExample ? (
                <section className="space-y-2">
                  {post.codeExample.title ? (
                    <h3 className="text-sm font-semibold text-brand/90 not-prose">
                      {toSentenceCase(post.codeExample.title)}
                    </h3>
                  ) : null}
                  <pre className="rounded-xl border border-border bg-[hsl(0_0%_6%)] p-4 overflow-x-auto text-sm leading-relaxed text-[#e8e8e8] font-mono">
                    <code>{post.codeExample.code}</code>
                  </pre>
                </section>
              ) : null}

              {post.sampleOutput ? (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-brand/90 not-prose">
                    Kết quả mẫu (JSON)
                  </h3>
                  <pre className="rounded-xl border border-border bg-[hsl(0_0%_6%)] p-4 overflow-x-auto text-xs md:text-sm leading-relaxed text-[#a8d4a8] font-mono max-h-[420px]">
                    {post.sampleOutput}
                  </pre>
                </section>
              ) : null}

              <PostResourceDownloads attachments={post.attachments ?? []} />

              <RelatedPosts posts={related} />

              <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-border">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center border border-border">
                    <User className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-foreground">Đội ngũ Donix</span>
                  <span className="text-xs text-muted-foreground tabular-nums hidden sm:inline">
                    · {formatViewCount(post.views)} lượt xem
                  </span>
                </div>
              </div>

              {/* Bình luận blog */}
              <div className="pt-2">
                <CommentSection targetType="post" targetId={post.id} />
              </div>
            </div>
          </article>
        </div>

        <aside className="lg:col-span-4">
          <Sidebar />
        </aside>
      </div>
    </div>
  );
}
