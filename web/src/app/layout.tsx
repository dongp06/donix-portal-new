import type { Metadata } from 'next';
import { Space_Grotesk, Poppins } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RootJsonLd } from '@/components/seo/RootJsonLd';
import { Providers } from './providers';
import { SITE_NAME, getDefaultDescription, getSiteUrl } from '@/lib/site';

const poppins = Poppins({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '600', '700'],
  variable: '--font-poppins',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin', 'latin-ext'],
  weight: ['600', '700'],
  variable: '--font-donix-logo',
});

const defaultDesc = getDefaultDescription();

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: `${SITE_NAME} — Chia sẻ tài nguyên & tool`,
    template: `%s | ${SITE_NAME}`,
  },
  description: defaultDesc,
  keywords: [
    'Donix',
    'tải tool',
    'lập trình',
    'Python',
    'chia sẻ tài nguyên',
    'hướng dẫn',
    'phần mềm',
  ],
  authors: [{ name: SITE_NAME, url: getSiteUrl() }],
  creator: SITE_NAME,
  icons: {
    icon: [{ url: '/favicon.png', type: 'image/png' }],
    apple: [{ url: '/favicon.png', type: 'image/png' }],
  },
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Chia sẻ tài nguyên & tool`,
    description: defaultDesc,
    url: '/',
    images: [
      {
        url: '/logo.png',
        width: 512,
        height: 512,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — Chia sẻ tài nguyên & tool`,
    description: defaultDesc,
    images: ['/logo.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className={`${poppins.variable} ${spaceGrotesk.variable} font-sans antialiased`}>
        <RootJsonLd />
        <Providers>
          <ErrorBoundary>
            <AppShell>{children}</AppShell>
          </ErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
