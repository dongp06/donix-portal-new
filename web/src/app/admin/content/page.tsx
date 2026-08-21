'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText, Hash, RefreshCw, ShieldAlert } from 'lucide-react';

import { apiAdmin } from '@/lib/api-client';
import { useAdminAccess } from '@/context/AdminAccessContext';

type Stats = { all: number; published: number; pending: number; reported: number; hidden: number; drafts: number; comments: number };
type Category = { slug: string; label: string; count: number };
type Tag = { tag: string; count: number };

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border border-[#e5e7eb] bg-white p-5"><p className="text-xs font-semibold text-[#69707d]">{label}</p><p className="mt-2 text-2xl font-bold text-[#12151b]">{value.toLocaleString('vi-VN')}</p></div>; }

export default function AdminContentPage() {
  const { role } = useAdminAccess();
  const canManage = role === 'owner' || role === 'admin';
  const [stats, setStats] = useState<Stats | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { if (!canManage) return; setError(null); try { const [nextStats, nextCategories, nextTags] = await Promise.all([apiAdmin<Stats>('/api/admin/posts/stats'), apiAdmin<Category[]>('/api/admin/posts/categories'), apiAdmin<Tag[]>('/api/admin/posts/tags')]); setStats(nextStats); setCategories(nextCategories); setTags(nextTags); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được dữ liệu nội dung.'); } }, [canManage]);
  useEffect(() => { void load(); }, [load]);
  if (!canManage) return <div className="rounded-xl border border-[#f0b4ba] bg-[#fff4f4] p-6 text-sm text-[#b42332]"><p className="font-bold">Không có quyền truy cập</p><p className="mt-1">Chỉ Owner hoặc Admin được quản lý nội dung.</p></div>;
  return <div className="space-y-7"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-[#1677ff]">Cộng đồng</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-[#12151b]">Nội dung</h1><p className="mt-2 text-sm text-[#69707d]">Tổng quan Posts, danh mục và tag đang được dùng trên marketplace.</p></div><button type="button" onClick={() => void load()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#dfe3e8] bg-white px-3.5 py-2 text-sm font-semibold text-[#36404d] hover:border-[#1677ff]/40 hover:text-[#1677ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677ff]"><RefreshCw className="h-4 w-4" aria-hidden /> Làm mới</button></div>{error ? <div className="rounded-lg border border-[#f0b4ba] bg-[#fff4f4] px-4 py-3 text-sm text-[#b42332]">{error}</div> : null}{stats ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Tất cả Posts" value={stats.all} /><Metric label="Đã xuất bản" value={stats.published} /><Metric label="Chờ duyệt" value={stats.pending} /><Metric label="Report mở" value={stats.reported} /></div> : <div className="h-32 animate-pulse rounded-xl bg-[#e9edf2]" />}<div className="grid gap-6 xl:grid-cols-2"><section className="rounded-xl border border-[#e5e7eb] bg-white"><div className="flex items-center gap-3 border-b border-[#edf0f2] px-5 py-4"><FileText className="h-5 w-5 text-[#1677ff]" aria-hidden /><h2 className="font-bold text-[#12151b]">Danh mục</h2></div><div className="divide-y divide-[#edf0f2]">{categories.map((category) => <div key={category.slug} className="flex items-center justify-between px-5 py-3 text-sm"><span className="font-semibold text-[#36404d]">{category.label}</span><span className="text-xs text-[#69707d]">{category.count} bài</span></div>)}{!categories.length ? <p className="px-5 py-8 text-sm text-[#69707d]">Chưa có danh mục.</p> : null}</div></section><section className="rounded-xl border border-[#e5e7eb] bg-white"><div className="flex items-center gap-3 border-b border-[#edf0f2] px-5 py-4"><Hash className="h-5 w-5 text-[#1677ff]" aria-hidden /><h2 className="font-bold text-[#12151b]">Tag phổ biến</h2></div><div className="flex flex-wrap gap-2 p-5">{tags.map((tag) => <span key={tag.tag} className="rounded-full bg-[#f7f8fa] px-3 py-1.5 text-xs font-semibold text-[#36404d]">#{tag.tag} <span className="text-[#8b929d]">{tag.count}</span></span>)}{!tags.length ? <p className="text-sm text-[#69707d]">Chưa có tag.</p> : null}</div></section></div><div className="flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-[#fbfcfd] px-4 py-3 text-xs text-[#69707d]"><ShieldAlert className="h-4 w-4 shrink-0 text-[#e5a100]" aria-hidden /> Featured/reorder editor sẽ nối vào content settings sau; màn này hiện chỉ phản ánh dữ liệu thật.</div></div>;
}
