'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Loader2,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Award,
  BadgeCheck,
  History,
  Send,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import type { TrustChecklistItem, TrustScoreInfo, TrustStatus, SellerTier } from '@shared/types';

/** Response của GET /api/sellers/me/trust-status */
interface TrustStatusResponse {
  status: TrustStatus;
  checklist: TrustChecklistItem[];
  score: TrustScoreInfo;
  tier: SellerTier;
}

/** Nhãn trạng thái xác minh theo tiếng Việt */
const STATUS_LABELS: Record<TrustStatus['status'], string> = {
  none: 'Chưa nộp hồ sơ',
  pending: 'Đang chờ duyệt',
  under_review: 'Đang xem xét',
  approved: 'Đã xác minh',
  rejected: 'Bị từ chối',
  expired: 'Hết hạn',
};

/** Nhãn hạng seller */
const TIER_LABELS: Record<SellerTier, string> = {
  new: 'Thành viên mới',
  active: 'Hoạt động',
  trusted: 'Trust Seller',
  top: 'Top Seller',
};

/** Nhãn tiếng Việt cho từng thành phần điểm (fallback key nếu chưa có) */
const SCORE_LABELS: Record<string, string> = {
  reviews: 'Đánh giá khách hàng',
  account_age: 'Thời gian hoạt động',
  profile: 'Xác minh hồ sơ',
  active_bots: 'Số bot hoạt động',
};

function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function TrustTab() {
  const [data, setData] = useState<TrustStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sellers/me/trust-status', { credentials: 'include' });
      const json = await res.json();
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || 'Không tải được trạng thái uy tín');
      }
      setData(json.data as TrustStatusResponse);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không tải được trạng thái uy tín');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSubmitVerification = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/sellers/me/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Nộp hồ sơ thất bại');
      }
      toast.success('Đã nộp hồ sơ xác minh. Đang chờ admin duyệt.');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Nộp hồ sơ thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-2xl border border-border bg-card">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Đang tải điểm uy tín…
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">Không có dữ liệu uy tín.</p>
        <Button type="button" variant="outline" onClick={() => void load()} className="mt-4">
          <RefreshCw className="h-4 w-4" aria-hidden />
          Thử lại
        </Button>
      </div>
    );
  }

  const { status, checklist, score, tier } = data;
  const statusLabel = STATUS_LABELS[status.status];
  const checklistDone = checklist.length > 0 && checklist.every((c) => c.passed);
  const canSubmit =
    checklistDone && !['pending', 'approved'].includes(status.status) && !submitting;
  const tierPct = Math.max(0, Math.min(100, Math.round(score.score ?? 0)));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 font-display text-xl font-bold">
          <ShieldCheck className="h-5 w-5 text-brand" aria-hidden />
          Uy tín
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Điểm uy tín được tính từ đánh giá, thời gian hoạt động, độ hoàn thiện hồ sơ và số bot
          hoạt động.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Cột trái: điểm uy tín + hạng */}
        <section
          aria-labelledby="trust-score-title"
          className="space-y-5 rounded-2xl border border-border bg-card p-6"
        >
          <div>
            <p id="trust-score-title" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Hạng hiện tại
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {tier === 'trusted' || tier === 'top' ? (
                <Badge
                  variant="secondary"
                  className={
                    tier === 'top'
                      ? 'border-amber-400/40 bg-amber-400/10 text-amber-400'
                      : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                  }
                >
                  {tier === 'top' ? <Award className="h-3.5 w-3.5" aria-hidden /> : <BadgeCheck className="h-3.5 w-3.5" aria-hidden />}
                  {TIER_LABELS[tier] ?? tier}
                </Badge>
              ) : (
                <Badge variant="outline">{TIER_LABELS[tier] ?? tier}</Badge>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Điểm uy tín
              </p>
              <p className="font-display text-3xl font-bold tracking-tight text-foreground">
                {score.score ?? 0}
                <span className="text-base font-semibold text-muted-foreground">/100</span>
              </p>
            </div>
            <Progress
              value={tierPct}
              aria-label={`Điểm uy tín ${score.score ?? 0} trên 100`}
              className="mt-3"
            />
            {score.updatedAt && (
              <p className="mt-3 text-xs text-muted-foreground">
                Cập nhật {formatDate(score.updatedAt)}
              </p>
            )}
          </div>

          {/* Trạng thái xác minh */}
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ShieldAlert className="h-4 w-4 text-brand" aria-hidden />
              Trạng thái xác minh
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">{statusLabel}</p>
            {status.status === 'rejected' && status.note && (
              <p className="mt-2 rounded-lg bg-destructive/10 p-3 text-xs leading-relaxed text-destructive">
                Lý do: {status.note}
              </p>
            )}
            {status.submittedAt && (
              <p className="mt-2 text-xs text-muted-foreground">
                Nộp lúc {formatDate(status.submittedAt)}
              </p>
            )}
            {status.expiresAt && (
              <p className="mt-1 text-xs text-muted-foreground">
                Hết hạn {formatDate(status.expiresAt)}
              </p>
            )}
          </div>

          <Button
            type="button"
            onClick={() => void handleSubmitVerification()}
            disabled={!canSubmit}
            className="w-full bg-brand text-brand-foreground hover:brightness-110"
          >
            <Send className="h-4 w-4" aria-hidden />
            {submitting ? 'Đang nộp…' : 'Nộp hồ sơ xác minh'}
          </Button>
          {!checklistDone && (
            <p className="text-center text-xs text-muted-foreground">
              Hoàn thành tất cả điều kiện bên dưới để nộp hồ sơ.
            </p>
          )}
          {status.status === 'approved' && (
            <p className="text-center text-xs text-emerald-500">
              Bạn đã được xác minh. Huy hiệu Trust Seller đang hiển thị.
            </p>
          )}
        </section>

        {/* Cột phải: breakdown + checklist */}
        <div className="space-y-6 lg:col-span-2">
          {/* Breakdown điểm */}
          {score.breakdown.length > 0 && (
            <section
              aria-labelledby="trust-breakdown-title"
              className="rounded-2xl border border-border bg-card p-6"
            >
              <h3
                id="trust-breakdown-title"
                className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
              >
                <Award className="h-4 w-4" aria-hidden />
                Chi tiết điểm uy tín
              </h3>
              <ul className="mt-4 space-y-4">
                {score.breakdown.map((item) => {
                  const pct = Math.max(0, Math.min(100, Math.round((item.value ?? 0) * 100)));
                  return (
                    <li key={item.key} className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="font-medium text-foreground">
                          {SCORE_LABELS[item.key] ?? item.label}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {pct}/100 · trọng số {item.weight}%
                        </span>
                      </div>
                      <Progress
                        value={pct}
                        aria-label={`${SCORE_LABELS[item.key] ?? item.label}: ${pct} trên 100`}
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Checklist điều kiện */}
          <section
            aria-labelledby="trust-checklist-title"
            className="rounded-2xl border border-border bg-card p-6"
          >
            <h3
              id="trust-checklist-title"
              className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
            >
              <History className="h-4 w-4" aria-hidden />
              Điều kiện xác minh
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Cần đạt đủ tất cả điều kiện sau để nộp hồ sơ xác minh.
            </p>
            <ul className="mt-4 space-y-3">
              {checklist.map((item) => {
                const passed = Boolean(item.passed);
                const Icon = passed ? CheckCircle2 : XCircle;
                return (
                  <li
                    key={item.key}
                    className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-4"
                  >
                    <Icon
                      className={
                        passed
                          ? 'mt-0.5 h-5 w-5 shrink-0 text-emerald-500'
                          : 'mt-0.5 h-5 w-5 shrink-0 text-destructive'
                      }
                      aria-hidden
                    />
                    <div className="min-w-0 text-sm">
                      <p className="font-medium text-foreground">{item.label}</p>
                      {(item.current || item.required) && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {item.current && <span>{item.current}</span>}
                          {item.current && item.required && <span> · </span>}
                          {item.required && <span>Cần {item.required}</span>}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
