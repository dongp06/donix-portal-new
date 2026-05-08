import type { ApiResponse } from '@shared/types';
import type { Category } from '@shared/types';

function apiBase(): string {
  return process.env.API_URL?.replace(/\/$/, '') ?? 'http://localhost:3001';
}

/** Metadata chuyên mục (SSR). */
export async function fetchCategoryMetaServer(
  slug: string,
): Promise<{ name: string; description: string } | null> {
  try {
    const res = await fetch(`${apiBase()}/api/categories`, {
      next: { revalidate: 3600 },
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as ApiResponse<Category[]>;
    if (!json.success || !json.data) return null;
    const c = json.data.find((x) => x.slug === slug);
    if (!c) return null;
    const name = c.name;
    const description =
      `Tổng hợp bài viết, tải tool và hướng dẫn chuyên mục ${name} tại Donix.Net.`.slice(
        0,
        160,
      );
    return { name, description };
  } catch {
    return null;
  }
}
