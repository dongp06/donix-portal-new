'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock3, RefreshCw, ShieldCheck, Star, Users, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiAdmin } from '@/lib/api-client';

type VerificationStatus = 'pending' | 'approved' | 'under_review' | 'rejected' | 'expired';

type VerificationRow = {
  id: string;
  status: VerificationStatus;
  submittedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
    joinedDate: string;
  };
  trustScore: number;
  reviewCount: number;
  avgRating: number;
};

const STATUS_LABELS: Record<VerificationStatus, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  under_review: 'Đang xem xét',
  rejected: 'Từ chối',
  expired: 'Hết hạn',
};

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function statusTone(status: VerificationStatus): string {
  switch (status) {
    case 'approved':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500';
    case 'rejected':
      return 'border-destructive/30 bg-destructive/10 text-destructive';
    case 'expired':
      return 'border-border bg-muted text-muted-foreground';
    case 'under_review':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-600';
    default:
      return 'border-brand/30 bg-brand/10 text-brand';
  }
}

function StatCard({
  label,
  value,
  description,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  description: string;
  icon: typeof ShieldCheck;
  tone: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="font-display text-3xl font-bold tracking-tight text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <span className={`rounded-xl border p-2.5 ${tone}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const [rows, setRows] = useState<VerificationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await apiAdmin<VerificationRow[]>('/api/admin/verifications');
      setRows(data);
    } catch (cause) {
      setRows([]);
      setError(cause instanceof Error ? cause.message : 'Không tải được dữ liệu Trust Seller.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const data = rows ?? [];
    const averageScore = data.length
      ? Math.round(data.reduce((sum, row) => sum + row.trustScore, 0) / data.length)
      : 0;
    return {
      total: data.length,
      pending: data.filter((row) => row.status === 'pending').length,
      approved: data.filter((row) => row.status === 'approved').length,
      underReview: data.filter((row) => row.status === 'under_review').length,
      averageScore,
    };
  }, [rows]);

  const reviewQueue = useMemo(
    () =>
      (rows ?? [])
        .filter((row) => row.status === 'pending' || row.status === 'under_review')
        .slice(0, 5),
    [rows],
  );

  if (rows === null) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-36 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Trust operations</p>
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">Tổng quan Trust Seller</h2>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Theo dõi các hồ sơ xác minh đã được gửi và xử lý hàng đợi Trust Seller bằng dữ liệu thực tế.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw aria-hidden />
            Làm mới
          </Button>
          <Button asChild size="sm">
            <Link href="/admin/verifications">
              Mở hàng đợi
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </div>

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <p>{error}</p>
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
            Thử lại
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Hồ sơ đã nộp"
          value={String(stats.total)}
          description="Tổng số verification trong hệ thống"
          icon={Users}
          tone="border-sky-500/30 bg-sky-500/10 text-sky-500"
        />
        <StatCard
          label="Chờ duyệt"
          value={String(stats.pending)}
          description="Cần admin kiểm tra"
          icon={Clock3}
          tone="border-brand/30 bg-brand/10 text-brand"
        />
        <StatCard
          label="Đã xác minh"
          value={String(stats.approved)}
          description="Verification còn hiệu lực theo hồ sơ"
          icon={CheckCircle2}
          tone="border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
        />
        <StatCard
          label="Điểm trung bình"
          value={`${stats.averageScore}/100`}
          description="Trên các hồ sơ đã nộp"
          icon={Star}
          tone="border-amber-500/30 bg-amber-500/10 text-amber-500"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div className="space-y-1.5">
              <CardTitle>Hàng đợi cần xử lý</CardTitle>
              <CardDescription>Hồ sơ pending và under review mới nhất.</CardDescription>
            </div>
            <Badge variant="outline">{stats.pending + stats.underReview} hồ sơ</Badge>
          </CardHeader>
          <CardContent>
            {reviewQueue.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
                <ShieldCheck className="mx-auto h-8 w-8 text-emerald-500" aria-hidden />
                <p className="mt-3 font-medium text-foreground">Không có hồ sơ cần xử lý</p>
                <p className="mt-1 text-sm text-muted-foreground">Hàng đợi hiện đang trống.</p>
              </div>
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border">
                {reviewQueue.map((row) => (
                  <div key={row.id} className="flex flex-wrap items-center justify-between gap-4 px-4 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                      {row.user.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={row.user.avatar}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-full border border-border object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                          {row.user.name.trim().charAt(0).toUpperCase() || '?'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{row.user.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{row.user.email}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Nộp {formatDate(row.submittedAt)} · {row.reviewCount} đánh giá · {row.avgRating.toFixed(1)}/5
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-semibold text-foreground">{Math.round(row.trustScore)}/100</p>
                        <Badge className={statusTone(row.status)} variant="outline">
                          {STATUS_LABELS[row.status]}
                        </Badge>
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <Link href="/admin/verifications">Xem</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trạng thái</CardTitle>
            <CardDescription>Phân loại hồ sơ hiện có.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(['pending', 'under_review', 'approved', 'rejected', 'expired'] as VerificationStatus[]).map((status) => {
              const count = (rows ?? []).filter((row) => row.status === status).length;
              return (
                <div key={status} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    {status === 'approved' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />
                    ) : status === 'rejected' || status === 'expired' ? (
                      <XCircle className="h-4 w-4 text-muted-foreground" aria-hidden />
                    ) : (
                      <Clock3 className="h-4 w-4 text-brand" aria-hidden />
                    )}
                    {STATUS_LABELS[status]}
                  </span>
                  <span className="font-semibold text-foreground">{count}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
