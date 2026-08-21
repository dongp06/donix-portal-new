'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight as ArrowRightIcon, Check, ExternalLink, Image as ImageIcon, ShieldCheck, Star } from 'lucide-react';

import { ImageLightbox } from '@/components/media/ImageLightbox';
import { MediaImage } from '@/components/media/MediaImage';
import { MarkdownRenderer } from '@/components/markdown/MarkdownRenderer';
import { apiAdmin } from '@/lib/api-client';

type BotDetailData = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  categorySlug: string;
  categoryName: string;
  sellerId: string;
  sellerName: string;
  sellerAvatar: string;
  sellerVerificationState: string;
  sellerTrustedUntil: string | null;
  sellerJoinedDate: string;
  coverImage: string;
  gallery: string[];
  features: string[];
  monthlyPrice: number;
  pricingDescription: string;
  pricingImages: string[];
  status: string;
  rating: number;
  reviewCount: number;
  views: number;
  tags: string[];
  targetAudience: string[];
  updatedAt: string;
  seller?: {
    id: string;
    name: string;
    email: string;
    avatar: string;
    verificationState: string;
    trustScore: number;
    joinedDate: string;
    trustedUntil: string | null;
    sellerProfile?: { slug: string; shopName: string } | null;
  };
  reviews: Array<{ id: string; rating: number; comment: string; createdAt: string; user?: { name: string; avatar: string } | null }>;
};

export function AdminBotDetail({ id }: { id: string }) {
  const [data, setData] = useState<BotDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await apiAdmin<BotDetailData>(`/api/admin/bots/${encodeURIComponent(id)}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được bot.');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <div className="rounded-xl border border-[#f0b4ba] bg-[#fff4f4] p-6 text-sm text-[#b42332]" role="alert">{error}</div>;
  if (!data) return <div className="space-y-5" aria-busy="true"><div className="h-28 animate-pulse rounded-xl bg-[#e9edf2]" /><div className="h-96 animate-pulse rounded-xl bg-[#e9edf2]" /></div>;

  const media = [data.coverImage, ...data.gallery, ...data.pricingImages].filter(Boolean);
  const mediaImages = media.map((src, index) => ({ src, alt: `${data.title} media ${index + 1}` }));

  return (
    <div className="space-y-7">
      <Link href="/admin/bots" className="inline-flex items-center gap-2 text-sm font-semibold text-[#69707d] hover:text-[#1677ff]"><ArrowLeft className="h-4 w-4" aria-hidden /> Bot</Link>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div><p className="text-sm font-semibold text-[#1677ff]">Bot moderation</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-[#12151b]">{data.title}</h1><p className="mt-2 text-sm text-[#69707d]">{data.categoryName} · {data.sellerName} · cập nhật {data.updatedAt}</p></div>
        <div className="flex flex-wrap gap-2"><Link href={`/bots/${encodeURIComponent(data.slug || data.id)}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#dfe3e8] bg-white px-3.5 py-2 text-sm font-semibold text-[#36404d] hover:border-[#1677ff]/40 hover:text-[#1677ff]">Xem public <ExternalLink className="h-4 w-4" aria-hidden /></Link><span className="inline-flex min-h-10 items-center rounded-lg bg-[#f7f8fa] px-3.5 py-2 text-sm font-bold text-[#36404d]">{data.status}</span></div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
            <button type="button" onClick={() => data.coverImage && setLightboxIndex(media.indexOf(data.coverImage))} className="group block aspect-[2.2/1] max-h-[380px] w-full bg-[#edf0f2] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1677ff]" aria-label={`Xem ảnh cover ${data.title}`}>
              <MediaImage src={data.coverImage} fallbackSrc="/favicon.svg" alt={data.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.01]" />
            </button>
            <div className="p-5 sm:p-6"><p className="text-base font-semibold text-[#36404d]">{data.tagline}</p><div className="mt-4 text-sm leading-7 text-[#69707d]"><MarkdownRenderer value={data.description} /></div><div className="mt-6 flex flex-wrap gap-2">{data.features.map((feature) => <span key={feature} className="inline-flex items-center gap-1.5 rounded-full bg-[#f7f8fa] px-3 py-1.5 text-xs font-semibold text-[#36404d]"><Check className="h-3.5 w-3.5 text-[#13b981]" aria-hidden />{feature}</span>)}</div></div>
          </section>

          <section className="rounded-xl border border-[#e5e7eb] bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3"><h2 className="font-bold text-[#12151b]">Media & bảng giá</h2><ImageIcon className="h-5 w-5 text-[#69707d]" aria-hidden /></div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{media.map((image, index) => <button key={`${image}-${index}`} type="button" onClick={() => setLightboxIndex(index)} className="aspect-video overflow-hidden rounded-lg bg-[#edf0f2] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677ff]"><MediaImage src={image} fallbackSrc="/logo.svg" alt={`Media ${index + 1}`} className="h-full w-full object-cover" /></button>)}{!media.length ? <p className="col-span-full text-sm text-[#69707d]">Chưa có ảnh demo hoặc ảnh bảng giá.</p> : null}</div>
            <div className="mt-5 border-t border-[#edf0f2] pt-5"><p className="text-xs font-semibold text-[#69707d]">Giá thuê cơ bản</p><p className="mt-1 text-2xl font-bold text-[#12151b]">{data.monthlyPrice.toLocaleString('vi-VN')}đ <span className="text-sm font-semibold text-[#69707d]">/ tháng</span></p>{data.pricingDescription ? <div className="mt-4 rounded-lg bg-[#f7f8fa] p-4 text-xs leading-6 text-[#36404d]"><MarkdownRenderer value={data.pricingDescription} /></div> : null}</div>
          </section>

          <section className="rounded-xl border border-[#e5e7eb] bg-white p-5 sm:p-6"><h2 className="font-bold text-[#12151b]">Reviews ({data.reviews.length})</h2><div className="mt-4 divide-y divide-[#edf0f2]">{data.reviews.slice(0, 10).map((review) => <div key={review.id} className="py-3 first:pt-0 last:pb-0"><span className="inline-flex items-center gap-1 text-sm font-bold"><Star className="h-3.5 w-3.5 fill-[#e5a100] text-[#e5a100]" aria-hidden /> {review.rating}/5</span><p className="mt-2 text-sm text-[#69707d]">{review.comment || 'Không có nội dung.'}</p></div>)}{!data.reviews.length ? <p className="text-sm text-[#69707d]">Chưa có review.</p> : null}</div></section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border border-[#e5e7eb] bg-white p-5"><h2 className="font-bold text-[#12151b]">Seller trust</h2><div className="mt-4 flex items-center gap-3"><MediaImage src={data.seller?.avatar || data.sellerAvatar} fallbackSrc="/avt.png" alt="" className="h-11 w-11 rounded-xl object-cover" /><div className="min-w-0"><p className="truncate font-bold text-[#12151b]">{data.seller?.name || data.sellerName}</p><p className="mt-0.5 text-xs text-[#69707d]">{data.seller?.email || data.sellerId}</p></div></div><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-lg bg-[#f7f8fa] p-3"><p className="text-xs text-[#69707d]">Trust Score</p><p className="mt-1 font-bold text-[#12151b]">{data.seller?.trustScore ?? '—'}</p></div><div className="rounded-lg bg-[#f7f8fa] p-3"><p className="text-xs text-[#69707d]">State</p><p className="mt-1 font-bold text-[#12151b]">{data.seller?.verificationState || data.sellerVerificationState}</p></div></div><Link href={`/admin/sellers/${encodeURIComponent(data.sellerId)}`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#1677ff] hover:underline">Mở seller <ArrowRightIcon className="h-4 w-4" aria-hidden /></Link></section>
          <section className="rounded-xl border border-[#e5e7eb] bg-white p-5"><h2 className="font-bold text-[#12151b]">Listing signals</h2><div className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-3"><span className="text-[#69707d]">Views</span><strong>{data.views.toLocaleString('vi-VN')}</strong></div><div className="flex justify-between gap-3"><span className="text-[#69707d]">Rating</span><strong>{data.rating.toFixed(1)} / 5</strong></div><div className="flex justify-between gap-3"><span className="text-[#69707d]">Reviews</span><strong>{data.reviewCount}</strong></div><div className="flex justify-between gap-3"><span className="text-[#69707d]">Audience</span><strong>{data.targetAudience.length || '—'}</strong></div></div></section>
          <section className="rounded-xl border border-[#e5e7eb] bg-white p-5"><h2 className="font-bold text-[#12151b]">Actions</h2><p className="mt-2 text-xs leading-5 text-[#69707d]">Mọi thay đổi moderation cần đi qua case hoặc được ghi vào audit log.</p><Link href="/admin/moderation" className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#1677ff] px-3 py-2 text-sm font-bold text-white hover:bg-[#145dca]">Tạo / mở moderation case <ShieldCheck className="h-4 w-4" aria-hidden /></Link></section>
        </aside>
      </div>

      {lightboxIndex !== null && mediaImages.length ? <ImageLightbox images={mediaImages} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} /> : null}
    </div>
  );
}
