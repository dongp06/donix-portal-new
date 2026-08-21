'use client';

import React, { use, useEffect, useState } from 'react';
import Link from 'next/link';
import type { BotItem } from '@shared/types';
import { useRole } from '../../../context/RoleContext';
import { ContactModal } from '../../../components/modals/ContactModal';
import { ReviewSection } from '../../../components/comments/ReviewSection';
import { CommentSection } from '../../../components/comments/CommentSection';
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Image as ImageIcon,
  MessageCircle,
  MessageSquare,
  Package,
  Star,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMonthlyPrice, isPricingStale } from '@/lib/bot-pricing';
import { TrustedBadge } from '@/components/trust/TrustedBadge';
import { ImageLightbox } from '@/components/media/ImageLightbox';
import { MediaImage } from '@/components/media/MediaImage';
import { MarkdownRenderer } from '@/components/markdown/MarkdownRenderer';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';

type DetailTab = 'overview' | 'features' | 'pricing' | 'gallery' | 'reviews';
type PreviewState = { images: string[]; index: number; altPrefix: string } | null;

const statusMeta: Record<BotItem['status'], { label: string; className: string }> = {
  online: { label: 'Đang hoạt động', className: 'bg-emerald-500' },
  maintenance: { label: 'Đang bảo trì', className: 'bg-amber-500' },
  offline: { label: 'Tạm ngừng', className: 'bg-zinc-400' },
};

function MarkdownContent({ value }: { value: string }) {
  const lines = value.split(/\r?\n/);
  return (
    <div className="space-y-2 text-sm leading-7 text-muted-foreground">
      {lines.map((line, index) => {
        const text = line.trim();
        if (!text) return <div key={`space-${index}`} className="h-1" aria-hidden />;
        if (text.startsWith('### ')) return <h4 key={index} className="pt-2 font-display text-base font-bold text-foreground">{text.slice(4)}</h4>;
        if (text.startsWith('## ')) return <h3 key={index} className="pt-3 font-display text-lg font-bold text-foreground">{text.slice(3)}</h3>;
        if (text.startsWith('# ')) return <h3 key={index} className="pt-3 font-display text-xl font-bold text-foreground">{text.slice(2)}</h3>;
        if (/^[-*]\s/.test(text)) return <div key={index} className="flex items-start gap-2"><span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden /><span>{text.slice(2)}</span></div>;
        if (text.startsWith('> ')) return <blockquote key={index} className="rounded-lg border border-brand/20 bg-brand/[0.04] px-3 py-2 italic text-foreground/80">{text.slice(2)}</blockquote>;
        return <p key={index}>{text}</p>;
      })}
    </div>
  );
}

function PricingMarkdown({ value }: { value: string }) {
  const lines = value.split(/\r?\n/);
  const tableLines = lines.filter((line) => line.trim().startsWith('|'));
  const hasTable = tableLines.length >= 2 && /^\|?\s*:?-{3,}/.test(tableLines[1].trim().replace(/^\|/, ''));
  if (!hasTable) return <MarkdownContent value={value} />;

  const cells = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
  const header = cells(tableLines[0]);
  const rows = tableLines.slice(2).map(cells);
  const beforeTable = lines.slice(0, lines.indexOf(tableLines[0])).join('\n').trim();
  const afterTable = lines.slice(lines.indexOf(tableLines[tableLines.length - 1]) + 1).join('\n').trim();

  return (
    <div className="space-y-4">
      {beforeTable ? <MarkdownContent value={beforeTable} /> : null}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-muted/50 text-xs font-semibold text-foreground">
            <tr>{header.map((cell, index) => <th key={index} className="whitespace-nowrap px-4 py-3">{cell}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3 text-muted-foreground">{cell}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
      {afterTable ? <MarkdownContent value={afterTable} /> : null}
    </div>
  );
}

function statusLabel(status: BotItem['status']): string {
  return statusMeta[status]?.label ?? 'Chưa cập nhật';
}

function sellerTrustLabel(bot: BotItem): string {
  if (bot.seller.isTrusted && typeof bot.seller.reputation === 'number') return `${bot.seller.reputation}/100`;
  return 'Đang xây dựng';
}

type BotDetailError = {
  status: number;
  code?: string;
  message: string;
};

function BotDetailLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground" aria-busy="true" aria-live="polite">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="h-4 w-44 animate-pulse rounded bg-muted" />
        <section className="grid grid-cols-1 gap-6 rounded-2xl border border-border bg-card p-5 sm:p-6 md:p-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="aspect-[4/3] animate-pulse rounded-xl bg-muted" />
          <div className="space-y-5 py-2">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="h-10 w-4/5 animate-pulse rounded bg-muted" />
            <div className="h-16 w-full animate-pulse rounded bg-muted" />
            <div className="h-20 w-full animate-pulse rounded-xl bg-muted" />
            <div className="h-16 w-full animate-pulse rounded-xl bg-muted" />
          </div>
        </section>
      </div>
    </div>
  );
}

function BotDetailUnavailable({ error, onRetry }: { error: BotDetailError; onRetry: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background p-6 text-center text-foreground">
      <div className="max-w-md">
        <p className="font-display text-2xl font-bold">Bot details are temporarily unavailable</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {error.message || 'The service is starting or temporarily unavailable. Please try again.'}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground"
          >
            Try again
          </button>
          <Link href="/bots" className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 py-2.5 text-sm font-semibold">
            Back to bots
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function BotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { bots, botsError } = useRole();
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [activeImage, setActiveImage] = useState(0);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewState>(null);
  const [detailBot, setDetailBot] = useState<BotItem | null>(null);
  const [detailBotId, setDetailBotId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState<BotDetailError | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setDetailLoading(true);
    setDetailError(null);
    setDetailBot(null);
    setDetailBotId(null);

    void (async () => {
      try {
        const response = await fetchWithTimeout(`/api/bots/${encodeURIComponent(id)}`, {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        }, 20_000);
        const payload = await response.json().catch(() => null) as {
          success?: boolean;
          data?: unknown;
          error?: string;
          code?: string;
        } | null;

        if (!response.ok || !payload?.success || !payload.data) {
          if (!cancelled) {
            setDetailError({
              status: response.status,
              code: payload?.code,
              message: payload?.error || `Bot details could not be loaded (${response.status}).`,
            });
          }
          return;
        }

        if (!cancelled) {
          setDetailBot(payload.data as BotItem);
          setDetailBotId(id);
        }
      } catch (cause) {
        if (cancelled || controller.signal.aborted) return;
        setDetailError({
          status: 0,
          message: cause instanceof Error ? cause.message : 'The server could not be reached.',
        });
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [id, retryCount]);

  // Catalog data is useful for a first paint while the authoritative detail
  // call is in flight, but it never masks a failed detail request.
  const catalogBot: BotItem | undefined = bots.find((item) => item.id === id || item.slug === id);
  const currentDetailBot = detailBotId === id ? detailBot : null;
  const bot: BotItem | undefined = currentDetailBot ?? (detailLoading ? catalogBot : undefined);

  if (detailLoading && !bot) return <BotDetailLoading />;

  const isBotNotFound = detailError?.status === 404 && detailError.code === 'BOT_NOT_FOUND';

  if (isBotNotFound) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-background p-6 text-center text-foreground">
        <div>
          <p className="font-display text-2xl font-bold">Không tìm thấy bot</p>
          <p className="mt-2 text-sm text-muted-foreground">Listing này không tồn tại hoặc đã được gỡ khỏi thuebot.org.</p>
          <Link href="/bots" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground">Quay lại chợ bot</Link>
        </div>
      </div>
    );
  }

  if (detailError && !bot) {
    return (
      <BotDetailUnavailable
        error={{ ...detailError, message: detailError.message || botsError || 'Bot details could not be loaded.' }}
        onRetry={() => setRetryCount((value) => value + 1)}
      />
    );
  }

  if (!bot) return <BotDetailLoading />;

  const status = statusMeta[bot.status] ?? statusMeta.offline;
  const gallery = Array.from(new Set([bot.coverImage, ...bot.gallery].filter(Boolean)));
  const currentImage = gallery[Math.min(activeImage, gallery.length - 1)] ?? bot.coverImage;
  const pricingStale = isPricingStale(bot.pricingUpdatedAt);
  const pricingUpdatedLabel = bot.pricingUpdatedAt ? new Date(bot.pricingUpdatedAt).toLocaleDateString('vi-VN') : null;
  const monthlyPriceLabel = bot.pricing.monthlyPrice > 0 ? formatMonthlyPrice(bot.pricing.monthlyPrice) : 'Chưa cập nhật giá';
  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'overview', label: 'Tổng quan' },
    { id: 'features', label: `Tính năng (${bot.features.length})` },
    { id: 'pricing', label: 'Bảng giá' },
    { id: 'gallery', label: `Ảnh demo (${gallery.length})` },
    { id: 'reviews', label: `Đánh giá (${bot.reviewCount ?? 0})` },
  ];

  const moveImage = (direction: -1 | 1) => {
    setActiveImage((current) => (current + direction + gallery.length) % gallery.length);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/bots" className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Quay lại danh sách bot
        </Link>

        <section className="grid grid-cols-1 gap-6 rounded-2xl border border-border bg-card p-5 sm:p-6 md:p-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="min-w-0">
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-muted">
              <button
                type="button"
                onClick={() => setPreview({ images: gallery, index: activeImage, altPrefix: bot.title })}
                className="group absolute inset-0 z-0 block h-full w-full cursor-zoom-in text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
                aria-label={`Xem ảnh ${bot.title}`}
              >
                <MediaImage src={currentImage} alt={bot.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.015]" />
                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white opacity-100 backdrop-blur-sm transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">Xem ảnh</span>
              </button>
              <div className="absolute inset-x-3 top-3 z-10 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/85 px-2.5 py-1 text-xs font-semibold backdrop-blur-sm">
                  <span className={cn('h-2 w-2 rounded-full', status.className)} aria-hidden /> {status.label}
                </span>
                <span className="rounded-full border border-brand/30 bg-background/85 px-2.5 py-1 text-[11px] font-semibold text-brand backdrop-blur-sm">{bot.categoryName}</span>
              </div>
              {gallery.length > 1 ? <>
                <button type="button" onClick={() => moveImage(-1)} className="absolute left-3 top-1/2 z-20 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white transition hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="Ảnh trước"><ChevronLeft className="h-5 w-5" aria-hidden /></button>
                <button type="button" onClick={() => moveImage(1)} className="absolute right-3 top-1/2 z-20 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white transition hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="Ảnh tiếp theo"><ChevronRight className="h-5 w-5" aria-hidden /></button>
              </> : null}
            </div>
              {gallery.length > 1 ? <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6">
              {gallery.slice(0, 8).map((image, index) => <button key={`${image}-${index}`} type="button" onClick={() => { setActiveImage(index); setPreview({ images: gallery, index, altPrefix: bot.title }); }} className={cn('aspect-square overflow-hidden rounded-lg border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand', index === activeImage ? 'border-brand ring-2 ring-brand/25' : 'border-border opacity-75 hover:opacity-100')} aria-label={`Xem ảnh demo ${index + 1}`}><MediaImage src={image} alt="" className="h-full w-full object-cover" /></button>)}
            </div> : null}
          </div>

          <div className="flex min-w-0 flex-col justify-between gap-7">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="rounded-full bg-brand/10 px-2.5 py-1 font-semibold text-brand">{statusLabel(bot.status)}</span><span>Phiên bản {bot.version}</span></div>
              <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">{bot.title}</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">{bot.tagline}</p>
              <div className="mt-4 flex flex-wrap gap-2">{bot.tags.map((tag) => <span key={tag} className="rounded-lg border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground">#{tag}</span>)}</div>

              <Link href={bot.seller.slug ? `/sellers/${bot.seller.slug}` : `/sellers/${bot.seller.id}`} className="mt-6 flex items-center gap-3 rounded-xl border border-border bg-background p-3 transition-colors hover:border-brand/45">
                <MediaImage src={bot.seller.avatar} alt="" className="h-10 w-10 rounded-full border border-border object-cover" />
                <span className="min-w-0 flex-1"><span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">{bot.seller.name}<TrustedBadge size="sm" interactive={false} info={{ isTrusted: bot.seller.isTrusted, trustScore: bot.seller.reputation, rating: bot.seller.rating }} /></span><span className="mt-1 block text-xs text-muted-foreground">Trust {sellerTrustLabel(bot)} · Tham gia {bot.seller.joinedDate}</span></span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
              </Link>

              <div className="mt-6 flex flex-wrap items-center gap-5 border-y border-border py-4 text-sm">
                <span className="inline-flex items-center gap-1.5 font-semibold"><Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden />{bot.rating.toFixed(1)} <span className="font-normal text-muted-foreground">({bot.reviewCount} đánh giá)</span></span>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Activity className="h-4 w-4 text-brand" aria-hidden /><strong className="font-semibold text-foreground">{bot.views.toLocaleString('vi-VN')}</strong> lượt xem</span>
                {bot.targetAudience?.length ? <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Users className="h-4 w-4 text-brand" aria-hidden />{bot.targetAudience.length} nhóm phù hợp</span> : null}
              </div>
            </div>

            <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-brand/30 bg-background p-4 sm:flex-row sm:items-center">
              <div><span className="block text-xs text-muted-foreground">Giá thuê từ</span><span className="mt-1 block font-display text-2xl font-bold">{monthlyPriceLabel}</span><span className="mt-1 block text-xs text-muted-foreground">Giá tham chiếu · Xem bảng giá chi tiết bên dưới</span></div>
              <button type="button" onClick={() => setIsContactOpen(true)} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-8 py-3 text-sm font-semibold text-brand-foreground transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:w-auto"><MessageCircle className="h-4 w-4" aria-hidden /> Liên hệ người bán</button>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <nav className="sticky top-0 z-20 -mx-1 overflow-x-auto border-b border-border bg-background/95 backdrop-blur" aria-label="Chi tiết bot" role="tablist">
              <div className="flex min-w-max gap-1">{tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className={cn('min-h-14 border-b-2 px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:px-4', activeTab === tab.id ? 'border-brand text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>{tab.label}</button>)}</div>
            </nav>

            {activeTab === 'overview' ? <section className="mt-6 space-y-6 rounded-2xl border border-border bg-card p-6">
              <div><h2 className="font-display text-lg font-bold">Mô tả sản phẩm</h2>{bot.description ? <div className="mt-4"><MarkdownRenderer value={bot.description} /></div> : <p className="mt-3 text-sm text-muted-foreground">Seller chưa thêm mô tả chi tiết.</p>}</div>
              {bot.targetAudience?.length ? <div className="border-t border-border pt-5"><h3 className="flex items-center gap-2 font-semibold"><Users className="h-4 w-4 text-brand" aria-hidden />Phù hợp với</h3><div className="mt-3 flex flex-wrap gap-2">{bot.targetAudience.map((audience) => <span key={audience} className="rounded-full border border-brand/25 bg-brand/10 px-3 py-1.5 text-xs font-semibold text-foreground">{audience}</span>)}</div></div> : null}
              {bot.systemReqs ? <div className="border-t border-border pt-5"><h3 className="font-semibold">Yêu cầu sử dụng</h3><p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{bot.systemReqs}</p></div> : null}
            </section> : null}

            {activeTab === 'features' ? <section className="mt-6 space-y-3 rounded-2xl border border-border bg-card p-6"><h2 className="font-display text-lg font-bold">Tính năng nổi bật</h2>{bot.features.length > 0 ? bot.features.map((feature) => <div key={feature} className="flex items-start gap-3 rounded-xl border border-border bg-background p-3 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden /><span>{feature}</span></div>) : <p className="text-sm text-muted-foreground">Seller chưa thêm danh sách tính năng.</p>}</section> : null}

            {activeTab === 'pricing' ? <section className="mt-6 space-y-5 rounded-2xl border border-border bg-card p-6"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Giá thuê tham chiếu</p><h2 className="mt-2 font-display text-2xl font-bold">{monthlyPriceLabel}</h2><p className="mt-2 text-sm text-muted-foreground">Mức giá chuẩn dùng trên card bot, tìm kiếm và so sánh.</p>{pricingUpdatedLabel ? <p className="mt-2 text-xs text-muted-foreground">Cập nhật bảng giá: {pricingUpdatedLabel}</p> : null}</div><Package className="h-6 w-6 text-brand" aria-hidden /></div>{pricingStale ? <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900"><strong>⚠ Bảng giá đã lâu chưa được cập nhật.</strong><p className="mt-1 text-xs leading-relaxed">Vui lòng xác nhận lại giá với seller trước khi thuê.</p></div> : null}{bot.pricing.pricingDescription ? <div className="border-t border-border pt-5"><h3 className="font-semibold">Bảng giá chi tiết</h3><div className="mt-3"><MarkdownRenderer value={bot.pricing.pricingDescription} /></div></div> : null}{bot.pricing.pricingImages?.length ? <div className="border-t border-border pt-5"><h3 className="flex items-center gap-2 font-semibold"><ImageIcon className="h-4 w-4 text-brand" aria-hidden />Ảnh bảng giá từ nhà cung cấp</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">{bot.pricing.pricingImages.map((image, index) => <button key={`${image}-${index}`} type="button" onClick={() => setPreview({ images: bot.pricing.pricingImages ?? [], index, altPrefix: 'Bảng giá' })} className="group relative overflow-hidden rounded-xl border border-border bg-muted text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"><MediaImage src={image} alt={`Bảng giá ${index + 1}`} className="max-h-80 w-full object-contain transition-transform duration-300 group-hover:scale-[1.015]" /><span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white opacity-100 backdrop-blur-sm transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">Xem ảnh</span></button>)}</div><p className="mt-3 text-xs leading-relaxed text-muted-foreground">Bảng giá do nhà cung cấp đăng tải. Vui lòng xác nhận lại giá trước khi thuê.</p></div> : null}{!bot.pricing.pricingDescription && !bot.pricing.pricingImages?.length ? <p className="border-t border-border pt-5 text-sm text-muted-foreground">Seller chưa thêm bảng giá bổ sung. Mức giá tham chiếu ở trên vẫn là giá dùng cho marketplace.</p> : null}</section> : null}

            {activeTab === 'gallery' ? <section className="mt-6 rounded-2xl border border-border bg-card p-6"><div className="flex items-center justify-between gap-3"><div><p className="eyebrow">Media sản phẩm</p><h2 className="mt-2 font-display text-xl font-bold">Ảnh demo bot</h2></div><ImageIcon className="h-5 w-5 text-brand" aria-hidden /></div><div className="mt-5 grid gap-4 sm:grid-cols-2">{gallery.map((image, index) => <button key={`${image}-${index}`} type="button" onClick={() => setPreview({ images: gallery, index, altPrefix: bot.title })} className="group relative overflow-hidden rounded-xl border border-border bg-muted text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"><MediaImage src={image} alt={`${bot.title} - ảnh demo ${index + 1}`} className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" /><span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white opacity-100 backdrop-blur-sm transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">Xem ảnh</span></button>)}</div></section> : null}

            {activeTab === 'reviews' ? <div className="mt-6"><ReviewSection botId={bot.id} /></div> : null}
          </div>

          <aside className="space-y-5 lg:sticky lg:top-[76px]">
            <section className="space-y-4 rounded-2xl border border-border bg-card p-6"><span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Thông tin nhà cung cấp</span><Link href={bot.seller.slug ? `/sellers/${bot.seller.slug}` : `/sellers/${bot.seller.id}`} className="flex items-center gap-3 rounded-xl transition-colors hover:opacity-90"><MediaImage src={bot.seller.avatar} alt={bot.seller.name} className="h-11 w-11 rounded-full border border-border object-cover" /><div className="min-w-0"><div className="flex items-center gap-1 text-sm font-semibold">{bot.seller.name}<TrustedBadge size="sm" interactive={false} info={{ isTrusted: bot.seller.isTrusted, trustScore: bot.seller.reputation, rating: bot.seller.rating }} /></div><div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden /><span className="font-medium text-foreground">{bot.seller.rating.toFixed(1)} / 5.0</span><span>· Uy tín {sellerTrustLabel(bot)}</span></div></div></Link><div className="space-y-2 border-t border-border pt-4 text-xs text-muted-foreground"><p>Trạng thái bot: <strong className="font-semibold text-foreground">{status.label}</strong></p><p>Cập nhật: <strong className="font-semibold text-foreground">{bot.updatedAt}</strong></p></div><button type="button" onClick={() => setIsContactOpen(true)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold transition-colors hover:border-brand/40 hover:text-foreground"><MessageSquare className="h-4 w-4" aria-hidden /> Nhắn tin hỏi nhà cung cấp</button></section>
            {bot.seller.contact?.website ? <a href={/^https?:\/\//i.test(bot.seller.contact.website) ? bot.seller.contact.website : `https://${bot.seller.contact.website}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-5 text-sm transition-colors hover:border-brand/45"><ExternalLink className="h-5 w-5 text-brand" aria-hidden /><span className="min-w-0 flex-1"><span className="block text-xs text-muted-foreground">Website seller</span><span className="mt-1 block truncate font-semibold">{bot.seller.contact.website}</span></span></a> : null}
            <section className="rounded-2xl border border-border bg-muted/40 p-5"><div className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden /><p className="text-xs leading-relaxed text-muted-foreground">Tích xanh và điểm uy tín là tín hiệu tham khảo, không phải bảo đảm tuyệt đối cho giao dịch.</p></div></section>
          </aside>
        </div>

        <CommentSection targetType="bot" targetId={bot.id} />
      </div>
      {preview ? <ImageLightbox key={`${preview.altPrefix}-${preview.index}-${preview.images.join('|')}`} images={preview.images.map((image, index) => ({ src: image, alt: `${preview.altPrefix} - ảnh ${index + 1}` }))} initialIndex={preview.index} onClose={() => setPreview(null)} /> : null}
      <ContactModal bot={bot} isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </div>
  );
}
