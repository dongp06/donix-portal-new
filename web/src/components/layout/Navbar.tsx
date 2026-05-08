'use client';

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Menu,
  Search,
  Pin,
  Clock,
  FolderOpen,
  ChevronDown,
  Home,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import { ThemeToggle } from '@/components/ThemeToggle';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import type { Category } from '@shared/types';
import { cn } from '@/lib/utils';
import { DonixLogo } from '@/components/brand/DonixLogo';
import { Command as CommandPaletteRoot, useCommandState } from 'cmdk';

function CmdkEnterSync({
  stateRef,
}: {
  stateRef: React.MutableRefObject<{ count: number; search: string }>;
}) {
  const count = useCommandState((s) => s.filtered.count);
  const search = useCommandState((s) => s.search);
  useLayoutEffect(() => {
    stateRef.current = { count, search };
  }, [count, search, stateRef]);
  return null;
}

function NavMoreIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" />
      <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" />
      <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />
    </svg>
  );
}

/** Viết HOA sẵn — tránh `text-transform: uppercase` làm hỏng dấu tiếng Việt. */
const PRIMARY_LINKS = [
  { href: '/', label: 'TRANG CHỦ', icon: Home },
  { href: '/bai-ghim', label: 'BÀI GHIM', icon: Pin },
  { href: '/bai-moi', label: 'BÀI MỚI', icon: Clock },
] as const;

/** Đường tắt trong chuyên mục Lập trình (đồng bộ nội dung mock). */
const LAP_TRINH_QUICK = [
  { href: '/category/lap-trinh', label: 'Tất cả bài Lập trình' },
  { href: '/posts/python-co-ban-cho-nguoi-moi', label: 'Python cho người mới' },
  { href: '/posts/trien-khai-nodejs-vps-ubuntu', label: 'Node.js & VPS' },
  { href: '/posts/toi-uu-performance-react-app', label: 'React & hiệu năng' },
] as const;

function NavLabel({
  active,
  children,
  className,
}: {
  active: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'max-w-[12rem] truncate text-[11px] font-bold tracking-wide leading-tight sm:text-xs',
        active
          ? 'relative pb-1 text-[#f97316] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-[#f97316]'
          : 'text-neutral-700 dark:text-white',
        className,
      )}
    >
      {children}
    </span>
  );
}

function pillIconClass(active: boolean) {
  return cn(
    'h-3.5 w-3.5 shrink-0 stroke-[2] sm:h-4 sm:w-4',
    active ? 'text-[#f97316]' : 'text-neutral-600 dark:text-white',
  );
}

function programmingSectionActive(pathname: string) {
  if (pathname.startsWith('/category/lap-trinh')) return true;
  return LAP_TRINH_QUICK.some(
    (l) => l.href !== '/category/lap-trinh' && pathname === l.href,
  );
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [paletteShortcut, setPaletteShortcut] = useState('Ctrl+K');
  const cmdkStateRef = useRef({ count: 0, search: '' });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api<Category[]>('/api/categories'),
  });

  useEffect(() => {
    setPaletteShortcut(
      /Mac|iPhone|iPad/i.test(navigator.userAgent) ? '⌘K' : 'Ctrl+K',
    );
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const handleCommandEnter = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'Enter') return;
      const { count, search } = cmdkStateRef.current;
      const q = search.trim();
      if (count > 0 || !q) return;
      e.preventDefault();
      toast.info(`Tìm kiếm: "${q}" (đang phát triển)`);
      setSearchOpen(false);
    },
    [],
  );

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const catLinks =
    categories?.map((c) => ({
      href: `/category/${c.slug}`,
      label: c.navLabel ?? c.name,
      slug: c.slug,
    })) ?? [];

  const otherCats = catLinks.filter((c) => c.slug !== 'lap-trinh');
  const lapLabel =
    categories?.find((c) => c.slug === 'lap-trinh')?.navLabel ?? 'LẬP TRÌNH';

  const moreSectionActive =
    isActive('/bai-ghim') ||
    isActive('/bai-moi') ||
    otherCats.some((c) => isActive(c.href));

  const linkRowClass =
    'inline-flex items-center gap-1.5 py-1.5 transition-colors hover:opacity-95 sm:gap-2';

  const dropdownTriggerClass = cn(
    linkRowClass,
    'rounded-md border-0 bg-transparent cursor-pointer',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'data-[state=open]:bg-muted/70 dark:data-[state=open]:bg-white/[0.06]',
  );

  const menuContentClass =
    'min-w-[13.5rem] border-border dark:border-white/10 dark:bg-[#121214] dark:shadow-xl';

  const openSearch = () => setSearchOpen(true);

  const homeLink = PRIMARY_LINKS[0];
  const morePrimary = PRIMARY_LINKS.slice(1);
  const HomeIcon = homeLink.icon;

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-50 w-full border-b backdrop-blur-md',
          'border-neutral-200/80 bg-background/75',
          'dark:border-white/[0.08] dark:bg-black/70',
        )}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex min-h-12 items-center gap-2 py-1.5 sm:min-h-[3.25rem] sm:gap-3 md:gap-4">
            <Link
              href="/"
              className="flex shrink-0 items-center py-0.5 transition-opacity hover:opacity-95"
            >
              <DonixLogo variant="adaptive" size="md" />
            </Link>

            <nav
              className="hidden min-w-0 flex-1 justify-center md:flex"
              aria-label="Menu chính"
            >
              <ul className="flex min-w-max items-center justify-center gap-5 px-1 lg:gap-8">
                <li className="flex items-center">
                  <Link href={homeLink.href} className={linkRowClass}>
                    <HomeIcon
                      className={pillIconClass(isActive(homeLink.href))}
                      aria-hidden
                    />
                    <NavLabel active={isActive(homeLink.href)}>
                      {homeLink.label}
                    </NavLabel>
                  </Link>
                </li>

                <li className="flex items-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger className={dropdownTriggerClass}>
                      <FolderOpen
                        className={pillIconClass(programmingSectionActive(pathname))}
                        aria-hidden
                      />
                      <NavLabel active={programmingSectionActive(pathname)}>
                        {lapLabel}
                      </NavLabel>
                      <ChevronDown
                        className={cn(
                          'ml-0.5 h-3 w-3 shrink-0 opacity-90 sm:h-3.5 sm:w-3.5',
                          programmingSectionActive(pathname)
                            ? 'text-[#f97316]'
                            : 'text-neutral-600 dark:text-white',
                        )}
                        aria-hidden
                      />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="center"
                      className={menuContentClass}
                    >
                      {LAP_TRINH_QUICK.map((item) => (
                        <DropdownMenuItem key={item.href} asChild>
                          <Link href={item.href}>{item.label}</Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>

                <li className="flex items-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger className={dropdownTriggerClass}>
                      <NavMoreIcon
                        className={pillIconClass(moreSectionActive)}
                      />
                      <NavLabel active={moreSectionActive}>
                        XEM THÊM
                      </NavLabel>
                      <ChevronDown
                        className={cn(
                          'ml-0.5 h-3 w-3 shrink-0 opacity-90 sm:h-3.5 sm:w-3.5',
                          moreSectionActive
                            ? 'text-[#f97316]'
                            : 'text-neutral-600 dark:text-white',
                        )}
                        aria-hidden
                      />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="center"
                      className={menuContentClass}
                    >
                      {morePrimary.map((item) => {
                        const Icon = item.icon;
                        return (
                          <DropdownMenuItem key={item.href} asChild>
                            <Link
                              href={item.href}
                              className="flex items-center gap-2"
                            >
                              <Icon
                                className="h-4 w-4 text-muted-foreground"
                                aria-hidden
                              />
                              {item.label}
                            </Link>
                          </DropdownMenuItem>
                        );
                      })}
                      {otherCats.length > 0 ? (
                        <DropdownMenuSeparator className="dark:bg-white/10" />
                      ) : null}
                      {otherCats.map((item) => (
                        <DropdownMenuItem key={item.href} asChild>
                          <Link href={item.href} className="flex items-center gap-2">
                            <FolderOpen
                              className="h-4 w-4 text-muted-foreground"
                              aria-hidden
                            />
                            {item.label}
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              </ul>
            </nav>

            <div className="ml-auto flex h-9 shrink-0 items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={openSearch}
                className={cn(
                  'group flex h-9 cursor-pointer items-center rounded-lg border transition-all duration-200',
                  'w-9 shrink-0 justify-center p-0 sm:w-auto sm:min-w-[11.5rem] sm:justify-between sm:gap-2 sm:px-3',
                  'md:min-w-[15rem]',
                  'border-neutral-300/60 bg-neutral-200/50 hover:border-neutral-400/70 hover:bg-neutral-200/80',
                  'dark:border-gray-700/50 dark:bg-gray-800/40 dark:hover:border-gray-600 dark:hover:bg-gray-700/50',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                )}
                aria-label={`Mở tìm kiếm (${paletteShortcut})`}
                title={`Tìm kiếm · ${paletteShortcut}`}
              >
                <div className="flex min-w-0 flex-1 items-center justify-center gap-0 sm:justify-start sm:gap-2">
                  <Search
                    className="h-4 w-4 shrink-0 text-neutral-500 group-hover:text-neutral-700 dark:text-gray-400 dark:group-hover:text-gray-300"
                    aria-hidden
                  />
                  <span className="hidden min-w-0 flex-1 truncate text-left text-sm leading-none text-neutral-600 group-hover:text-neutral-800 dark:text-gray-400 dark:group-hover:text-gray-300 sm:block">
                    Tìm kiếm...
                  </span>
                </div>
                <kbd
                  className={cn(
                    'hidden shrink-0 items-center px-1.5 py-0.5 font-mono text-[11px] font-medium leading-none md:inline-flex',
                    'rounded border border-neutral-400/50 bg-black/5 text-neutral-600',
                    'dark:border-gray-700 dark:bg-black/30 dark:text-gray-400',
                  )}
                >
                  {paletteShortcut === '⌘K' ? (
                    '⌘K'
                  ) : (
                    <>
                      <span className="text-[10px]">Ctrl</span>
                      <span>K</span>
                    </>
                  )}
                </kbd>
              </button>

              <div
                className="hidden h-9 w-px shrink-0 self-center bg-neutral-300 dark:bg-gray-700 sm:block"
                aria-hidden
              />

              <ThemeToggle className="relative shrink-0" />
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 md:hidden text-muted-foreground"
                    aria-label="Mở menu"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="w-[300px] bg-background/95 backdrop-blur-lg border-border"
                >
                  <SheetHeader className="sr-only">
                    <SheetTitle>Menu điều hướng</SheetTitle>
                    <SheetDescription>
                      Liên kết trang chủ, danh mục và tìm kiếm.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="flex flex-col gap-5 py-6">
                    <Link href="/" className="block py-1">
                      <DonixLogo variant="adaptive" size="md" />
                    </Link>
                    <SheetClose asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-start gap-2 rounded-full border-border dark:border-white/12"
                        onClick={() => {
                          window.setTimeout(() => openSearch(), 0);
                        }}
                      >
                        <Search className="h-4 w-4" />
                        Tìm kiếm…
                        <span className="ml-auto hidden font-mono text-[10px] text-muted-foreground md:inline">
                          {paletteShortcut}
                        </span>
                      </Button>
                    </SheetClose>
                    <nav className="flex flex-col gap-1 text-sm font-semibold">
                      <Link
                        href={homeLink.href}
                        className={cn(
                          'px-3 py-2 rounded-lg transition-colors',
                          isActive(homeLink.href)
                            ? 'text-[#f97316] bg-[#f97316]/10'
                            : 'text-foreground/90 hover:bg-muted hover:text-foreground',
                        )}
                      >
                        {homeLink.label}
                      </Link>
                      <p className="px-3 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {lapLabel}
                      </p>
                      {LAP_TRINH_QUICK.map((item) => {
                        const lapItemActive =
                          item.href === '/category/lap-trinh'
                            ? isActive(item.href)
                            : pathname === item.href;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                              'px-3 py-2 rounded-lg transition-colors pl-5',
                              lapItemActive
                                ? 'text-[#f97316] bg-[#f97316]/10'
                                : 'text-foreground/90 hover:bg-muted hover:text-foreground',
                            )}
                          >
                            {item.label}
                          </Link>
                        );
                      })}
                      <p className="px-3 pt-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        XEM THÊM
                      </p>
                      {morePrimary.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                              'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors pl-5',
                              isActive(item.href)
                                ? 'text-[#f97316] bg-[#f97316]/10'
                                : 'text-foreground/90 hover:bg-muted hover:text-foreground',
                            )}
                          >
                            <Icon
                              className="h-4 w-4 text-muted-foreground"
                              aria-hidden
                            />
                            {item.label}
                          </Link>
                        );
                      })}
                      {otherCats.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors pl-5',
                            isActive(item.href)
                              ? 'text-[#f97316] bg-[#f97316]/10'
                              : 'text-foreground/90 hover:bg-muted hover:text-foreground',
                          )}
                        >
                          <FolderOpen
                            className="h-4 w-4 text-muted-foreground"
                            aria-hidden
                          />
                          {item.label}
                        </Link>
                      ))}
                    </nav>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent
          showCloseButton={false}
          className="overflow-hidden p-0 gap-0 max-w-xl border-border bg-background/90 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0c0c0d]/90"
        >
          <DialogTitle className="sr-only">
            Tìm kiếm và điều hướng nhanh
          </DialogTitle>
          <CommandPaletteRoot
            onKeyDown={handleCommandEnter}
            className="flex h-full w-full flex-col overflow-hidden rounded-lg border-0 bg-transparent text-popover-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
          >
            <CmdkEnterSync stateRef={cmdkStateRef} />
            <CommandInput
              placeholder="Gõ để lọc trang hoặc tìm kiếm…"
              className="border-border/60 dark:border-white/10"
            />
            <CommandList>
              <CommandEmpty>Nhấn Enter để gửi tìm kiếm (demo).</CommandEmpty>
              <CommandGroup heading="Trang">
                {PRIMARY_LINKS.map(({ href, label, icon: Icon }) => (
                  <CommandItem
                    key={href}
                    value={`${label} ${href}`}
                    onSelect={() => {
                      router.push(href);
                      setSearchOpen(false);
                    }}
                  >
                    <Icon className="text-muted-foreground" aria-hidden />
                    {label}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading={lapLabel}>
                {LAP_TRINH_QUICK.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={`${item.label} ${item.href}`}
                    onSelect={() => {
                      router.push(item.href);
                      setSearchOpen(false);
                    }}
                  >
                    <FolderOpen
                      className="text-muted-foreground"
                      aria-hidden
                    />
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
              {otherCats.length > 0 ? (
                <CommandGroup heading="Chuyên mục khác">
                  {otherCats.map(({ href, label, slug }) => (
                    <CommandItem
                      key={href}
                      value={`${label} ${slug} ${href}`}
                      onSelect={() => {
                        router.push(href);
                        setSearchOpen(false);
                      }}
                    >
                      <FolderOpen
                        className="text-muted-foreground"
                        aria-hidden
                      />
                      {label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
            </CommandList>
            <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[10px] text-muted-foreground dark:border-white/10">
              <span>Điều hướng nhanh</span>
              <CommandShortcut className="text-[10px]">
                {paletteShortcut}
              </CommandShortcut>
            </div>
          </CommandPaletteRoot>
        </DialogContent>
      </Dialog>
    </>
  );
}
