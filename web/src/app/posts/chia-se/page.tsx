import type { Metadata } from 'next';
import { PostsPage } from '@/components/posts/PostsPage';
import { absoluteUrl } from '@/lib/site';

export const metadata: Metadata = { title: 'Chia sẻ', description: 'Tutorial, kinh nghiệm và tài nguyên hữu ích từ cộng đồng.', alternates: { canonical: absoluteUrl('/posts/chia-se') } };
export default function Page() { return <PostsPage mode="share" />; }
