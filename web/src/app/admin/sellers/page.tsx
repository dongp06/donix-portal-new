"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, RefreshCw, Search, ShieldCheck } from "lucide-react";

import { apiAdmin } from "@/lib/api-client";
import { MediaImage } from "@/components/media/MediaImage";

type SellerRow = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  joinedDate: string;
  verificationState: string;
  trustScore: number;
  trustScoreReady: boolean;
  trustedUntil?: string | null;
  shop: { name: string; slug: string; completeness: number } | null;
  botCount: number;
  activeBotCount: number;
  views: number;
  reviewCount: number;
  averageRating: number;
};

const stateTone: Record<string, string> = {
  trusted: "bg-[#13b981]/10 text-[#087a55]",
  under_review: "bg-[#e5a100]/15 text-[#8a6100]",
  pending: "bg-[#1677ff]/10 text-[#145dca]",
  suspended: "bg-[#dc3545]/10 text-[#b42332]",
};
const stateLabel: Record<string, string> = {
  trusted: "Trusted Seller",
  under_review: "Đang xem xét",
  pending: "Chờ xác minh",
  suspended: "Bị hạn chế",
  unverified: "Chưa xác minh",
};

function formatNumber(value: number): string {
  return value.toLocaleString("vi-VN");
}

export default function AdminSellersPage() {
  const [rows, setRows] = useState<SellerRow[] | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(
        await apiAdmin<SellerRow[]>(
          `/api/admin/sellers${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ""}`,
        ),
      );
    } catch (cause) {
      setRows([]);
      setError(
        cause instanceof Error
          ? cause.message
          : "Không tải được danh sách seller.",
      );
    }
  }, [search]);
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get('search');
    if (initial) setSearch(initial);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#1677ff]">
            Marketplace operations
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#12151b]">
            Seller
          </h1>
          <p className="mt-2 text-sm text-[#69707d]">
            Theo dõi hồ sơ, Trust state và listing của từng nhà cung cấp.
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
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#e5e7eb] bg-white p-3">
        <div className="relative min-w-[260px] flex-1">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b929d]"
            aria-hidden
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm tên, email hoặc seller ID..."
            aria-label="Tìm seller"
            className="h-10 w-full rounded-lg border border-[#dfe3e8] bg-white pl-9 pr-3 text-sm text-[#12151b] outline-none placeholder:text-[#8b929d] focus:border-[#1677ff] focus:ring-2 focus:ring-[#1677ff]/15"
          />
        </div>
        <span className="text-xs text-[#69707d]">
          {rows?.length ?? 0} seller
        </span>
      </div>
      {error ? (
        <div className="rounded-lg border border-[#f0b4ba] bg-[#fff4f4] px-4 py-3 text-sm text-[#b42332]">
          {error}
        </div>
      ) : null}
      <section className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-[#edf0f2] bg-[#fbfcfd] text-[11px] font-bold uppercase tracking-[0.08em] text-[#69707d]">
              <tr>
                <th className="px-5 py-3 sm:px-6">Seller</th>
                <th className="px-5 py-3">Trust</th>
                <th className="px-5 py-3">Bots</th>
                <th className="px-5 py-3">Reviews</th>
                <th className="px-5 py-3">Tham gia</th>
                <th className="px-5 py-3 sm:px-6">
                  <span className="sr-only">Mở</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf0f2]">
              {rows?.map((row) => (
                <tr
                  key={row.id}
                  className="transition-colors hover:bg-[#fbfcfd]"
                >
                  <td className="px-5 py-4 sm:px-6">
                    <div className="flex items-center gap-3">
                      <MediaImage
                        src={row.avatar || "/avt.png"}
                        alt=""
                        className="h-10 w-10 rounded-xl border border-[#e5e7eb] object-cover"
                      />
                      <div className="min-w-0">
                        <Link
                          href={`/admin/sellers/${encodeURIComponent(row.id)}`}
                          className="block truncate font-bold text-[#12151b] hover:text-[#1677ff]"
                        >
                          {row.shop?.name || row.name}
                        </Link>
                        <p className="mt-0.5 truncate text-xs text-[#69707d]">
                          {row.email} · {row.id}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col items-start gap-1.5">
                      <span
                        className={`rounded-md px-2 py-1 text-[10px] font-bold ${stateTone[row.verificationState] ?? "bg-[#69707d]/10 text-[#69707d]"}`}
                      >
                        {stateLabel[row.verificationState] ??
                          row.verificationState}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#36404d]">
                        <ShieldCheck
                          className="h-3.5 w-3.5 text-[#1677ff]"
                          aria-hidden
                        />{" "}
                        {row.trustScoreReady
                          ? `${row.trustScore}/100`
                          : "Chưa đủ dữ liệu"}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="font-bold text-[#12151b]">
                      {row.activeBotCount}/{row.botCount}
                    </span>
                    <span className="ml-1 text-xs text-[#69707d]">active</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="font-bold text-[#12151b]">
                      {formatNumber(row.reviewCount)}
                    </span>
                    <span className="ml-1 text-xs text-[#69707d]">
                      · {row.averageRating.toFixed(1)}★
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs text-[#69707d]">
                    {row.joinedDate}
                  </td>
                  <td className="px-5 py-4 text-right sm:px-6">
                    <Link
                      href={`/admin/sellers/${encodeURIComponent(row.id)}`}
                      className="inline-flex items-center gap-1.5 font-semibold text-[#1677ff] hover:underline"
                    >
                      Mở hồ sơ{" "}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows?.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-[#69707d]">
            Không tìm thấy seller phù hợp.
          </div>
        ) : null}
      </section>
    </div>
  );
}
