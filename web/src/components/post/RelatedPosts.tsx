'use client';

import Link from 'next/link';
import { Calendar, Eye, Link2 } from 'lucide-react';
import type { Post } from '@shared/types';
import { formatPostDate, formatViewCount } from '@/lib/format';

function PostThumb({ post }: { post: Post }) {
  return (
    <div className="h-14 w-14 rounded-lg overflow-hidden shrink-0 border border-border bg-muted">
      <img src={post.coverImage} alt="" className="h-full w-full object-cover" />
    </div>
  );
}

export function RelatedPosts({ posts }: { posts: Post[] }) {
  if (!posts.length) return null;

  return (
    <section className="rounded-xl border border-border overflow-hidden bg-card">
      <div className="flex items-center gap-2 bg-brand px-4 py-2.5 text-brand-foreground font-bold text-sm">
        <Link2 className="h-4 w-4" />
        Bài viết liên quan
      </div>
      <ul className="divide-y divide-border">
        {posts.map((p) => (
          <li key={p.id}>
            <Link
              href={`/posts/${p.slug}`}
              className="flex gap-3 p-4 hover:bg-muted/50 transition-colors group"
            >
              <PostThumb post={p} />
              <div className="min-w-0 flex-1 space-y-1">
                {p.tagLine ? (
                  <p className="text-[11px] font-bold text-brand uppercase tracking-wide">
                    {p.tagLine}
                  </p>
                ) : (
                  <p className="text-[11px] font-bold text-brand uppercase tracking-wide">
                    {p.categoryName}
                  </p>
                )}
                <p className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-brand transition-colors">
                  {p.title}
                </p>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatPostDate(p.date)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {formatViewCount(p.views)}
                  </span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
