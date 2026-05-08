import { PostListingPage } from '@/components/pages/PostListingPage';
import type { Metadata } from 'next';
import { SITE_NAME, absoluteUrl } from '@/lib/site';

const title = 'Bài ghim';
const description = `Bài viết ghim nổi bật trên ${SITE_NAME} — công cụ và hướng dẫn được chọn lọc.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: absoluteUrl('/bai-ghim') },
  openGraph: {
    title,
    description,
    url: absoluteUrl('/bai-ghim'),
    type: 'website',
    siteName: SITE_NAME,
    locale: 'vi_VN',
  },
  twitter: { card: 'summary_large_image', title, description },
};

export default function Page() {
  return (
    <PostListingPage
      title="Bài ghim"
      description="Tổng hợp bài viết quan trọng, công cụ và hướng dẫn được đội ngũ chọn lọc."
      queryPath="/api/posts/pinned"
    />
  );
}
