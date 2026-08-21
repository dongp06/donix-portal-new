'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  Headphones,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  UserRoundCog,
  X,
} from 'lucide-react';

import { ThuebotLogo } from '@/components/brand/ThuebotLogo';
import { MediaImage } from '@/components/media/MediaImage';
import { AdminAccessProvider } from '@/context/AdminAccessContext';
import { useRole } from '@/context/RoleContext';
import { cn } from '@/lib/utils';
import type { AdminAccess, AdminRole } from '@/lib/admin-server';
import { apiAdmin } from '@/lib/api-client';

type AdminSearchResult = {
  type: 'seller' | 'user' | 'bot' | 'case' | 'post';
  id: string;
  label: string;
  description: string;
  role?: string | null;
};

type AdminNavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: AdminRole[];
  shortcut?: string;
};

type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

const NAV_GROUPS: AdminNavGroup[] = [
  {
    label: 'Vận hành',
    items: [
      { href: '/admin', label: 'Tổng quan', icon: LayoutDashboard },
      { href: '/admin/moderation', label: 'Kiểm duyệt', icon: CheckSquare },
    ],
  },
  {
    label: 'Marketplace',
    items: [
      { href: '/admin/sellers', label: 'Seller', icon: Users },
      { href: '/admin/bots', label: 'Bot', icon: Bot },
      { href: '/admin/verifications', label: 'Xác minh', icon: ShieldCheck },
      { href: '/admin/reports', label: 'Báo cáo', icon: AlertTriangle },
      { href: '/admin/reviews', label: 'Đánh giá', icon: MessageSquare },
    ],
  },
  {
    label: 'Nội dung',
    items: [
      { href: '/admin/posts', label: 'Bài viết', icon: FileText, shortcut: '/admin/posts/new' },
      { href: '/admin/comments', label: 'Bình luận', icon: MessageSquare },
      { href: '/admin/content', label: 'Nội dung nổi bật', icon: SlidersHorizontal, roles: ['owner', 'admin'] },
    ],
  },
  {
    label: 'Quản trị',
    items: [
      { href: '/admin/users', label: 'Người dùng', icon: Users },
      { href: '/admin/staff', label: 'Nhân sự', icon: UserRoundCog, roles: ['owner', 'admin'] },
      { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
      { href: '/admin/audit', label: 'Audit log', icon: Activity },
    ],
  },
  {
    label: 'Hệ thống',
    items: [{ href: '/admin/settings', label: 'Cài đặt', icon: Settings, roles: ['owner'] }],
  },
];

const MODERATION_CHILDREN = [
  { href: '/admin/moderation', label: 'Hàng đợi' },
  { href: '/admin/cases', label: 'Case đang mở' },
] as const;

const PAGE_META: Array<{ match: (pathname: string) => boolean; title: string; subtitle: string }> = [
  { match: (pathname) => pathname === '/admin', title: 'Tổng quan', subtitle: 'Tình trạng vận hành thuebot.org hôm nay.' },
  { match: (pathname) => pathname.startsWith('/admin/moderation'), title: 'Kiểm duyệt', subtitle: 'Hàng đợi các nội dung và case cần xử lý.' },
  { match: (pathname) => pathname.startsWith('/admin/cases'), title: 'Case đang mở', subtitle: 'Theo dõi điều tra, người phụ trách và audit trail.' },
  { match: (pathname) => pathname.startsWith('/admin/sellers'), title: 'Seller', subtitle: 'Quản lý seller, listing và lịch sử trust.' },
  { match: (pathname) => pathname.startsWith('/admin/bots'), title: 'Bot', subtitle: 'Kiểm tra listing, media, giá tháng và trạng thái hiển thị.' },
  { match: (pathname) => pathname.startsWith('/admin/verifications'), title: 'Xác minh', subtitle: 'Quản lý verification và Trusted Seller.' },
  { match: (pathname) => pathname.startsWith('/admin/reports'), title: 'Báo cáo', subtitle: 'Xử lý tín hiệu rủi ro từ marketplace và cộng đồng.' },
  { match: (pathname) => pathname.startsWith('/admin/reviews'), title: 'Đánh giá', subtitle: 'Theo dõi review, xác minh và rủi ro gian lận.' },
  { match: (pathname) => pathname.startsWith('/admin/posts'), title: 'Bài viết', subtitle: 'Xuất bản và kiểm duyệt nội dung của thuebot.org.' },
  { match: (pathname) => pathname.startsWith('/admin/comments'), title: 'Bình luận', subtitle: 'Giữ cho thảo luận rõ ràng và an toàn.' },
  { match: (pathname) => pathname.startsWith('/admin/content'), title: 'Nội dung nổi bật', subtitle: 'Điều phối danh mục, tags và vị trí hiển thị.' },
  { match: (pathname) => pathname.startsWith('/admin/users'), title: 'Người dùng', subtitle: 'Tra cứu tài khoản và hoạt động liên quan.' },
  { match: (pathname) => pathname.startsWith('/admin/staff'), title: 'Nhân sự', subtitle: 'Quản lý staff và quyền truy cập console.' },
  { match: (pathname) => pathname.startsWith('/admin/analytics'), title: 'Analytics', subtitle: 'Các chỉ số giúp vận hành marketplace.' },
  { match: (pathname) => pathname.startsWith('/admin/audit'), title: 'Audit log', subtitle: 'Lịch sử thao tác không thể xóa của staff.' },
  { match: (pathname) => pathname.startsWith('/admin/settings'), title: 'Cài đặt', subtitle: 'Cấu hình trust, marketplace và moderation.' },
];

function isCurrentPath(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function roleLabel(role?: AdminRole | null): string {
  if (role === 'owner') return 'Owner';
  if (role === 'admin') return 'Admin';
  return 'Moderator';
}

function getPageMeta(pathname: string) {
  return PAGE_META.find((item) => item.match(pathname)) ?? {
    title: 'Admin console',
    subtitle: 'Vận hành thuebot.org.',
  };
}

function searchResultHref(result: AdminSearchResult): string {
  const id = encodeURIComponent(result.id);
  if (result.type === 'seller') return `/admin/sellers?search=${id}`;
  if (result.type === 'user') return `/admin/users?search=${id}`;
  if (result.type === 'bot') return `/admin/bots?search=${id}`;
  if (result.type === 'case') return `/admin/cases/${id}`;
  return `/admin/posts/${id}`;
}

function searchResultType(type: AdminSearchResult['type']): string {
  if (type === 'seller') return 'Seller';
  if (type === 'user') return 'User';
  if (type === 'bot') return 'Bot';
  if (type === 'case') return 'Case';
  return 'Post';
}

function Sidebar({ pathname, role, onNavigate }: { pathname: string; role?: AdminRole; onNavigate: () => void }) {
  const moderationOpen = pathname.startsWith('/admin/moderation') || pathname.startsWith('/admin/cases');

  return (
    <aside className="flex h-full w-[240px] shrink-0 flex-col border-r border-white/10 bg-[#0b0d12] text-white">
      <div className="border-b border-border px-4 py-5">
        <Link href="/admin" onClick={onNavigate} aria-label="thuebot.org Admin Console">
          <ThuebotLogo variant="dark" size="sm" />
        </Link>
        <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Admin console</p>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 py-4" aria-label="Điều hướng admin">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => !item.roles || (role && item.roles.includes(role)));
          if (!items.length) return null;

          return (
            <div key={group.label} className="mb-5 last:mb-0">
              <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">{group.label}</p>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = isCurrentPath(pathname, item.href);
                  const isModeration = item.href === '/admin/moderation';

                  return (
                    <div key={item.href}>
                      <div className="flex items-center gap-1">
                        <Link
                          href={item.href}
                          onClick={onNavigate}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'group flex min-h-9 min-w-0 flex-1 items-center gap-3 rounded-md px-3 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            active ? 'border-l-2 border-l-brand bg-white/10 pl-[10px] text-white' : 'text-white/65 hover:bg-white/[0.07] hover:text-white',
                          )}
                        >
                          <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-brand' : 'text-white/50 group-hover:text-white')} aria-hidden />
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        </Link>
                        {item.shortcut ? (
                          <Link
                            href={item.shortcut}
                            onClick={onNavigate}
                            aria-label="Tạo bài viết mới"
                            title="Tạo bài viết mới"
                            className="mr-1 rounded p-1 text-white/45 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden />
                          </Link>
                        ) : null}
                        {isModeration ? <ChevronRight className={cn('mr-2 h-3.5 w-3.5 text-white/45 transition-transform', moderationOpen && 'rotate-90')} aria-hidden /> : null}
                      </div>

                      {isModeration && moderationOpen ? (
                        <div className="ml-7 mt-0.5 space-y-0.5 border-l border-white/15 pl-2">
                          {MODERATION_CHILDREN.map((child) => {
                            const childActive = isCurrentPath(pathname, child.href);
                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                onClick={onNavigate}
                                aria-current={childActive ? 'page' : undefined}
                                className={cn(
                                  'block rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                  childActive ? 'bg-white/10 text-white' : 'text-white/55 hover:bg-white/[0.07] hover:text-white',
                                )}
                              >
                                {child.label}
                              </Link>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-2.5">
        <Link href="/" onClick={onNavigate} className="flex min-h-9 items-center gap-3 rounded-md px-3 text-xs font-semibold text-white/60 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
          <Headphones className="h-4 w-4" aria-hidden />
          Về thuebot.org
        </Link>
      </div>
    </aside>
  );
}

export function AdminShell({ children, initialAccess }: { children: React.ReactNode; initialAccess: AdminAccess }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, staffRole, authStatus } = useRole();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AdminSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const desktopSearchRef = useRef<HTMLInputElement>(null);
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  // The server access result is only the bootstrap used for the first render.
  // Once the shared auth check settles, never keep rendering an old staff role
  // after logout/session expiry.
  const effectiveRole: AdminRole | null =
    authStatus === 'loading' ? initialAccess.staff.role : staffRole ?? null;
  const shellUser =
    authStatus === 'loading' && user.id === 'anonymous'
      ? { ...user, ...initialAccess.user }
      : user;
  const pageMeta = getPageMeta(pathname);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
        setMobileSearchOpen(false);
        window.setTimeout(() => desktopSearchRef.current?.focus(), 0);
      }
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setMobileSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    const query = searchQuery.trim().replace(/^@/, '');
    if (!query) {
      setSearchResults([]);
      setSearchError(null);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    setSearchError(null);
    const timer = window.setTimeout(() => {
      void apiAdmin<AdminSearchResult[]>(`/api/admin/search?q=${encodeURIComponent(query)}`)
        .then((results) => {
          if (!cancelled) setSearchResults(results);
        })
        .catch((cause: unknown) => {
          if (cancelled) return;
          setSearchResults([]);
          setSearchError(cause instanceof Error ? cause.message : 'Không tìm kiếm được admin.');
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  useEffect(() => {
    if (!mobileSearchOpen) return;
    window.setTimeout(() => mobileSearchRef.current?.focus(), 0);
  }, [mobileSearchOpen]);

  if (authStatus !== 'loading' && !effectiveRole) {
    return (
      <AdminAccessProvider
        value={{ access: initialAccess, role: null, authResolved: true }}
      >
        <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
          <section
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm"
            role="alert"
          >
            <h1 className="text-lg font-bold">Phiên admin đã hết hạn</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Hãy đăng nhập lại để tiếp tục vận hành thuebot.org.
            </p>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="mt-5 inline-flex min-h-10 items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              Thử lại
            </button>
          </section>
        </main>
      </AdminAccessProvider>
    );
  }

  const openResult = (result: AdminSearchResult) => {
    router.push(searchResultHref(result));
    setSearchOpen(false);
    setMobileSearchOpen(false);
    setSearchQuery('');
  };

  const searchPanel = searchOpen ? (
    <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-xl border border-border bg-card p-2 text-foreground shadow-2xl">
      {searching ? <p className="px-3 py-3 text-xs text-muted-foreground">Đang tìm…</p> : null}
      {searchError ? <p className="px-3 py-3 text-xs text-destructive" role="alert">{searchError}</p> : null}
      {!searching && !searchError && !searchQuery.trim() ? <p className="px-3 py-3 text-xs text-muted-foreground">Tìm seller, bot, case, post hoặc email.</p> : null}
      {!searching && !searchError && searchQuery.trim() && searchResults.length === 0 ? <p className="px-3 py-3 text-xs text-muted-foreground">Không tìm thấy kết quả phù hợp.</p> : null}
      {searchResults.map((result) => (
        <button key={`${result.type}:${result.id}`} type="button" onClick={() => openResult(result)} className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Search className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{result.label}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{searchResultType(result.type)} · {result.description}</span></span>
        </button>
      ))}
    </div>
  ) : null;

  return (
    <AdminAccessProvider
      value={{
        access: initialAccess,
        role: effectiveRole,
        authResolved: authStatus !== 'loading',
      }}
    >
      <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">
           <Sidebar pathname={pathname} role={effectiveRole ?? undefined} onNavigate={() => undefined} />
        </div>

        {mobileOpen ? (
          <>
            <button type="button" aria-label="Đóng menu admin" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-black/60 lg:hidden" />
            <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
              <div className="relative h-full">
                <button type="button" onClick={() => setMobileOpen(false)} aria-label="Đóng sidebar" className="absolute right-3 top-4 z-10 rounded-md p-2 text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
                  <X className="h-5 w-5" aria-hidden />
                </button>
                 <Sidebar pathname={pathname} role={effectiveRole ?? undefined} onNavigate={() => setMobileOpen(false)} />
              </div>
            </div>
          </>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col lg:pl-[240px]">
          <header className="sticky top-0 z-30 flex min-h-[64px] items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6 lg:px-8">
            <button type="button" onClick={() => setMobileOpen(true)} aria-label="Mở menu admin" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden">
              <Menu className="h-5 w-5" aria-hidden />
            </button>

            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold text-foreground sm:text-[15px]">{pageMeta.title}</h1>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">{pageMeta.subtitle}</p>
            </div>

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <div className="relative hidden md:block">
                <label className="flex h-9 w-64 items-center gap-2 rounded-lg border border-border bg-muted px-3 text-sm text-muted-foreground focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
                <Search className="h-4 w-4 shrink-0" aria-hidden />
                <input ref={desktopSearchRef} type="search" value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} onKeyDown={(event) => { if (event.key === 'Escape') setSearchOpen(false); if (event.key === 'Enter' && searchResults[0]) openResult(searchResults[0]); }} placeholder="Tìm seller, bot, case..." aria-label="Tìm trong admin" className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground" />
                <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">⌘K</kbd>
                </label>
                {searchPanel}
              </div>
              <button type="button" aria-label="Mở tìm kiếm admin" aria-expanded={mobileSearchOpen} onClick={() => { setMobileSearchOpen(true); setSearchOpen(true); }} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden">
                <Search className="h-5 w-5" aria-hidden />
              </button>
              <div className="flex items-center gap-2 border-l border-border pl-2 sm:pl-3">
                <div className="hidden text-right sm:block">
                  <p className="max-w-32 truncate text-xs font-bold text-foreground">{shellUser.name}</p>
                  <p className="text-[11px] text-muted-foreground">{roleLabel(effectiveRole)}</p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-brand/10 text-xs font-bold text-brand">
                  {shellUser.avatar ? <MediaImage src={shellUser.avatar} fallbackSrc="/avt.png" alt="" className="h-full w-full object-cover" /> : shellUser.name.charAt(0).toUpperCase()}
                </div>
                <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" aria-hidden />
              </div>
            </div>
          </header>

          {mobileSearchOpen ? (
            <div className="relative z-20 border-b border-border bg-background px-4 py-3 shadow-sm sm:px-6 lg:px-8 md:hidden">
              <div className="relative">
                <label className="flex h-10 items-center gap-2 rounded-lg border border-border bg-muted px-3 text-sm text-muted-foreground focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
                  <Search className="h-4 w-4 shrink-0" aria-hidden />
                  <input ref={mobileSearchRef} type="search" value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setSearchOpen(true); }} onKeyDown={(event) => { if (event.key === 'Escape') { setSearchOpen(false); setMobileSearchOpen(false); } if (event.key === 'Enter' && searchResults[0]) openResult(searchResults[0]); }} placeholder="Tìm seller, bot, case..." aria-label="Tìm trong admin" className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground" />
                  <button type="button" onClick={() => { setSearchQuery(''); setSearchOpen(false); setMobileSearchOpen(false); }} aria-label="Đóng tìm kiếm admin" className="rounded p-1 text-muted-foreground hover:bg-card hover:text-foreground"><X className="h-4 w-4" aria-hidden /></button>
                </label>
                {searchPanel}
              </div>
            </div>
          ) : null}

          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto w-full max-w-[1440px]">{children}</div>
          </main>
        </div>
      </div>
      </div>
    </AdminAccessProvider>
  );
}
