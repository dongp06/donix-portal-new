'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Bot as BotIcon, RefreshCw, Search } from 'lucide-react';

import { MediaImage } from '@/components/media/MediaImage';
import { apiAdmin } from '@/lib/api-client';

type BotRow = {
  id: string;
  title: string;
  categoryName: string;
  sellerName: string;
  sellerId: string;
  sellerVerificationState: string;
  status: string;
  views: number;
  rating: number;
  reviewCount: number;
  monthlyPrice: number;
  coverImage: string;
};

export default function AdminBotsPage() {
  const [rows, setRows] = useState<BotRow[] | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (status !== 'all') params.set('status', status);
      setRows(await apiAdmin<BotRow[]>(`/api/admin/bots${params.toString() ? `?${params.toString()}` : ''}`));
    } catch (cause) {
      setRows([]);
      setError(cause instanceof Error ? cause.message : 'Không tải được bot.');
    }
  }, [search, status]);
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
          <p className="text-sm font-semibold text-[#1677ff]">Marketplace operations</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#12151b]">Bot</h1>
          <p className="mt-2 text-sm text-[#69707d]">Kiểm tra listing, media, giá tháng và trạng thái hiển thị.</p>
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#dfe3e8] bg-white px-3.5 py-2 text-sm font-semibold text-[#36404d] hover:border-[#1677ff]/40 hover:text-[#1677ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677ff]">
          <RefreshCw className="h-4 w-4" aria-hidden /> Làm mới
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#e5e7eb] bg-white p-3">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b929d]" aria-hidden />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm bot, seller hoặc category..." aria-label="Tìm bot" className="h-10 w-full rounded-lg border border-[#dfe3e8] bg-white pl-9 pr-3 text-sm text-[#12151b] outline-none placeholder:text-[#8b929d] focus:border-[#1677ff] focus:ring-2 focus:ring-[#1677ff]/15" />
        </div>
        <select aria-label="Lọc trạng thái bot" value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-lg border border-[#dfe3e8] bg-white px-3 text-xs font-semibold text-[#36404d] outline-none focus:border-[#1677ff] focus:ring-2 focus:ring-[#1677ff]/15">
          <option value="all">Tất cả trạng thái</option>
          <option value="pending">Chờ duyệt</option>
          <option value="online">Đang hoạt động</option>
          <option value="maintenance">Bảo trì</option>
          <option value="offline">Ngoại tuyến</option>
          <option value="hidden">Đã ẩn</option>
        </select>
        <span className="text-xs text-[#69707d]">{rows?.length ?? 0} bot</span>
      </div>

      {error ? <div className="rounded-lg border border-[#f0b4ba] bg-[#fff4f4] px-4 py-3 text-sm text-[#b42332]" role="alert">{error}</div> : null}

      <section className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-[#edf0f2] bg-[#fbfcfd] text-[11px] font-bold uppercase tracking-[0.08em] text-[#69707d]">
              <tr><th className="px-5 py-3 sm:px-6">Bot</th><th className="px-5 py-3">Seller</th><th className="px-5 py-3">Category</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Views</th><th className="px-5 py-3">Giá tháng</th><th className="px-5 py-3 sm:px-6"><span className="sr-only">Mở</span></th></tr>
            </thead>
            <tbody className="divide-y divide-[#edf0f2]">
              {rows?.map((bot) => (
                <tr key={bot.id} className="transition-colors hover:bg-[#fbfcfd]">
                  <td className="px-5 py-4 sm:px-6"><div className="flex items-center gap-3"><div className="h-10 w-14 overflow-hidden rounded-lg bg-[#edf0f2]"><MediaImage src={bot.coverImage} fallbackSrc="/favicon.svg" alt="" className="h-full w-full object-cover" /></div><Link href={`/admin/bots/${encodeURIComponent(bot.id)}`} className="max-w-[250px] truncate font-bold text-[#12151b] hover:text-[#1677ff]">{bot.title}</Link></div></td>
                  <td className="px-5 py-4 text-xs font-semibold text-[#36404d]">{bot.sellerName}</td>
                  <td className="px-5 py-4 text-xs text-[#69707d]">{bot.categoryName}</td>
                  <td className="px-5 py-4"><span className="rounded-md bg-[#f7f8fa] px-2 py-1 text-[10px] font-bold text-[#69707d]">{bot.status}</span></td>
                  <td className="px-5 py-4 text-xs text-[#69707d]">{bot.views.toLocaleString('vi-VN')} · {bot.rating.toFixed(1)}★</td>
                  <td className="px-5 py-4 text-xs font-bold text-[#12151b]">{bot.monthlyPrice.toLocaleString('vi-VN')}đ</td>
                  <td className="px-5 py-4 text-right sm:px-6"><Link href={`/admin/bots/${encodeURIComponent(bot.id)}`} className="inline-flex items-center gap-1.5 font-semibold text-[#1677ff] hover:underline">Mở <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows?.length === 0 ? <div className="px-6 py-16 text-center"><BotIcon className="mx-auto h-8 w-8 text-[#8b929d]" aria-hidden /><p className="mt-3 text-sm text-[#69707d]">Không tìm thấy bot.</p></div> : null}
      </section>
    </div>
  );
}
