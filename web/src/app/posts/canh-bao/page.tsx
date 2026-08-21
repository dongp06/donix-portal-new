import type { Metadata } from 'next';
import { PostsPage } from '@/components/posts/PostsPage';
import { absoluteUrl } from '@/lib/site';

export const metadata: Metadata = { title: 'Cảnh báo', description: 'Các cảnh báo cần kiểm tra trước khi kết nối seller.', alternates: { canonical: absoluteUrl('/posts/canh-bao') } };
export default function Page() { return <PostsPage mode="warning" />; }
