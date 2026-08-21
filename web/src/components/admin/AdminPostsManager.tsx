'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Eye,
  FileText,
  Hash,
  Pin,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Tags,
  X,
} from 'lucide-react';
import type { Post, PostReport } from '@shared/types';
import { apiAdmin } from '@/lib/api-client';
import { OfficialBadge } from '@/components/trust/OfficialBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type View = 'all' | 'pending' | 'reported' | 'categories' | 'tags';
type Stats = { all: number; published: number; pending: number; scheduled: number; reported: number; hidden: number; drafts: number; comments: number };

const STATUS_LABELS: Record<string, string> = {
  draft: 'Bản nháp',
  scheduled: 'Đã lên lịch',
  pending: 'Chờ duyệt',
  published: 'Đã đăng',
  hidden: 'Đã ẩn',
  removed: 'Đã gỡ',
};

function statusTone(status: string) {
  if (status === 'published') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
  if (status === 'scheduled') return 'border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-400';
  if (status === 'pending') return 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400';
  return 'border-border bg-muted text-muted-foreground';
}

export function AdminPostsManager({ view = 'all' }: { view?: View }) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [reports, setReports] = useState<PostReport[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [categories, setCategories] = useState<{ slug: string; name: string; count: number }[]>([]);
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [statsData, categoriesData, tagsData] = await Promise.all([
        apiAdmin<Stats>('/api/admin/posts/stats'),
        apiAdmin<{ slug: string; name: string; count: number }[]>('/api/admin/posts/categories'),
        apiAdmin<{ tag: string; count: number }[]>('/api/admin/posts/tags'),
      ]);
      setStats(statsData);
      setCategories(categoriesData);
      setTags(tagsData);
      if (view === 'reported') setReports(await apiAdmin<PostReport[]>('/api/admin/posts/reports?status=open'));
      else if (view !== 'categories' && view !== 'tags') {
        const params = new URLSearchParams();
        if (view === 'pending') params.set('status', 'pending');
        if (search.trim()) params.set('q', search.trim());
        setPosts(await apiAdmin<Post[]>(`/api/admin/posts${params.toString() ? `?${params.toString()}` : ''}`));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được dữ liệu bài viết.');
      setPosts([]);
      setReports([]);
    }
  }, [search, view]);

  useEffect(() => { void load(); }, [load]);

  const updateStatus = async (id: string, status: string) => {
    try {
      await apiAdmin(`/api/admin/posts/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      toast.success(`Đã chuyển bài sang ${STATUS_LABELS[status] ?? status}.`);
      void load();
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Không cập nhật được trạng thái.'); }
  };

  const updateDistribution = async (post: Post, key: 'isPinned' | 'isFeatured') => {
    try {
      await apiAdmin(`/api/admin/posts/${encodeURIComponent(post.id)}/distribution`, { method: 'PATCH', body: JSON.stringify({ [key]: !post[key] }) });
      toast.success(key === 'isPinned' ? (post.isPinned ? 'Đã bỏ ghim bài.' : 'Đã ghim bài.') : (post.isFeatured ? 'Đã bỏ nổi bật.' : 'Đã đánh dấu nổi bật.'));
      void load();
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Không cập nhật được phân phối.'); }
  };

  const resolveReport = async (id: string, status: 'resolved' | 'dismissed') => {
    try {
      await apiAdmin(`/api/admin/posts/reports/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      toast.success(status === 'resolved' ? 'Đã đánh dấu báo cáo đã xử lý.' : 'Đã bỏ qua báo cáo.');
      void load();
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Không xử lý được báo cáo.'); }
  };

  const title = view === 'pending' ? 'Hàng đợi duyệt' : view === 'reported' ? 'Báo cáo bài viết' : view === 'categories' ? 'Danh mục bài viết' : view === 'tags' ? 'Tags bài viết' : 'Bài viết';
  const currentCount = useMemo(() => view === 'reported' ? reports?.length ?? 0 : posts?.length ?? 0, [posts, reports, view]);
  const statCards = [
    { label: 'Tất cả', value: stats?.all ?? '—', icon: FileText },
    { label: 'Published', value: stats?.published ?? '—', icon: Check },
    { label: 'Draft', value: stats?.drafts ?? '—', icon: FileText },
    { label: 'Scheduled', value: stats?.scheduled ?? '—', icon: CalendarClock },
    { label: 'Reported', value: stats?.reported ?? '—', icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin" className="text-xs font-semibold text-[#69707d] hover:text-[#1677ff]">Admin console</Link>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#12151b] sm:text-3xl">{title}</h2>
          <p className="mt-2 text-sm text-[#69707d]">Xuất bản, theo dõi và kiểm duyệt nội dung của thuebot.org.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="h-4 w-4" aria-hidden /> Làm mới</Button>
          <Button asChild size="sm"><Link href="/admin/posts/new"><Plus className="h-4 w-4" aria-hidden /> Tạo bài</Link></Button>
        </div>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-[#e5e7eb]" aria-label="Bộ lọc bài viết">
        <PostTab href="/admin/posts" active={view === 'all'} label="Tất cả" value={stats?.all} />
        <PostTab href="/admin/posts/pending" active={view === 'pending'} label="Chờ duyệt" value={stats?.pending} />
        <PostTab href="/admin/posts/reported" active={view === 'reported'} label="Reported" value={stats?.reported} />
        <PostTab href="/admin/posts/categories" active={view === 'categories'} label="Danh mục" />
        <PostTab href="/admin/posts/tags" active={view === 'tags'} label="Tags" />
      </nav>

      {error ? <div className="flex items-center justify-between gap-3 rounded-xl border border-[#f0b4ba] bg-[#fff4f4] px-4 py-3 text-sm text-[#b42332]" role="alert"><span>{error}</span><Button type="button" size="sm" variant="secondary" onClick={() => void load()}>Thử lại</Button></div> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map(({ label, value, icon: Icon }) => <div key={label} className="rounded-xl border border-[#e5e7eb] bg-white p-4"><Icon className="h-4 w-4 text-[#1677ff]" aria-hidden /><p className="mt-3 text-xs text-[#69707d]">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums text-[#12151b]">{value}</p></div>)}
      </div>

      {view === 'categories' ? <CategoryView categories={categories} /> : null}
      {view === 'tags' ? <TagView tags={tags} /> : null}

      {view === 'reported' ? (
        <section className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white">
          <div className="border-b border-[#edf0f2] p-5"><h3 className="font-bold text-[#12151b]">Report cần kiểm tra <span className="ml-2 text-xs font-normal text-[#69707d]">{currentCount}</span></h3></div>
          <div className="divide-y divide-[#edf0f2]">
            {reports?.map((report) => <div key={report.id} className="space-y-3 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><Link href={`/admin/posts/${report.postId}`} className="font-semibold text-[#12151b] hover:text-[#1677ff]">{report.postTitle}</Link><p className="mt-1 text-xs text-[#69707d]">{report.category} · {new Date(report.createdAt).toLocaleString('vi-VN')} · reporter {report.reporterId ?? 'ẩn danh'}</p></div><Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700">open</Badge></div>{report.details ? <p className="rounded-lg bg-[#f7f8fa] px-3 py-2 text-sm text-[#69707d]">{report.details}</p> : null}<div className="flex gap-2"><Button size="sm" onClick={() => void resolveReport(report.id, 'resolved')}><Check className="h-3.5 w-3.5" aria-hidden /> Đã xử lý</Button><Button size="sm" variant="outline" onClick={() => void resolveReport(report.id, 'dismissed')}><X className="h-3.5 w-3.5" aria-hidden /> Bỏ qua</Button></div></div>)}
            {reports?.length === 0 ? <Empty label="Không có report mở." /> : null}
          </div>
        </section>
      ) : null}

      {view !== 'categories' && view !== 'tags' && view !== 'reported' ? (
        <section className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0f2] p-5">
            <div><h3 className="font-bold text-[#12151b]">Danh sách bài <span className="ml-2 text-xs font-normal text-[#69707d]">{currentCount}</span></h3><p className="mt-1 text-xs text-[#69707d]">Soft-delete và edit history được giữ lại trong DB.</p></div>
            <label className="flex h-9 min-w-[230px] items-center gap-2 rounded-lg border border-[#dfe3e8] bg-[#fbfcfd] px-3 text-xs text-[#69707d] focus-within:border-[#1677ff] focus-within:ring-2 focus-within:ring-[#1677ff]/15"><Search className="h-4 w-4" aria-hidden /><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void load(); }} placeholder="Tìm tiêu đề, tác giả..." aria-label="Tìm bài viết" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#8b929d]" /></label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-[#edf0f2] bg-[#fbfcfd] text-[11px] font-bold uppercase tracking-[0.08em] text-[#69707d]"><tr><th className="px-5 py-3 sm:px-6">Tiêu đề</th><th className="px-5 py-3">Tác giả</th><th className="px-5 py-3">Loại</th><th className="px-5 py-3">Trạng thái</th><th className="px-5 py-3">Ngày</th><th className="px-5 py-3 text-right sm:px-6">Thao tác</th></tr></thead>
              <tbody className="divide-y divide-[#edf0f2]">
                {posts?.map((post) => <PostRow key={post.id} post={post} onStatus={updateStatus} onDistribution={updateDistribution} />)}
              </tbody>
            </table>
          </div>
          {posts?.length === 0 ? <Empty label="Không có bài viết phù hợp." /> : null}
        </section>
      ) : null}
    </div>
  );
}

function PostTab({ href, label, value, active }: { href: string; label: string; value?: number; active: boolean }) {
  return <Link href={href} className={active ? 'border-b-2 border-[#1677ff] px-3 py-3 text-xs font-bold text-[#1677ff]' : 'border-b-2 border-transparent px-3 py-3 text-xs font-semibold text-[#69707d] hover:text-[#12151b]'}>{label}{typeof value === 'number' ? <span className="ml-1.5 text-[10px] opacity-70">{value}</span> : null}</Link>;
}

function PostRow({ post, onStatus, onDistribution }: { post: Post; onStatus: (id: string, status: string) => void; onDistribution: (post: Post, key: 'isPinned' | 'isFeatured') => void }) {
  return <tr className="align-top transition-colors hover:bg-[#fbfcfd]">
    <td className="max-w-[360px] px-5 py-4 sm:px-6"><Link href={`/admin/posts/${encodeURIComponent(post.id)}`} className="line-clamp-2 font-bold text-[#12151b] hover:text-[#1677ff]">{post.title}</Link><div className="mt-2 flex flex-wrap gap-1.5">{post.author.isOfficial ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1677ff]"><OfficialBadge size="sm" /> Official</span> : null}{post.isPinned ? <span className="inline-flex items-center gap-1 text-[11px] text-[#a36a00]"><Pin className="h-3 w-3" aria-hidden /> Ghim</span> : null}{post.isFeatured ? <span className="inline-flex items-center gap-1 text-[11px] text-[#1677ff]"><Sparkles className="h-3 w-3" aria-hidden /> Nổi bật</span> : null}</div></td>
    <td className="px-5 py-4"><p className="max-w-[170px] truncate text-xs font-semibold text-[#36404d]">{post.author.name}</p><p className="mt-1 text-[11px] text-[#69707d]">{post.author.isOfficial ? 'Tài khoản chính thức' : post.author.role}</p></td>
    <td className="px-5 py-4 text-xs text-[#69707d]">{post.type}<p className="mt-1 text-[11px]">{post.categoryName}</p></td>
    <td className="px-5 py-4"><span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold ${statusTone(post.status)}`}>{post.status === 'scheduled' ? <CalendarClock className="h-3 w-3" aria-hidden /> : null}{STATUS_LABELS[post.status] ?? post.status}</span></td>
    <td className="whitespace-nowrap px-5 py-4 text-xs text-[#69707d]">{post.status === 'scheduled' && post.scheduledAt ? new Date(post.scheduledAt).toLocaleString('vi-VN') : new Date(post.updatedAt || post.createdAt).toLocaleDateString('vi-VN')}</td>
    <td className="px-5 py-4 sm:px-6"><div className="flex flex-wrap justify-end gap-1.5"><Button asChild size="sm" variant="outline" title="Xem preview"><Link href={`/posts/${encodeURIComponent(post.slug)}`} target="_blank" rel="noreferrer"><Eye className="h-3.5 w-3.5" aria-hidden /> Xem</Link></Button>{post.status === 'pending' ? <Button size="sm" onClick={() => onStatus(post.id, 'published')}><Check className="h-3.5 w-3.5" aria-hidden /> Duyệt</Button> : null}{post.status === 'published' ? <Button size="sm" variant="outline" onClick={() => onStatus(post.id, 'hidden')}>Ẩn</Button> : null}{post.status === 'hidden' ? <Button size="sm" onClick={() => onStatus(post.id, 'published')}>Hiện</Button> : null}<Button size="sm" variant="ghost" title={post.isPinned ? 'Bỏ ghim' : 'Ghim'} onClick={() => onDistribution(post, 'isPinned')}><Pin className={post.isPinned ? 'h-3.5 w-3.5 text-[#a36a00]' : 'h-3.5 w-3.5'} aria-hidden /></Button><Button size="sm" variant="ghost" title={post.isFeatured ? 'Bỏ nổi bật' : 'Đánh dấu nổi bật'} onClick={() => onDistribution(post, 'isFeatured')}><Sparkles className={post.isFeatured ? 'h-3.5 w-3.5 text-[#1677ff]' : 'h-3.5 w-3.5'} aria-hidden /></Button></div></td>
  </tr>;
}

function CategoryView({ categories }: { categories: { slug: string; name: string; count: number }[] }) {
  return <section className="rounded-2xl border border-[#e5e7eb] bg-white"><div className="flex items-center gap-2 border-b border-[#edf0f2] p-5"><Hash className="h-4 w-4 text-[#1677ff]" aria-hidden /><h3 className="font-bold text-[#12151b]">Danh mục và số bài đã đăng</h3></div><div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">{categories.map((category) => <div key={category.slug} className="flex items-center justify-between rounded-xl border border-[#edf0f2] px-4 py-3"><span><strong className="block text-sm text-[#12151b]">{category.name}</strong><span className="text-xs text-[#69707d]">{category.slug}</span></span><Badge variant="outline">{category.count}</Badge></div>)}</div></section>;
}

function TagView({ tags }: { tags: { tag: string; count: number }[] }) {
  return <section className="rounded-2xl border border-[#e5e7eb] bg-white"><div className="flex items-center gap-2 border-b border-[#edf0f2] p-5"><Tags className="h-4 w-4 text-[#1677ff]" aria-hidden /><h3 className="font-bold text-[#12151b]">Tag đang được sử dụng</h3></div><div className="flex flex-wrap gap-2 p-5">{tags.map((tag) => <span key={tag.tag} className="rounded-full border border-[#dfe3e8] px-3 py-2 text-sm text-[#69707d]">#{tag.tag} <strong className="ml-1 text-[#12151b]">{tag.count}</strong></span>)}{tags.length === 0 ? <p className="text-sm text-[#69707d]">Chưa có tag.</p> : null}</div></section>;
}

function Empty({ label }: { label: string }) { return <div className="px-6 py-12 text-center text-sm text-[#69707d]">{label}</div>; }
