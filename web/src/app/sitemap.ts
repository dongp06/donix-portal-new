import type { MetadataRoute } from 'next';
import type { ApiResponse, Post, PostFeed } from '@shared/types';
import { getSiteUrl } from '@/lib/site';
import { serverTransportFetch } from '@/lib/server-transport';

function apiBase(): string {
  return process.env.API_URL?.replace(/\/$/, '') ?? 'http://localhost:3002';
}

async function fetchPosts(): Promise<Post[]> {
  try {
    const response = await serverTransportFetch(`${apiBase()}/api/posts?limit=100`, {
      next: { revalidate: 3600 },
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return [];
    const json = (await response.json()) as ApiResponse<PostFeed>;
    return json.success && json.data ? json.data.items : [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const now = new Date();
  const posts = await fetchPosts();
  const staticEntries: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/check`, lastModified: now, changeFrequency: 'weekly', priority: 0.85 },
    { url: `${base}/posts`, lastModified: now, changeFrequency: 'daily', priority: 0.95 },
    { url: `${base}/posts/moi`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/posts/noi-bat`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/posts/hoi-dap`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/posts/chia-se`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/posts/canh-bao`, lastModified: now, changeFrequency: 'daily', priority: 0.75 },
  ];

  const postEntries: MetadataRoute.Sitemap = posts.map((post: Post) => ({
    url: `${base}/posts/${encodeURIComponent(post.slug)}`,
    lastModified: new Date(post.updatedAt || post.createdAt),
    changeFrequency: 'daily' as const,
    priority: 0.85,
  }));

  return [...staticEntries, ...postEntries];
}
