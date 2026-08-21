import type { Metadata } from 'next';
import { HomePage } from '@/components/pages/HomePage';
import { SITE_NAME, absoluteUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Chợ bot tự động hóa với seller được xác minh',
  description: 'Tìm bot tự động hóa, kiểm tra seller uy tín và kết nối trực tiếp trên thuebot.org.',
  alternates: { canonical: absoluteUrl('/') },
  openGraph: {
    title: `Chợ bot tự động hóa với seller được xác minh | ${SITE_NAME}`,
    description: 'Tìm bot, kiểm tra hồ sơ seller và kết nối trực tiếp trên thuebot.org.',
    url: absoluteUrl('/'),
    type: 'website',
    siteName: SITE_NAME,
    locale: 'vi_VN',
  },
};

export default function Page() {
  return <HomePage />;
}
