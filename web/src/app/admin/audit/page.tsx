'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';

import { apiAdmin } from '@/lib/api-client';

type AuditRow = {
  id: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  caseId?: string | null;
  reason?: string | null;
  beforeData?: string | null;
  afterData?: string | null;
  createdAt: string;
};

export default function AdminAuditPage() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await apiAdmin<AuditRow[]>('/api/admin/audit?limit=200'));
    } catch (cause) {
      setRows([]);
      const message = cause instanceof Error ? cause.message : 'Khong tai duoc audit log.';
      setError(message);
      toast.error(message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#1677ff]">Governance</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#12151b]">Audit log</h1>
          <p className="mt-2 text-sm text-[#69707d]">Nhat ky append-only cua cac thao tac staff tren operations console.</p>
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#dfe3e8] bg-white px-3.5 py-2 text-sm font-semibold text-[#36404d] hover:border-[#1677ff]/40 hover:text-[#1677ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677ff]">
          <RefreshCw className="h-4 w-4" aria-hidden /> Lam moi
        </button>
      </div>

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#f0b4ba] bg-[#fff4f4] px-4 py-3 text-sm text-[#b42332]" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => void load()} className="font-bold underline underline-offset-2">Thu lai</button>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-[#edf0f2] bg-[#fbfcfd] text-[11px] font-bold uppercase tracking-[0.08em] text-[#69707d]">
              <tr><th className="px-5 py-3 sm:px-6">Time</th><th className="px-5 py-3">Staff</th><th className="px-5 py-3">Action</th><th className="px-5 py-3">Target</th><th className="px-5 py-3 sm:px-6">Reason</th></tr>
            </thead>
            <tbody className="divide-y divide-[#edf0f2]">
              {rows?.map((row) => (
                <tr key={row.id} onClick={() => setSelected(row)} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(row); } }} className="cursor-pointer transition-colors hover:bg-[#fbfcfd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1677ff]">
                  <td className="whitespace-nowrap px-5 py-4 text-xs text-[#69707d] sm:px-6">{new Date(row.createdAt).toLocaleString('vi-VN')}</td>
                  <td className="px-5 py-4"><p className="font-semibold text-[#12151b]">{row.actorName}</p><p className="text-xs text-[#69707d]">{row.actorRole}</p></td>
                  <td className="px-5 py-4 font-mono text-xs font-semibold text-[#36404d]">{row.action}</td>
                  <td className="px-5 py-4 text-xs text-[#69707d]">{row.targetType} · {row.targetId || '—'}</td>
                  <td className="max-w-[240px] truncate px-5 py-4 text-xs text-[#69707d]">{row.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows?.length === 0 && !error ? (
          <div className="px-6 py-16 text-center"><Activity className="mx-auto h-8 w-8 text-[#8b929d]" aria-hidden /><p className="mt-3 text-sm text-[#69707d]">Chua co audit events.</p></div>
        ) : null}
      </section>

      {selected ? (
        <div role="dialog" aria-modal="true" aria-label="Audit event detail" className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={() => setSelected(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1677ff]">Audit event</p><h2 className="mt-2 text-xl font-bold text-[#12151b]">{selected.action}</h2></div>
              <button type="button" onClick={() => setSelected(null)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#69707d] hover:bg-[#f7f8fa] hover:text-[#12151b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677ff]" aria-label="Dong"><X className="h-4 w-4" aria-hidden /></button>
            </div>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              {([
                ['Staff', `${selected.actorName} · ${selected.actorRole}`],
                ['Target', `${selected.targetType} · ${selected.targetId || '—'}`],
                ['Case', selected.caseId || '—'],
                ['Time', new Date(selected.createdAt).toLocaleString('vi-VN')],
              ] as Array<[string, string]>).map(([label, value]) => <div key={label}><dt className="text-xs text-[#69707d]">{label}</dt><dd className="mt-1 text-sm font-semibold text-[#12151b]">{value}</dd></div>)}
            </dl>
            {selected.reason ? <div className="mt-6 rounded-lg bg-[#f7f8fa] p-4 text-sm text-[#36404d]"><p className="text-xs font-bold text-[#69707d]">Reason</p><p className="mt-2">{selected.reason}</p></div> : null}
            <div className="mt-6 grid gap-4 md:grid-cols-2"><pre className="overflow-auto rounded-lg bg-[#0b0d12] p-4 text-xs leading-5 text-[#dce5f2]">{selected.beforeData || 'null'}</pre><pre className="overflow-auto rounded-lg bg-[#0b0d12] p-4 text-xs leading-5 text-[#dce5f2]">{selected.afterData || 'null'}</pre></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
