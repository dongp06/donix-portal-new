'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRole } from '../../context/RoleContext';
import { Bot, ArrowRightLeft, Menu, X } from 'lucide-react';
export function Navbar() {
  const pathname = usePathname();
  const { role, toggleRole, user } = useRole();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: '/', label: 'Trang Chủ' },
    { href: '/bots', label: 'Chợ Bot Cho Thuê' },
    { href: '/community', label: 'Diễn Đàn Cộng Đồng' },
    { href: '/dashboard', label: 'Bảng Điều Khiển' }
  ];

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            {/* Brand Logo */}
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-2.5 group">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-violet-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <div>
                  <span className="text-lg font-black tracking-wider text-white">
                    THUEBOT<span className="text-cyan-400">.SITE</span>
                  </span>
                  <span className="block text-[10px] text-zinc-400 tracking-widest font-semibold uppercase">
                    Sàn Trung Gian & Cộng Đồng Bot Tự Động
                  </span>
                </div>
              </Link>

              {/* Desktop Nav links */}
              <nav className="hidden md:flex items-center gap-1">
                {navLinks.map((link) => {
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-zinc-800/90 text-cyan-400 border border-zinc-700/60 shadow-sm'
                          : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-3">
              {/* Role Toggle Button (Khách Thuê vs Nhà Cung Cấp) */}
              <button
                onClick={toggleRole}
                className={`relative hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-md ${
                  role === 'provider'
                    ? 'border-violet-500/50 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 shadow-violet-500/10'
                    : 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 shadow-cyan-500/10'
                }`}
                title="Bấm để chuyển chế độ xem giữa Người Thuê Bot và Người Cho Thuê Bot"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>
                  {role === 'provider' ? 'Chế độ: Cho Thuê (Chủ Bot)' : 'Chế độ: Khách Thuê Bot'}
                </span>
                <span className="relative flex h-2 w-2">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      role === 'provider' ? 'bg-violet-400' : 'bg-cyan-400'
                    }`}
                  ></span>
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      role === 'provider' ? 'bg-violet-500' : 'bg-cyan-500'
                    }`}
                  ></span>
                </span>
              </button>

              {/* User profile dropdown avatar */}
              <div className="hidden lg:flex items-center gap-2 border-l border-zinc-800 pl-3">
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-8 h-8 rounded-full border border-zinc-700 object-cover"
                />
                <div className="text-left text-[11px]">
                  <span className="block font-semibold text-white leading-tight">{user.name}</span>
                  <span className="text-[10px] text-zinc-400">
                    {role === 'provider' ? 'Nhà Cung Cấp' : 'Khách Thuê'}
                  </span>
                </div>
              </div>

              {/* Mobile menu button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-b border-zinc-800 bg-zinc-950 p-4 space-y-3">
            <button
              onClick={() => {
                toggleRole();
                setIsMobileMenuOpen(false);
              }}
              className={`w-full py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-between ${
                role === 'provider' ? 'border-violet-500/50 bg-violet-500/10 text-violet-300' : 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300'
              }`}
            >
              <span>Chuyển chế độ: {role === 'provider' ? 'Cho Thuê Bot' : 'Khách Thuê Bot'}</span>
              <ArrowRightLeft className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-xl text-sm font-semibold text-zinc-300 hover:bg-zinc-900"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>
    </>
  );
}
