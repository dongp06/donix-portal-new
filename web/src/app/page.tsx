import { HomePage } from '@/components/pages/HomePage';
import type { Metadata } from 'next';
import { SITE_NAME, absoluteOgImage, absoluteUrl } from '@/lib/site';

const title = `${SITE_NAME} — Cổng chia sẻ tài nguyên & tool`;
const description =
  'Khám phá bài viết hướng dẫn lập trình, game mod và công cụ tiện ích — có file tải về, hướng dẫn chi tiết.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: absoluteUrl('/') },
  openGraph: {
    title,
    description,
    url: absoluteUrl('/'),
    type: 'website',
    siteName: SITE_NAME,
    locale: 'vi_VN',
    images: [{ url: absoluteOgImage('/logo.png')!, width: 512, height: 512, alt: SITE_NAME }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [absoluteOgImage('/logo.png')!],
  },
};

export default function Page() {
  return <HomePage />;
}
