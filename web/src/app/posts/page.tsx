import type { Metadata } from 'next';
import { PostsPage } from '@/components/posts/PostsPage';
import { SITE_NAME, absoluteUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Posts cộng đồng',
  description: 'Chia sẻ bot, hỏi đáp, tutorial và cập nhật seller trên thuebot.org.',
  alternates: { canonical: absoluteUrl('/posts') },
  openGraph: { title: `Posts cộng đồng | ${SITE_NAME}`, description: 'Chia sẻ bot, hỏi đáp và cập nhật mới nhất từ cộng đồng.', url: absoluteUrl('/posts'), type: 'website', siteName: SITE_NAME, locale: 'vi_VN' },
};

export default function Page() { return <PostsPage mode="latest" />; }
