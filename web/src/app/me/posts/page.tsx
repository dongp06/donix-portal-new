import type { Metadata } from 'next';
import { MyPostsPage } from '@/components/posts/MyPostsPage';

export const metadata: Metadata = { title: 'Bài viết của tôi | thuebot.org', robots: { index: false, follow: false } };
export default function Page() { return <MyPostsPage />; }
