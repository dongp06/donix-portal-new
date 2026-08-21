'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle2, Clock3, ExternalLink, Loader2, RefreshCw, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { SellerTier, TrustChecklistItem, TrustScoreInfo, TrustStatus, VerificationCheck, VerificationState } from '@shared/types';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { TrustedBadge } from './TrustedBadge';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';

interface VerificationCenterData {
  status: TrustStatus;
  state: VerificationState;
  isTrusted: boolean;
  trustScore: number;
  trustedAt?: string;
  trustedUntil?: string;
  basicVerifiedCount: number;
  basicVerifiedTotal: number;
  checks: VerificationCheck[];
  checklist: TrustChecklistItem[];
  score: TrustScoreInfo;
  tier: SellerTier;
}

const STATE_LABELS: Record<VerificationState | 'none', string> = {
  none: 'Chưa xác minh',
  unverified: 'Chưa xác minh',
  pending: 'Đang chờ xét duyệt',
  verified: 'Thông tin cơ bản đã xác minh',
  trusted: 'Trusted Seller',
  under_review: 'Đang được xem xét',
  suspended: 'Tạm dừng trạng thái Trusted Seller',
  revoked: 'Đã thu hồi trạng thái Trusted Seller',
  rejected: 'Yêu cầu chưa được chấp thuận',
};

const CHECK_LABELS: Record<string, string> = {
  email: 'Email',
  phone: 'Số điện thoại',
  telegram: 'Telegram',
  website: 'Website / domain',
  identity: 'Danh tính',
};

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function checkLabel(check: VerificationCheck): string {
  return CHECK_LABELS[check.kind] ?? check.label;
}

function checkStatusLabel(status: VerificationCheck['status']): string {
  if (status === 'verified') return 'Đã xác minh';
  if (status === 'pending') return 'Đang chờ xác minh';
  if (status === 'revoked') return 'Cần xác minh lại';
  return 'Chưa xác minh';
}

function statusTone(state: VerificationState | 'none'): string {
  if (state === 'trusted' || state === 'verified') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  if (state === 'pending' || state === 'under_review') return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  if (state === 'suspended' || state === 'revoked' || state === 'rejected') return 'border-destructive/30 bg-destructive/10 text-destructive';
  return 'border-border bg-muted text-muted-foreground';
}

export function VerificationCenter({ standalone = false }: { standalone?: boolean }) {
  const [data, setData] = useState<VerificationCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetchWithTimeout('/api/sellers/me/verification', { credentials: 'include' }, 30_000);
      const json = await response.json();
      if (!response.ok || !json.success || !json.data) throw new Error(json.error || 'Không tải được trung tâm xác minh.');
      setData(json.data as VerificationCenterData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không tải được trung tâm xác minh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const prerequisiteItems = useMemo(
    () => data?.checklist.filter((item) => item.blocking !== false) ?? [],
    [data],
  );
  const prerequisitePassed = prerequisiteItems.filter((item) => item.passed).length;
  const eligible = prerequisiteItems.length > 0 && prerequisitePassed === prerequisiteItems.length;
  const canRequest = Boolean(data && eligible && !['pending', 'under_review', 'trusted', 'suspended'].includes(data.status.status));

  const submit = async () => {
    if (!canRequest || busy) return;
    setBusy('submit');
    try {
      const response = await fetchWithTimeout('/api/sellers/me/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      }, 30_000);
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || 'Không thể gửi yêu cầu.');
      toast.success('Đã gửi yêu cầu Trusted Seller.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể gửi yêu cầu.');
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    if (busy) return;
    setBusy('cancel');
    try {
      const response = await fetchWithTimeout('/api/sellers/me/verification', { method: 'DELETE', credentials: 'include' }, 30_000);
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || 'Không thể hủy yêu cầu.');
      toast.success('Đã hủy yêu cầu xác minh.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể hủy yêu cầu.');
    } finally {
      setBusy(null);
    }
  };

  const requestCheck = async (kind: string) => {
    if (busy) return;
    setBusy(kind);
    try {
      const response = await fetchWithTimeout(`/api/sellers/me/verification/checks/${encodeURIComponent(kind)}`, {
        method: 'POST',
        credentials: 'include',
      }, 30_000);
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || 'Không thể tạo yêu cầu xác minh.');
      toast.success('Đã ghi nhận yêu cầu xác minh ownership.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể tạo yêu cầu xác minh.');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <div className="flex min-h-[34rem] items-center justify-center rounded-2xl border border-border bg-card"><span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Đang tải Verification Center…</span></div>;
  }

  if (!data) {
    return <div className="rounded-2xl border border-border bg-card p-10 text-center"><ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden /><p className="mt-3 text-sm text-muted-foreground">Chưa thể tải dữ liệu xác minh.</p><Button type="button" variant="outline" className="mt-4" onClick={() => void load()}><RefreshCw aria-hidden /> Thử lại</Button></div>;
  }

  const score = data.score.score;
  const scoreReady = score > 0 || data.score.breakdown.some((item) => item.value > 0);
  const currentState = data.status.status === 'none' ? data.state : data.status.status;

  return (
    <div className={standalone ? 'min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8' : 'space-y-6'}>
      <div className={standalone ? 'mx-auto max-w-6xl space-y-6' : 'space-y-6'}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Verification Center</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Xác minh & uy tín</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Hoàn thiện thông tin xác minh để gửi yêu cầu Trusted Seller. Tích xanh không được bán và luôn cần admin xét duyệt.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={Boolean(busy)}><RefreshCw aria-hidden /> Làm mới</Button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6" aria-labelledby="verification-status-title">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Trạng thái hiện tại</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {data.isTrusted ? <TrustedBadge size="lg" info={{ isTrusted: true, trustScore: score, trustedAt: data.trustedAt, basicVerifiedCount: data.basicVerifiedCount, basicVerifiedTotal: data.basicVerifiedTotal }} /> : null}
                  <h2 id="verification-status-title" className="font-display text-2xl font-bold">{STATE_LABELS[currentState]}</h2>
                  <Badge variant="outline" className={statusTone(currentState)}>{currentState}</Badge>
                </div>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">{data.isTrusted ? `Trạng thái có hiệu lực đến ${formatDate(data.trustedUntil)}.` : 'Basic verification và Trusted Seller là hai lớp khác nhau. Chỉ trạng thái trusted còn hạn mới hiện badge xanh.'}</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3 text-right"><p className="text-xs text-muted-foreground">Xác minh cơ bản</p><p className="mt-1 font-display text-2xl font-bold">{data.basicVerifiedCount}<span className="text-sm font-medium text-muted-foreground">/{data.basicVerifiedTotal}</span></p></div>
            </div>

            {data.status.note ? <p className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm leading-relaxed text-amber-700 dark:text-amber-300">Ghi chú từ đội ngũ: {data.status.note}</p> : null}

            <div className="mt-6 border-t border-border pt-5">
              <div className="flex items-center justify-between gap-3 text-sm"><span className="font-semibold">Điều kiện tự động</span><span className="text-muted-foreground">{prerequisitePassed}/{prerequisiteItems.length}</span></div>
              <Progress value={prerequisiteItems.length ? (prerequisitePassed / prerequisiteItems.length) * 100 : 0} className="mt-3 h-2" aria-label={`${prerequisitePassed} trên ${prerequisiteItems.length} điều kiện`} />
              {data.status.status === 'pending' || data.status.status === 'under_review' ? <Button type="button" variant="outline" className="mt-5" onClick={() => void cancel()} disabled={Boolean(busy)}>{busy === 'cancel' ? <Loader2 className="animate-spin" aria-hidden /> : <XCircle aria-hidden />} Hủy yêu cầu đang chờ</Button> : null}
              {canRequest ? <Button type="button" className="mt-5 bg-brand text-brand-foreground hover:brightness-110" onClick={() => void submit()} disabled={Boolean(busy)}>{busy === 'submit' ? <Loader2 className="animate-spin" aria-hidden /> : <ShieldCheck aria-hidden />} Gửi yêu cầu Trusted Seller</Button> : null}
              {data.isTrusted ? <p className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400"><CheckCircle2 aria-hidden /> Đã được admin phê duyệt Trusted Seller.</p> : null}
              {!eligible && !['pending', 'under_review', 'trusted'].includes(data.status.status) ? <p className="mt-3 text-xs text-muted-foreground">Hoàn thành các mục bắt buộc bên dưới trước khi gửi yêu cầu.</p> : null}
            </div>
          </section>

          <aside className="rounded-2xl border border-border bg-card p-5" aria-labelledby="score-title">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Điểm uy tín</p>
            {scoreReady ? <><div className="mt-3 flex items-end gap-2"><span className="font-display text-5xl font-bold">{score}</span><span className="pb-1 text-sm text-muted-foreground">/100</span></div><p className="mt-1 text-sm font-semibold text-brand">{score >= 90 ? 'Xuất sắc' : score >= 80 ? 'Rất tốt' : score >= 65 ? 'Tốt' : 'Khá'}</p><Progress value={score} className="mt-4 h-2" aria-label={`Điểm uy tín ${score}/100`} /></> : <div className="mt-4 rounded-xl border border-brand/20 bg-brand/5 p-4"><p id="score-title" className="font-semibold text-foreground">Đang thu thập dữ liệu</p><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Seller chưa có đủ lịch sử để tính điểm uy tín. Đây không phải là điểm 0.</p></div>}
            <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">Công thức chi tiết không công khai để hạn chế thao túng. Điểm này không thay thế việc kiểm tra giao dịch.</p>
          </aside>
        </div>

        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6" aria-labelledby="checks-title">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="checks-title" className="font-display text-xl font-bold">Xác minh cơ bản</h2><p className="mt-1 text-sm text-muted-foreground">Thông tin liên hệ chỉ là “đã cung cấp” cho đến khi có proof ownership được chấp nhận.</p></div><span className="text-sm font-semibold text-foreground">{data.basicVerifiedCount}/{data.basicVerifiedTotal} hoàn tất</span></div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {data.checks.map((check) => (
              <div key={check.kind} className="flex min-h-28 flex-col justify-between rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-foreground">{checkLabel(check)}</p><p className="mt-1 text-xs text-muted-foreground">{check.value || (check.provided ? 'Đã cung cấp' : 'Chưa cung cấp')}</p></div>{check.status === 'verified' ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" aria-label="Đã xác minh" /> : check.status === 'pending' ? <Clock3 className="h-5 w-5 shrink-0 text-amber-500" aria-label="Đang chờ xác minh" /> : <XCircle className="h-5 w-5 shrink-0 text-muted-foreground" aria-label="Chưa xác minh" />}</div>
                <div className="mt-3 flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{checkStatusLabel(check.status)}</span>{check.status !== 'verified' && check.status !== 'pending' && check.provided ? <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs text-brand" onClick={() => void requestCheck(check.kind)} disabled={Boolean(busy)}>{busy === check.kind ? <Loader2 className="animate-spin" aria-hidden /> : <ExternalLink aria-hidden />} Gửi yêu cầu</Button> : null}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6" aria-labelledby="criteria-title">
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-brand" aria-hidden /><h2 id="criteria-title" className="font-display text-xl font-bold">Điều kiện Trusted Seller</h2></div>
          <p className="mt-1 text-sm text-muted-foreground">Các điều kiện tự động có thể công khai; tín hiệu an toàn nội bộ và kết quả kiểm tra evidence không hiển thị ở đây.</p>
          <ul className="mt-5 grid gap-3 md:grid-cols-2">
            {data.checklist.map((item) => <li key={item.key} className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-4"><span className="mt-0.5 shrink-0">{item.passed ? <Check className="h-5 w-5 text-emerald-500" aria-hidden /> : item.blocking === false ? <Clock3 className="h-5 w-5 text-amber-500" aria-hidden /> : <XCircle className="h-5 w-5 text-muted-foreground" aria-hidden />}</span><span className="min-w-0"><strong className="block text-sm text-foreground">{item.label}</strong><span className="mt-1 block text-xs text-muted-foreground">{item.current}{item.required ? ` · Cần ${item.required}` : ''}</span></span></li>)}
          </ul>
          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">Trusted Seller không nằm trong bất kỳ gói trả phí nào. Thanh toán phí xét duyệt (nếu có trong tương lai) cũng không đảm bảo được cấp badge.</p>
        </section>
      </div>
    </div>
  );
}
