'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Check, Filter, RefreshCw, UserRound } from 'lucide-react';
import { toast } from 'sonner';

import { apiAdmin } from '@/lib/api-client';

type QueueItem = {
  id: string;
  sourceId: string;
  type: string;
  targetType: string;
  targetId: string;
  targetName: string;
  reason: string;
  details?: string | null;
  priority: string;
  status: string;
  assignedTo?: string | null;
  createdAt: string;
  reference?: string;
};

type AdminCase = { id: string; reference: string };

const priorityTone: Record<string, string> = { critical: 'bg-[#dc3545]/10 text-[#b42332]', high: 'bg-[#e5a100]/15 text-[#8a6100]', medium: 'bg-[#1677ff]/10 text-[#145dca]', low: 'bg-[#69707d]/10 text-[#69707d]' };
const typeLabel: Record<string, string> = { report: 'Report', trust_request: 'Trust request', bot_approval: 'Bot approval', review_fraud: 'Review fraud' };

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function AdminModerationPage({ initialType = '' }: { initialType?: string }) {
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [type, setType] = useState(initialType);
  const [priority, setPriority] = useState('');
  const [assigned, setAssigned] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (type) params.set('type', type);
      if (priority) params.set('priority', priority);
      if (assigned) params.set('assigned', assigned);
      setItems(await apiAdmin<QueueItem[]>(`/api/admin/moderation?${params.toString()}`));
    } catch (cause) {
      setItems([]);
      setError(cause instanceof Error ? cause.message : 'Không tải được hàng đợi kiểm duyệt.');
    }
  }, [assigned, priority, type]);

  useEffect(() => { void load(); }, [load]);

  const takeCase = async (item: QueueItem) => {
    if (busy) return;
    setBusy(item.id);
    try {
      let caseId = item.targetType === 'case' ? item.targetId : '';
      if (!caseId) {
        const created = await apiAdmin<AdminCase>('/api/admin/cases', { method: 'POST', body: JSON.stringify({ type: item.type, targetId: item.targetId, targetName: item.targetName, reason: item.reason, priority: item.priority, details: item.details }) });
        caseId = created.id;
      }
      await apiAdmin(`/api/admin/cases/${encodeURIComponent(caseId)}/assign`, { method: 'POST' });
      toast.success('Đã nhận case.');
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Không thể nhận case.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-[#1677ff]">Trust & Safety</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-[#12151b]">Hàng đợi kiểm duyệt</h1><p className="mt-2 max-w-2xl text-sm text-[#69707d]">Một nơi cho report, Trust request và các case cần phân công. Nhận case trước khi xử lý để tránh trùng việc.</p></div><button type="button" onClick={() => void load()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#dfe3e8] bg-white px-3.5 py-2 text-sm font-semibold text-[#36404d] hover:border-[#1677ff]/40 hover:text-[#1677ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677ff]"><RefreshCw className="h-4 w-4" aria-hidden /> Làm mới</button></div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#e5e7eb] bg-white p-3"><Filter className="ml-1 h-4 w-4 text-[#69707d]" aria-hidden /><span className="mr-2 text-xs font-bold text-[#69707d]">Bộ lọc</span><select aria-label="Lọc loại queue" value={type} onChange={(event) => setType(event.target.value)} className="h-9 rounded-lg border border-[#dfe3e8] bg-white px-3 text-xs font-semibold text-[#36404d] outline-none focus:border-[#1677ff] focus:ring-2 focus:ring-[#1677ff]/15"><option value="">Tất cả loại</option><option value="report">Report</option><option value="trust_request">Trust request</option><option value="bot_approval">Bot approval</option><option value="review_fraud">Review fraud</option></select><select aria-label="Lọc độ ưu tiên" value={priority} onChange={(event) => setPriority(event.target.value)} className="h-9 rounded-lg border border-[#dfe3e8] bg-white px-3 text-xs font-semibold text-[#36404d] outline-none focus:border-[#1677ff] focus:ring-2 focus:ring-[#1677ff]/15"><option value="">Tất cả mức độ</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select><select aria-label="Lọc phân công" value={assigned} onChange={(event) => setAssigned(event.target.value)} className="h-9 rounded-lg border border-[#dfe3e8] bg-white px-3 text-xs font-semibold text-[#36404d] outline-none focus:border-[#1677ff] focus:ring-2 focus:ring-[#1677ff]/15"><option value="">Tất cả người xử lý</option><option value="unassigned">Chưa giao</option><option value="me">Của tôi</option></select><span className="ml-auto text-xs text-[#69707d]">{items?.length ?? 0} mục</span></div>

      {error ? <div className="rounded-lg border border-[#f0b4ba] bg-[#fff4f4] px-4 py-3 text-sm text-[#b42332]">{error}</div> : null}
      <section className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-[#edf0f2] bg-[#fbfcfd] text-[11px] font-bold uppercase tracking-[0.08em] text-[#69707d]"><tr><th className="px-5 py-3 sm:px-6">Type</th><th className="px-5 py-3">Target</th><th className="px-5 py-3">Priority</th><th className="px-5 py-3">Assigned</th><th className="px-5 py-3">Waiting</th><th className="px-5 py-3 sm:px-6"><span className="sr-only">Action</span></th></tr></thead><tbody className="divide-y divide-[#edf0f2]">{items?.map((item) => <tr key={item.id} className="transition-colors hover:bg-[#fbfcfd]"><td className="px-5 py-4 text-xs font-bold text-[#69707d] sm:px-6">{typeLabel[item.type] ?? item.type}</td><td className="max-w-[330px] px-5 py-4"><p className="truncate font-bold text-[#12151b]">{item.targetName}</p><p className="mt-1 truncate text-xs text-[#69707d]">{item.reason}{item.reference ? ` · ${item.reference}` : ''}</p></td><td className="px-5 py-4"><span className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase ${priorityTone[item.priority] ?? priorityTone.medium}`}>{item.priority}</span></td><td className="px-5 py-4 text-xs text-[#69707d]">{item.assignedTo ? <span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" aria-hidden />{item.assignedTo}</span> : 'Chưa giao'}</td><td className="px-5 py-4 text-xs text-[#69707d]">{formatTime(item.createdAt)}</td><td className="px-5 py-4 text-right sm:px-6"><div className="flex justify-end gap-2">{item.targetType === 'case' ? <Link href={`/admin/cases/${encodeURIComponent(item.targetId)}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#dfe3e8] px-3 py-2 text-xs font-bold text-[#36404d] hover:border-[#1677ff]/40 hover:text-[#1677ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677ff]">Mở <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link> : null}<button type="button" disabled={Boolean(busy) || Boolean(item.assignedTo)} onClick={() => void takeCase(item)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#1677ff] px-3 py-2 text-xs font-bold text-white hover:bg-[#145dca] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677ff]">{busy === item.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />}{item.assignedTo ? 'Đã nhận' : 'Nhận xử lý'}</button></div></td></tr>)}</tbody></table></div>{items?.length === 0 ? <div className="px-6 py-16 text-center"><Check className="mx-auto h-8 w-8 text-[#13b981]" aria-hidden /><p className="mt-3 font-semibold text-[#12151b]">Hàng đợi đang trống</p><p className="mt-1 text-sm text-[#69707d]">Không có item nào khớp bộ lọc hiện tại.</p></div> : null}</section>
    </div>
  );
}

export default AdminModerationPage;
