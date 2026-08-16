'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, ShieldCheck, Star, X } from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { apiAdmin } from '@/lib/api-client';

type VerificationStatus = 'pending' | 'approved' | 'under_review' | 'rejected' | 'expired';

type VerificationRow = {
  id: string;
  userId: string;
  status: VerificationStatus;
  submittedAt: string;
  reviewedAt?: string;
  expiresAt?: string;
  note?: string;
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

type ReviewAction = 'approve' | 'reject';

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

function statusLabel(status: VerificationStatus): string {
  switch (status) {
    case 'approved':
      return 'Đã duyệt';
    case 'under_review':
      return 'Đang xem xét';
    case 'rejected':
      return 'Từ chối';
    case 'expired':
      return 'Hết hạn';
    default:
      return 'Chờ duyệt';
  }
}

function scoreLabel(score: number): string {
  return `${Math.max(0, Math.round(score))}/100`;
}

export default function AdminVerificationsPage() {
  const [rows, setRows] = useState<VerificationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<VerificationRow | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await apiAdmin<VerificationRow[]>('/api/admin/verifications?status=pending');
      setRows(data);
    } catch (cause) {
      setRows([]);
      setError(cause instanceof Error ? cause.message : 'Không tải được danh sách xác minh.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(id: string, action: ReviewAction, note?: string) {
    setBusyId(id);
    try {
      await apiAdmin<VerificationRow>(`/api/admin/verifications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          action,
          ...(note?.trim() ? { note: note.trim() } : {}),
        }),
      });
      toast.success(action === 'approve' ? 'Đã duyệt hồ sơ xác minh.' : 'Đã từ chối hồ sơ xác minh.');
      setRejecting(null);
      setRejectNote('');
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Không thể cập nhật hồ sơ.');
    } finally {
      setBusyId(null);
    }
  }

  function openRejectDialog(row: VerificationRow) {
    setRejectNote('');
    setRejecting(row);
  }

  if (rows === null) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-brand" aria-hidden />
                Hồ sơ xác minh
              </CardTitle>
              <CardDescription>
                Kiểm tra các hồ sơ Trust Seller đang chờ duyệt.
              </CardDescription>
            </div>
            <Badge variant="outline">{rows.length} hồ sơ chờ duyệt</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="space-y-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <p>{error}</p>
              <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
                Thử lại
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
              <Check className="mx-auto h-8 w-8 text-emerald-500" aria-hidden />
              <p className="mt-3 font-medium text-foreground">Không có hồ sơ chờ duyệt</p>
              <p className="mt-1 text-sm text-muted-foreground">Hàng đợi đã được xử lý hết.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Người bán</TableHead>
                  <TableHead>Uy tín</TableHead>
                  <TableHead>Hoạt động</TableHead>
                  <TableHead>Ngày nộp</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const busy = busyId === row.id;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="min-w-52">
                        <div className="flex items-center gap-3">
                          {row.user.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={row.user.avatar}
                              alt=""
                              className="h-9 w-9 rounded-full border border-border object-cover"
                            />
                          ) : (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                              {row.user.name.trim().charAt(0).toUpperCase() || '?'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{row.user.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{row.user.email}</p>
                            <p className="text-xs text-muted-foreground">
                              Tham gia {formatDate(row.user.joinedDate)}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-foreground">{scoreLabel(row.trustScore)}</span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
                            {row.avgRating.toFixed(1)} / 5
                          </span>
                          <span>{row.reviewCount} đánh giá</span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(row.submittedAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{statusLabel(row.status)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={busy}
                            onClick={() => void review(row.id, 'approve')}
                          >
                            <Check aria-hidden />
                            Duyệt
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => openRejectDialog(row)}
                          >
                            <X aria-hidden />
                            Từ chối
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(rejecting)} onOpenChange={(open) => !open && setRejecting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Từ chối hồ sơ xác minh?</AlertDialogTitle>
            <AlertDialogDescription>
              {rejecting?.user.name
                ? `Hồ sơ của ${rejecting.user.name} sẽ được chuyển sang trạng thái từ chối.`
                : 'Hồ sơ sẽ được chuyển sang trạng thái từ chối.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label htmlFor="reject-note" className="text-sm font-medium text-foreground">
              Lý do (không bắt buộc)
            </label>
            <Textarea
              id="reject-note"
              value={rejectNote}
              onChange={(event) => setRejectNote(event.target.value)}
              placeholder="Nhập ghi chú để người bán biết cần bổ sung gì…"
              maxLength={500}
              rows={4}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyId === rejecting?.id}>Hủy</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={!rejecting || busyId === rejecting.id}
              onClick={() => rejecting && void review(rejecting.id, 'reject', rejectNote)}
            >
              <X aria-hidden />
              Xác nhận từ chối
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
