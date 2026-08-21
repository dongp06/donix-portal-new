'use client';

import Link from 'next/link';
import { useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  Eye,
  FileText,
  List,
  MessageCircle,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Users,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { BotCategorySlug, BotItem, BotSellerInfo, Post, PostFeed } from '@shared/types';

import { BotCard } from '@/components/bot/BotCard';
import { OfficialBadge } from '@/components/trust/OfficialBadge';
import { PostCard } from '@/components/posts/PostCard';
import { TrustedBadge } from '@/components/trust/TrustedBadge';
import { useRole } from '@/context/RoleContext';
import { api } from '@/lib/api-client';
import { getBotPriceValue } from '@/lib/bot-pricing';
import { cn } from '@/lib/utils';
import { MediaImage } from '@/components/media/MediaImage';

type CategoryFilter = 'all' | BotCategorySlug;
type CatalogSort = 'popular' | 'newest' | 'rating' | 'price_asc' | 'price_desc';

const categoryFilters: { id: CategoryFilter; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'discord', label: 'Discord' },
  { id: 'zalo', label: 'Zalo' },
  { id: 'messenger', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
];

const useCases = [
  { label: 'Bot Telegram', query: 'Telegram', icon: Send },
  { label: 'Bot Discord', query: 'Discord', icon: MessageCircle },
  { label: 'Auto post & broadcast', query: 'auto post', icon: Zap },
  { label: 'Chăm sóc khách hàng', query: 'chăm sóc khách hàng', icon: Users },
  { label: 'Bot chốt đơn', query: 'chốt đơn', icon: BriefcaseBusiness },
  { label: 'AI & automation', query: 'AI automation', icon: Sparkles },
];

const statusLabels: Record<BotItem['status'], string> = {
  online: 'Đang hoạt động',
  maintenance: 'Đang bảo trì',
  offline: 'Ngoại tuyến',
};

function formatCount(value: number | undefined): string {
  return value === undefined ? '—' : value.toLocaleString('vi-VN');
}

function sellerPath(seller: BotSellerInfo): string {
  return seller.slug ? `/sellers/${encodeURIComponent(seller.slug)}` : `/sellers/${encodeURIComponent(seller.id)}`;
}

function SectionHeading({
  eyebrow,
  title,
  description,
  href,
  linkLabel = 'Xem tất cả',
}: {
  eyebrow: string;
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-2 font-display text-2xl font-bold tracking-tight md:text-3xl">{title}</h2>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      {href ? (
        <Link href={href} className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
          {linkLabel}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

function BotGrid({ bots }: { bots: BotItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {bots.map((bot) => <BotCard key={bot.id} bot={bot} />)}
    </div>
  );
}

function BotShelf({
  title,
  description,
  bots,
  href,
}: {
  title: string;
  description?: string;
  bots: BotItem[];
  href?: string;
}) {
  if (!bots.length) return null;

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h3 className="font-display text-xl font-bold tracking-tight md:text-2xl">{title}</h3>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {href ? <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">Xem tất cả <ArrowRight className="h-4 w-4" aria-hidden /></Link> : null}
      </div>
      <BotGrid bots={bots} />
    </section>
  );
}

function SellerCard({ seller, botCount }: { seller: BotSellerInfo; botCount: number }) {
  return (
    <Link href={sellerPath(seller)} className="group flex min-h-44 flex-col rounded-2xl border border-border bg-card p-5 transition-colors hover:border-[#1677FF]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677FF]">
      <div className="flex items-start gap-3">
        <MediaImage src={seller.avatar} fallbackSrc="/avt.png" alt="" className="h-12 w-12 rounded-2xl border border-[#1677FF]/20 object-cover ring-2 ring-[#1677FF]/10 ring-offset-2 ring-offset-card" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-display font-bold group-hover:text-[#1677FF]">{seller.name}</h3>
            <TrustedBadge size="sm" interactive={false} info={{ isTrusted: true, trustScore: seller.reputation, rating: seller.rating }} />
          </div>
          <p className="mt-1 text-xs font-medium text-[#1677FF]">Trusted Seller</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 text-xs">
        <div>
          <p className="text-muted-foreground">Điểm uy tín</p>
          <p className="mt-1 font-bold text-foreground">{typeof seller.reputation === 'number' ? `${seller.reputation}/100` : 'Đã xác minh'}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Đánh giá</p>
          <p className="mt-1 inline-flex items-center gap-1 font-bold text-foreground"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />{seller.rating.toFixed(1)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Bot đang đăng</p>
          <p className="mt-1 font-bold text-foreground">{botCount}</p>
        </div>
        {seller.totalSales > 0 ? (
          <div>
            <p className="text-muted-foreground">Lượt giao dịch</p>
            <p className="mt-1 font-bold text-foreground">{seller.totalSales.toLocaleString('vi-VN')}</p>
          </div>
        ) : null}
      </div>
      <span className="mt-auto pt-4 text-xs font-semibold text-[#1677FF]">Xem hồ sơ <ChevronRight className="inline h-3.5 w-3.5" aria-hidden /></span>
    </Link>
  );
}

function EmptyTrustedSellerState() {
  return (
    <div className="flex flex-col items-start gap-5 rounded-2xl border border-dashed border-[#1677FF]/30 bg-[#1677FF]/[0.035] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-[#1677FF]/10 p-3 text-[#1677FF]"><ShieldCheck className="h-6 w-6" aria-hidden /></div>
        <div>
          <h3 className="font-display text-lg font-bold">Danh sách Trusted Seller đang được cập nhật</h3>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">Chỉ seller đã được admin phê duyệt mới xuất hiện ở đây. Bạn vẫn có thể kiểm tra bất kỳ username hoặc đường dẫn seller nào trước khi liên hệ.</p>
        </div>
      </div>
      <Link href="/check" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-[#1677FF]/35 px-4 py-2.5 text-sm font-semibold text-[#1677FF] transition-colors hover:bg-[#1677FF]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677FF]">Kiểm tra seller <ArrowRight className="h-4 w-4" aria-hidden /></Link>
    </div>
  );
}

function UserPostLink({ post }: { post: Post }) {
  return (
    <Link href={`/posts/${encodeURIComponent(post.slug)}`} className="group block rounded-2xl border border-border bg-card p-5 transition-colors hover:border-brand/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
      <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        <span className="text-brand">{post.categoryName}</span>
        <span>{post.readTimeMinutes} phút đọc</span>
      </div>
      <h3 className="mt-3 line-clamp-2 font-display text-base font-bold leading-snug transition-colors group-hover:text-brand">{post.title}</h3>
      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{post.excerpt}</p>
      <div className="mt-4 flex items-center gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5" aria-hidden />{post.commentsCount}</span>
        <span className="inline-flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" aria-hidden />{post.views.toLocaleString('vi-VN')}</span>
        <span className="ml-auto truncate">{post.author.name}</span>
      </div>
    </Link>
  );
}

export function HomePage() {
  const router = useRouter();
  const { bots, botsLoading, botsError, reloadBots } = useRole();
  const [heroQuery, setHeroQuery] = useState('');
  const [sellerQuery, setSellerQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [marketSearch, setMarketSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | BotItem['status']>('all');
  const [trustedOnly, setTrustedOnly] = useState(false);
  const [catalogSort, setCatalogSort] = useState<CatalogSort>('popular');
  const [visibleBotCount, setVisibleBotCount] = useState(12);

  const { data: feed, isLoading: postsLoading } = useQuery({
    queryKey: ['posts', 'home-v2'],
    queryFn: () => api<PostFeed>('/api/posts?limit=8&sort=latest'),
  });

  const matchingBots = useMemo(() => {
    const query = marketSearch.trim().toLowerCase();
    return bots.filter((bot) => {
      const searchable = [
        bot.title,
        bot.tagline,
        bot.description,
        bot.categoryName,
        bot.seller.name,
        ...bot.tags,
        ...bot.features,
      ].join(' ').toLowerCase();
      const matchesSearch = !query || searchable.includes(query);
      const matchesCategory = selectedCategory === 'all' || bot.categorySlug === selectedCategory;
      const matchesStatus = statusFilter === 'all' || bot.status === statusFilter;
      const matchesTrust = !trustedOnly || bot.seller.isTrusted;
      return matchesSearch && matchesCategory && matchesStatus && matchesTrust;
    });
  }, [bots, marketSearch, selectedCategory, statusFilter, trustedOnly]);

  const sortedCatalogBots = useMemo(() => {
    return [...matchingBots].sort((a, b) => {
      if (catalogSort === 'newest') return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      if (catalogSort === 'rating') return b.rating - a.rating || b.reviewCount - a.reviewCount;
      if (catalogSort === 'price_asc') return getBotPriceValue(a) - getBotPriceValue(b);
      if (catalogSort === 'price_desc') return getBotPriceValue(b) - getBotPriceValue(a);
      return b.views - a.views;
    });
  }, [catalogSort, matchingBots]);

  const featuredBots = useMemo(
    () => [...matchingBots].sort((a, b) => b.views - a.views).slice(0, 4),
    [matchingBots],
  );

  const trustedBots = useMemo(
    () => [...matchingBots]
      .filter((bot) => bot.seller.isTrusted)
      .sort((a, b) => (b.seller.reputation ?? 0) - (a.seller.reputation ?? 0) || b.views - a.views)
      .slice(0, 4),
    [matchingBots],
  );

  const platformShelves = useMemo(
    () => categoryFilters
      .filter((category) => category.id !== 'all')
      .map((category) => ({
        ...category,
        bots: [...matchingBots]
          .filter((bot) => bot.categorySlug === category.id)
          .sort((a, b) => b.views - a.views)
          .slice(0, 4),
      }))
      .filter((category) => category.bots.length > 0),
    [matchingBots],
  );

  const visibleCatalogBots = sortedCatalogBots.slice(0, visibleBotCount);
  const showMarketplaceShelves = selectedCategory === 'all' && !marketSearch.trim() && !trustedOnly && statusFilter === 'all';

  const resetCatalogPage = () => setVisibleBotCount(12);

  const sellerSummaries = useMemo(() => {
    const map = new Map<string, { seller: BotSellerInfo; botCount: number }>();
    for (const bot of bots) {
      const key = bot.seller.id || bot.seller.slug || bot.seller.name;
      const current = map.get(key);
      if (current) current.botCount += 1;
      else map.set(key, { seller: bot.seller, botCount: 1 });
    }
    return [...map.values()]
      .filter(({ seller }) => seller.isTrusted)
      .sort((a, b) => (b.seller.reputation ?? 0) - (a.seller.reputation ?? 0) || b.seller.rating - a.seller.rating)
      .slice(0, 3);
  }, [bots]);

  const officialPosts = feed?.items.filter((post) => post.author.isOfficial).slice(0, 2) ?? [];
  const userPosts = feed?.items.filter((post) => !post.author.isOfficial).slice(0, 3) ?? [];
  const botsAvailable = !botsLoading && !botsError;
  const onlineBotCount = botsAvailable ? bots.filter((bot) => bot.status === 'online').length : undefined;
  const stats = [
    { value: botsAvailable ? bots.length : undefined, label: 'bot đang niêm yết', icon: Bot },
    { value: botsAvailable ? new Set(bots.map((bot) => bot.seller.id)).size : undefined, label: 'seller có listing', icon: Users },
    { value: onlineBotCount, label: 'bot đang hoạt động', icon: Zap },
    { value: postsLoading ? undefined : feed?.pagination.total, label: 'Posts đã xuất bản', icon: FileText },
  ];

  const submitBotSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = heroQuery.trim();
    router.push(query ? `/bots?q=${encodeURIComponent(query)}` : '/bots');
  };

  const submitSellerCheck = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = sellerQuery.trim();
    if (query) router.push(`/check?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="bg-background text-foreground">
      <section className="relative overflow-hidden border-b border-border bg-card">
        <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden>
          <div className="absolute -right-24 -top-40 h-[32rem] w-[32rem] rounded-full bg-[#1677FF]/10 blur-[110px]" />
          <div className="absolute -bottom-56 left-1/3 h-[26rem] w-[26rem] rounded-full bg-brand/10 blur-[110px]" />
        </div>
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-center lg:px-8 lg:py-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#1677FF]/25 bg-[#1677FF]/[0.07] px-3.5 py-1.5 text-xs font-bold text-[#1677FF]">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Tìm bot · Kiểm tra uy tín · Kết nối trực tiếp
            </div>
            <h1 className="mt-6 max-w-3xl text-balance font-display text-4xl font-extrabold leading-[1.06] tracking-tight sm:text-5xl lg:text-6xl">
              Chợ bot tự động hóa với seller được <span className="text-[#1677FF]">xác minh</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Khám phá bot Telegram, Discord, Zalo, Facebook và các giải pháp automation khác. Xem hồ sơ seller, điểm uy tín và liên hệ trực tiếp trước khi giao dịch.
            </p>

            <form className="mt-8 flex max-w-3xl flex-col gap-3 sm:flex-row" onSubmit={submitBotSearch} role="search">
              <label htmlFor="home-bot-search" className="sr-only">Tìm bot hoặc chủ đề</label>
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <input id="home-bot-search" value={heroQuery} onChange={(event) => setHeroQuery(event.target.value)} placeholder="Tìm bot Telegram, Zalo, Discord, seller hoặc chủ đề..." className="h-14 w-full rounded-2xl border border-border bg-background pl-12 pr-4 text-base placeholder:text-muted-foreground focus:border-[#1677FF]/60 focus:outline-none focus:ring-2 focus:ring-[#1677FF]/25" />
              </div>
              <button type="submit" className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-brand px-6 text-sm font-bold text-brand-foreground transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-card">
                <Search className="h-4 w-4" aria-hidden /> Tìm bot
              </button>
            </form>

            <div className="mt-5 flex flex-wrap gap-2" aria-label="Lối tắt">
              <a href="#featured-bots" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-semibold transition-colors hover:border-brand/45 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"><Bot className="h-4 w-4" aria-hidden /> Tìm bot</a>
              <Link href="/check" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#1677FF]/30 bg-[#1677FF]/[0.05] px-3.5 py-2 text-xs font-semibold text-[#1677FF] transition-colors hover:bg-[#1677FF]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677FF]"><ShieldCheck className="h-4 w-4" aria-hidden /> Kiểm tra seller</Link>
              <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-semibold transition-colors hover:border-brand/45 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"><Zap className="h-4 w-4" aria-hidden /> Đăng bot</Link>
              <Link href="/posts" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-semibold transition-colors hover:border-brand/45 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"><FileText className="h-4 w-4" aria-hidden /> Bài viết</Link>
            </div>
          </div>

          <aside className="rounded-3xl border border-[#1677FF]/25 bg-[#1677FF]/[0.045] p-6 lg:p-7">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#1677FF]"><ShieldCheck className="h-4 w-4" aria-hidden /> Trust layer</div>
            <h2 className="mt-4 font-display text-2xl font-bold leading-tight">Quyết định sáng suốt trước khi liên hệ.</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Một hồ sơ rõ ràng giúp bạn biết seller là ai, đã xác minh gì và hoạt động ra sao.</p>
            <ul className="mt-6 space-y-4 text-sm">
              {['Trust Seller và trạng thái xác minh', 'Review, Posts và lịch sử hoạt động', 'Kênh liên hệ công khai của seller'].map((item) => (
                <li key={item} className="flex items-start gap-2.5"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#1677FF]" aria-hidden /><span>{item}</span></li>
              ))}
            </ul>
            <Link href="/check" className="mt-7 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1677FF] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#0B5CCC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677FF] focus-visible:ring-offset-2 focus-visible:ring-offset-card">Kiểm tra seller ngay <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          </aside>
        </div>
        <dl className="relative mx-auto grid max-w-7xl grid-cols-2 border-t border-border px-4 sm:px-6 md:grid-cols-4 lg:px-8">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return <div key={stat.label} className="flex items-center gap-3 border-r border-border px-2 py-5 first:pl-0 last:border-r-0 sm:px-5 lg:first:pl-0"><Icon className="h-5 w-5 shrink-0 text-brand" aria-hidden /><div><dd className="font-display text-xl font-bold tabular-nums sm:text-2xl">{formatCount(stat.value)}</dd><dt className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">{stat.label}</dt></div></div>;
          })}
        </dl>
      </section>

      <section id="check-seller" className="border-b border-border bg-muted/30">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:px-8 lg:py-20">
          <div>
            <p className="eyebrow">Kiểm tra uy tín seller</p>
            <h2 className="mt-2 max-w-2xl font-display text-3xl font-bold tracking-tight md:text-4xl">Đừng chỉ nghe lời giới thiệu. Hãy kiểm tra hồ sơ.</h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">Nhập Telegram username, URL, số điện thoại hoặc tên shop để xem dữ liệu seller công khai trên thuebot.org.</p>
            <form className="mt-7 flex max-w-2xl flex-col gap-3 sm:flex-row" onSubmit={submitSellerCheck} role="search">
              <label htmlFor="home-seller-search" className="sr-only">Username hoặc URL seller</label>
              <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden /><input id="home-seller-search" value={sellerQuery} onChange={(event) => setSellerQuery(event.target.value)} placeholder="@username, t.me/username hoặc tên shop" className="h-12 w-full rounded-xl border border-border bg-card pl-12 pr-4 text-base placeholder:text-muted-foreground focus:border-[#1677FF]/60 focus:outline-none focus:ring-2 focus:ring-[#1677FF]/25" /></div>
              <button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#1677FF] px-5 text-sm font-bold text-white transition-colors hover:bg-[#0B5CCC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677FF] focus-visible:ring-offset-2 focus-visible:ring-offset-muted"><ShieldCheck className="h-4 w-4" aria-hidden /> Kiểm tra ngay</button>
            </form>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm font-bold">Kết quả sẽ gồm</p>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              {['Trust Score và tier seller', 'Trạng thái xác minh hiện tại', 'Rating, review và số bot', 'Ngày tham gia và hồ sơ công khai'].map((item) => <li key={item} className="flex items-start gap-2.5"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#1677FF]" aria-hidden />{item}</li>)}
            </ul>
            <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">Trusted Seller là tín hiệu uy tín của hồ sơ, không phải bảo đảm tuyệt đối cho giao dịch bên ngoài nền tảng.</p>
          </div>
        </div>
      </section>

      <section id="featured-bots" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <SectionHeading
          eyebrow="Marketplace"
          title="Khám phá bot"
          description="Tìm bot theo nền tảng, nhu cầu và nhà cung cấp phù hợp."
          href="/bots"
          linkLabel="Xem dạng danh sách"
        />

        <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <label htmlFor="marketplace-bot-search" className="sr-only">Tìm bot theo tên hoặc chức năng</label>
              <input
                id="marketplace-bot-search"
                value={marketSearch}
                onChange={(event) => {
                  setMarketSearch(event.target.value);
                  resetCatalogPage();
                }}
                placeholder="Tìm bot theo tên, chức năng, seller hoặc tag..."
                className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm placeholder:text-muted-foreground focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/25"
              />
            </div>
            <div className="flex min-w-0 gap-2 overflow-x-auto pb-1 xl:pb-0" role="tablist" aria-label="Lọc bot theo nền tảng">
              {categoryFilters.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedCategory === category.id}
                  onClick={() => {
                    setSelectedCategory(category.id);
                    resetCatalogPage();
                  }}
                  className={cn(
                    'min-h-10 shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                    selectedCategory === category.id
                      ? 'border-brand bg-brand text-brand-foreground'
                      : 'border-border bg-background text-muted-foreground hover:border-brand/45 hover:text-foreground',
                  )}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><SlidersHorizontal className="h-3.5 w-3.5" aria-hidden /> Bộ lọc</span>
            <label className={cn('inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors', trustedOnly ? 'border-[#1677FF]/40 bg-[#1677FF]/10 text-[#1677FF]' : 'border-border bg-background text-muted-foreground hover:border-[#1677FF]/35')}>
              <input
                type="checkbox"
                checked={trustedOnly}
                onChange={(event) => {
                  setTrustedOnly(event.target.checked);
                  resetCatalogPage();
                }}
                className="h-3.5 w-3.5 accent-[#1677FF]"
              />
              Seller uy tín
            </label>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as 'all' | BotItem['status']);
                resetCatalogPage();
              }}
              className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/25"
              aria-label="Lọc theo trạng thái bot"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="online">Đang hoạt động</option>
              <option value="maintenance">Đang bảo trì</option>
              <option value="offline">Ngoại tuyến</option>
            </select>
            <select
              value={catalogSort}
              onChange={(event) => {
                setCatalogSort(event.target.value as CatalogSort);
                resetCatalogPage();
              }}
              className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/25"
              aria-label="Sắp xếp bot"
            >
              <option value="popular">Phổ biến nhất</option>
              <option value="newest">Mới đăng</option>
              <option value="rating">Đánh giá cao</option>
              <option value="price_asc">Giá thấp đến cao</option>
              <option value="price_desc">Giá cao đến thấp</option>
            </select>
            <span className="ml-auto text-xs text-muted-foreground">{botsLoading ? 'Đang tải...' : `${matchingBots.length} bot`}</span>
          </div>
        </div>

        {botsLoading ? (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => <div key={index} className="aspect-[.86] animate-pulse rounded-2xl border border-border bg-muted" />)}
          </div>
        ) : botsError ? (
          <div className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/5 p-10 text-center" role="alert">
            <Bot className="mx-auto h-8 w-8 text-destructive" aria-hidden />
            <p className="mt-3 font-semibold">Không tải được danh sách bot</p>
            <p className="mt-1 text-sm text-muted-foreground">{botsError}</p>
            <button type="button" onClick={() => void reloadBots()} className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-brand px-4 py-2 text-sm font-bold text-brand-foreground hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">Thử lại</button>
          </div>
        ) : matchingBots.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <Bot className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="mt-3 font-semibold">Không tìm thấy bot phù hợp</p>
            <p className="mt-1 text-sm text-muted-foreground">Thử từ khóa khác hoặc đặt lại bộ lọc marketplace.</p>
            <button type="button" onClick={() => { setMarketSearch(''); setSelectedCategory('all'); setStatusFilter('all'); setTrustedOnly(false); resetCatalogPage(); }} className="mt-4 text-sm font-semibold text-brand underline underline-offset-4">Đặt lại bộ lọc</button>
          </div>
        ) : (
          <div className="mt-8 space-y-12">
            {showMarketplaceShelves ? (
              <>
                <BotShelf title="Nổi bật tuần này" description="Những listing đang được quan tâm nhiều nhất." bots={featuredBots} href="/bots?sort=popular" />
                {trustedBots.length > 0 ? <BotShelf title="Từ nhà cung cấp uy tín" description="Bot từ seller đã đạt Trusted Seller." bots={trustedBots} href="/bots?trusted=1" /> : null}
                {platformShelves.map((shelf) => <BotShelf key={shelf.id} title={shelf.label} bots={shelf.bots} href={`/bots?category=${shelf.id}`} />)}
              </>
            ) : null}

            <section id="all-bots">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <h3 className="font-display text-xl font-bold tracking-tight md:text-2xl">{showMarketplaceShelves ? 'Tất cả bot' : 'Kết quả marketplace'}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{showMarketplaceShelves ? 'Duyệt toàn bộ listing theo thứ tự bạn chọn.' : `${matchingBots.length} bot phù hợp với bộ lọc hiện tại.`}</p>
                </div>
                <span className="hidden text-sm text-muted-foreground sm:block">Hiển thị {visibleCatalogBots.length}/{sortedCatalogBots.length}</span>
              </div>
              <BotGrid bots={visibleCatalogBots} />
              {visibleBotCount < sortedCatalogBots.length ? (
                <div className="mt-8 flex justify-center">
                  <button type="button" onClick={() => setVisibleBotCount((count) => count + 12)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold transition-colors hover:border-brand/45 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                    <List className="h-4 w-4" aria-hidden /> Tải thêm bot
                  </button>
                </div>
              ) : null}
            </section>
          </div>
        )}
      </section>

      <section className="border-y border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <SectionHeading eyebrow="Trust network" title="Nhà cung cấp uy tín nổi bật" description="Tích xanh chỉ xuất hiện với seller đã được thuebot.org phê duyệt Trusted Seller." href="/check" linkLabel="Kiểm tra seller" />
          {sellerSummaries.length > 0 ? <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{sellerSummaries.map(({ seller, botCount }) => <SellerCard key={seller.id} seller={seller} botCount={botCount} />)}</div> : <EmptyTrustedSellerState />}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <SectionHeading eyebrow="Khám phá theo nhu cầu" title="Bạn đang cần bot cho việc gì?" description="Bắt đầu từ nhu cầu, sau đó lọc tiếp theo nền tảng, trạng thái và seller." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {useCases.map((item) => { const Icon = item.icon; return <Link key={item.label} href={`/bots?q=${encodeURIComponent(item.query)}`} className="group flex min-h-20 items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 transition-colors hover:border-brand/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"><span className="rounded-xl bg-brand/10 p-2.5 text-brand"><Icon className="h-5 w-5" aria-hidden /></span><span className="min-w-0 flex-1"><span className="block font-semibold">{item.label}</span><span className="mt-0.5 block text-xs text-muted-foreground">Xem bot phù hợp</span></span><ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden /></Link>; })}
        </div>
      </section>

      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <SectionHeading eyebrow="Cách hoạt động" title="Một luồng rõ ràng từ tìm kiếm đến kết nối" description="thuebot.org cung cấp thông tin và lớp uy tín; giao dịch vẫn do hai bên tự trao đổi." />
          <div className="grid gap-5 md:grid-cols-3">
            {[{ icon: Search, step: '01', title: 'Tìm đúng bot', text: 'Khám phá theo nền tảng hoặc nhu cầu, xem giá tham khảo và trạng thái hoạt động.' }, { icon: ShieldCheck, step: '02', title: 'Kiểm tra seller', text: 'Đọc Trust Score, xác minh, review và Posts trước khi mở kênh liên hệ.' }, { icon: MessageCircle, step: '03', title: 'Kết nối trực tiếp', text: 'Trao đổi với seller qua kênh công khai và tự thống nhất phạm vi giao dịch.' }].map((item) => { const Icon = item.icon; return <div key={item.step} className="rounded-2xl border border-border bg-background p-6"><div className="flex items-center justify-between"><span className="font-display text-3xl font-bold text-brand/40">{item.step}</span><span className="rounded-xl bg-brand/10 p-2.5 text-brand"><Icon className="h-5 w-5" aria-hidden /></span></div><h3 className="mt-7 font-display text-xl font-bold">{item.title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p></div>; })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="eyebrow">Posts</p><h2 className="mt-2 font-display text-2xl font-bold tracking-tight md:text-3xl">Official và cộng đồng, cùng một nơi</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Theo dõi cảnh báo chính thức, cập nhật bot và kinh nghiệm automation từ người dùng.</p></div>
          <Link href="/posts" className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-brand hover:underline">Mở Posts <ArrowRight className="h-4 w-4" aria-hidden /></Link>
        </div>
        {postsLoading ? <div className="grid gap-5 lg:grid-cols-2"><div className="h-72 animate-pulse rounded-2xl border border-border bg-muted" /><div className="space-y-3"><div className="h-32 animate-pulse rounded-2xl border border-border bg-muted" /><div className="h-32 animate-pulse rounded-2xl border border-border bg-muted" /></div></div> : <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)]"><div><div className="mb-3 flex items-center gap-2 text-sm font-bold text-[#1677FF]"><OfficialBadge size="sm" /> Nội dung chính thức</div>{officialPosts.length > 0 ? <div className="space-y-3">{officialPosts.map((post) => <PostCard key={post.id} post={post} />)}</div> : <div className="rounded-2xl border border-dashed border-[#1677FF]/30 bg-[#1677FF]/[0.035] p-8 text-sm text-muted-foreground">Chưa có thông báo Official mới.</div>}</div><div><div className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground"><FileText className="h-4 w-4 text-brand" aria-hidden /> Posts từ người dùng</div>{userPosts.length > 0 ? <div className="space-y-3">{userPosts.map((post) => <UserPostLink key={post.id} post={post} />)}</div> : <div className="rounded-2xl border border-dashed border-border p-8 text-sm text-muted-foreground">Chưa có Posts từ người dùng mới.</div>}</div></div>}
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-20">
        <div className="relative overflow-hidden rounded-3xl border border-[#1677FF]/25 bg-[#1677FF]/[0.055] p-7 sm:p-10 lg:flex lg:items-center lg:justify-between lg:gap-10">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#1677FF]/10 blur-3xl" aria-hidden />
          <div className="relative"><p className="eyebrow text-[#1677FF]">Dành cho seller</p><h2 className="mt-2 max-w-2xl font-display text-2xl font-bold tracking-tight md:text-3xl">Đăng bot và xây hồ sơ uy tín của bạn.</h2><p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">Đưa bot đến đúng người cần, chia sẻ cập nhật qua Posts và để khách hàng kiểm tra thông tin trước khi liên hệ.</p></div>
          <div className="relative mt-6 flex shrink-0 flex-wrap gap-3 lg:mt-0"><Link href="/dashboard" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-brand-foreground transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">Đăng bot <ArrowRight className="h-4 w-4" aria-hidden /></Link><Link href="/seller/verification" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[#1677FF]/30 bg-background px-5 py-3 text-sm font-semibold text-[#1677FF] transition-colors hover:bg-[#1677FF]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677FF]">Xem Trusted Seller</Link></div>
        </div>
      </section>

    </div>
  );
}
