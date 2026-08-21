"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MessageSquare, RefreshCw, Search } from "lucide-react";

import { apiAdmin } from "@/lib/api-client";
import { MediaImage } from "@/components/media/MediaImage";

type AdminComment = {
  id: string;
  targetType: string;
  targetId: string;
  targetName: string;
  authorId?: string | null;
  authorName: string;
  authorAvatar: string;
  content: string;
  createdAt: string;
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
}

export default function AdminCommentsPage() {
  const [rows, setRows] = useState<AdminComment[] | null>(null);
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const query = search.trim()
        ? `?search=${encodeURIComponent(search.trim())}`
        : "";
      setRows(await apiAdmin<AdminComment[]>(`/api/admin/comments${query}`));
    } catch (cause) {
      setRows([]);
      setError(
        cause instanceof Error ? cause.message : "Không tải được bình luận.",
      );
    }
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#1677ff]">Cộng đồng</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#12151b]">
            Bình luận
          </h1>
          <p className="mt-2 text-sm text-[#69707d]">
            Xem các bình luận gần đây trên Posts và bot để kiểm tra tín hiệu
            cộng đồng.
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
        className="flex gap-3 rounded-xl border border-[#e5e7eb] bg-white p-3"
      >
        <label className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#dfe3e8] px-3 text-sm text-[#69707d] focus-within:border-[#1677ff] focus-within:ring-2 focus-within:ring-[#1677ff]/15">
          <Search className="h-4 w-4 shrink-0" aria-hidden />
          <span className="sr-only">Tìm bình luận</span>
          <input
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
            placeholder="Tìm nội dung hoặc tên người viết..."
            className="min-w-0 flex-1 bg-transparent text-[#12151b] outline-none placeholder:text-[#8b929d]"
          />
        </label>
        <button
          type="submit"
          className="min-h-10 rounded-lg bg-[#1677ff] px-4 text-sm font-bold text-white hover:bg-[#145dca] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677ff]"
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
          <h2 className="font-bold text-[#12151b]">Bình luận gần đây</h2>
          <span className="text-xs text-[#69707d]">
            {rows?.length ?? 0} kết quả
          </span>
        </div>
        <div className="divide-y divide-[#edf0f2]">
          {rows?.map((row) => (
            <article
              key={row.id}
              className="flex flex-wrap gap-4 px-5 py-5 sm:px-6"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e8eef8] text-xs font-bold text-[#1677ff]">
                {row.authorAvatar ? (
                  <MediaImage
                    src={row.authorAvatar}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  row.authorName.charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-[#12151b]">{row.authorName}</p>
                  <span className="text-xs text-[#8b929d]">
                    {formatDate(row.createdAt)}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#36404d]">
                  {row.content}
                </p>
                <p className="mt-3 text-xs text-[#69707d]">
                  Trên {row.targetType === "post" ? "Post" : "Bot"}:{" "}
                  <Link
                    href={
                      row.targetType === "post"
                        ? `/admin/posts/${encodeURIComponent(row.targetId)}`
                        : `/admin/bots/${encodeURIComponent(row.targetId)}`
                    }
                    className="font-semibold text-[#1677ff] hover:underline"
                  >
                    {row.targetName}
                  </Link>
                </p>
              </div>
              <span className="h-fit rounded-md bg-[#f7f8fa] px-2 py-1 text-[10px] font-bold uppercase text-[#69707d]">
                {row.targetType}
              </span>
            </article>
          ))}
        </div>
        {rows?.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <MessageSquare
              className="mx-auto h-8 w-8 text-[#8b929d]"
              aria-hidden
            />
            <p className="mt-3 font-semibold text-[#12151b]">
              Chưa có bình luận phù hợp
            </p>
            <p className="mt-1 text-sm text-[#69707d]">
              Không có dữ liệu khớp bộ lọc hiện tại.
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
