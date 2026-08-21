import type { Metadata } from 'next';
import { PostEditor } from '@/components/posts/PostEditor';

export const metadata: Metadata = { title: 'Chỉnh sửa bài viết | thuebot.org', robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PostEditor postId={slug} />;
}
