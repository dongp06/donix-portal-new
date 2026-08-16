import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { DonixLogo } from '@/components/brand/DonixLogo';

export const metadata: Metadata = {
  title: 'Quản trị',
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div className="flex items-center gap-3">
          <DonixLogo size="sm" />
          <h1 className="text-xl font-semibold text-foreground">Quản trị</h1>
        </div>
        <nav className="flex flex-wrap items-center gap-2 text-sm" aria-label="Điều hướng quản trị">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/posts">Danh sách</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/verifications">Xác minh</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/admin/posts/new">+ Bài mới</Link>
          </Button>
          <Link href="/" className="px-2 text-muted-foreground transition-colors hover:text-foreground">
            ← Về site
          </Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
