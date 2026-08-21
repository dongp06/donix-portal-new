'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bookmark, FileEdit, Plus, Trash2 } from 'lucide-react';
import type { Post } from '@shared/types';
import { PostCard } from './PostCard';
import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton';
import { useRole } from '@/context/RoleContext';
import { toast } from 'sonner';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';

export function MyPostsPage({ saved = false }: { saved?: boolean }) {
  const { isAuthenticated } = useRole();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [tab, setTab] = useState('all');

  useEffect(() => {
    if (isAuthenticated !== true) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const endpoint = saved ? '/api/posts/saved' : `/api/posts/me${tab !== 'all' ? `?status=${tab}` : ''}`;
    setPosts(null);
    setError(null);
    setLoading(true);

    void (async () => {
      try {
        const res = await fetchWithTimeout(endpoint, { credentials: 'include', signal: controller.signal }, 20_000);
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || 'Không tải được bài viết.');
        if (!cancelled) setPosts(Array.isArray(json.data) ? json.data as Post[] : []);
      } catch (cause) {
        if (cancelled) return;
        const message = cause instanceof Error ? cause.message : 'Không tải được bài viết.';
        setError(message);
        toast.error(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isAuthenticated, retryKey, saved, tab]);

  const remove = async (post: Post) => {
    if (!window.confirm(`Gỡ bài “${post.title}”?`)) return;
    try {
      const res = await fetchWithTimeout(`/api/posts/${encodeURIComponent(post.id)}`, { method: 'DELETE', credentials: 'include' }, 30_000);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Không gỡ được bài.');
      setPosts((current) => current?.filter((item) => item.id !== post.id) ?? []);
      toast.success('Đã gỡ bài viết.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không gỡ được bài.');
    }
  };

  if (isAuthenticated !== true) {
    return <div className="mx-auto max-w-lg px-4 py-20 text-center"><div className="surface p-8"><Bookmark className="mx-auto h-8 w-8 text-brand" aria-hidden /><h1 className="mt-4 font-display text-2xl font-bold">Đăng nhập để xem {saved ? 'bài đã lưu' : 'bài viết của bạn'}</h1><p className="mt-2 text-sm text-muted-foreground">Dữ liệu Posts được gắn với tài khoản để bạn tiếp tục từ mọi thiết bị.</p><div className="mt-5 flex justify-center"><GoogleLoginButton redirectTo={saved ? '/me/saved-posts' : '/me/posts'} /></div></div></div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 md:py-12 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">Không gian cá nhân</p><h1 className="mt-2 font-display text-3xl font-bold">{saved ? 'Bài đã lưu' : 'Posts của tôi'}</h1><p className="mt-2 text-sm text-muted-foreground">{saved ? 'Những hướng dẫn bạn muốn quay lại.' : 'Quản lý bài đã đăng, bản nháp và bài chờ duyệt.'}</p></div>
        {!saved ? <Link href="/posts/new" className="btn-brand"><Plus className="h-4 w-4" aria-hidden /> Đăng bài</Link> : null}
      </div>

      {!saved ? <nav className="mt-7 flex gap-1 overflow-x-auto border-b border-border pb-2" aria-label="Bộ lọc bài của tôi">{[['all', 'Tất cả'], ['published', 'Đã đăng'], ['draft', 'Bản nháp'], ['pending', 'Chờ duyệt']].map(([value, label]) => <button key={value} type="button" onClick={() => setTab(value)} className={`shrink-0 rounded-lg px-3 py-2 text-sm ${tab === value ? 'bg-brand text-brand-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>{label}</button>)}</nav> : null}

      {loading ? <div className="mt-6 space-y-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-40 animate-pulse rounded-2xl border border-border bg-muted/50" />)}</div> : error ? <div className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center" role="alert"><p className="font-semibold text-destructive">Không tải được danh sách bài viết</p><p className="mt-2 text-sm text-muted-foreground">{error}</p><button type="button" onClick={() => setRetryKey((current) => current + 1)} className="mt-5 inline-flex min-h-10 items-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:brightness-110">Thử lại</button></div> : posts?.length === 0 ? <div className="mt-8 rounded-2xl border border-dashed border-border px-6 py-16 text-center"><FileEdit className="mx-auto h-8 w-8 text-brand" aria-hidden /><h2 className="mt-4 font-semibold">Chưa có bài viết</h2><p className="mt-1 text-sm text-muted-foreground">Bắt đầu chia sẻ điều bạn biết về bot.</p><Link href="/posts/new" className="mt-4 inline-flex text-sm font-semibold text-brand hover:underline">Viết bài đầu tiên</Link></div> : <div className="mt-6 space-y-4">{posts?.map((post) => <div key={post.id} className="relative"><PostCard post={post} /><div className="absolute right-5 top-5 flex gap-1 rounded-lg border border-border bg-card p-1 sm:right-6"><Link href={`/posts/${encodeURIComponent(post.id)}/edit`} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-brand" aria-label={`Sửa ${post.title}`}><FileEdit className="h-4 w-4" aria-hidden /></Link><button type="button" onClick={() => void remove(post)} className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Gỡ ${post.title}`}><Trash2 className="h-4 w-4" aria-hidden /></button></div></div>)}</div>}
    </div>
  );
}
