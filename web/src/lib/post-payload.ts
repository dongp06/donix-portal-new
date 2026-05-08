import type { ApiResponse } from '@shared/types';
import type { Post } from '@shared/types';

export type PostPagePayload = { post: Post; articleHtml: string };

/** Client: JSON gọn + HTML nội dung từ API (2 request song song qua rewrite). */
export async function fetchPostPagePayload(slug: string): Promise<PostPagePayload> {
  const enc = encodeURIComponent(slug);
  const [jsonRes, htmlRes] = await Promise.all([
    fetch(`/api/posts/${enc}?omit=content`),
    fetch(`/api/posts/rendered/${enc}`),
  ]);
  const articleHtml = await htmlRes.text();
  if (!htmlRes.ok) {
    throw new Error('Không tải được nội dung HTML');
  }
  const json = (await jsonRes.json()) as ApiResponse<Post>;
  if (!jsonRes.ok || !json.success || json.data === undefined) {
    throw new Error(json.error || 'Request failed');
  }
  return { post: json.data, articleHtml };
}
