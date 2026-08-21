'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Gauge,
  History,
  MinusCircle,
  Search,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type {
  SellerLookupResponse,
  SellerLookupResult,
  SellerLookupVerificationCheck,
} from '@shared/types';
import { api } from '@/lib/api-client';
import { useRole } from '@/context/RoleContext';
import { TrustedBadge } from '@/components/trust/TrustedBadge';
import { MediaImage } from '@/components/media/MediaImage';
import { resolveMediaUrl } from '@/lib/media';

const RECENT_STORAGE_KEY = 'thuebot:check-seller:recent:v1';

type RecentCheck = {
  query: string;
  checkedAt: string;
  result: SellerLookupResult;
};

type TrustPresentation = {
  label: string;
  description: string;
  tone: 'limited' | 'caution' | 'positive' | 'neutral';
};

function formatDate(value: string | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatJoinedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
  if (days === 0) return 'Hôm nay';
  if (days === 1) return 'Hôm qua';
  if (days < 30) return `${days} ngày trước`;
  return formatDate(value);
}

function formatNumber(value: number): string {
  return value.toLocaleString('vi-VN');
}

function getTierLabel(result: SellerLookupResult): string {
  if (result.isTrusted) return 'Trusted Seller';
  if (result.tier === 'top') return 'Top seller';
  if (result.tier === 'active') return 'Seller đang hoạt động';
  if (result.tier === 'trusted') return 'Seller được xác minh';
  return 'Seller mới';
}

function getTrustPresentation(result: SellerLookupResult): TrustPresentation {
  if (result.riskStatus === 'caution') {
    return {
      label: 'Cần thận trọng',
      description: 'Trạng thái xác minh đang cần được xem xét thêm trước khi giao dịch.',
      tone: 'caution',
    };
  }

  const isBuildingTrust =
    result.riskStatus === 'limited' ||
    (result.tier === 'new' && result.reviewCount === 0 && result.botCount === 0);

  if (isBuildingTrust) {
    return {
      label: 'Đang xây dựng uy tín',
      description:
        'Seller mới tham gia và chưa có đủ lịch sử để đưa ra đánh giá đầy đủ.',
      tone: 'limited',
    };
  }

  if (result.trustScore >= 85) {
    return {
      label: 'Rất tốt',
      description: 'Hồ sơ có lịch sử hoạt động và tín hiệu uy tín tốt.',
      tone: 'positive',
    };
  }
  if (result.trustScore >= 70) {
    return {
      label: 'Tốt',
      description: 'Hồ sơ đang có nền tảng uy tín ổn định.',
      tone: 'positive',
    };
  }
  if (result.trustScore >= 50) {
    return {
      label: 'Khá',
      description: 'Hãy xem thêm review và thông tin xác minh trước khi liên hệ.',
      tone: 'neutral',
    };
  }

  return {
    label: 'Cần thêm thông tin',
    description: 'Nên kiểm tra kỹ các tín hiệu xác minh và trao đổi trước khi thuê.',
    tone: 'neutral',
  };
}

function getMatchLabel(result: SellerLookupResult): string {
  const labels: Record<SellerLookupResult['matchType'], string> = {
    telegram: 'Tìm thấy qua Telegram',
    website: 'Tìm thấy qua website',
    zalo: 'Tìm thấy qua Zalo',
    phone: 'Tìm thấy qua số điện thoại',
    messenger: 'Tìm thấy qua Messenger',
    facebook: 'Tìm thấy qua Facebook',
    contact: 'Tìm thấy qua thông tin liên hệ',
    slug: 'Tìm thấy qua đường dẫn seller',
    name: 'Tìm thấy qua tên seller',
    id: 'Tìm thấy qua mã hồ sơ',
  };
  return labels[result.matchType];
}

function Avatar({
  src,
  name,
  className,
}: {
  src: string;
  name: string;
  className: string;
}) {
  const [failed, setFailed] = useState(false);
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const resolvedSrc = resolveMediaUrl(src);

  if (!resolvedSrc || failed) {
    return (
      <span
        className={`${className} inline-flex shrink-0 items-center justify-center bg-[#1677FF]/10 font-display font-bold text-[#1677FF]`}
        aria-hidden="true"
      >
        {initial}
      </span>
    );
  }

  if (/^\/api\/(?:media|resources\/files\/[^/]+\/view)$/i.test(resolvedSrc)) {
    return (
      <MediaImage
        src={resolvedSrc}
        alt=""
        fallbackSrc="/favicon-192.png"
        className={`${className} shrink-0 object-cover`}
      />
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt=""
      className={`${className} shrink-0 object-cover`}
      onError={() => setFailed(true)}
    />
  );
}

function CheckStatusIcon({ status }: { status: SellerLookupVerificationCheck['status'] }) {
  if (status === 'verified') return <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />;
  if (status === 'pending') return <Clock3 className="h-4 w-4 text-amber-500" aria-hidden />;
  if (status === 'revoked') return <XCircle className="h-4 w-4 text-red-500" aria-hidden />;
  return <Circle className="h-4 w-4 text-muted-foreground/60" aria-hidden />;
}

function getCheckStatusLabel(status: SellerLookupVerificationCheck['status']): string {
  if (status === 'verified') return 'Đã xác minh';
  if (status === 'pending') return 'Đang xét duyệt';
  if (status === 'revoked') return 'Đã thu hồi';
  return 'Chưa xác minh';
}

function VerificationGrid({ checks }: { checks: SellerLookupVerificationCheck[] }) {
  return (
    <section aria-labelledby="verification-title" className="mt-7">
      <div className="flex items-center justify-between gap-3">
        <h4 id="verification-title" className="eyebrow text-foreground/65">
          Xác minh thông tin
        </h4>
        <span className="text-xs font-semibold text-muted-foreground">{checks.filter((check) => check.status === 'verified').length}/{checks.length}</span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {checks.map((check) => (
          <div
            key={check.kind}
            className="flex min-h-11 items-center gap-2.5 rounded-xl border border-border bg-background/70 px-3 py-2.5"
          >
            <CheckStatusIcon status={check.status} />
            <span className="min-w-0 flex-1 text-xs font-medium text-foreground">{check.label}</span>
            <span className="text-[11px] text-muted-foreground">{getCheckStatusLabel(check.status)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function TrustSummary({ result }: { result: SellerLookupResult }) {
  const presentation = getTrustPresentation(result);
  const score = Math.max(0, Math.min(100, result.trustScore));
  const progressColor =
    presentation.tone === 'caution'
      ? 'bg-red-500'
      : presentation.tone === 'limited'
        ? 'bg-amber-400'
        : 'bg-[#1677FF]';

  return (
    <div className="border-t border-border bg-muted/20 p-5 sm:p-7 lg:border-l lg:border-t-0">
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="eyebrow">Trust Score</p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-display text-5xl font-bold tracking-tight text-foreground">{score}</span>
            <span className="text-sm text-muted-foreground">/100</span>
          </div>
          <p
            className={`mt-1 text-sm font-bold ${presentation.tone === 'caution' ? 'text-red-600 dark:text-red-400' : presentation.tone === 'limited' ? 'text-amber-700 dark:text-amber-300' : 'text-[#1677FF]'}`}
          >
            {presentation.label}
          </p>
        </div>
        {result.isTrusted ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1677FF]/10 px-2.5 py-1.5 text-[11px] font-bold text-[#1677FF]">
            <TrustedBadge size="sm" interactive={false} info={{ isTrusted: true, trustScore: score }} />
            Trusted Seller
          </span>
        ) : null}
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-border" aria-label={`Trust Score ${score}/100`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score}>
        <div className={`h-full rounded-full transition-[width] duration-500 ${progressColor}`} style={{ width: `${score}%` }} />
      </div>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{presentation.description}</p>

      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4">
        <div className="bg-card p-3">
          <span className="block text-[11px] text-muted-foreground">Reviews</span>
          <strong className="mt-1 block text-base text-foreground">{result.reviewCount ? formatNumber(result.reviewCount) : '—'}</strong>
        </div>
        <div className="bg-card p-3">
          <span className="block text-[11px] text-muted-foreground">Bot</span>
          <strong className="mt-1 block text-base text-foreground">{formatNumber(result.botCount)}</strong>
        </div>
        <div className="bg-card p-3">
          <span className="block text-[11px] text-muted-foreground">Xác minh</span>
          <strong className="mt-1 block text-base text-foreground">{result.basicVerifiedCount}/{result.basicVerifiedTotal}</strong>
        </div>
        <div className="bg-card p-3">
          <span className="block text-[11px] text-muted-foreground">Tham gia</span>
          <strong className="mt-1 block truncate text-base text-foreground">{formatJoinedDate(result.joinedDate)}</strong>
        </div>
      </div>
    </div>
  );
}

function RiskBanner({ result }: { result: SellerLookupResult }) {
  const isCaution = result.riskStatus === 'caution';
  const isLimited = result.riskStatus === 'limited';
  const Icon = isCaution ? TriangleAlert : isLimited ? MinusCircle : CheckCircle2;
  const title = isCaution
    ? 'Cần thận trọng'
    : isLimited
      ? 'Chưa đủ dữ liệu cảnh báo'
      : 'Chưa ghi nhận cảnh báo nghiêm trọng';
  const className = isCaution
    ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/25 dark:text-red-200'
    : isLimited
      ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-200'
      : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-200';

  return (
    <div className={`flex items-start gap-3 rounded-2xl border p-4 ${className}`} role="status">
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div>
        <p className="text-sm font-bold">{title}</p>
        <p className="mt-1 text-xs leading-relaxed opacity-85">{result.riskMessage}</p>
      </div>
    </div>
  );
}

function SearchResultCard({ result }: { result: SellerLookupResult }) {
  const matchTitle = result.exactMatch ? 'Khớp chính xác' : 'Có thể khớp';
  const matchDescription = result.matchType === 'zalo'
    ? 'Thông tin bạn nhập khớp với thông tin Zalo seller đã công khai trên thuebot.org.'
    : `${getMatchLabel(result)} trong hồ sơ seller công khai.`;
  const profilePath = result.profilePath;

  return (
    <article className="overflow-hidden rounded-[24px] border border-border bg-card">
      <div className="border-b border-border p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="eyebrow">Kết quả kiểm tra</p>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${result.exactMatch ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/10 text-amber-800 dark:text-amber-300'}`}>
            {result.exactMatch ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Search className="h-3.5 w-3.5" aria-hidden />}
            {matchTitle}
          </span>
        </div>

        <div className="mt-6 flex items-start gap-4">
          <Avatar src={result.avatar} name={result.shopName} className="h-16 w-16 rounded-2xl" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">{result.shopName}</h2>
              {result.isTrusted ? <TrustedBadge size="md" info={{ isTrusted: true, trustScore: result.trustScore, rating: result.rating }} /> : null}
            </div>
            <p className="mt-1 text-sm font-medium text-muted-foreground">{result.slug ? `@${result.slug.replace(/^@/, '')}` : result.name}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground/75">{getTierLabel(result)}</span>
              <span aria-hidden>·</span>
              <span>{formatJoinedDate(result.joinedDate)}</span>
            </div>
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#1677FF]" title={matchDescription}>
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              {getMatchLabel(result)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)]">
        <div className="p-5 sm:p-7">
          <p className="eyebrow text-foreground/65">Danh tính seller</p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Hồ sơ công khai gồm các thông tin seller đã cung cấp và những trạng thái xác minh hiện có.
          </p>
          <VerificationGrid checks={result.verificationChecks} />
        </div>
        <TrustSummary result={result} />
      </div>

      <div className="space-y-4 border-t border-border p-5 sm:p-7">
        <RiskBanner result={result} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-relaxed text-muted-foreground">Trust Score là tín hiệu tham khảo, không phải bảo đảm tuyệt đối cho giao dịch bên ngoài nền tảng.</p>
          <div className="flex flex-wrap gap-2">
            <Link href={profilePath} className="btn-brand min-h-11 px-4 text-xs">
              Xem hồ sơ seller
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
            {result.botCount > 0 ? (
              <Link href={`${profilePath}#bots`} className="btn-outline min-h-11 px-4 text-xs">
                Xem bot đang đăng
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function PossibleMatchCard({ result }: { result: SellerLookupResult }) {
  const presentation = getTrustPresentation(result);

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar src={result.avatar} name={result.shopName} className="h-12 w-12 rounded-xl" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold text-foreground">{result.shopName}</h3>
            {result.isTrusted ? <TrustedBadge size="sm" info={{ isTrusted: true, trustScore: result.trustScore }} /> : null}
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">{getMatchLabel(result)} · {presentation.label}</p>
        </div>
      </div>
      <Link href={result.profilePath} className="btn-outline min-h-11 shrink-0 px-4 text-xs">
        Xem hồ sơ
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </article>
  );
}

function HowToReadReport() {
  const items = [
    {
      icon: ShieldCheck,
      title: 'Xác minh',
      text: 'Cho biết seller đã xác minh những thông tin nào và trạng thái hiện tại của từng mục.',
      tone: 'text-[#1677FF] bg-[#1677FF]/10',
    },
    {
      icon: Gauge,
      title: 'Trust Score',
      text: 'Tổng hợp lịch sử hoạt động, review và các tín hiệu uy tín đang có trong hệ thống.',
      tone: 'text-emerald-600 bg-emerald-500/10 dark:text-emerald-400',
    },
    {
      icon: AlertTriangle,
      title: 'Cảnh báo',
      text: 'Tách riêng tín hiệu rủi ro và trạng thái thiếu dữ liệu để bạn không hiểu nhầm điểm thấp.',
      tone: 'text-amber-700 bg-amber-500/10 dark:text-amber-300',
    },
  ];

  return (
    <section aria-labelledby="how-to-read-title" className="mt-14">
      <div className="max-w-2xl">
        <p className="eyebrow">Trust Check</p>
        <h2 id="how-to-read-title" className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Cách hiểu kết quả kiểm tra</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Mỗi lớp thông tin trả lời một câu hỏi khác nhau trước khi bạn mở kênh liên hệ với seller.</p>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="rounded-2xl border border-border bg-card p-5">
              <span className={`inline-flex rounded-xl p-2.5 ${item.tone}`}><Icon className="h-5 w-5" aria-hidden /></span>
              <h3 className="mt-5 font-display text-lg font-bold text-foreground">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RecentChecks({ checks, onSelect, onClear }: { checks: RecentCheck[]; onSelect: (query: string) => void; onClear: () => void }) {
  if (checks.length === 0) return null;

  return (
    <section aria-labelledby="recent-checks-title" className="mt-14">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Cá nhân</p>
          <h2 id="recent-checks-title" className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground">Gần đây bạn đã kiểm tra</h2>
        </div>
        <button type="button" onClick={onClear} className="min-h-11 rounded-lg px-3 text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677FF]">Xóa lịch sử</button>
      </div>
      <div className="mt-5 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {checks.map((item) => {
          const presentation = getTrustPresentation(item.result);
          return (
            <button key={`${item.result.id}-${item.checkedAt}`} type="button" onClick={() => onSelect(item.query)} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1677FF]">
              <Avatar src={item.result.avatar} name={item.result.shopName} className="h-9 w-9 rounded-lg" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">{item.query}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.result.shopName} · {presentation.label}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function EmptyState({ searched, onReset }: { searched: boolean; onReset?: () => void }) {
  return (
    <div className="rounded-[24px] border border-dashed border-[#1677FF]/30 bg-[#1677FF]/[0.035] p-8 text-center sm:p-12">
      {searched ? (
        <Search className="mx-auto h-8 w-8 text-[#1677FF]" aria-hidden />
      ) : (
        <img src="/favicon.svg" alt="thuebot.org" className="mx-auto h-12 w-12" />
      )}
      <h2 className="mt-5 font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
        {searched ? 'Không tìm thấy seller này trên thuebot.org' : 'Bắt đầu bằng một hồ sơ seller'}
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
        {searched
          ? 'Điều này không có nghĩa seller không uy tín — hiện chỉ là chưa có hồ sơ phù hợp trong hệ thống.'
          : 'Nhập Telegram, URL, tên shop hoặc số điện thoại để xem Trust Report trước khi liên hệ.'}
      </p>
      {searched ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={onReset} className="btn-outline min-h-11 px-4 text-xs">Thử từ khóa khác</button>
          <Link href="/posts/canh-bao" className="btn-outline min-h-11 px-4 text-xs">Xem cảnh báo cộng đồng</Link>
        </div>
      ) : (
        <p className="mt-5 text-xs font-medium text-muted-foreground">Ví dụ: <span className="text-foreground">@seller · t.me/seller · tên shop · 09xx...</span></p>
      )}
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-[24px] border border-border bg-card" role="status" aria-label="Đang kiểm tra seller">
      <div className="h-36 border-b border-border bg-muted/60 p-6"><div className="h-3 w-32 rounded bg-border" /><div className="mt-6 h-8 w-64 rounded bg-border" /></div>
      <div className="grid lg:grid-cols-2">
        <div className="space-y-4 p-7"><div className="h-3 w-28 rounded bg-border" /><div className="h-5 w-3/4 rounded bg-border" /><div className="h-24 rounded-2xl bg-muted" /></div>
        <div className="space-y-5 border-t border-border p-7 lg:border-l lg:border-t-0"><div className="h-3 w-24 rounded bg-border" /><div className="h-16 w-32 rounded bg-border" /><div className="h-2 rounded-full bg-border" /><div className="h-20 rounded-2xl bg-muted" /></div>
      </div>
    </div>
  );
}

export default function CheckSellerPage() {
  const router = useRouter();
  const { isAuthenticated } = useRole();
  const [input, setInput] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [report, setReport] = useState<SellerLookupResponse | null>(null);
  const [recentChecks, setRecentChecks] = useState<RecentCheck[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialQueryLoaded = useRef(false);

  const runLookup = useCallback(async (value: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<SellerLookupResponse>(`/api/sellers/lookup?query=${encodeURIComponent(value)}`);
      setReport(data);
      setActiveQuery(value);
    } catch (lookupError) {
      setReport(null);
      setError(lookupError instanceof Error ? lookupError.message : 'Không thể kiểm tra seller lúc này.');
      setActiveQuery(value);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialQueryLoaded.current) return;
    initialQueryLoaded.current = true;
    const query = new URLSearchParams(window.location.search).get('query')?.trim() ?? '';
    if (query) {
      setInput(query);
      void runLookup(query);
    }
  }, [runLookup]);

  useEffect(() => {
    if (isAuthenticated !== true) {
      if (isAuthenticated === false) setRecentChecks([]);
      return;
    }
    try {
      const stored = JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY) ?? '[]') as RecentCheck[];
      setRecentChecks(Array.isArray(stored) ? stored.slice(0, 5) : []);
    } catch {
      setRecentChecks([]);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated !== true || !report?.matches[0]) return;
    const item: RecentCheck = {
      query: report.query,
      checkedAt: new Date().toISOString(),
      result: report.matches[0],
    };
    try {
      const stored = JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY) ?? '[]') as RecentCheck[];
      const next = [item, ...(Array.isArray(stored) ? stored : [])]
        .filter((entry, index, entries) => entries.findIndex((candidate) => candidate.result?.id === entry.result?.id) === index)
        .slice(0, 5);
      localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
      setRecentChecks(next);
    } catch {
      // localStorage can be unavailable in private browsing; the report still works normally.
    }
  }, [isAuthenticated, report]);

  const exactMatches = useMemo(() => report?.matches.filter((match) => match.exactMatch) ?? [], [report]);
  const possibleMatches = useMemo(() => report?.matches.filter((match) => !match.exactMatch) ?? [], [report]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = input.trim();
    if (!value) {
      setError('Nhập username, URL, tên shop hoặc số điện thoại để bắt đầu.');
      setReport(null);
      return;
    }
    router.replace(`/check?query=${encodeURIComponent(value)}`, { scroll: false });
    void runLookup(value);
  };

  const resetLookup = () => {
    setInput('');
    setActiveQuery('');
    setReport(null);
    setError(null);
    router.replace('/check', { scroll: false });
  };

  const clearRecent = () => {
    localStorage.removeItem(RECENT_STORAGE_KEY);
    setRecentChecks([]);
  };

  const selectRecent = (query: string) => {
    setInput(query);
    router.replace(`/check?query=${encodeURIComponent(query)}`, { scroll: false });
    void runLookup(query);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border bg-[#F8FBFF] dark:bg-[#091321]">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#1677FF]/20 bg-card px-3 py-1.5 text-xs font-bold text-[#1677FF]">
              <img src="/favicon.svg" alt="" className="h-5 w-5" />
              Trust Check · Seller Intelligence
            </div>
            <h1 className="mt-5 max-w-2xl font-display text-4xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-5xl">
              Kiểm tra seller trước khi giao dịch
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Nhập Telegram, URL, tên shop hoặc số điện thoại để xem hồ sơ, xác minh và lịch sử uy tín trên thuebot.org.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3 sm:flex-row" role="search">
              <label htmlFor="seller-query" className="sr-only">Thông tin seller cần kiểm tra</label>
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <input
                  id="seller-query"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="@seller, t.me/..., tên shop, SĐT..."
                  autoComplete="off"
                  className="min-h-14 w-full rounded-2xl border border-border bg-card pl-12 pr-4 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-[#1677FF]/60 focus:ring-4 focus:ring-[#1677FF]/10"
                />
              </div>
              <button type="submit" disabled={loading} className="btn-brand min-h-14 shrink-0 rounded-2xl px-6 disabled:cursor-wait">
                {loading ? 'Đang kiểm tra...' : 'Kiểm tra'}
                {!loading ? <ArrowRight className="h-4 w-4" aria-hidden /> : null}
              </button>
            </form>
            <p className="mt-3 text-xs text-muted-foreground">Hỗ trợ Telegram username, link Telegram, tên shop và số điện thoại.</p>

            <div className="mt-7 flex flex-wrap gap-2">
              {['Hồ sơ xác minh', 'Trust Score', 'Reviews & lịch sử'].map((item) => (
                <span key={item} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground/75">
                  <CheckCircle2 className="h-4 w-4 text-[#1677FF]" aria-hidden />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        {error ? (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900/60 dark:bg-red-950/25 dark:text-red-200" role="alert">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Không thể hoàn tất kiểm tra</p>
              <p className="mt-1 text-xs leading-relaxed">{error}</p>
            </div>
            <button type="button" onClick={() => activeQuery && void runLookup(activeQuery)} className="min-h-10 shrink-0 rounded-lg px-3 text-xs font-bold underline underline-offset-4 hover:no-underline">Thử lại</button>
          </div>
        ) : null}

        {loading ? <ReportSkeleton /> : report ? (
          <>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow">Trust Report</p>
                <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Kết quả cho “{report.query}”</h2>
              </div>
              <p className="text-xs text-muted-foreground">{report.matches.length ? `${report.matches.length} hồ sơ phù hợp` : 'Không có hồ sơ phù hợp'}</p>
            </div>

            {report.matches.length === 0 ? <EmptyState searched onReset={resetLookup} /> : null}

            {exactMatches.length > 0 ? (
              <section aria-labelledby="exact-match-title" className="space-y-4">
                <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden /><h3 id="exact-match-title" className="font-display text-lg font-bold text-foreground">{exactMatches.length} kết quả khớp chính xác</h3></div>
                {exactMatches.map((result) => <SearchResultCard key={result.id} result={result} />)}
              </section>
            ) : null}

            {possibleMatches.length > 0 ? (
              <section aria-labelledby="possible-match-title" className={`${exactMatches.length ? 'mt-12' : ''} space-y-4`}>
                <div><p className="eyebrow">Gợi ý hồ sơ</p><h3 id="possible-match-title" className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground">Có thể bạn đang tìm</h3><p className="mt-1 text-sm text-muted-foreground">Các kết quả gần đúng theo tên hoặc đường dẫn seller.</p></div>
                {possibleMatches.map((result) => <PossibleMatchCard key={result.id} result={result} />)}
              </section>
            ) : null}
          </>
        ) : (
          <EmptyState searched={false} />
        )}

        <HowToReadReport />
        {isAuthenticated === true ? <RecentChecks checks={recentChecks} onSelect={selectRecent} onClear={clearRecent} /> : null}
      </main>
    </div>
  );
}
