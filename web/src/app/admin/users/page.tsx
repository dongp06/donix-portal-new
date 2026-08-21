"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Search, ShieldCheck, UserRound } from "lucide-react";

import { apiAdmin } from "@/lib/api-client";
import { MediaImage } from "@/components/media/MediaImage";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: string;
  joinedDate: string;
  verificationState: string;
  trustScore: number;
  trustedUntil?: string | null;
  staffRole?: string | null;
  botCount: number;
  postCount: number;
  commentCount: number;
  reviewCount: number;
};

const roleLabel: Record<string, string> = { buyer: "Buyer", seller: "Seller" };

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("vi-VN");
}

export default function AdminUsersPage() {
  const [rows, setRows] = useState<AdminUser[] | null>(null);
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [role, setRole] = useState("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("search");
    if (initial) {
      setSearch(initial);
      setDraftSearch(initial);
    }
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (role !== "all") params.set("role", role);
      setRows(
        await apiAdmin<AdminUser[]>(`/api/admin/users?${params.toString()}`),
      );
    } catch (cause) {
      setRows([]);
      setError(
        cause instanceof Error
          ? cause.message
          : "Không tải được danh sách người dùng.",
      );
    }
  }, [role, search]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#1677ff]">Quản trị</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#12151b]">
            Người dùng
          </h1>
          <p className="mt-2 text-sm text-[#69707d]">
            Tra cứu tài khoản, vai trò công khai và hoạt động đã ghi nhận.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#dfe3e8] bg-white px-3.5 py-2 text-sm font-semibold text-[#36404d] hover:border-[#1677ff]/40 hover:text-[#1677ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677ff]"
        >
          <RefreshCw className="h-4 w-4" aria-hidden /> Làm mới
        </button>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(draftSearch);
        }}
        className="flex flex-wrap gap-3 rounded-xl border border-[#e5e7eb] bg-white p-3"
      >
        <label className="flex min-h-10 min-w-[260px] flex-1 items-center gap-2 rounded-lg border border-[#dfe3e8] px-3 text-sm text-[#69707d] focus-within:border-[#1677ff] focus-within:ring-2 focus-within:ring-[#1677ff]/15">
          <Search className="h-4 w-4 shrink-0" aria-hidden />
          <span className="sr-only">Tìm người dùng</span>
          <input
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
            placeholder="Tên, email hoặc ID..."
            className="min-w-0 flex-1 bg-transparent text-[#12151b] outline-none placeholder:text-[#8b929d]"
          />
        </label>
        <select
          aria-label="Lọc vai trò"
          value={role}
          onChange={(event) => setRole(event.target.value)}
          className="min-h-10 rounded-lg border border-[#dfe3e8] bg-white px-3 text-sm font-semibold text-[#36404d] outline-none focus:border-[#1677ff] focus:ring-2 focus:ring-[#1677ff]/15"
        >
          <option value="all">Tất cả vai trò</option>
          <option value="buyer">Buyer</option>
          <option value="seller">Seller</option>
        </select>
        <button
          type="submit"
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#1677ff] px-4 text-sm font-bold text-white hover:bg-[#145dca] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677ff]"
        >
          Tìm kiếm
        </button>
      </form>

      {error ? (
        <div className="rounded-lg border border-[#f0b4ba] bg-[#fff4f4] px-4 py-3 text-sm text-[#b42332]">
          {error}
        </div>
      ) : null}
      <section className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
        <div className="flex items-center justify-between border-b border-[#edf0f2] px-5 py-4 sm:px-6">
          <h2 className="font-bold text-[#12151b]">Tài khoản</h2>
          <span className="text-xs text-[#69707d]">
            {rows?.length ?? 0} kết quả
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-[#fbfcfd] text-xs font-semibold text-[#69707d]">
              <tr>
                <th className="px-5 py-3 sm:px-6">Người dùng</th>
                <th className="px-5 py-3">Vai trò</th>
                <th className="px-5 py-3">Trust</th>
                <th className="px-5 py-3">Hoạt động</th>
                <th className="px-5 py-3">Tham gia</th>
                <th className="px-5 py-3 sm:px-6">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf0f2]">
              {rows?.map((row) => (
                <tr key={row.id} className="hover:bg-[#fbfcfd]">
                  <td className="px-5 py-4 sm:px-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e8eef8] text-xs font-bold text-[#1677ff]">
                        {row.avatar ? (
                        <MediaImage
                          src={row.avatar}
                          alt=""
                          className="h-full w-full object-cover"
                          />
                        ) : (
                          <UserRound className="h-4 w-4" aria-hidden />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-bold text-[#12151b]">
                          {row.name}
                        </p>
                        <p className="max-w-[260px] truncate text-xs text-[#69707d]">
                          {row.email}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#8b929d]">
                          {row.id}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="rounded-md bg-[#f7f8fa] px-2 py-1 text-xs font-semibold text-[#36404d]">
                      {roleLabel[row.role] ?? row.role}
                    </span>
                    {row.staffRole ? (
                      <span className="ml-2 rounded-md bg-[#0b0d12]/[0.08] px-2 py-1 text-[10px] font-bold uppercase text-[#36404d]">
                        {row.staffRole}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-5 py-4">
                    {row.role === "seller" ? (
                      <div>
                        <p className="font-bold text-[#12151b]">
                          {row.trustScore}
                        </p>
                        <p className="text-xs text-[#69707d]">
                          {row.verificationState}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-[#8b929d]">
                        Không áp dụng
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-xs text-[#69707d]">
                    <span>{row.botCount} bot</span>
                    <span className="mx-1.5 text-[#c5cbd3]">·</span>
                    <span>{row.postCount} post</span>
                    <span className="mx-1.5 text-[#c5cbd3]">·</span>
                    <span>{row.commentCount} bình luận</span>
                  </td>
                  <td className="px-5 py-4 text-xs text-[#69707d]">
                    {formatDate(row.joinedDate)}
                  </td>
                  <td className="px-5 py-4 text-right sm:px-6">
                    {row.role === "seller" ? (
                      <a
                        href={`/admin/sellers/${encodeURIComponent(row.id)}`}
                        className="text-xs font-bold text-[#1677ff] hover:underline"
                      >
                        Xem seller
                      </a>
                    ) : (
                      <span className="text-xs text-[#8b929d]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows?.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <ShieldCheck
              className="mx-auto h-8 w-8 text-[#8b929d]"
              aria-hidden
            />
            <p className="mt-3 font-semibold text-[#12151b]">
              Không có tài khoản phù hợp
            </p>
            <p className="mt-1 text-sm text-[#69707d]">
              Thử từ khóa hoặc bộ lọc khác.
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
