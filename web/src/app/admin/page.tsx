'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, Bot, CheckCircle2, Clock3, MessageSquare, RefreshCw, ShieldCheck } from 'lucide-react';

import { apiAdmin } from '@/lib/api-client';

type QueueItem = {
  id: string;
  type: string;
  targetType: string;
  targetId: string;
  targetName: string;
  reason: string;
  priority: string;
  status: string;
  assignedTo?: string | null;
  createdAt: string;
  reference?: string;
};

type Overview = {
  needsAttention: { botApprovals: number; trustRequests: number; reports: number; riskyReviews: number };
  highPriority: QueueItem[];
  activityToday: { botsUpdated: number; sellersJoined: number; reportsCreated: number; postsPending: number };
  marketplace: { bots: number; activeBots: number; sellers: number; trustedSellers: number; posts: number; comments: number };
  staff: { total: number };
  generatedAt: string;
};

const priorityTone: Record<string, string> = {
  critical: 'bg-[#dc3545]/10 text-[#b42332]',
  high: 'bg-[#e5a100]/15 text-[#8a6100]',
  medium: 'bg-[#1677ff]/10 text-[#145dca]',
  low: 'bg-[#69707d]/10 text-[#69707d]',
};

const priorityLabel: Record<string, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };

function formatNumber(value: number): string {
  return value.toLocaleString('vi-VN');
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function ActionCard({ href, label, value, description, icon: Icon, tone }: { href: string; label: string; value: number; description: string; icon: typeof Bot; tone: string }) {
  return (
    <Link href={href} className="group rounded-xl border border-[#e5e7eb] bg-white p-5 transition-[border-color,box-shadow] hover:border-[#1677ff]/35 hover:shadow-[0_10px_30px_-20px_rgba(18,21,27,.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677ff]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-[#69707d]">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-[#12151b]">{formatNumber(value)}</p>
        </div>
        <span className={`rounded-lg p-2.5 ${tone}`}><Icon className="h-5 w-5" aria-hidden /></span>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-[#69707d]">
        <span>{description}</span>
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </div>
    </Link>
  );
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <div className="rounded-xl border border-[#e5e7eb] bg-white p-5"><p className="text-xs font-semibold text-[#69707d]">{label}</p><p className="mt-2 text-2xl font-bold tracking-tight text-[#12151b]">{formatNumber(value)}</p><p className="mt-1 text-xs text-[#8b929d]">{detail}</p></div>;
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await apiAdmin<Overview>('/api/admin/overview'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được tổng quan vận hành.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading && !data) {
    return <div className="space-y-8" aria-busy="true"><div className="h-20 animate-pulse rounded-xl bg-[#e9edf2]" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-xl bg-[#e9edf2]" />)}</div><div className="h-72 animate-pulse rounded-xl bg-[#e9edf2]" /></div>;
  }

  if (!data) {
    return <div className="rounded-xl border border-[#f0b4ba] bg-[#fff4f4] p-6 text-sm text-[#b42332]"><p>{error ?? 'Không tải được dữ liệu.'}</p><button type="button" onClick={() => void load()} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#b42332] px-4 py-2 font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b42332]"><RefreshCw className="h-4 w-4" aria-hidden /> Thử lại</button></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-semibold text-[#1677ff]">Operations Console</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-[#12151b] sm:text-4xl">Tổng quan vận hành</h1><p className="mt-2 max-w-2xl text-sm text-[#69707d]">Hôm nay có gì cần xử lý trên thuebot.org?</p></div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#dfe3e8] bg-white px-3.5 py-2 text-sm font-semibold text-[#36404d] transition-colors hover:border-[#1677ff]/40 hover:text-[#1677ff] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677ff]"><RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden /> Làm mới</button>
      </div>

      {error ? <div className="rounded-lg border border-[#f0b4ba] bg-[#fff4f4] px-4 py-3 text-sm text-[#b42332]">{error}</div> : null}

      <section aria-labelledby="needs-attention">
        <div className="mb-4 flex items-center justify-between gap-3"><h2 id="needs-attention" className="text-lg font-bold text-[#12151b]">Cần xử lý</h2><Link href="/admin/moderation" className="text-sm font-semibold text-[#1677ff] hover:underline">Mở hàng đợi <ArrowRight className="inline h-4 w-4" aria-hidden /></Link></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ActionCard href="/admin/bots?status=pending" label="Bot chờ duyệt" value={data.needsAttention.botApprovals} description="Listing cần kiểm tra" icon={Bot} tone="bg-[#f58200]/10 text-[#c86a00]" />
          <ActionCard href="/admin/verifications" label="Trust requests" value={data.needsAttention.trustRequests} description="Hồ sơ seller chờ review" icon={ShieldCheck} tone="bg-[#1677ff]/10 text-[#1677ff]" />
          <ActionCard href="/admin/reports" label="Report chưa xử lý" value={data.needsAttention.reports} description="Báo cáo đang mở" icon={AlertTriangle} tone="bg-[#dc3545]/10 text-[#b42332]" />
          <ActionCard href="/admin/reviews" label="Review rủi ro cao" value={data.needsAttention.riskyReviews} description="Rating 1–2 cần xem" icon={MessageSquare} tone="bg-[#e5a100]/15 text-[#8a6100]" />
        </div>
      </section>

      <section aria-labelledby="high-priority" className="rounded-xl border border-[#e5e7eb] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0f2] px-5 py-4 sm:px-6"><div><h2 id="high-priority" className="font-bold text-[#12151b]">Cần xử lý gấp</h2><p className="mt-1 text-xs text-[#69707d]">Các tín hiệu có mức ưu tiên cao nhất trong hàng đợi.</p></div><span className="rounded-full bg-[#f7f8fa] px-2.5 py-1 text-xs font-semibold text-[#69707d]">{data.highPriority.length} mục</span></div>
        {data.highPriority.length ? <div className="divide-y divide-[#edf0f2]">{data.highPriority.map((item) => <Link key={item.id} href={item.targetType === 'case' ? `/admin/cases/${item.targetId}` : '/admin/moderation'} className="flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-[#fbfcfd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1677ff] sm:px-6"><div className="flex min-w-0 flex-1 items-center gap-3"><span className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase ${priorityTone[item.priority] ?? priorityTone.medium}`}>{priorityLabel[item.priority] ?? item.priority}</span><div className="min-w-0"><p className="truncate text-sm font-bold text-[#12151b]">{item.targetName}</p><p className="mt-0.5 truncate text-xs text-[#69707d]">{item.reason} · {formatTime(item.createdAt)}</p></div></div><span className="text-xs font-semibold text-[#1677ff]">Mở case <ArrowRight className="inline h-3.5 w-3.5" aria-hidden /></span></Link>)}</div> : <div className="px-6 py-12 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-[#13b981]" aria-hidden /><p className="mt-3 text-sm font-semibold text-[#12151b]">Chưa có tín hiệu ưu tiên cao</p><p className="mt-1 text-xs text-[#69707d]">Hàng đợi đang trong trạng thái ổn định.</p></div>}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-labelledby="activity" className="rounded-xl border border-[#e5e7eb] bg-white p-5 sm:p-6"><h2 id="activity" className="font-bold text-[#12151b]">Hoạt động hôm nay</h2><p className="mt-1 text-xs text-[#69707d]">Dữ liệu được tổng hợp từ các module đang vận hành.</p><div className="mt-5 grid grid-cols-2 gap-3"><Metric label="Bot cập nhật" value={data.activityToday.botsUpdated} detail="listing có thay đổi" /><Metric label="Seller mới" value={data.activityToday.sellersJoined} detail="tham gia hôm nay" /><Metric label="Report mới" value={data.activityToday.reportsCreated} detail="báo cáo được tạo" /><Metric label="Post chờ duyệt" value={data.activityToday.postsPending} detail="nội dung pending" /></div></section>
        <section aria-labelledby="marketplace-health" className="rounded-xl border border-[#e5e7eb] bg-white p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><h2 id="marketplace-health" className="font-bold text-[#12151b]">Marketplace</h2><p className="mt-1 text-xs text-[#69707d]">Quy mô và trạng thái hiện tại.</p></div><Link href="/admin/analytics" className="text-xs font-semibold text-[#1677ff] hover:underline">Analytics <ArrowRight className="inline h-3.5 w-3.5" aria-hidden /></Link></div><div className="mt-5 grid grid-cols-2 gap-3"><Metric label="Bot đang hoạt động" value={data.marketplace.activeBots} detail={`trên ${formatNumber(data.marketplace.bots)} listing`} /><Metric label="Seller active" value={data.marketplace.sellers} detail={`${formatNumber(data.marketplace.trustedSellers)} Trusted Seller`} /><Metric label="Posts" value={data.marketplace.posts} detail="nội dung không bị gỡ" /><Metric label="Bình luận" value={data.marketplace.comments} detail="trên marketplace" /></div></section>
      </div>

      <section aria-labelledby="moderation-queue" className="rounded-xl border border-[#e5e7eb] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0f2] px-5 py-4 sm:px-6"><div><h2 id="moderation-queue" className="font-bold text-[#12151b]">Moderation queue</h2><p className="mt-1 text-xs text-[#69707d]">Report, trust request và case được gom vào một hàng đợi.</p></div><Link href="/admin/moderation" className="text-sm font-semibold text-[#1677ff] hover:underline">Xem toàn bộ <ArrowRight className="inline h-4 w-4" aria-hidden /></Link></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-[#fbfcfd] text-xs font-semibold text-[#69707d]"><tr><th className="px-5 py-3 sm:px-6">Loại</th><th className="px-5 py-3">Target</th><th className="px-5 py-3">Priority</th><th className="px-5 py-3">Assigned</th><th className="px-5 py-3">Chờ từ</th><th className="px-5 py-3 sm:px-6"><span className="sr-only">Mở</span></th></tr></thead><tbody className="divide-y divide-[#edf0f2]">{data.highPriority.slice(0, 5).map((item) => <tr key={item.id} className="transition-colors hover:bg-[#fbfcfd]"><td className="px-5 py-4 text-xs font-semibold text-[#69707d] sm:px-6">{item.type}</td><td className="max-w-[260px] truncate px-5 py-4 font-semibold text-[#12151b]">{item.targetName}</td><td className="px-5 py-4"><span className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase ${priorityTone[item.priority] ?? priorityTone.medium}`}>{priorityLabel[item.priority] ?? item.priority}</span></td><td className="px-5 py-4 text-xs text-[#69707d]">{item.assignedTo ?? 'Chưa giao'}</td><td className="px-5 py-4 text-xs text-[#69707d]">{formatTime(item.createdAt)}</td><td className="px-5 py-4 text-right sm:px-6"><Link href={item.targetType === 'case' ? `/admin/cases/${item.targetId}` : '/admin/moderation'} className="font-semibold text-[#1677ff] hover:underline">Mở</Link></td></tr>)}</tbody></table></div>
        {!data.highPriority.length ? <div className="px-6 py-10 text-center text-sm text-[#69707d]">Chưa có mục cần hiển thị.</div> : null}
      </section>

      <p className="flex items-center gap-2 text-xs text-[#8b929d]"><Clock3 className="h-3.5 w-3.5" aria-hidden /> Cập nhật lúc {formatTime(data.generatedAt)} · {data.staff.total} tài khoản staff</p>
    </div>
  );
}
