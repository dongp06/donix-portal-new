import type { Metadata } from 'next';
import { PostsPage } from '@/components/posts/PostsPage';
import { absoluteUrl } from '@/lib/site';

export const metadata: Metadata = { title: 'Bài mới', description: 'Dòng bài viết mới nhất từ cộng đồng thuebot.org.', alternates: { canonical: absoluteUrl('/posts/moi') } };
export default function Page() { return <PostsPage mode="latest" />; }
