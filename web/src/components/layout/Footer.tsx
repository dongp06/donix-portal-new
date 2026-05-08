import Link from 'next/link';
import { Github, Globe, Mail } from 'lucide-react';

import { DonixLogo } from '@/components/brand/DonixLogo';
import { cn } from '@/lib/utils';

const linkClass = cn(
  'text-[13px] md:text-sm text-gray-400 transition-colors duration-200',
  'hover:text-orange-400',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]',
);

const headingClass =
  'text-base md:text-lg font-semibold text-orange-500 mb-4 tracking-tight';

export function Footer() {
  return (
    <footer className="border-t border-gray-800/60 bg-[#0a0a0a] py-8 font-sans text-gray-300 md:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4 lg:gap-12">
          {/* Brand — mobile full width, desktop one column */}
          <div className="col-span-2 space-y-3 lg:col-span-1">
            <Link
              href="/"
              className="inline-block transition-opacity duration-200 hover:opacity-90"
            >
              <DonixLogo variant="darkBar" size="lg" />
            </Link>
            <p className="text-justify text-[13px] leading-relaxed text-gray-400 md:text-sm">
              Không phải sản phẩm hoàn hảo hay đột phá. Những gì ở đây được đúc
              kết từ trải nghiệm thực tế — học, làm và vấp ngã. Không phô
              trương; chỉ tập trung chia sẻ tài nguyên và công cụ thực chiến
              cho dev và cộng đồng.
            </p>
          </div>

          {/* Chuyên mục */}
          <div className="col-span-1">
            <h3 className={headingClass}>Chuyên mục</h3>
            <ul className="space-y-2.5 text-[13px] md:text-sm">
              <li>
                <Link href="/category/lap-trinh" className={linkClass}>
                  Lập trình
                </Link>
              </li>
              <li>
                <Link href="/category/game-mod" className={linkClass}>
                  Mobi Army2 / Game mod
                </Link>
              </li>
              <li>
                <Link href="/category/phan-mem" className={linkClass}>
                  Phần mềm &amp; TUT
                </Link>
              </li>
              <li>
                <Link href="/category/tool-tien-ich" className={linkClass}>
                  Tool tiện ích
                </Link>
              </li>
            </ul>
          </div>

          {/* Thông tin */}
          <div className="col-span-1">
            <h3 className={headingClass}>Thông tin</h3>
            <ul className="space-y-2.5 text-[13px] md:text-sm">
              <li>
                <Link href="/" className={linkClass}>
                  Trang chủ
                </Link>
              </li>
              <li>
                <Link href="/bai-ghim" className={linkClass}>
                  Bài viết đã ghim
                </Link>
              </li>
              <li>
                <Link href="/bai-moi" className={linkClass}>
                  Bài viết mới nhất
                </Link>
              </li>
              <li>
                <Link href="/" className={linkClass}>
                  Điều khoản sử dụng
                </Link>
              </li>
              <li>
                <Link href="/" className={linkClass}>
                  Chính sách bảo mật
                </Link>
              </li>
              <li>
                <Link href="/" className={linkClass}>
                  Liên hệ quảng cáo
                </Link>
              </li>
            </ul>
          </div>

          {/* Liên hệ — mobile full width */}
          <div className="col-span-2 mt-2 lg:col-span-1 lg:mt-0">
            <h3 className={headingClass}>Liên hệ</h3>
            <ul className="space-y-3.5 text-[13px] md:text-sm">
              <li className="group flex items-center gap-3">
                <Mail
                  size={16}
                  className="shrink-0 text-gray-500 transition-colors group-hover:text-orange-500"
                  aria-hidden
                />
                <a
                  href="mailto:contact@donix.net"
                  className={cn(
                    linkClass,
                    'min-w-0 truncate border-b border-transparent hover:border-orange-400/40',
                  )}
                >
                  contact@donix.net
                </a>
              </li>
              <li className="group flex items-center gap-3">
                <Github
                  size={16}
                  className="shrink-0 text-gray-500 transition-colors group-hover:text-orange-500"
                  aria-hidden
                />
                <a
                  href="https://github.com/donix-portal"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    linkClass,
                    'min-w-0 truncate border-b border-transparent hover:border-orange-400/40',
                  )}
                >
                  github.com/donix-portal
                </a>
              </li>
              <li className="group flex items-start gap-3">
                <Globe
                  size={16}
                  className="mt-0.5 shrink-0 text-gray-500 transition-colors group-hover:text-orange-500"
                  aria-hidden
                />
                <a
                  href="https://www.facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    linkClass,
                    'leading-snug border-b border-transparent hover:border-orange-400/40',
                  )}
                >
                  Group Fb: ReverseVN – Developers Powered by ChatAI
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-gray-800/60 pt-5 text-[11px] text-gray-500 md:flex-row md:text-xs">
          <p>© 2024 – 2026 Donix Portal. Mọi quyền được bảo lưu.</p>
          <p className="text-center md:text-right">
            <span>
              Thiết kế bởi{' '}
              <span className="cursor-pointer font-medium text-gray-300 transition-colors hover:text-orange-500">
                Donix Team
              </span>
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
