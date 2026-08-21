import type { Metadata } from 'next';
import { PostsPage } from '@/components/posts/PostsPage';
import { absoluteUrl } from '@/lib/site';

export const metadata: Metadata = { title: 'Hỏi đáp', description: 'Câu hỏi và câu trả lời về bot, automation và seller.', alternates: { canonical: absoluteUrl('/posts/hoi-dap') } };
export default function Page() { return <PostsPage mode="questions" />; }
