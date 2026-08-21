'use client';

import { useCallback, useEffect, useState } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';

import { apiAdmin } from '@/lib/api-client';

type CountRow = { label: string; count: number };
type Analytics = {
  generatedAt: string;
  marketplace: { bots: number; activeBots: number; sellers: number; trustedSellers: number; posts: number; comments: number; botViews: number; postViews: number };
  moderation: { botApprovals: number; trustRequests: number; reports: number; riskyReviews: number; reportsByCategory: CountRow[] };
  trust: { sellersByState: CountRow[] };
  reviews: { total: number; averageRating: number; ratings: CountRow[] };
  bots: { byStatus: CountRow[]; topByViews: { id: string; title: string; sellerName: string; views: number }[] };
  posts: { byStatus: CountRow[] };
  tracking: { contactClicks: number | null; note: string };
};

function number(value: number) { return value.toLocaleString('vi-VN'); }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN'); }

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="rounded-xl border border-[#e5e7eb] bg-white p-5"><p className="text-xs font-semibold text-[#69707d]">{label}</p><p className="mt-2 text-2xl font-bold tracking-tight text-[#12151b]">{value}</p><p className="mt-1 text-xs text-[#8b929d]">{detail}</p></div>; }
function Breakdown({ title, rows }: { title: string; rows: CountRow[] }) { const max = Math.max(1, ...rows.map((row) => row.count)); return <section className="rounded-xl border border-[#e5e7eb] bg-white p-5 sm:p-6"><h2 className="font-bold text-[#12151b]">{title}</h2>{rows.length ? <div className="mt-5 space-y-4">{rows.map((row) => <div key={row.label}><div className="flex items-center justify-between gap-4 text-xs"><span className="font-semibold text-[#36404d]">{row.label}</span><span className="font-bold text-[#12151b]">{number(row.count)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#edf0f2]"><div className="h-full rounded-full bg-[#1677ff]" style={{ width: `${Math.max(4, (row.count / max) * 100)}%` }} /></div></div>)}</div> : <p className="mt-5 text-sm text-[#69707d]">Chưa có dữ liệu.</p>}</section>; }

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setError(null); try { setData(await apiAdmin<Analytics>('/api/admin/analytics')); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được analytics.'); } }, []);
  useEffect(() => { void load(); }, [load]);
  if (!data && error) return <div className="rounded-xl border border-[#f0b4ba] bg-[#fff4f4] p-6 text-sm text-[#b42332]"><p>{error}</p><button type="button" onClick={() => void load()} className="mt-4 rounded-lg bg-[#b42332] px-4 py-2 font-bold text-white">Thử lại</button></div>;
  if (!data) return <div className="space-y-5" aria-busy="true"><div className="h-20 animate-pulse rounded-xl bg-[#e9edf2]" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-32 animate-pulse rounded-xl bg-[#e9edf2]" />)}</div></div>;
  return <div className="space-y-7"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-[#1677ff]">Quản trị</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-[#12151b]">Analytics</h1><p className="mt-2 text-sm text-[#69707d]">Snapshot từ dữ liệu marketplace và trust hiện có; không thêm số liệu mô phỏng.</p></div><button type="button" onClick={() => void load()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#dfe3e8] bg-white px-3.5 py-2 text-sm font-semibold text-[#36404d] hover:border-[#1677ff]/40 hover:text-[#1677ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677ff]"><RefreshCw className="h-4 w-4" aria-hidden /> Làm mới</button></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Bot views" value={number(data.marketplace.botViews)} detail={`${number(data.marketplace.bots)} listing`} /><Metric label="Post views" value={number(data.marketplace.postViews)} detail={`${number(data.marketplace.posts)} bài còn tồn tại`} /><Metric label="Seller" value={number(data.marketplace.sellers)} detail={`${number(data.marketplace.trustedSellers)} Trusted Seller`} /><Metric label="Rating trung bình" value={data.reviews.averageRating ? data.reviews.averageRating.toFixed(2) : '—'} detail={`${number(data.reviews.total)} review`} /></div><div className="grid gap-6 xl:grid-cols-3"><Breakdown title="Bot theo trạng thái" rows={data.bots.byStatus} /><Breakdown title="Seller theo trạng thái trust" rows={data.trust.sellersByState} /><Breakdown title="Review theo rating" rows={data.reviews.ratings} /></div><div className="grid gap-6 xl:grid-cols-2"><Breakdown title="Report theo loại" rows={data.moderation.reportsByCategory} /><Breakdown title="Post theo trạng thái" rows={data.posts.byStatus} /></div><section className="rounded-xl border border-[#e5e7eb] bg-white"><div className="flex items-center gap-3 border-b border-[#edf0f2] px-5 py-4 sm:px-6"><BarChart3 className="h-5 w-5 text-[#1677ff]" aria-hidden /><div><h2 className="font-bold text-[#12151b]">Bot có nhiều lượt xem</h2><p className="mt-1 text-xs text-[#69707d]">Top hiện tại theo trường views của listing.</p></div></div><div className="divide-y divide-[#edf0f2]">{data.bots.topByViews.map((bot, index) => <div key={bot.id} className="flex items-center gap-4 px-5 py-4 sm:px-6"><span className="w-6 text-sm font-bold text-[#8b929d]">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate font-bold text-[#12151b]">{bot.title}</p><p className="truncate text-xs text-[#69707d]">{bot.sellerName}</p></div><span className="text-sm font-bold text-[#12151b]">{number(bot.views)}</span></div>)}{!data.bots.topByViews.length ? <p className="px-6 py-10 text-center text-sm text-[#69707d]">Chưa có bot để xếp hạng.</p> : null}</div></section><div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#8b929d]"><span>Cập nhật lúc {formatDate(data.generatedAt)}</span><span>{data.tracking.note}</span></div></div>;
}
