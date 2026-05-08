import { PostListingPage } from '@/components/pages/PostListingPage';
import type { Metadata } from 'next';
import { SITE_NAME, absoluteUrl } from '@/lib/site';

const title = 'Bài mới';
const description = `Bài viết mới nhất trên ${SITE_NAME} — tool, hướng dẫn và tài nguyên tải về.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: absoluteUrl('/bai-moi') },
  openGraph: {
    title,
    description,
    url: absoluteUrl('/bai-moi'),
    type: 'website',
    siteName: SITE_NAME,
    locale: 'vi_VN',
  },
  twitter: { card: 'summary_large_image', title, description },
};

export default function Page() {
  return (
    <PostListingPage
      title="Bài mới nhất"
      description="Danh sách bài viết sắp xếp theo ngày đăng mới nhất."
      queryPath="/api/posts?sort=latest"
    />
  );
}
