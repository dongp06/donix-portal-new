import type { Metadata } from 'next';
import { PostsPage } from '@/components/posts/PostsPage';
import { absoluteUrl } from '@/lib/site';

export const metadata: Metadata = { title: 'Posts nổi bật', description: 'Những bài viết đang được cộng đồng thuebot.org quan tâm.', alternates: { canonical: absoluteUrl('/posts/noi-bat') } };
export default function Page() { return <PostsPage mode="featured" />; }
