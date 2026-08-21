'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Filter, Hash, PenLine, Search, Sparkles, Tag } from 'lucide-react';
import type { Post, PostFeed } from '@shared/types';
import { PostCard } from './PostCard';
import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton';
import { useRole } from '@/context/RoleContext';
import { cn } from '@/lib/utils';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';

type FeedMode = 'latest' | 'featured' | 'questions' | 'share' | 'warning';

const MODES: { key: FeedMode; label: string; href: string; description: string }[] = [
  { key: 'latest', label: 'Mới nhất', href: '/posts/moi', description: 'Dòng thời gian mới nhất từ thuebot.org.' },
  { key: 'featured', label: 'Nổi bật', href: '/posts/noi-bat', description: 'Những bài đang được cộng đồng quan tâm.' },
  { key: 'questions', label: 'Hỏi đáp', href: '/posts/hoi-dap', description: 'Câu hỏi đang cần người có kinh nghiệm trả lời.' },
  { key: 'share', label: 'Chia sẻ', href: '/posts/chia-se', description: 'Tutorial, kinh nghiệm và câu chuyện triển khai bot.' },
  { key: 'warning', label: 'Cảnh báo', href: '/posts/canh-bao', description: 'Thông tin cần kiểm tra trước khi kết nối seller.' },
];

function fetchFeed(params: URLSearchParams, signal?: AbortSignal): Promise<PostFeed> {
  return fetchWithTimeout(`/api/posts?${params.toString()}`, { credentials: 'include', signal }, 20_000)
    .then(async (res) => {
      const json = await res.json().catch(() => null) as { success?: boolean; data?: PostFeed; error?: string } | null;
      if (!res.ok || !json?.success || !json.data) throw new Error(json?.error || 'Không tải được bài viết.');
      return json.data;
    });
}

export function PostsPage({ mode = 'latest' }: { mode?: FeedMode }) {
  const { isAuthenticated } = useRole();
  const [feed, setFeed] = useState<PostFeed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);

  const selectedMode = MODES.find((item) => item.key === mode) ?? MODES[0];

  const load = useCallback(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), limit: '12' });
    if (search) params.set('q', search);
    if (category !== 'all') params.set('category', category);
    if (mode === 'featured') params.set('sort', 'trending');
    if (mode === 'latest') params.set('sort', 'latest');
    if (mode === 'questions') params.set('type', 'question');
    if (mode === 'share') params.set('type', 'share');
    if (mode === 'warning') params.set('type', 'warning');
    setError(null);
    void fetchFeed(params, controller.signal)
      .then(setFeed)
      .catch((cause: unknown) => {
        if ((cause as { name?: string })?.name !== 'AbortError') {
          setError(cause instanceof Error ? cause.message : 'Không tải được bài viết.');
        }
      });
    return () => controller.abort();
  }, [category, mode, page, search]);

  useEffect(() => load(), [load]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const activeCategories = useMemo(
    () => feed?.categories.filter((item) => item.count > 0) ?? [],
    [feed],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 md:py-12 lg:px-8">
        <header className="relative overflow-hidden rounded-3xl border border-border bg-card px-5 py-8 sm:px-8 md:py-10">
          <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-brand/10 blur-3xl" aria-hidden />
          <div className="relative max-w-3xl">
            <p className="eyebrow">Posts · thuebot.org</p>
            <h1 className="mt-3 max-w-2xl text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              Chia sẻ bot. Hỏi đúng người. Kiểm tra uy tín.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Nơi seller cập nhật sản phẩm, developer chia sẻ kinh nghiệm và người dùng tìm câu trả lời trước khi kết nối.
            </p>
            <form onSubmit={submitSearch} className="mt-7 flex max-w-2xl flex-col gap-2 sm:flex-row">
              <label htmlFor="posts-search" className="sr-only">Tìm bài viết</label>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <input
                  id="posts-search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Tìm tutorial, Telegram, seller..."
                  className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-brand/60 focus:ring-2 focus:ring-brand/20"
                />
              </div>
              <button type="submit" className="btn-brand h-11 shrink-0 px-5">
                Tìm bài
              </button>
            </form>
          </div>
        </header>

        <div className="mt-7 flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_17rem]">
          <main className="min-w-0">
            <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
              <nav className="flex gap-1 overflow-x-auto pb-1" aria-label="Bộ lọc Posts">
                {MODES.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={cn(
                      'shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      item.key === mode ? 'bg-brand text-brand-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                    aria-current={item.key === mode ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="flex items-center gap-2">
                <label htmlFor="posts-category" className="sr-only">Lọc theo chủ đề</label>
                <Filter className="h-4 w-4 text-muted-foreground" aria-hidden />
                <select
                  id="posts-category"
                  value={category}
                  onChange={(event) => { setCategory(event.target.value); setPage(1); }}
                  className="h-9 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-brand/60"
                >
                  <option value="all">Tất cả chủ đề</option>
                  {activeCategories.map((item) => <option key={item.slug} value={item.slug}>{item.name} ({item.count})</option>)}
                </select>
              </div>
            </div>

            <div className="mb-5 mt-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold">{selectedMode.label}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{selectedMode.description}</p>
              </div>
              {isAuthenticated === true ? (
                <Link href="/posts/new" className="btn-brand">
                  <PenLine className="h-4 w-4" aria-hidden /> Đăng bài
                </Link>
              ) : (
                <Link href="/posts/new" className="btn-outline">
                  <PenLine className="h-4 w-4" aria-hidden /> Đăng bài
                </Link>
              )}
            </div>

            {error ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
                <p>{error}</p>
                <button type="button" onClick={() => { setFeed(null); void load(); }} className="mt-3 font-semibold underline">Thử lại</button>
              </div>
            ) : null}

            {!error && !feed ? (
              <div className="space-y-3" aria-label="Đang tải bài viết">
                {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-48 animate-pulse rounded-2xl border border-border bg-muted/50" />)}
              </div>
            ) : null}

            {feed && feed.items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
                <BookOpen className="mx-auto h-8 w-8 text-brand" aria-hidden />
                <h3 className="mt-4 font-semibold">Chưa có bài phù hợp</h3>
                <p className="mt-1 text-sm text-muted-foreground">Thử đổi từ khóa hoặc trở thành người đầu tiên chia sẻ.</p>
                <Link href="/posts/new" className="mt-5 inline-flex text-sm font-semibold text-brand hover:underline">Đăng bài mới <ArrowRight className="ml-1 h-4 w-4" aria-hidden /></Link>
              </div>
            ) : null}

            <div className="space-y-3">
              {feed?.items.map((post: Post) => <PostCard key={post.id} post={post} />)}
            </div>

            {feed && feed.pagination.totalPages > 1 ? (
              <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 text-sm">
                <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="btn-outline px-3 disabled:opacity-40">Trang trước</button>
                <span className="text-muted-foreground">Trang {page} / {feed.pagination.totalPages}</span>
                <button type="button" disabled={!feed.pagination.hasMore} onClick={() => setPage((current) => current + 1)} className="btn-outline px-3 disabled:opacity-40">Trang sau</button>
              </div>
            ) : null}
          </main>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <section className="surface p-5">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-brand" aria-hidden />
                <h2 className="font-semibold">Chủ đề</h2>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(feed?.categories ?? []).filter((item) => item.count > 0).map((item) => (
                  <button key={item.slug} type="button" onClick={() => { setCategory(item.slug); setPage(1); }} className={cn('rounded-full border px-2.5 py-1.5 text-xs transition-colors', category === item.slug ? 'border-brand/50 bg-brand/10 text-brand' : 'border-border text-muted-foreground hover:border-brand/40 hover:text-foreground')}>
                    {item.name}
                  </button>
                ))}
              </div>
            </section>

            <section className="surface p-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand" aria-hidden />
                <h2 className="font-semibold">Tag nổi bật</h2>
              </div>
              <div className="mt-4 space-y-2">
                {(feed?.trendingTags ?? []).slice(0, 7).map((item) => (
                  <button key={item.tag} type="button" onClick={() => { setSearchInput(item.tag); setSearch(item.tag); setPage(1); }} className="flex w-full items-center justify-between gap-3 text-left text-sm text-muted-foreground hover:text-brand">
                    <span className="inline-flex items-center gap-2"><Tag className="h-3.5 w-3.5" aria-hidden />#{item.tag}</span>
                    <span className="text-xs">{item.count}</span>
                  </button>
                ))}
                {feed?.trendingTags.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có tag nào.</p> : null}
              </div>
            </section>

            {isAuthenticated !== true ? (
              <section className="surface border-brand/30 bg-brand/5 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Tham gia</p>
                <h2 className="mt-2 font-display text-lg font-bold">Có kinh nghiệm về bot?</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Đăng nhập để viết bài, hỏi đáp và lưu lại những hướng dẫn hữu ích.</p>
                <div className="mt-4"><GoogleLoginButton redirectTo="/posts/new" /></div>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
