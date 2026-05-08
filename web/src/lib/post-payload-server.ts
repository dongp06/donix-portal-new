import type { ApiResponse } from '@shared/types';
import type { Post } from '@shared/types';
import type { PostPagePayload } from './post-payload';

function apiBase(): string {
  return process.env.API_URL?.replace(/\/$/, '') ?? 'http://localhost:3001';
}

/** Server Components: gọi thẳng Nest (cần API_URL khi SSR). */
export async function fetchPostPagePayloadServer(slug: string): Promise<PostPagePayload> {
  const base = apiBase();
  const enc = encodeURIComponent(slug);
  const [jsonRes, htmlRes] = await Promise.all([
    fetch(`${base}/api/posts/${enc}?omit=content`, {
      next: { revalidate: 120 },
      headers: { Accept: 'application/json' },
    }),
    fetch(`${base}/api/posts/rendered/${enc}`, {
      next: { revalidate: 120 },
      headers: { Accept: 'text/html' },
    }),
  ]);
  if (!jsonRes.ok || !htmlRes.ok) {
    throw new Error('NOT_FOUND');
  }
  const json = (await jsonRes.json()) as ApiResponse<Post>;
  if (!json.success || json.data === undefined) {
    throw new Error('NOT_FOUND');
  }
  const articleHtml = await htmlRes.text();
  return { post: json.data, articleHtml };
}

export async function fetchPostMetaServer(
  slug: string,
): Promise<Pick<Post, 'title' | 'excerpt' | 'coverImage' | 'date' | 'categoryName'>> {
  const base = apiBase();
  const enc = encodeURIComponent(slug);
  const jsonRes = await fetch(`${base}/api/posts/${enc}?omit=content`, {
    next: { revalidate: 120 },
    headers: { Accept: 'application/json' },
  });
  if (!jsonRes.ok) {
    throw new Error('NOT_FOUND');
  }
  const json = (await jsonRes.json()) as ApiResponse<Post>;
  if (!json.success || json.data === undefined) {
    throw new Error('NOT_FOUND');
  }
  const p = json.data;
  return {
    title: p.title,
    excerpt: p.excerpt,
    coverImage: p.coverImage,
    date: p.date,
    categoryName: p.categoryName,
  };
}
