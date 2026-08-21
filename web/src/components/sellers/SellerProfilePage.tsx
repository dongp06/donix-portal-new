'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowUpRight,
  Bot,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Copy,
  Eye,
  ExternalLink,
  FileText,
  Globe2,
  Heart,
  History,
  Info,
  Mail,
  MessageCircle,
  MessageSquare,
  PencilLine,
  Phone,
  Send,
  ShieldCheck,
  Star,
  ThumbsUp,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type {
  BotContactInfo,
  BotItem,
  Post,
  SellerProfile,
  SellerReview,
  SellerReviewSummary,
  SellerTrustEvent,
} from '@shared/types';
import { useRole } from '@/context/RoleContext';
import { ContactModal } from '@/components/modals/ContactModal';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { EditProfileModal } from '@/components/modals/EditProfileModal';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { TrustedBadge } from '@/components/trust/TrustedBadge';
import { getBotPriceDisplay } from '@/lib/bot-pricing';
import { MediaImage } from '@/components/media/MediaImage';

type SellerTab = 'bots' | 'reviews' | 'posts' | 'about';

const tabLabels: Record<SellerTab, string> = {
  bots: 'Bots',
  reviews: 'Đánh giá',
  posts: 'Bài viết',
  about: 'Giới thiệu',
};

const eventLabels: Record<string, string> = {
  joined: 'Gia nhập thuebot.org',
  verification_submitted: 'Đã nộp hồ sơ xác minh',
  verification_state_changed: 'Cập nhật trạng thái xác minh',
  verification_check_updated: 'Cập nhật thông tin xác minh',
  verification_reviewed: 'Hồ sơ được đội ngũ xem xét',
  verification_revoked: 'Xác minh bị thu hồi',
  trusted_expired: 'Trusted Seller hết hạn',
};

const postTypeLabels: Record<string, string> = {
  share: 'Chia sẻ',
  question: 'Hỏi đáp',
  bot_update: 'Bot update',
  warning: 'Cảnh báo',
  discussion: 'Thảo luận',
  announcement: 'Thông báo',
};

const statusMeta: Record<BotItem['status'], { label: string; className: string }> = {
  online: { label: 'Đang hoạt động', className: 'bg-emerald-500' },
  maintenance: { label: 'Đang bảo trì', className: 'bg-amber-500' },
  offline: { label: 'Tạm ngừng', className: 'bg-zinc-400' },
};

const contactMeta: Array<{
  key: keyof BotContactInfo;
  label: string;
  icon: LucideIcon;
}> = [
  { key: 'zalo', label: 'Zalo', icon: MessageCircle },
  { key: 'telegram', label: 'Telegram', icon: Send },
  { key: 'phone', label: 'Điện thoại', icon: Phone },
  { key: 'messenger', label: 'Messenger', icon: MessageCircle },
  { key: 'facebook', label: 'Facebook', icon: Globe2 },
  { key: 'website', label: 'Website', icon: Globe2 },
];

function formatDate(value: string, month: 'long' | 'short' = 'long'): string {
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month, year: 'numeric' });
}

function formatNumber(value: number): string {
  return value.toLocaleString('vi-VN');
}

function formatPrice(bot: BotItem): string {
  return getBotPriceDisplay(bot.pricing);
}

function getTrustLabel(score: number): string {
  if (score >= 90) return 'Xuất sắc';
  if (score >= 80) return 'Rất tốt';
  if (score >= 65) return 'Tốt';
  if (score >= 45) return 'Khá';
  return 'Cần cải thiện';
}

function fallbackReviewSummary(bots: BotItem[]): SellerReviewSummary {
  const total = bots.reduce((sum, bot) => sum + bot.reviewCount, 0);
  const ratingTotal = bots.reduce((sum, bot) => sum + bot.rating * bot.reviewCount, 0);
  return {
    total,
    average: total > 0 ? Math.round((ratingTotal / total) * 10) / 10 : 0,
    distribution: [0, 0, 0, 0, 0],
  };
}

function contactHref(key: keyof BotContactInfo, value: string): string | undefined {
  if (/^https?:\/\//i.test(value)) return value;
  if (key === 'telegram') return `https://t.me/${value.replace(/^@/, '')}`;
  if (key === 'phone') return `tel:${value.replace(/[^\d+]/g, '')}`;
  if (key === 'zalo') return `https://zalo.me/${value.replace(/[^\d+]/g, '')}`;
  if (key === 'messenger') return `https://m.me/${value.replace(/^@/, '')}`;
  if (key === 'facebook') return `https://facebook.com/${value.replace(/^@/, '')}`;
  if (key === 'website') return /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return undefined;
}

function getEventLabel(event: SellerTrustEvent): string {
  if (event.type === 'tier_changed') {
    const from = typeof event.detail?.from === 'string' ? event.detail.from : '';
    const to = typeof event.detail?.to === 'string' ? event.detail.to : '';
    return from && to ? `Thay đổi hạng: ${from} → ${to}` : 'Cập nhật hạng seller';
  }
  return eventLabels[event.type] ?? 'Cập nhật hồ sơ uy tín';
}

function Stars({ value, size = 'h-4 w-4' }: { value: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value.toFixed(1)} trên 5 sao`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={`${size} ${index < Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
          aria-hidden
        />
      ))}
    </span>
  );
}

function SellerContactDialog({
  sellerName,
  contact,
  open,
  onClose,
}: {
  sellerName: string;
  contact: BotContactInfo;
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const entries = contactMeta
    .map((item) => ({ ...item, value: contact[item.key] }))
    .filter((item): item is typeof item & { value: string } => Boolean(item.value?.trim()));

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`Đã sao chép ${label}`);
    } catch {
      toast.error('Không thể sao chép thông tin liên hệ');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="seller-contact-title"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-foreground shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Liên hệ seller</p>
            <h2 id="seller-contact-title" className="mt-2 font-display text-xl font-bold tracking-tight">
              {sellerName}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Giao dịch diễn ra trực tiếp giữa hai bên ngoài thuebot.org.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            aria-label="Đóng cửa sổ liên hệ"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {entries.length > 0 ? (
          <div className="mt-6 space-y-2">
            {entries.map(({ key, label, icon: Icon, value }) => {
              const href = contactHref(key, value);
              return (
                <div key={key} className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
                  <span className="rounded-lg bg-brand/10 p-2 text-brand">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-muted-foreground">{label}</span>
                    <span className="block truncate text-sm font-semibold text-foreground">{value}</span>
                  </span>
                  {href ? (
                    <a
                      href={href}
                      target={key === 'phone' ? undefined : '_blank'}
                      rel={key === 'phone' ? undefined : 'noreferrer'}
                      className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-brand px-3 text-xs font-semibold text-brand-foreground transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      Mở <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void copy(value, label)}
                      className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-border px-3 text-xs font-semibold text-foreground transition hover:border-brand/50 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      Sao chép <Copy className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
            Seller chưa cung cấp thông tin liên hệ công khai.
          </div>
        )}
      </div>
    </div>
  );
}

function TrustCard({
  seller,
  bots,
  reviewSummary,
  events,
}: {
  seller: SellerProfile['user'];
  bots: BotItem[];
  reviewSummary: SellerReviewSummary;
  events: SellerTrustEvent[];
}) {
  const [showCriteria, setShowCriteria] = useState(false);
  const score = seller.trustScore ?? 0;
  const hasScore = score > 0;
  const contactCount = Object.values(seller.contact ?? {}).filter((value) => Boolean(value?.trim())).length;
  const signals = [
    { label: 'Xác minh cơ bản', value: `${seller.basicVerifiedCount}/${seller.basicVerifiedTotal}`, passed: seller.basicVerifiedCount > 0 },
    { label: 'Trạng thái', value: seller.isTrusted ? 'Trusted Seller' : seller.verificationState === 'under_review' ? 'Đang xem xét' : 'Chưa đủ điều kiện', passed: seller.isTrusted },
    { label: 'Đánh giá', value: reviewSummary.total > 0 ? `${reviewSummary.total} đánh giá` : 'Chưa đủ dữ liệu', passed: reviewSummary.total > 0 },
    { label: 'Bot hoạt động', value: bots.some((bot) => bot.status === 'online') ? 'Đang hoạt động' : 'Chưa có dữ liệu', passed: bots.some((bot) => bot.status === 'online') },
    { label: 'Liên hệ', value: contactCount > 0 ? `${contactCount} kênh công khai` : 'Chưa cung cấp', passed: contactCount > 0 },
  ];

  return (
    <section className="surface p-5" aria-labelledby="trust-card-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Hồ sơ uy tín</p>
          <h2 id="trust-card-title" className="mt-2 font-display text-xl font-bold tracking-tight">
            {hasScore ? 'Điểm uy tín' : 'Chưa đủ dữ liệu uy tín'}
          </h2>
        </div>
        <ShieldCheck className="h-5 w-5 text-brand" aria-hidden />
      </div>

      {hasScore ? (
        <div className="mt-5">
          <div className="flex items-end gap-2">
            <span className="font-display text-5xl font-bold tracking-tight">{score}</span>
            <span className="pb-1 text-sm text-muted-foreground">/100</span>
          </div>
          <p className="mt-1 text-sm font-semibold text-brand">{getTrustLabel(score)}</p>
          <Progress value={score} className="mt-4 h-2 bg-muted" aria-label={`Điểm uy tín ${score}/100`} />
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-brand/20 bg-brand/5 p-4">
          <div className="flex gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Seller chưa có đủ lịch sử hoạt động để thuebot.org tính điểm. Đây không phải là điểm 0.
            </p>
          </div>
        </div>
      )}

      <div className="mt-5 space-y-2.5 border-t border-border pt-4">
        {signals.map((signal) => (
          <div key={signal.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              {signal.passed ? <Check className="h-4 w-4 text-emerald-500" aria-hidden /> : <span className="h-4 w-4 rounded-full border border-border" aria-hidden />}
              {signal.label}
            </span>
            <span className={signal.passed ? 'font-medium text-foreground' : 'text-xs text-muted-foreground'}>{signal.value}</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setShowCriteria((current) => !current)}
        className="mt-5 inline-flex min-h-10 w-full items-center justify-between rounded-xl border border-border px-3 text-sm font-semibold text-foreground transition-colors hover:border-brand/50 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        aria-expanded={showCriteria}
      >
        <span>Điểm uy tín được tính thế nào?</span>
        {showCriteria ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
      </button>
      {showCriteria ? (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Điểm được tính từ lịch sử hoạt động, đánh giá, mức độ hoàn thiện hồ sơ, trạng thái xác minh và hoạt động của bot. Công thức chi tiết không công khai để hạn chế việc thao túng.
        </p>
      ) : null}

      <div className="mt-6 border-t border-border pt-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Lịch sử uy tín</h3>
          <History className="h-4 w-4 text-muted-foreground" aria-hidden />
        </div>
        {events.length > 0 ? (
          <ol className="relative mt-4 space-y-4 border-l border-border pl-4">
            {events.slice(0, 4).map((event) => (
              <li key={event.id} className="relative">
                <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-card bg-brand" aria-hidden />
                <p className="text-sm font-medium text-foreground">{getEventLabel(event)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(event.createdAt)}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Chưa có sự kiện lịch sử.</p>
        )}
      </div>
    </section>
  );
}

function SellerBotCard({
  bot,
  horizontal,
  onContact,
}: {
  bot: BotItem;
  horizontal?: boolean;
  onContact: (bot: BotItem) => void;
}) {
  const status = statusMeta[bot.status] ?? statusMeta.offline;
  return (
    <article className={`group overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-brand/40 ${horizontal ? 'md:flex' : ''}`}>
      <div className={`relative overflow-hidden bg-muted ${horizontal ? 'h-52 md:h-auto md:w-56 md:shrink-0' : 'h-48'}`}>
        <MediaImage src={bot.coverImage} fallbackSrc="/logo.svg" alt={bot.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
        <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-semibold text-foreground backdrop-blur-sm">
            <span className={`h-2 w-2 rounded-full ${status.className}`} aria-hidden />
            {status.label}
          </span>
          <span className="rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-semibold text-foreground backdrop-blur-sm">{bot.categoryName}</span>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">{bot.categoryName}</p>
            <h3 className="mt-2 line-clamp-2 font-display text-lg font-bold tracking-tight text-foreground">{bot.title}</h3>
          </div>
          <Bot className="mt-1 h-5 w-5 shrink-0 text-brand" aria-hidden />
        </div>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{bot.tagline}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-1.5 font-semibold text-foreground"><Stars value={bot.rating} size="h-3.5 w-3.5" /> {bot.rating.toFixed(1)} <span className="font-normal text-muted-foreground">({bot.reviewCount})</span></span>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Eye className="h-4 w-4" aria-hidden /> {formatNumber(bot.views)}</span>
        </div>
        <div className="mt-auto flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="block text-xs text-muted-foreground">Giá hiển thị</span>
            <strong className="mt-1 block font-display text-xl font-bold tracking-tight text-foreground">{formatPrice(bot)}</strong>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="icon" className="h-10 w-10 rounded-xl" aria-label={`Xem ${bot.title}`}>
              <Link href={`/bots/${encodeURIComponent(bot.id)}`}><ArrowUpRight aria-hidden /></Link>
            </Button>
            <Button type="button" onClick={() => onContact(bot)} className="h-10 rounded-xl bg-brand px-4 text-brand-foreground hover:bg-brand/90">
              Liên hệ seller
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function PostCard({ post }: { post: Post }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-brand/40">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-brand/10 px-2.5 py-1 font-semibold text-brand">{postTypeLabels[post.type] ?? post.type}</span>
        <span>{post.categoryName ?? post.category}</span>
        <span>·</span>
        <time dateTime={post.createdAt}>{formatDate(post.createdAt, 'short')}</time>
      </div>
      <Link href={`/posts/${encodeURIComponent(post.slug)}`} className="mt-3 block font-display text-lg font-bold tracking-tight text-foreground hover:text-brand">
        {post.title}
      </Link>
      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{post.excerpt}</p>
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" aria-hidden /> {formatNumber(post.views)}</span>
        <span className="inline-flex items-center gap-1.5"><ThumbsUp className="h-3.5 w-3.5" aria-hidden /> {formatNumber(post.reactionCount)}</span>
        <span className="inline-flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" aria-hidden /> {formatNumber(post.commentsCount)}</span>
      </div>
    </article>
  );
}

function ReviewCard({ review }: { review: SellerReview }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <MediaImage src={review.userAvatar} fallbackSrc="/avt.png" alt="" className="h-10 w-10 rounded-full border border-border object-cover" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{review.userName}</p>
            <time dateTime={review.date} className="text-xs text-muted-foreground">{formatDate(review.date, 'short')}</time>
          </div>
        </div>
        <Stars value={review.rating} size="h-3.5 w-3.5" />
      </div>
      <p className="mt-4 text-sm leading-relaxed text-foreground">{review.comment || 'Người dùng không để lại nội dung.'}</p>
      <Link href={`/bots/${encodeURIComponent(review.botId)}`} className="mt-4 inline-flex max-w-full items-center gap-1.5 text-xs font-semibold text-brand hover:underline">
        <Bot className="h-3.5 w-3.5" aria-hidden /> <span className="truncate">Đánh giá cho {review.botTitle}</span> <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
      </Link>
    </article>
  );
}

function ReviewsTab({ reviews, summary }: { reviews: SellerReview[]; summary: SellerReviewSummary }) {
  return (
    <div className="space-y-5">
      <section className="grid gap-6 rounded-2xl border border-border bg-card p-5 sm:grid-cols-[180px_minmax(0,1fr)] sm:p-6">
        <div className="flex flex-col justify-center sm:border-r sm:border-border sm:pr-6">
          <p className="eyebrow">Tổng đánh giá</p>
          {summary.total > 0 ? (
            <>
              <div className="mt-2 flex items-end gap-2"><strong className="font-display text-4xl font-bold tracking-tight">{summary.average.toFixed(1)}</strong><span className="pb-1 text-sm text-muted-foreground">/5</span></div>
              <Stars value={summary.average} />
              <p className="mt-2 text-sm text-muted-foreground">{formatNumber(summary.total)} đánh giá trên các bot</p>
            </>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Chưa có đánh giá đủ dữ liệu để hiển thị.</p>
          )}
        </div>
        <div className="space-y-2.5">
          {[5, 4, 3, 2, 1].map((rating) => {
            const count = summary.distribution[rating - 1] ?? 0;
            const width = summary.total > 0 ? (count / summary.total) * 100 : 0;
            return (
              <div key={rating} className="grid grid-cols-[32px_minmax(0,1fr)_34px] items-center gap-3 text-xs">
                <span className="font-semibold text-muted-foreground">{rating} ★</span>
                <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-amber-400" style={{ width: `${width}%` }} /></div>
                <span className="text-right text-muted-foreground">{count}</span>
              </div>
            );
          })}
        </div>
      </section>
      {reviews.length > 0 ? (
        <div className="space-y-3">
          {reviews.map((review) => <ReviewCard key={review.id} review={review} />)}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <Star className="mx-auto h-8 w-8 text-brand" aria-hidden />
          <h3 className="mt-3 font-semibold">Chưa có đánh giá</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Đánh giá sẽ xuất hiện ở đây sau khi người dùng trải nghiệm bot của seller.</p>
        </div>
      )}
    </div>
  );
}

function AboutTab({ seller, bots, contact }: { seller: SellerProfile['user']; bots: BotItem[]; contact: BotContactInfo }) {
  const categories = Array.from(new Set(bots.map((bot) => bot.categoryName).filter(Boolean)));
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl border border-border bg-card p-6">
        <p className="eyebrow">Giới thiệu</p>
        <h2 className="mt-2 font-display text-2xl font-bold tracking-tight">Về {seller.name}</h2>
        <p className="mt-4 whitespace-pre-line text-sm leading-7 text-muted-foreground">{seller.bio || 'Seller chưa thêm phần giới thiệu.'}</p>
      </section>
      <section className="rounded-2xl border border-border bg-card p-6">
        <p className="eyebrow">Thông tin công khai</p>
        <dl className="mt-5 space-y-4 text-sm">
          <div className="flex items-start justify-between gap-4 border-b border-border pb-4"><dt className="text-muted-foreground">Tham gia</dt><dd className="font-semibold text-foreground">{formatDate(seller.joinedDate)}</dd></div>
          <div className="flex items-start justify-between gap-4 border-b border-border pb-4"><dt className="text-muted-foreground">Chuyên môn</dt><dd className="max-w-[65%] text-right font-semibold text-foreground">{categories.length > 0 ? categories.join(' · ') : 'Chưa cập nhật'}</dd></div>
          <div className="flex items-start justify-between gap-4"><dt className="text-muted-foreground">Kênh liên hệ</dt><dd className="font-semibold text-foreground">{Object.values(contact).filter(Boolean).length || 'Chưa có'} </dd></div>
        </dl>
      </section>
    </div>
  );
}

function LoadingState() {
  return <div className="mx-auto max-w-[1200px] space-y-5 px-4 py-10 sm:px-6 lg:px-8"><div className="h-64 animate-pulse rounded-2xl bg-muted" /><div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]"><div className="h-96 animate-pulse rounded-2xl bg-muted" /><div className="h-80 animate-pulse rounded-2xl bg-muted" /></div></div>;
}

export function SellerProfilePage({ slug }: { slug: string }) {
  const { user, isAuthenticated, updateProfile } = useRole();
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<SellerTab>('bots');
  const [contactBot, setContactBot] = useState<BotItem | null>(null);
  const [contactSellerOpen, setContactSellerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchWithTimeout(`/api/sellers/${encodeURIComponent(slug)}`, { credentials: 'include' }, 20_000);
      const json = await response.json().catch(() => null) as { success?: boolean; data?: SellerProfile; error?: string } | null;
      if (!response.ok || !json?.success || !json.data) {
        setNotFound(true);
        return;
      }
      const nextProfile = json.data;
      setProfile(nextProfile);
      setFollowerCount(nextProfile.user.followerCount ?? 0);
      setIsFollowing(Boolean(nextProfile.user.isFollowing));
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { void load(); }, [load]);

  const toggleFollow = async () => {
    if (followBusy) return;
    if (isAuthenticated !== true) {
      toast.info('Đăng nhập để theo dõi seller này.');
      return;
    }
    setFollowBusy(true);
    try {
      const response = await fetchWithTimeout(`/api/sellers/${encodeURIComponent(slug)}/follow`, {
        method: isFollowing ? 'DELETE' : 'PUT',
        credentials: 'include',
      }, 20_000);
      const json = await response.json().catch(() => null) as { success?: boolean; data?: { followerCount?: number; isFollowing?: boolean }; error?: string } | null;
      if (!response.ok || !json?.success || !json.data) throw new Error(json?.error || 'Không thể cập nhật theo dõi');
      setFollowerCount(json.data.followerCount ?? followerCount);
      setIsFollowing(Boolean(json.data.isFollowing));
      toast.success(json.data.isFollowing ? 'Đã theo dõi seller' : 'Đã bỏ theo dõi seller');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể cập nhật theo dõi');
    } finally {
      setFollowBusy(false);
    }
  };

  const reviewSummary = useMemo(() => profile?.reviewSummary ?? fallbackReviewSummary(profile?.bots ?? []), [profile]);

  if (loading) return <LoadingState />;
  if (notFound || !profile) {
    return <div className="flex min-h-[60vh] items-center justify-center px-4 text-center"><div><UserRound className="mx-auto h-10 w-10 text-brand" aria-hidden /><h1 className="mt-4 font-display text-2xl font-bold">Không tìm thấy seller</h1><p className="mt-2 text-sm text-muted-foreground">Hồ sơ không tồn tại hoặc đã được gỡ khỏi thuebot.org.</p><Button asChild className="mt-5 rounded-xl bg-brand text-brand-foreground hover:bg-brand/90"><Link href="/bots">Về chợ bot</Link></Button></div></div>;
  }

  const seller = profile.user;
  const contact = seller.contact ?? {};
  const isOwner = isAuthenticated === true && user.id === seller.id;
  const hasTrustBadge = seller.isTrusted;
  const displayRating = reviewSummary.total > 0 ? reviewSummary.average : null;
  const onlineBotCount = profile.bots.filter((bot) => bot.status === 'online').length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1200px] space-y-5 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Link href="/bots" className="hover:text-brand">Chợ bot</Link><span>/</span><span className="truncate text-foreground">{seller.name}</span></div>

        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex flex-col gap-7 p-6 md:p-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 gap-5 sm:gap-6">
              <MediaImage src={seller.avatar} fallbackSrc="/avt.png" alt={seller.name} className="h-20 w-20 shrink-0 rounded-2xl border border-border object-cover sm:h-24 sm:w-24" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-bold tracking-tight sm:text-[28px]">{seller.name}</h1>
                  {hasTrustBadge ? <TrustedBadge size="lg" info={{ isTrusted: true, trustScore: seller.trustScore, rating: displayRating, basicVerifiedCount: seller.basicVerifiedCount, basicVerifiedTotal: seller.basicVerifiedTotal, trustedAt: seller.trustedAt }} /> : <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">Seller mới</span>}
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{seller.bio || 'Seller bot và giải pháp tự động hóa trên thuebot.org.'}</p>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                  {displayRating !== null ? <span className="inline-flex items-center gap-1.5 font-semibold text-foreground"><Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden /> {displayRating.toFixed(1)} <span className="font-normal text-muted-foreground">({formatNumber(reviewSummary.total)})</span></span> : <span className="inline-flex items-center gap-1.5"><Star className="h-4 w-4 text-muted-foreground/50" aria-hidden /> Chưa có đánh giá</span>}
                  <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-brand" aria-hidden /> Thành viên từ {formatDate(seller.joinedDate, 'short')}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground"><Check className="h-3.5 w-3.5 text-brand" aria-hidden /> Xác minh cơ bản {seller.basicVerifiedCount}/{seller.basicVerifiedTotal}</span>
                  {contactMeta.filter((item) => Boolean(contact[item.key])).slice(0, 4).map((item) => <span key={item.key} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground"><item.icon className="h-3.5 w-3.5 text-brand" aria-hidden /> {item.label}</span>)}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:w-56 lg:flex-col">
              <Button type="button" onClick={() => setContactSellerOpen(true)} className="h-11 rounded-xl bg-brand px-5 text-brand-foreground hover:bg-brand/90"><MessageCircle className="h-4 w-4" aria-hidden /> Liên hệ seller</Button>
              <Button type="button" variant="outline" onClick={() => void toggleFollow()} disabled={followBusy || isOwner} className="h-11 rounded-xl"><Heart className={isFollowing ? 'fill-brand text-brand' : ''} aria-hidden /> {followBusy ? 'Đang cập nhật…' : isFollowing ? 'Đang theo dõi' : 'Theo dõi'}</Button>
              {isOwner ? <Button type="button" variant="ghost" onClick={() => setEditOpen(true)} className="h-10 rounded-xl text-muted-foreground"><PencilLine aria-hidden /> Sửa hồ sơ</Button> : null}
            </div>
          </div>
          <div className="grid grid-cols-2 border-t border-border sm:grid-cols-4">
            <div className="border-r border-border px-5 py-4 sm:px-6"><p className="font-display text-xl font-bold">{profile.bots.length}</p><p className="mt-1 text-xs text-muted-foreground">Bot đang bán</p></div>
            <div className="border-b border-border px-5 py-4 sm:border-b-0 sm:border-r sm:px-6"><p className="font-display text-xl font-bold">{displayRating !== null ? displayRating.toFixed(1) : '—'}</p><p className="mt-1 text-xs text-muted-foreground">Đánh giá</p></div>
            <div className="border-r border-border px-5 py-4 sm:px-6"><p className="font-display text-xl font-bold">{formatNumber(followerCount)}</p><p className="mt-1 text-xs text-muted-foreground">Người theo dõi</p></div>
            <div className="px-5 py-4 sm:px-6"><p className="font-display text-xl font-bold">{onlineBotCount}</p><p className="mt-1 text-xs text-muted-foreground">Bot đang hoạt động</p></div>
          </div>
        </section>

        <nav className="sticky top-0 z-20 -mx-4 border-y border-border bg-background/95 px-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8" aria-label="Nội dung seller">
          <div className="flex gap-1 overflow-x-auto">
            {(Object.keys(tabLabels) as SellerTab[]).map((item) => {
              const active = tab === item;
              const count = item === 'bots' ? profile.bots.length : item === 'reviews' ? reviewSummary.total : item === 'posts' ? profile.posts.length : undefined;
              return <button key={item} type="button" role="tab" aria-selected={active} onClick={() => setTab(item)} className={`inline-flex min-h-14 shrink-0 items-center gap-1.5 border-b-2 px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${active ? 'border-brand text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{tabLabels[item]}{count !== undefined ? <span className="text-xs font-normal text-muted-foreground">{count}</span> : null}</button>;
            })}
          </div>
        </nav>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <main className="min-w-0">
            {tab === 'bots' ? <section aria-labelledby="seller-bots-title"><div className="mb-5 flex items-end justify-between gap-4"><div><p className="eyebrow">Danh mục sản phẩm</p><h2 id="seller-bots-title" className="mt-2 font-display text-2xl font-bold tracking-tight">Bot đang cho thuê</h2></div><span className="text-sm text-muted-foreground">{profile.bots.length} bot</span></div>{profile.bots.length > 0 ? profile.bots.length === 1 ? <SellerBotCard bot={profile.bots[0]} horizontal onContact={setContactBot} /> : <div className="grid gap-5 md:grid-cols-2">{profile.bots.map((bot) => <SellerBotCard key={bot.id} bot={bot} onContact={setContactBot} />)}</div> : <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center"><Bot className="mx-auto h-8 w-8 text-brand" aria-hidden /><p className="mt-3 font-semibold">Seller chưa đăng bot</p><p className="mt-1 text-sm text-muted-foreground">Các bot mới sẽ xuất hiện tại đây.</p></div>}</section> : null}
            {tab === 'reviews' ? <ReviewsTab reviews={profile.reviews ?? []} summary={reviewSummary} /> : null}
            {tab === 'posts' ? <section aria-labelledby="seller-posts-title"><div className="mb-5"><p className="eyebrow">Nội dung từ seller</p><h2 id="seller-posts-title" className="mt-2 font-display text-2xl font-bold tracking-tight">Bài viết</h2></div>{profile.posts.length > 0 ? <div className="space-y-3">{profile.posts.map((post) => <PostCard key={post.id} post={post} />)}</div> : <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center"><FileText className="mx-auto h-8 w-8 text-brand" aria-hidden /><p className="mt-3 font-semibold">Chưa có bài viết</p><p className="mt-1 text-sm text-muted-foreground">Seller chưa đăng nội dung nào.</p></div>}</section> : null}
            {tab === 'about' ? <AboutTab seller={seller} bots={profile.bots} contact={contact} /> : null}
          </main>

          <aside className="space-y-5 lg:sticky lg:top-[76px]">
            <TrustCard seller={seller} bots={profile.bots} reviewSummary={reviewSummary} events={profile.trustEvents ?? []} />
            <section className="surface p-5" aria-labelledby="contact-card-title">
              <div className="flex items-center justify-between gap-3"><div><p className="eyebrow">Kênh trực tiếp</p><h2 id="contact-card-title" className="mt-2 font-display text-xl font-bold tracking-tight">Liên hệ seller</h2></div><MessageCircle className="h-5 w-5 text-brand" aria-hidden /></div>
              {Object.values(contact).filter(Boolean).length > 0 ? <div className="mt-5 space-y-2">{contactMeta.filter((item) => Boolean(contact[item.key])).slice(0, 3).map((item) => { const Icon = item.icon; return <button key={item.key} type="button" onClick={() => setContactSellerOpen(true)} className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-border bg-background px-3 text-left transition-colors hover:border-brand/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"><Icon className="h-4 w-4 text-brand" aria-hidden /><span className="min-w-0 flex-1"><span className="block text-xs text-muted-foreground">{item.label}</span><span className="block truncate text-sm font-semibold text-foreground">{contact[item.key]}</span></span><ExternalLink className="h-4 w-4 text-muted-foreground" aria-hidden /></button>; })}</div> : <p className="mt-5 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Seller chưa cung cấp kênh liên hệ công khai.</p>}
              <Button type="button" onClick={() => setContactSellerOpen(true)} className="mt-4 h-11 w-full rounded-xl bg-brand text-brand-foreground hover:bg-brand/90">Mở thông tin liên hệ</Button>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Hãy kiểm tra kỹ bot và thỏa thuận rõ điều kiện trước khi thanh toán.</p>
            </section>
            <section className="rounded-2xl border border-border bg-muted/40 p-5"><div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden /><p className="text-xs leading-relaxed text-muted-foreground">Tích xanh và điểm uy tín là tín hiệu tham khảo, không phải bảo đảm tuyệt đối cho giao dịch.</p></div></section>
          </aside>
        </div>
      </div>

      <ContactModal bot={contactBot} isOpen={contactBot !== null} onClose={() => setContactBot(null)} />
      <SellerContactDialog sellerName={seller.name} contact={contact} open={contactSellerOpen} onClose={() => setContactSellerOpen(false)} />
      {isOwner ? <EditProfileModal isOpen={editOpen} onClose={() => setEditOpen(false)} bio={seller.bio ?? ''} contact={contact} onSave={async (bio, nextContact) => { await updateProfile(bio, nextContact); await load(); }} /> : null}
    </div>
  );
}
