'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Check, Eye, Lock, MessageSquare, Shield, Trash2 } from 'lucide-react';
import type { Post } from '@shared/types';
import { apiAdmin } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OfficialBadge } from '@/components/trust/OfficialBadge';
import { MarkdownRenderer } from '@/components/markdown/MarkdownRenderer';
import { MediaImage } from '@/components/media/MediaImage';
import { toast } from 'sonner';

export function AdminPostDetail({ id }: { id: string }) {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPost(await apiAdmin<Post>(`/api/admin/posts/${encodeURIComponent(id)}`));
    } catch (cause) {
      setPost(null);
      toast.error(cause instanceof Error ? cause.message : 'Không tải được bài.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const action = async (path: string, body: Record<string, unknown>) => {
    try {
      await apiAdmin(path, { method: 'PATCH', body: JSON.stringify(body) });
      toast.success('Đã cập nhật moderation.');
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Không cập nhật được.');
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground" aria-busy="true">Đang tải bài viết...</p>;
  if (!post) return <div className="rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">Không tìm thấy bài viết.</div>;

  return (
    <div className="space-y-6">
      <Link href="/admin/posts" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden /> Quay lại quản lý Posts</Link>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Moderation detail</p><h2 className="mt-2 max-w-3xl font-display text-3xl font-bold">{post.title}</h2><p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">{post.author.name}{post.author.isOfficial ? <OfficialBadge size="sm" /> : null} · {post.categoryName} · {post.type}</p></div><Badge variant="outline">{post.status}</Badge></div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <article className="rounded-2xl border border-border bg-card p-6 sm:p-8"><p className="text-sm leading-7 text-muted-foreground">{post.excerpt}</p><div className="mt-6 border-t border-border pt-6"><MarkdownRenderer value={post.content ?? ''} /></div><div className="mt-8 flex flex-wrap gap-2 border-t border-border pt-5">{post.tags.map((tag) => <span key={tag} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">#{tag}</span>)}</div></article>
        <aside className="space-y-4">
          <section className="rounded-2xl border border-border bg-card p-5"><h3 className="font-semibold">Tác giả</h3><div className="mt-4 flex items-center gap-3"><MediaImage src={post.author.avatar} fallbackSrc="/favicon.svg" alt="" className="h-10 w-10 rounded-full object-cover" /><div><p className="font-semibold">{post.author.name}</p><p className="text-xs text-muted-foreground">{post.author.isOfficial ? 'Tài khoản chính thức của thuebot.org' : post.author.role}</p></div></div></section>
          <section className="rounded-2xl border border-border bg-card p-5"><h3 className="font-semibold">Stats</h3><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><Stat icon={Eye} label="Views" value={post.views} /><Stat icon={MessageSquare} label="Comments" value={post.commentsCount} /><Stat icon={Shield} label="Reports" value={post.reportCount ?? 0} /><Stat icon={Check} label="Reactions" value={post.reactionCount} /></div></section>
          <section className="rounded-2xl border border-border bg-card p-5"><h3 className="font-semibold">Moderation</h3><div className="mt-4 flex flex-col gap-2"><Button asChild size="sm" variant="outline"><Link href={`/posts/${encodeURIComponent(post.slug)}`} target="_blank" rel="noreferrer"><Eye className="h-4 w-4" aria-hidden /> Xem public</Link></Button>{post.status === 'pending' ? <Button size="sm" onClick={() => void action(`/api/admin/posts/${post.id}/status`, { status: 'published' })}><Check className="h-4 w-4" aria-hidden /> Duyệt bài</Button> : null}{post.status === 'published' ? <Button size="sm" variant="outline" onClick={() => void action(`/api/admin/posts/${post.id}/status`, { status: 'hidden' })}><Eye className="h-4 w-4" aria-hidden /> Ẩn bài</Button> : null}<Button size="sm" variant="outline" onClick={() => void action(`/api/admin/posts/${post.id}/comments`, { locked: !post.commentsLocked })}><Lock className="h-4 w-4" aria-hidden /> {post.commentsLocked ? 'Mở bình luận' : 'Khóa bình luận'}</Button>{post.status !== 'removed' ? <Button size="sm" variant="destructive" onClick={() => void action(`/api/admin/posts/${post.id}/status`, { status: 'removed' })}><Trash2 className="h-4 w-4" aria-hidden /> Gỡ mềm</Button> : null}</div></section>
        </aside>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: number }) {
  return <div className="rounded-lg bg-muted/50 p-3"><Icon className="h-3.5 w-3.5 text-brand" aria-hidden /><p className="mt-2 text-xs text-muted-foreground">{label}</p><p className="font-semibold">{value}</p></div>;
}
