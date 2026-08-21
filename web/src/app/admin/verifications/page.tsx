"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Clock3,
  Eye,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAdminAccess } from "@/context/AdminAccessContext";
import type { VerificationCheck, VerificationState } from "@shared/types";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { apiAction, apiAdmin } from "@/lib/api-client";
import { MediaImage } from "@/components/media/MediaImage";
import { ensureDevice } from "@/lib/security-client";
import type { OpaqueActionHandle } from "@/lib/security-client";

type VerificationRow = {
  id: string;
  userId: string;
  status: VerificationState;
  submittedAt: string;
  reviewedAt?: string;
  trustedAt?: string;
  trustedUntil?: string;
  note?: string;
  recommendation?: "approve" | "reject";
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
    joinedDate: string;
    trustScore: number;
    verificationState: VerificationState;
    trustedAt?: string | null;
    trustedUntil?: string | null;
  };
  trustScore: number;
  reviewCount: number;
  avgRating: number;
  checks: VerificationCheck[];
  basicVerifiedCount: number;
  basicVerifiedTotal: number;
  trustScoreReady?: boolean;
  actionHandle?: OpaqueActionHandle;
};

type ReviewAction =
  | "request_info"
  | "recommend"
  | "approve"
  | "reject"
  | "suspend"
  | "revoke";

const STATUS_LABELS: Record<VerificationState, string> = {
  unverified: "Chưa xác minh",
  pending: "Chờ review",
  verified: "Basic verified",
  trusted: "Trusted Seller",
  under_review: "Đang xem xét",
  suspended: "Tạm dừng",
  revoked: "Thu hồi",
  rejected: "Từ chối",
};

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
}

function statusTone(status: VerificationState): string {
  if (status === "trusted" || status === "verified")
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (status === "pending" || status === "under_review")
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (status === "suspended" || status === "revoked" || status === "rejected")
    return "border-destructive/30 bg-destructive/10 text-destructive";
  return "border-border bg-muted text-muted-foreground";
}

export default function AdminVerificationsPage() {
  const { role } = useAdminAccess();
  const [rows, setRows] = useState<VerificationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionDialog, setActionDialog] = useState<{
    row: VerificationRow;
    action: ReviewAction;
    decision?: "approve" | "reject";
  } | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      await ensureDevice();
      setRows(await apiAdmin<VerificationRow[]>("/api/admin/verifications"));
    } catch (cause) {
      setRows([]);
      setError(
        cause instanceof Error
          ? cause.message
          : "Không tải được hàng đợi verification.",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const items = rows ?? [];
    return {
      total: items.length,
      pending: items.filter(
        (row) => row.status === "pending" || row.status === "under_review",
      ).length,
      trusted: items.filter((row) => row.status === "trusted").length,
      suspended: items.filter((row) => row.status === "suspended").length,
    };
  }, [rows]);

  const openAction = (
    row: VerificationRow,
    action: ReviewAction,
    decision?: "approve" | "reject",
  ) => {
    setNote("");
    setActionDialog({ row, action, decision });
  };

  const runAction = async () => {
    if (!actionDialog || busyId) return;
    const { row, action, decision } = actionDialog;
    if (!row.actionHandle) {
      toast.error("Action handle đã hết hạn. Hãy tải lại hàng đợi.");
      return;
    }
    setBusyId(row.id);
    try {
      await apiAction(row.actionHandle, {
        action,
        decision,
        note: note.trim() || undefined,
      });
      toast.success(
        action === "approve"
          ? "Đã cấp Trusted Seller."
          : "Đã cập nhật hồ sơ verification.",
      );
      setActionDialog(null);
      await load();
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Không thể cập nhật hồ sơ.",
      );
    } finally {
      setBusyId(null);
    }
  };

  if (rows === null)
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Trust operations</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight">
            Verification queue
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Moderator xem evidence và đề xuất; chỉ admin/owner được cấp, thu hồi
            hoặc tạm dừng Trusted Seller.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load()}
        >
          <RefreshCw aria-hidden /> Làm mới
        </Button>
      </div>
      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>{error}</span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void load()}
          >
            Thử lại
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Tổng hồ sơ", stats.total],
          ["Cần xử lý", stats.pending],
          ["Trusted đang hoạt động", stats.trusted],
          ["Tạm dừng", stats.suspended],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 font-display text-3xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-brand" aria-hidden /> Seller
            Verification Queue
          </CardTitle>
          <CardDescription>
            Không hiển thị internal risk score hoặc evidence nhạy cảm trong danh
            sách công khai.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <Check className="mx-auto h-8 w-8 text-emerald-500" aria-hidden />
              <p className="mt-3 font-semibold">Chưa có hồ sơ verification</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Các yêu cầu mới sẽ xuất hiện ở đây.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => {
                const canAdmin = role === "owner" || role === "admin";
                const isReviewable =
                  row.status === "pending" || row.status === "under_review";
                return (
                  <article
                    key={row.id}
                    className="rounded-2xl border border-border bg-card p-4 sm:p-5"
                  >
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="flex min-w-0 gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-sm font-semibold text-muted-foreground">
                          {row.user.avatar ? (
                        <MediaImage
                          src={row.user.avatar}
                          alt=""
                          className="h-full w-full object-cover"
                            />
                          ) : (
                            row.user.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-foreground">
                              {row.user.name}
                            </h3>
                            <Badge
                              variant="outline"
                              className={statusTone(row.status)}
                            >
                              {STATUS_LABELS[row.status]}
                            </Badge>
                            {row.recommendation ? (
                              <Badge variant="secondary">
                                Đề xuất: {row.recommendation}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 truncate text-sm text-muted-foreground">
                            {row.user.email}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Nộp {formatDate(row.submittedAt)} · Tham gia{" "}
                            {formatDate(row.user.joinedDate)}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-7 gap-y-2 text-sm sm:grid-cols-4 xl:min-w-[34rem]">
                        <div>
                          <span className="block text-xs text-muted-foreground">
                            Uy tín
                          </span>
                          <strong>
                            {row.trustScoreReady
                              ? `${row.trustScore}/100`
                              : "Chưa đủ dữ liệu"}
                          </strong>
                        </div>
                        <div>
                          <span className="block text-xs text-muted-foreground">
                            Đánh giá
                          </span>
                          <strong className="inline-flex items-center gap-1">
                            <Star
                              className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                              aria-hidden
                            />
                            {row.avgRating.toFixed(1)} ({row.reviewCount})
                          </strong>
                        </div>
                        <div>
                          <span className="block text-xs text-muted-foreground">
                            Basic checks
                          </span>
                          <strong>
                            {row.basicVerifiedCount}/{row.basicVerifiedTotal}
                          </strong>
                        </div>
                        <div>
                          <span className="block text-xs text-muted-foreground">
                            Trusted đến
                          </span>
                          <strong>{formatDate(row.trustedUntil)}</strong>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                      <div className="flex flex-wrap gap-2">
                        {row.checks.map((check) => (
                          <span
                            key={check.kind}
                            className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                          >
                            {check.status === "verified" ? (
                              <Check
                                className="h-3 w-3 text-emerald-500"
                                aria-hidden
                              />
                            ) : (
                              <Clock3 className="h-3 w-3" aria-hidden />
                            )}
                            {check.label}
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        {isReviewable ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => openAction(row, "request_info")}
                            >
                              <Eye aria-hidden /> Request info
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                openAction(row, "recommend", "reject")
                              }
                            >
                              <X aria-hidden /> Đề xuất từ chối
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() =>
                                openAction(row, "recommend", "approve")
                              }
                            >
                              <ShieldAlert aria-hidden /> Đề xuất duyệt
                            </Button>
                            {canAdmin &&
                            (row.recommendation === "approve" ||
                              role === "owner") ? (
                              <Button
                                type="button"
                                size="sm"
                                className="bg-brand text-brand-foreground"
                                onClick={() => openAction(row, "approve")}
                              >
                                Cấp Trusted
                              </Button>
                            ) : null}
                          </>
                        ) : null}
                        {row.status === "trusted" && canAdmin ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => openAction(row, "suspend")}
                            >
                              Tạm dừng
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() => openAction(row, "revoke")}
                            >
                              Thu hồi
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={Boolean(actionDialog)}
        onOpenChange={(open) => {
          if (!open && !busyId) setActionDialog(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog
                ? actionTitle(actionDialog.action, actionDialog.row.user.name)
                : "Cập nhật hồ sơ"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ghi chú này sẽ được lưu vào lịch sử moderation của seller. Không
              đưa thông tin fraud nội bộ vào ghi chú hiển thị cho seller.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={1000}
            rows={4}
            placeholder="Nhập ghi chú (không bắt buộc)…"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(busyId)}>
              Hủy
            </AlertDialogCancel>
            <Button
              type="button"
              onClick={() => void runAction()}
              disabled={Boolean(busyId)}
            >
              {busyId ? (
                <RefreshCw className="animate-spin" aria-hidden />
              ) : (
                <Check aria-hidden />
              )}{" "}
              Xác nhận
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function actionTitle(action: ReviewAction, name: string): string {
  const subject = name ? ` — ${name}` : "";
  if (action === "approve") return `Cấp Trusted Seller${subject}?`;
  if (action === "reject") return `Từ chối hồ sơ${subject}?`;
  if (action === "revoke") return `Thu hồi Trusted Seller${subject}?`;
  if (action === "suspend") return `Tạm dừng Trusted Seller${subject}?`;
  if (action === "recommend") return `Lưu đề xuất moderation${subject}?`;
  return `Yêu cầu bổ sung thông tin${subject}?`;
}
