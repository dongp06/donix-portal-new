import type { MetadataRoute } from 'next';
import type { ApiResponse } from '@shared/types';
import type { Category, Post } from '@shared/types';
import { getSiteUrl } from '@/lib/site';

function apiBase(): string {
  return process.env.API_URL?.replace(/\/$/, '') ?? 'http://localhost:3001';
}

async function fetchApi<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      next: { revalidate: 3600 },
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as ApiResponse<T>;
    if (!json.success || json.data === undefined) return null;
    return json.data;
  } catch {
    return null;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: 'daily', priority: 1 },
    {
      url: `${base}/bai-moi`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${base}/bai-ghim`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ];

  const [categories, posts] = await Promise.all([
    fetchApi<Category[]>('/api/categories'),
    fetchApi<Post[]>('/api/posts'),
  ]);

  const categoryEntries: MetadataRoute.Sitemap = (categories ?? []).map((c) => ({
    url: `${base}/category/${encodeURIComponent(c.slug)}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.85,
  }));

  const postEntries: MetadataRoute.Sitemap = (posts ?? []).map((p) => {
    const lastModified = p.date ? new Date(p.date) : now;
    return {
      url: `${base}/posts/${encodeURIComponent(p.slug)}`,
      lastModified: Number.isNaN(lastModified.getTime()) ? now : lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    };
  });

  return [...staticEntries, ...categoryEntries, ...postEntries];
}
