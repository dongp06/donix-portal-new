import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Quản trị',
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-amber-500/90">Donix</p>
          <h1 className="text-xl font-semibold text-white">Quản trị bài viết</h1>
        </div>
        <nav className="flex flex-wrap gap-3 text-sm">
          <Link
            href="/admin/posts"
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-zinc-200 hover:bg-zinc-800"
          >
            Danh sách
          </Link>
          <Link
            href="/admin/posts/new"
            className="rounded-md bg-amber-500 px-3 py-1.5 font-medium text-zinc-950 hover:bg-amber-400"
          >
            + Bài mới
          </Link>
          <Link href="/" className="text-zinc-500 hover:text-zinc-300">
            ← Về site
          </Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
