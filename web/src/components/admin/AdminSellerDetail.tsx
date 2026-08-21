"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  ShieldCheck,
  Star,
} from "lucide-react";

import { apiAdmin } from "@/lib/api-client";
import { MediaImage } from "@/components/media/MediaImage";

type SellerDetailData = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  joinedDate: string;
  bio?: string | null;
  contact: Record<string, string>;
  verificationState: string;
  trustScore: number;
  trustedAt?: string | null;
  trustedUntil?: string | null;
  shop: {
    shopName: string;
    slug: string;
    bio?: string | null;
    profileCompleteness: number;
  } | null;
  bots: Array<{
    id: string;
    title: string;
    status: string;
    categoryName: string;
    views: number;
    rating: number;
    reviewCount: number;
    monthlyPrice: number;
    coverImage: string;
  }>;
  reviews: Array<{
    id: string;
    rating: number;
    comment: string;
    createdAt: string;
    user?: { name: string; avatar: string } | null;
    bot?: { title: string } | null;
  }>;
  verifications: Array<{
    id: string;
    status: string;
    submittedAt: string;
    note?: string | null;
    recommendation?: string | null;
  }>;
  verificationChecks: Array<{
    kind: string;
    status: string;
    value?: string | null;
    updatedAt: string;
  }>;
  trustEvents: Array<{
    id: string;
    type: string;
    detail: string;
    createdAt: string;
  }>;
};

const checkLabels: Record<string, string> = {
  google: "Google account",
  email: "Email",
  phone: "Số điện thoại",
  telegram: "Telegram",
  website: "Website",
  identity: "Danh tính",
  zalo: "Zalo",
};

export function AdminSellerDetail({ id }: { id: string }) {
  const [data, setData] = useState<SellerDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setData(
        await apiAdmin<SellerDetailData>(
          `/api/admin/sellers/${encodeURIComponent(id)}`,
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không tải được seller.",
      );
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  if (error)
    return (
      <div className="rounded-xl border border-[#f0b4ba] bg-[#fff4f4] p-6 text-sm text-[#b42332]">
        {error}
      </div>
    );
  if (!data)
    return (
      <div className="space-y-5">
        <div className="h-28 animate-pulse rounded-xl bg-[#e9edf2]" />
        <div className="h-80 animate-pulse rounded-xl bg-[#e9edf2]" />
      </div>
    );
  return (
    <div className="space-y-7">
      <Link
        href="/admin/sellers"
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#69707d] hover:text-[#1677ff]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Seller
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-5 rounded-xl border border-[#e5e7eb] bg-white p-5 sm:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <MediaImage
            src={data.avatar || "/avt.png"}
            alt=""
            className="h-16 w-16 rounded-2xl border border-[#e5e7eb] object-cover"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-bold text-[#12151b]">
                {data.shop?.shopName || data.name}
              </h1>
              {data.verificationState === "trusted" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#1677ff]/10 px-2.5 py-1 text-xs font-bold text-[#145dca]">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Trusted
                  Seller
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-[#69707d]">
              {data.email} · {data.id}
            </p>
            <p className="mt-1 text-xs text-[#8b929d]">
              Tham gia {data.joinedDate}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/sellers/${encodeURIComponent(data.shop?.slug || data.id)}`}
            target="_blank"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#dfe3e8] px-3.5 py-2 text-sm font-semibold text-[#36404d] hover:border-[#1677ff]/40 hover:text-[#1677ff]"
          >
            Public profile <ExternalLink className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href="/admin/verifications"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#1677ff] px-3.5 py-2 text-sm font-bold text-white hover:bg-[#145dca]"
          >
            Mở verification
          </Link>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Metric label="Trust Score" value={`${data.trustScore}/100`} />
        <Metric label="Bots" value={String(data.bots.length)} />
        <Metric label="Reviews" value={String(data.reviews.length)} />
        <Metric
          label="Trạng thái"
          value={
            data.verificationState === "trusted"
              ? "Trusted"
              : data.verificationState
          }
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Panel title="Tổng quan">
            <p className="text-sm leading-6 text-[#69707d]">
              {data.shop?.bio ||
                data.bio ||
                "Seller chưa thêm phần giới thiệu."}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {Object.entries(data.contact).length ? (
                Object.entries(data.contact).map(([key, value]) => (
                  <div key={key} className="rounded-lg bg-[#f7f8fa] p-3">
                    <p className="text-xs text-[#69707d]">{key}</p>
                    <p className="mt-1 truncate text-sm font-semibold text-[#12151b]">
                      {value}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#8b929d]">Chưa có kênh liên hệ.</p>
              )}
            </div>
          </Panel>
          <Panel title="Bots">
            <div className="divide-y divide-[#edf0f2]">
              {data.bots.map((bot) => (
                <Link
                  key={bot.id}
                  href={`/admin/bots/${encodeURIComponent(bot.id)}`}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#12151b] hover:text-[#1677ff]">
                      {bot.title}
                    </p>
                    <p className="mt-1 text-xs text-[#69707d]">
                      {bot.categoryName} · {bot.reviewCount} reviews ·{" "}
                      {bot.views.toLocaleString("vi-VN")} views
                    </p>
                  </div>
                  <span className="rounded-md bg-[#f7f8fa] px-2 py-1 text-[10px] font-bold text-[#69707d]">
                    {bot.status}
                  </span>
                </Link>
              ))}
              {!data.bots.length ? (
                <p className="text-sm text-[#69707d]">Seller chưa có bot.</p>
              ) : null}
            </div>
          </Panel>
          <Panel title="Trust history">
            <div className="space-y-3">
              {data.trustEvents.map((event) => (
                <div key={event.id} className="flex gap-3 text-sm">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#1677ff]" />
                  <div>
                    <p className="font-semibold text-[#12151b]">{event.type}</p>
                    <p className="mt-0.5 text-xs text-[#69707d]">
                      {new Date(event.createdAt).toLocaleString("vi-VN")}
                    </p>
                  </div>
                </div>
              ))}
              {!data.trustEvents.length ? (
                <p className="text-sm text-[#69707d]">Chưa có lịch sử trust.</p>
              ) : null}
            </div>
          </Panel>
        </div>
        <aside className="space-y-6">
          <Panel title="Xác minh">
            <div className="space-y-3">
              {data.verificationChecks.map((check) => (
                <div
                  key={check.kind}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="text-[#69707d]">
                    {checkLabels[check.kind] ?? check.kind}
                  </span>
                  {check.status === "verified" ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-[#087a55]">
                      <Check className="h-3.5 w-3.5" aria-hidden /> Verified
                    </span>
                  ) : (
                    <span className="text-xs text-[#8b929d]">
                      {check.status}
                    </span>
                  )}
                </div>
              ))}
              {!data.verificationChecks.length ? (
                <p className="text-sm text-[#69707d]">
                  Chưa có check xác minh.
                </p>
              ) : null}
            </div>
          </Panel>
          <Panel title="Latest review">
            <div className="space-y-4">
              {data.reviews.slice(0, 4).map((review) => (
                <div
                  key={review.id}
                  className="border-b border-[#edf0f2] pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-sm font-bold">
                      <Star
                        className="h-3.5 w-3.5 fill-[#e5a100] text-[#e5a100]"
                        aria-hidden
                      />{" "}
                      {review.rating}/5
                    </span>
                    <span className="text-[11px] text-[#8b929d]">
                      {review.createdAt}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-3 text-xs leading-5 text-[#69707d]">
                    {review.comment || "Không có nội dung."}
                  </p>
                </div>
              ))}
              {!data.reviews.length ? (
                <p className="text-sm text-[#69707d]">Chưa có review.</p>
              ) : null}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#e5e7eb] bg-white p-5 sm:p-6">
      <h2 className="mb-4 font-bold text-[#12151b]">{title}</h2>
      {children}
    </section>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  const displayValue =
    label === "Trust Score" && value === "0/100" ? "Chưa đủ dữ liệu" : value;
  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-white p-4">
      <p className="text-xs font-semibold text-[#69707d]">{label}</p>
      <p className="mt-2 text-xl font-bold text-[#12151b]">{displayValue}</p>
    </div>
  );
}
