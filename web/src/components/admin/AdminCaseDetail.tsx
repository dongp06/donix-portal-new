'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type HTMLAttributes, type ReactNode } from 'react';
import { ArrowLeft, Check, RefreshCw, UserRound } from 'lucide-react';
import { toast } from 'sonner';

import { apiAdmin } from '@/lib/api-client';

type CaseData = {
  id: string;
  reference: string;
  type: string;
  targetId: string;
  targetName: string;
  reason: string;
  priority: string;
  status: string;
  assignedTo?: string | null;
  details?: string | null;
  evidence: string[];
  notes: string[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
};

export function AdminCaseDetail({ id }: { id: string }) {
  const [data, setData] = useState<CaseData | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await apiAdmin<CaseData>(`/api/admin/cases/${encodeURIComponent(id)}`));
    } catch (cause) {
      setData(null);
      const message = cause instanceof Error ? cause.message : 'Khong tai duoc case.';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const assign = async () => {
    setBusy(true);
    try {
      await apiAdmin(`/api/admin/cases/${encodeURIComponent(id)}/assign`, { method: 'POST' });
      toast.success('Da nhan case.');
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Khong the nhan case.');
    } finally {
      setBusy(false);
    }
  };

  const update = async (status: string) => {
    setBusy(true);
    try {
      await apiAdmin(`/api/admin/cases/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, note: note.trim() || undefined }),
      });
      setNote('');
      toast.success('Da cap nhat case.');
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Khong cap nhat duoc case.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="h-96 animate-pulse rounded-xl bg-[#e9edf2]" aria-busy="true" />;
  if (error) return <div className="rounded-xl border border-[#f0b4ba] bg-[#fff4f4] p-6 text-sm text-[#b42332]" role="alert"><p>{error}</p><button type="button" onClick={() => void load()} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#b42332]/30 bg-white px-3 py-2 font-bold hover:bg-[#b42332]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b42332]">Thu lai</button></div>;
  if (!data) return <div className="rounded-xl border border-[#e5e7eb] bg-white p-8 text-center text-sm text-[#69707d]">Khong tim thay case.</div>;

  return (
    <div className="space-y-7">
      <Link href="/admin/cases" className="inline-flex items-center gap-2 text-sm font-semibold text-[#69707d] hover:text-[#1677ff]"><ArrowLeft className="h-4 w-4" aria-hidden /> Cases</Link>
      <div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-sm font-bold text-[#1677ff]">CASE #{data.reference}</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-[#12151b]">{data.targetName}</h1><p className="mt-2 text-sm text-[#69707d]">{data.reason} · tao {new Date(data.createdAt).toLocaleString('vi-VN')}</p></div><div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-[#f7f8fa] px-3 py-2 text-xs font-bold text-[#36404d]">{data.priority}</span><span className="rounded-md bg-[#1677ff]/10 px-3 py-2 text-xs font-bold text-[#145dca]">{data.status}</span></div></div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]"><main className="space-y-6"><Panel title="Bao cao"><p className="text-sm leading-6 text-[#69707d]">{data.details || 'Khong co mo ta bo sung.'}</p></Panel><Panel title="Evidence"><div className="grid gap-3 sm:grid-cols-3">{data.evidence.map((item) => <div key={item} className="rounded-lg border border-[#e5e7eb] bg-[#f7f8fa] p-4 text-xs text-[#69707d]">{item}</div>)}{!data.evidence.length ? <p className="text-sm text-[#8b929d]">Chua co evidence dinh kem.</p> : null}</div></Panel><Panel title="Timeline"><div className="space-y-4"><TimelineItem label="Case created" value={data.createdAt} /><TimelineItem label={data.assignedTo ? 'Moderator assigned' : 'Chua phan cong'} value={data.updatedAt} /><TimelineItem label="Last update" value={data.updatedAt} /></div></Panel><Panel title="Internal notes"><div className="space-y-3">{data.notes.map((item) => <p key={item} className="rounded-lg bg-[#f7f8fa] p-3 text-sm text-[#36404d]">{item}</p>)}{!data.notes.length ? <p className="text-sm text-[#8b929d]">Chua co ghi chu noi bo.</p> : null}<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={1000} placeholder="Them ghi chu noi bo..." className="w-full rounded-lg border border-[#dfe3e8] bg-white p-3 text-sm outline-none placeholder:text-[#8b929d] focus:border-[#1677ff] focus:ring-2 focus:ring-[#1677ff]/15" /></div></Panel></main><aside className="space-y-6"><Panel title="Assignment"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1677ff]/10 text-[#1677ff]"><UserRound className="h-5 w-5" aria-hidden /></span><div><p className="text-xs text-[#69707d]">Assigned to</p><p className="font-bold text-[#12151b]">{data.assignedTo || 'Chua giao'}</p></div></div><button type="button" disabled={busy || Boolean(data.assignedTo)} onClick={() => void assign()} className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#1677ff] px-3 py-2 text-sm font-bold text-white hover:bg-[#145dca] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677ff]">{busy ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}{data.assignedTo ? 'Da phan cong' : 'Nhan xu ly'}</button></Panel><Panel title="Actions"><div className="space-y-2"><button type="button" disabled={busy} onClick={() => void update('investigating')} className="min-h-10 w-full rounded-lg border border-[#dfe3e8] px-3 py-2 text-left text-sm font-semibold text-[#36404d] hover:border-[#1677ff]/40 hover:text-[#1677ff] disabled:opacity-50">Dang dieu tra</button><button type="button" disabled={busy} onClick={() => void update('resolved')} className="min-h-10 w-full rounded-lg bg-[#13b981] px-3 py-2 text-sm font-bold text-white hover:bg-[#087a55] disabled:opacity-50">Resolve case</button><button type="button" disabled={busy} onClick={() => void update('dismissed')} className="min-h-10 w-full rounded-lg border border-[#dfe3e8] px-3 py-2 text-left text-sm font-semibold text-[#69707d] hover:text-[#12151b] disabled:opacity-50">Dismiss</button></div></Panel><Panel title="Target"><Link href={data.type === 'trust_request' ? `/admin/sellers/${encodeURIComponent(data.targetId)}` : data.type === 'report' ? `/admin/posts/${encodeURIComponent(data.targetId)}` : '/admin'} className="text-sm font-semibold text-[#1677ff] hover:underline">Mo target <ArrowRightIcon className="inline h-4 w-4" aria-hidden /></Link></Panel></aside></div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) { return <section className="rounded-xl border border-[#e5e7eb] bg-white p-5 sm:p-6"><h2 className="mb-4 font-bold text-[#12151b]">{title}</h2>{children}</section>; }
function TimelineItem({ label, value }: { label: string; value: string }) { return <div className="flex gap-3"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#1677ff]" /><div><p className="text-sm font-semibold text-[#12151b]">{label}</p><p className="mt-0.5 text-xs text-[#69707d]">{new Date(value).toLocaleString('vi-VN')}</p></div></div>; }
function ArrowRightIcon(props: HTMLAttributes<HTMLSpanElement>) { return <span {...props}>→</span>; }
