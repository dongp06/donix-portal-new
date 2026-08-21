'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useRole } from '../../context/RoleContext';
import { Menu, X, LayoutDashboard, Plus, LogOut, UserRound, Store, ShieldCheck, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ThuebotLogo } from '@/components/brand/ThuebotLogo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { MediaImage } from '@/components/media/MediaImage';
import { toast } from 'sonner';

export function Navbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, staffRole, becomeSeller, logout } = useRole();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [becomingSeller, setBecomingSeller] = useState(false);

  const handleBecomeSeller = async () => {
    if (becomingSeller) return;
    setBecomingSeller(true);
    try {
      await becomeSeller();
      router.push('/dashboard');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể nâng cấp tài khoản.');
    } finally {
      setBecomingSeller(false);
    }
  };

  const navLinks = [
    { href: '/bots', label: 'Khám phá bot' },
    { href: '/check', label: 'Kiểm tra seller' },
    { href: '/posts', label: 'Bài viết' },
    { href: '/dashboard', label: 'Dành cho seller' },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label="thuebot.org — về trang chủ">
            <ThuebotLogo size="md" />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="Điều hướng chính">
            {navLinks.map((link) => {
              const active =
                link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Post a bot CTA */}
          <Link
            href="/dashboard"
            className="hidden items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-xs font-semibold text-brand-foreground transition-colors hover:brightness-110 sm:inline-flex"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Đăng tin bot
          </Link>

          <ThemeToggle />

          {/* Auth: đăng nhập / đăng xuất */}
          {isAuthenticated === false ? (
            <Link
              href="/login"
              className="hidden items-center gap-1.5 rounded-xl border border-brand/40 px-3.5 py-2 text-xs font-semibold text-brand transition-colors hover:bg-brand/10 sm:inline-flex"
            >
              Đăng nhập / Đăng ký
            </Link>
          ) : null}

          {/* User menu */}
          <div className="hidden md:block">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-full border border-border p-0.5 pr-2 transition-colors hover:bg-muted"
                  aria-label="Menu tài khoản"
                >
                  <MediaImage
                    src={user.avatar}
                    alt={user.name}
                    fallbackSrc="/avt.png"
                    className="h-7 w-7 rounded-full border border-border object-cover"
                  />
                  <span className="hidden max-w-[8rem] truncate text-xs font-semibold lg:block">
                    {user.name}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold">{user.name}</span>
                  <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user.role === 'seller' ? (
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard">
                      <LayoutDashboard className="mr-2 h-4 w-4" aria-hidden />
                      Đăng bot
                    </Link>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem asChild>
                    <Link href="/profile">
                      <UserRound className="mr-2 h-4 w-4" aria-hidden />
                      Trang cá nhân
                    </Link>
                  </DropdownMenuItem>
                )}
                {user.role !== 'seller' && (
                  <DropdownMenuItem
                    disabled={becomingSeller}
                    onSelect={() => {
                      void handleBecomeSeller();
                    }}
                  >
                    {becomingSeller ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Store className="mr-2 h-4 w-4" aria-hidden />}
                    {becomingSeller ? 'Đang nâng cấp…' : 'Trở thành nhà cung cấp'}
                  </DropdownMenuItem>
                )}
                {staffRole && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin">
                        <ShieldCheck className="mr-2 h-4 w-4" aria-hidden />
                        Trang quản trị
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                {isAuthenticated === true && (
                  <DropdownMenuItem
                    onSelect={() => {
                      void logout();
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" aria-hidden />
                    Đăng xuất
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
            onClick={() => setIsMobileMenuOpen((v) => !v)}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-nav"
            aria-label={isMobileMenuOpen ? 'Đóng menu' : 'Mở menu'}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {isMobileMenuOpen && (
        <nav id="mobile-nav" className="border-t border-border bg-background md:hidden">
          <div className="space-y-1 px-4 py-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  'block rounded-lg px-3 py-2 text-sm font-medium',
                  pathname === link.href
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground',
                )}
              >
                {link.label}
              </Link>
            ))}
            {user.role === 'seller' && (
              <Link
                href="/dashboard"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-brand"
              >
                <Plus className="h-4 w-4" aria-hidden />
                Đăng tin bot
              </Link>
            )}
            {isAuthenticated === true ? (
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  void logout();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-brand"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                Đăng xuất
              </button>
            ) : (
              <Link
                href="/register"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-brand"
              >
                Đăng nhập / Đăng ký
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
