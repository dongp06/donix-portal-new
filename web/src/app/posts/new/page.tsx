import type { Metadata } from 'next';
import { PostEditor } from '@/components/posts/PostEditor';

export const metadata: Metadata = { title: 'Đăng bài mới | thuebot.org', robots: { index: false, follow: false } };
export default function Page() { return <PostEditor />; }
