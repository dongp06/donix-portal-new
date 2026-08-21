'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, ClipboardList, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { apiAdmin } from '@/lib/api-client';

type CaseRow = { id: string; reference: string; type: string; targetName: string; reason: string; priority: string; status: string; assignedTo?: string | null; createdAt: string };
const tone: Record<string, string> = { critical: 'bg-[#dc3545]/10 text-[#b42332]', high: 'bg-[#e5a100]/15 text-[#8a6100]', medium: 'bg-[#1677ff]/10 text-[#145dca]', low: 'bg-[#69707d]/10 text-[#69707d]' };

export default function AdminCasesPage() {
  const [rows, setRows] = useState<CaseRow[] | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await apiAdmin<CaseRow[]>(`/api/admin/cases${status ? `?status=${status}` : ''}`));
    } catch (cause) {
      setRows([]);
      const message = cause instanceof Error ? cause.message : 'Không tải được danh sách case.';
      setError(message);
      toast.error(message);
    }
  }, [status]);
  useEffect(() => { void load(); }, [load]);
  return <div className="space-y-7"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-[#1677ff]">Trust & Safety</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-[#12151b]">Cases</h1><p className="mt-2 text-sm text-[#69707d]">Case là đơn vị xử lý có người nhận, trạng thái, ghi chú và audit trail.</p></div><button type="button" onClick={() => void load()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#dfe3e8] bg-white px-3.5 py-2 text-sm font-semibold text-[#36404d] hover:border-[#1677ff]/40 hover:text-[#1677ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677ff]"><RefreshCw className="h-4 w-4" aria-hidden /> Làm mới</button></div><div className="flex items-center gap-3 rounded-xl border border-[#e5e7eb] bg-white p-3"><select aria-label="Lọc trạng thái case" value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-lg border border-[#dfe3e8] bg-white px-3 text-xs font-semibold text-[#36404d] outline-none focus:border-[#1677ff] focus:ring-2 focus:ring-[#1677ff]/15"><option value="">Tất cả trạng thái</option><option value="open">Open</option><option value="investigating">Investigating</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select><span className="ml-auto text-xs text-[#69707d]">{rows?.length ?? 0} case</span></div>{error ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#f0b4ba] bg-[#fff4f4] px-4 py-3 text-sm text-[#b42332]" role="alert"><span>{error}</span><button type="button" onClick={() => void load()} className="font-bold underline underline-offset-2">Thử lại</button></div> : null}<section className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-[#edf0f2] bg-[#fbfcfd] text-[11px] font-bold uppercase tracking-[0.08em] text-[#69707d]"><tr><th className="px-5 py-3 sm:px-6">Case</th><th className="px-5 py-3">Target</th><th className="px-5 py-3">Priority</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Assigned</th><th className="px-5 py-3 sm:px-6"><span className="sr-only">Mở</span></th></tr></thead><tbody className="divide-y divide-[#edf0f2]">{rows?.map((row) => <tr key={row.id} className="hover:bg-[#fbfcfd]"><td className="px-5 py-4 sm:px-6"><Link href={`/admin/cases/${encodeURIComponent(row.id)}`} className="font-bold text-[#1677ff] hover:underline">{row.reference}</Link><p className="mt-1 text-xs text-[#69707d]">{row.type} · {new Date(row.createdAt).toLocaleString('vi-VN')}</p></td><td className="max-w-[300px] truncate px-5 py-4"><p className="truncate font-semibold text-[#12151b]">{row.targetName}</p><p className="mt-1 truncate text-xs text-[#69707d]">{row.reason}</p></td><td className="px-5 py-4"><span className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase ${tone[row.priority] ?? tone.medium}`}>{row.priority}</span></td><td className="px-5 py-4 text-xs font-semibold text-[#36404d]">{row.status}</td><td className="px-5 py-4 text-xs text-[#69707d]">{row.assignedTo || 'Chưa giao'}</td><td className="px-5 py-4 text-right sm:px-6"><Link href={`/admin/cases/${encodeURIComponent(row.id)}`} className="inline-flex items-center gap-1.5 font-semibold text-[#1677ff] hover:underline">Mở <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link></td></tr>)}</tbody></table></div>{rows?.length === 0 && !error ? <div className="px-6 py-16 text-center"><ClipboardList className="mx-auto h-8 w-8 text-[#8b929d]" aria-hidden /><p className="mt-3 text-sm text-[#69707d]">Chưa có case được tạo.</p></div> : null}</section></div>;
}
