import type { Metadata } from 'next';
import { Space_Grotesk, Manrope } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RootJsonLd } from '@/components/seo/RootJsonLd';
import { Providers } from './providers';
import { SITE_NAME, getDefaultDescription, getSiteUrl } from '@/lib/site';

const manrope = Manrope({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin', 'latin-ext'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
});

const defaultDesc = getDefaultDescription();

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: `${SITE_NAME} — Chợ bot thuê & tài nguyên tự động hóa`,
    template: `%s | ${SITE_NAME}`,
  },
  description: defaultDesc,
  keywords: [
    'thuebot',
    'bot marketplace',
    'thuê bot',
    'bán bot',
    'tự động hóa',
    'chợ bot',
    'điểm uy tín',
  ],
  authors: [{ name: SITE_NAME, url: getSiteUrl() }],
  creator: SITE_NAME,
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    other: [
      { rel: 'mask-icon', url: '/favicon.svg', color: '#1677FF' },
    ],
  },
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Chợ bot thuê & tài nguyên tự động hóa`,
    description: defaultDesc,
    url: '/',
    images: [
      {
        url: '/favicon-512.png',
        width: 512,
        height: 512,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — Chợ bot thuê & tài nguyên tự động hóa`,
    description: defaultDesc,
    images: ['/favicon-512.png'],
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
    <html lang="vi" suppressHydrationWarning>
      <body className={`${manrope.variable} ${spaceGrotesk.variable} font-sans antialiased`}>
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
