'use client';

import React from 'react';
import Link from 'next/link';
import { Bot, Shield, Zap, Server, MessageSquare, Terminal, Heart } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-zinc-800/80 bg-zinc-950 text-zinc-400">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Col */}
          <div className="space-y-4 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <span className="text-base font-black tracking-wider text-white">
                THUEBOT<span className="text-cyan-400">.SITE</span>
              </span>
            </Link>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Sàn giao dịch trung gian cho thuê bot tự động hóa số 1 Việt Nam. Chuyên biệt các dòng Bot Messenger, Telegram, Discord, Zalo & Instagram.
            </p>
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Hệ thống Uptime 99.94% Online</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Khám Phá Bot</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/bots?category=messenger" className="hover:text-cyan-400 transition-colors">
                  Bot Facebook Messenger Auto Inbox
                </Link>
              </li>
              <li>
                <Link href="/bots?category=telegram" className="hover:text-cyan-400 transition-colors">
                  Bot Telegram Spam Group & Kéo Mem
                </Link>
              </li>
              <li>
                <Link href="/bots?category=discord" className="hover:text-cyan-400 transition-colors">
                  Bot Discord Auto Role & Notice Signal
                </Link>
              </li>
              <li>
                <Link href="/bots?category=zalo" className="hover:text-cyan-400 transition-colors">
                  Bot Zalo OA & Auto Spam Tin Nhắn SĐT
                </Link>
              </li>
              <li>
                <Link href="/bots?category=instagram" className="hover:text-cyan-400 transition-colors">
                  Bot Instagram Direct (DM) & Seeding
                </Link>
              </li>
            </ul>
          </div>

          {/* Dành Cho Nhà Cung Cấp */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Dành Cho Chủ Bot</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/dashboard" className="hover:text-cyan-400 transition-colors">
                  Đăng Cho Thuê Phần Mềm (0% Phí Ban Đầu)
                </Link>
              </li>
              <li>
                <Link href="/community" className="hover:text-cyan-400 transition-colors">
                  Nhận Làm Bot Theo Yêu Cầu
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-cyan-400 transition-colors">
                  Hệ Thống Tạo Key & Quản Lý Khách Thuê
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-cyan-400 transition-colors">
                  Quản Lý Doanh Thu Tự Động 24/7
                </Link>
              </li>
            </ul>
          </div>

          {/* Support & Community */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Hỗ Trợ & Cộng Đồng</h4>
            <div className="space-y-2 text-xs">
              <p>Hotline/Zalo Support: <span className="text-white font-semibold">0988.xxx.xxx</span></p>
              <p>Group Telegram Dev: <span className="text-cyan-400 font-semibold">t.me/donix_bot_dev</span></p>
              <p>Email: <span className="text-white">support@donix.vn</span></p>
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-800/80 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 gap-4">
          <p>© 2026 Donix Bot Rental Portal. Phát triển theo mô hình chợ cho thuê bot tự động.</p>
          <p className="flex items-center gap-1">
            Made with <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> for Bot Developers & Automation Community.
          </p>
        </div>
      </div>
    </footer>
  );
}
