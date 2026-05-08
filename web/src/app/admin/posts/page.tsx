'use client';

import { Button } from '@/components/ui/button';
import { apiAdmin } from '@/lib/api-client';
import type { Post } from '@shared/types';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function AdminPostsPage() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await apiAdmin<Post[]>('/api/admin/posts');
      setPosts(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi tải danh sách');
      setPosts([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onDelete(id: string, title: string) {
    if (!window.confirm(`Xóa bài "${title}"? Thao tác không hoàn tác.`)) return;
    try {
      await apiAdmin<boolean>(`/api/admin/posts/${id}`, { method: 'DELETE' });
      toast.success('Đã xóa bài');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Xóa thất bại');
    }
  }

  if (posts === null) {
    return <p className="text-zinc-400">Đang tải…</p>;
  }

  if (error) {
    return (
      <div className="space-y-3 rounded-md border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
        <p>{error}</p>
        <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
          Thử lại
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400">{posts.length} bài viết (lưu trong bộ nhớ API — khởi động lại sẽ reset về mock).</p>
      <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800 bg-zinc-900/40">
        {posts.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <Link
                href={`/admin/posts/${p.id}`}
                className="font-medium text-white hover:text-amber-400"
              >
                {p.title}
              </Link>
              <p className="truncate text-xs text-zinc-500">
                /{p.slug} · {p.categoryName} · {p.date}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button asChild size="sm" variant="outline" className="border-zinc-600 bg-zinc-950 text-zinc-200">
                <Link href={`/posts/${p.slug}`} target="_blank" rel="noreferrer">
                  Xem
                </Link>
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => void onDelete(p.id, p.title)}
              >
                Xóa
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
