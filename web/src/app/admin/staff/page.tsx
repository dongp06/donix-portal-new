"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  UserRoundCog,
  X,
} from "lucide-react";

import { MediaImage } from "@/components/media/MediaImage";
import { useAdminAccess } from "@/context/AdminAccessContext";
import { apiAdmin } from "@/lib/api-client";

type StaffRole = "owner" | "admin" | "moderator";
type AssignableRole = "admin" | "moderator";

type StaffRow = {
  id: string;
  userId: string;
  role: StaffRole | string;
  isActive: boolean;
  isRootOwner: boolean;
  createdAt: string;
  appointedBy?: string | null;
  invitedBy?: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    avatar: string;
    joinedDate: string;
  };
};

const roleTone: Record<string, string> = {
  owner: "bg-[#0b0d12] text-white",
  admin: "bg-[#1677ff]/10 text-[#145dca]",
  moderator: "bg-[#13b981]/10 text-[#087a55]",
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
}

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

export default function AdminStaffPage() {
  const { access, role: currentRole } = useAdminAccess();
  const canWrite = currentRole === "owner" || currentRole === "admin";
  const [rows, setRows] = useState<StaffRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [assignRole, setAssignRole] = useState<AssignableRole>(
    currentRole === "admin" ? "moderator" : "admin",
  );

  const load = useCallback(async (refresh = false) => {
    setError(null);
    if (refresh) setIsRefreshing(true);
    try {
      setRows(await apiAdmin<StaffRow[]>("/api/admin/staff"));
    } catch (cause) {
      setRows([]);
      setError(errorMessage(cause, "Không tải được danh sách staff."));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(
    () =>
      (["owner", "admin", "moderator"] as const).map((staffRole) => ({
        role: staffRole,
        count: rows?.filter((row) => row.role === staffRole).length ?? 0,
      })),
    [rows],
  );

  const replaceRow = useCallback((next: StaffRow) => {
    setRows((current) => {
      if (!current) return current;
      const exists = current.some((row) => row.id === next.id);
      return exists
        ? current.map((row) => (row.id === next.id ? next : row))
        : [...current, next].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });
  }, []);

  const runAction = useCallback(
    async (
      key: string,
      successMessage: string,
      request: () => Promise<StaffRow>,
    ): Promise<boolean> => {
      setActionKey(key);
      setError(null);
      setSuccess(null);
      try {
        const updated = await request();
        replaceRow(updated);
        setSuccess(successMessage);
        return true;
      } catch (cause) {
        setError(errorMessage(cause, "Thao tác staff thất bại."));
        return false;
      } finally {
        setActionKey(null);
      }
    },
    [replaceRow],
  );

  const appoint = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setError("Nhập email của tài khoản đã đăng ký trên thuebot.org.");
      setSuccess(null);
      return;
    }
    const completed = await runAction("appoint", "Đã bổ nhiệm staff thành công.", () =>
      apiAdmin<StaffRow>("/api/admin/staff", {
        method: "POST",
        body: JSON.stringify({ email: normalizedEmail, role: assignRole }),
      }),
    );
    if (completed) setEmail("");
  };

  const updateRole = (row: StaffRow, nextRole: AssignableRole) =>
    runAction(
      `role:${row.id}`,
      `Đã cập nhật role cho ${row.user.name}.`,
      () =>
        apiAdmin<StaffRow>(`/api/admin/staff/${encodeURIComponent(row.user.id)}`, {
          method: "PATCH",
          body: JSON.stringify({ role: nextRole }),
        }),
    );

  const toggleActive = (row: StaffRow) =>
    runAction(
      `active:${row.id}`,
      row.isActive
        ? `Đã thu hồi quyền truy cập của ${row.user.name}.`
        : `Đã kích hoạt lại ${row.user.name}.`,
      () =>
        apiAdmin<StaffRow>(`/api/admin/staff/${encodeURIComponent(row.user.id)}`, {
          method: row.isActive ? "DELETE" : "PATCH",
          body: JSON.stringify({
            ...(row.isActive ? {} : { isActive: true }),
            reason: row.isActive ? "Staff access revoked from console." : undefined,
          }),
        }),
    );

  const canManage = (row: StaffRow) => {
    if (!canWrite || row.isRootOwner || row.role === "owner") return false;
    if (row.user.id === access.user.id) return false;
    return currentRole === "owner" || row.role === "moderator";
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#1677ff]">Quản trị truy cập</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#12151b]">Nhân sự</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#69707d]">
            Bổ nhiệm và thu hồi staff server-side. Buyer/seller role không cấp quyền vào
            Operations Console.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={isRefreshing}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#dfe3e8] bg-white px-3.5 py-2 text-sm font-semibold text-[#36404d] hover:border-[#1677ff]/40 hover:text-[#1677ff] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677ff]"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden />
          Làm mới
        </button>
      </div>

      {error ? (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-[#f0b4ba] bg-[#fff4f4] px-4 py-3 text-sm text-[#b42332]">
          <X className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      ) : null}
      {success ? (
        <div role="status" className="flex items-start gap-3 rounded-lg border border-[#a9e6d0] bg-[#effcf7] px-4 py-3 text-sm text-[#087a55]">
          <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{success}</span>
        </div>
      ) : null}

      {canWrite ? (
        <section className="rounded-xl border border-[#dce7f7] bg-[#f7faff] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1677ff]/10 text-[#1677ff]">
              <UserPlus className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 className="font-bold text-[#12151b]">Bổ nhiệm staff</h2>
              <p className="mt-1 text-sm text-[#69707d]">
                Chỉ tài khoản đã tồn tại mới được bổ nhiệm. OWNER chỉ đến từ OWNER_EMAIL.
              </p>
            </div>
          </div>
          <form onSubmit={appoint} className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.08em] text-[#69707d]">Email tài khoản</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="staff@example.com"
                disabled={actionKey !== null}
                className="h-11 w-full rounded-lg border border-[#dfe3e8] bg-white px-3 text-sm text-[#12151b] outline-none transition focus:border-[#1677ff] focus:ring-2 focus:ring-[#1677ff]/15 disabled:opacity-60"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.08em] text-[#69707d]">Role</span>
              <select
                value={assignRole}
                onChange={(event) => setAssignRole(event.target.value as AssignableRole)}
                disabled={actionKey !== null || currentRole === "admin"}
                className="h-11 w-full rounded-lg border border-[#dfe3e8] bg-white px-3 text-sm font-semibold text-[#12151b] outline-none focus:border-[#1677ff] focus:ring-2 focus:ring-[#1677ff]/15 disabled:opacity-60"
              >
                {currentRole === "owner" ? <option value="admin">Admin</option> : null}
                <option value="moderator">Moderator</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={actionKey !== null}
              className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#1677ff] px-4 text-sm font-bold text-white shadow-sm hover:bg-[#145dca] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677ff] focus-visible:ring-offset-2"
            >
              {actionKey === "appoint" ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
              Bổ nhiệm
            </button>
          </form>
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        {counts.map(({ role, count }) => (
          <div key={role} className="rounded-xl border border-[#e5e7eb] bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#69707d]">{role}</p>
            <p className="mt-2 text-3xl font-bold text-[#12151b]">{count}</p>
            <p className="mt-1 text-xs text-[#8b929d]">tài khoản</p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
        <div className="flex items-center justify-between border-b border-[#edf0f2] px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-bold text-[#12151b]">Staff members</h2>
            <p className="mt-1 text-xs text-[#69707d]">Mọi thay đổi được ghi vào Audit Log.</p>
          </div>
          <ShieldCheck className="h-5 w-5 text-[#1677ff]" aria-hidden />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-[#fbfcfd] text-xs font-semibold text-[#69707d]">
              <tr>
                <th className="px-5 py-3 sm:px-6">Nhân sự</th>
                <th className="px-5 py-3">Vai trò</th>
                <th className="px-5 py-3">Trạng thái</th>
                <th className="px-5 py-3">Tham gia staff</th>
                <th className="px-5 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf0f2]">
              {isLoading
                ? Array.from({ length: 3 }, (_, index) => (
                    <tr key={`loading-${index}`}>
                      <td colSpan={5} className="px-5 py-5 sm:px-6">
                        <div className="h-10 animate-pulse rounded-lg bg-[#f1f3f5]" />
                      </td>
                    </tr>
                  ))
                : rows?.map((row) => {
                    const manageable = canManage(row);
                    const busy = actionKey?.endsWith(row.id) ?? false;
                    return (
                      <tr key={row.id} className="hover:bg-[#fbfcfd]">
                        <td className="px-5 py-4 sm:px-6">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#e8eef8] text-xs font-bold text-[#1677ff]">
                              {row.user.avatar ? (
                                <MediaImage src={row.user.avatar} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <UserRoundCog className="h-4 w-4" aria-hidden />
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-[#12151b]">
                                {row.user.name}{row.user.id === access.user.id ? " (Bạn)" : ""}
                              </p>
                              <p className="text-xs text-[#69707d]">{row.user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`rounded-md px-2 py-1 text-xs font-bold uppercase ${roleTone[row.role] ?? "bg-[#f7f8fa] text-[#36404d]"}`}>
                            {row.role}
                          </span>
                          {row.isRootOwner ? <span className="ml-2 text-[11px] font-semibold text-[#69707d]">Root</span> : null}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${row.isActive ? "text-[#087a55]" : "text-[#b42332]"}`}>
                            <span className={`h-2 w-2 rounded-full ${row.isActive ? "bg-[#13b981]" : "bg-[#dc3545]"}`} aria-hidden />
                            {row.isActive ? "Đang hoạt động" : "Đã thu hồi"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs text-[#69707d]">{formatDate(row.createdAt)}</td>
                        <td className="px-5 py-4">
                          {manageable ? (
                            <div className="flex flex-wrap justify-end gap-2">
                              {currentRole === "owner" && row.role !== "admin" ? (
                                <button type="button" disabled={busy || actionKey !== null} onClick={() => void updateRole(row, "admin")} className="rounded-md border border-[#dfe3e8] px-2.5 py-1.5 text-xs font-semibold text-[#36404d] hover:border-[#1677ff]/40 hover:text-[#1677ff] disabled:cursor-wait disabled:opacity-50">Admin</button>
                              ) : null}
                              {row.role !== "moderator" && currentRole === "owner" ? (
                                <button type="button" disabled={busy || actionKey !== null} onClick={() => void updateRole(row, "moderator")} className="rounded-md border border-[#dfe3e8] px-2.5 py-1.5 text-xs font-semibold text-[#36404d] hover:border-[#13b981]/50 hover:text-[#087a55] disabled:cursor-wait disabled:opacity-50">Moderator</button>
                              ) : null}
                              <button type="button" disabled={busy || actionKey !== null} onClick={() => void toggleActive(row)} className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold disabled:cursor-wait disabled:opacity-50 ${row.isActive ? "border-[#f0b4ba] text-[#b42332] hover:bg-[#fff4f4]" : "border-[#a9e6d0] text-[#087a55] hover:bg-[#effcf7]"}`}>
                                {busy ? <LoaderCircle className="inline h-3.5 w-3.5 animate-spin" aria-label="Đang xử lý" /> : row.isActive ? "Thu hồi" : "Kích hoạt"}
                              </button>
                            </div>
                          ) : (
                            <span className="block text-right text-xs text-[#8b929d]">Được bảo vệ</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
        {!isLoading && rows?.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-[#69707d]">Không có dữ liệu staff.</div>
        ) : null}
      </section>
    </div>
  );
}
