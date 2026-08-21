import Link from 'next/link';
import { Activity, ArrowUpRight, Bot, ChevronDown, SearchCheck, Send } from 'lucide-react';
import { ThuebotLogo } from '@/components/brand/ThuebotLogo';

type FooterLink = {
  href: string;
  label: string;
  external?: boolean;
};

type FooterGroup = {
  id: string;
  title: string;
  links: FooterLink[];
};

const footerGroups: FooterGroup[] = [
  {
    id: 'explore',
    title: 'Khám phá',
    links: [
      { href: '/bots', label: 'Khám phá bot' },
      { href: '/check', label: 'Kiểm tra seller' },
      { href: '/posts', label: 'Bài viết' },
      { href: '/resources', label: 'Tài nguyên chính thức' },
    ],
  },
  {
    id: 'seller',
    title: 'Dành cho seller',
    links: [
      { href: '/dashboard', label: 'Đăng bot' },
      { href: '/seller/verification', label: 'Trusted Seller' },
      { href: '/dashboard?tab=profile', label: 'Hồ sơ seller' },
    ],
  },
  {
    id: 'support',
    title: 'Hỗ trợ',
    links: [
      { href: '/posts/hoi-dap', label: 'FAQ' },
      { href: 'https://t.me/donix_bot_dev', label: 'Báo cáo / liên hệ', external: true },
      { href: '/terms', label: 'Điều khoản' },
    ],
  },
];

function FooterLinkItem({ link }: { link: FooterLink }) {
  const className =
    'inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground dark:text-[#A5AAB4] dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677FF] focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-offset-[#0A0C0F]';

  if (link.external) {
    return (
      <a href={link.href} target="_blank" rel="noreferrer" className={className}>
        {link.label}
        <ArrowUpRight className="h-3.5 w-3.5 opacity-60" aria-hidden />
      </a>
    );
  }

  return (
    <Link href={link.href} className={className}>
      {link.label}
    </Link>
  );
}

function FooterLinkList({ links }: { links: FooterLink[] }) {
  return (
    <ul className="space-y-2.5">
      {links.map((link) => (
        <li key={`${link.href}-${link.label}`}>
          <FooterLinkItem link={link} />
        </li>
      ))}
    </ul>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/40 text-foreground dark:border-[#20242B] dark:bg-[#0A0C0F] dark:text-[#F5F7FA]">
      <div className="mx-auto max-w-[1220px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between lg:gap-16">
          <div className="max-w-[360px]">
            <Link href="/" aria-label="thuebot.org — về trang chủ" className="inline-flex">
              <ThuebotLogo size="lg" variant="adaptive" />
            </Link>
            <p className="mt-4 text-sm leading-6 text-muted-foreground dark:text-[#D2D6DD]">
              Chợ bot tự động hóa với seller được xác minh uy tín.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link
                href="/check"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#1677FF]/60 px-3.5 py-2 text-xs font-semibold text-[#1677FF] transition-colors hover:border-[#1677FF] hover:bg-[#1677FF]/10 dark:text-white dark:hover:bg-[#1677FF]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677FF] focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-offset-[#0A0C0F]"
              >
                <SearchCheck className="h-3.5 w-3.5 text-[#5C9BFF]" aria-hidden />
                Kiểm tra seller
              </Link>
              <Link
                href="/bots"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted dark:border-[#3A414D] dark:text-[#D2D6DD] dark:hover:border-[#6B7280] dark:hover:bg-white/5 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677FF] focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-offset-[#0A0C0F]"
              >
                <Bot className="h-3.5 w-3.5 text-[#10C98A]" aria-hidden />
                Khám phá bot
              </Link>
            </div>
          </div>

          <div className="mt-1 w-full lg:max-w-[560px]">
            <div className="grid grid-cols-1 gap-0 sm:grid-cols-3 sm:gap-10 lg:gap-14">
              {footerGroups.map((group) => (
                <nav key={group.id} className="hidden sm:block" aria-label={group.title}>
                  <h2 className="mb-4 text-sm font-semibold text-foreground dark:text-white">{group.title}</h2>
                  <FooterLinkList links={group.links} />
                </nav>
              ))}
            </div>

            <div className="sm:hidden">
              {footerGroups.map((group) => (
                <details key={group.id} className="group border-b border-border last:border-b-0 dark:border-[#20242B]">
                  <summary className="flex cursor-pointer list-none items-center justify-between py-3.5 text-sm font-semibold text-foreground dark:text-white [&::-webkit-details-marker]:hidden">
                    {group.title}
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180 dark:text-[#8D96A5]" aria-hidden />
                  </summary>
                  <div className="pb-4">
                    <FooterLinkList links={group.links} />
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-4 border-t border-border pt-5 text-xs sm:flex-row sm:items-center sm:justify-between dark:border-[#20242B]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-muted-foreground dark:text-[#8D96A5]">
            <span>© 2026 thuebot.org</span>
            <span className="hidden text-border sm:inline dark:text-[#3A414D]" aria-hidden>·</span>
            <Link href="/terms" className="transition-colors hover:text-foreground dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677FF]">Điều khoản</Link>
            <Link href="/privacy" className="transition-colors hover:text-foreground dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677FF]">Quyền riêng tư</Link>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-muted-foreground dark:text-[#A5AAB4]">
            <a
              href="https://t.me/donix_bot_dev"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677FF]"
            >
              <Send className="h-3.5 w-3.5 text-[#5C9BFF]" aria-hidden />
              Telegram
              <ArrowUpRight className="h-3 w-3 opacity-60" aria-hidden />
            </a>
            <span className="inline-flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-[#10C98A]" aria-hidden />
              Hệ thống hoạt động
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
