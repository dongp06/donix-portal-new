import { SITE_NAME, absoluteUrl, getDefaultDescription } from '@/lib/site';

/** WebSite + Organization gốc cho trang chủ (toàn site). */
export function RootJsonLd() {
  const siteUrl = absoluteUrl('/');
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}#website`,
        url: siteUrl,
        name: SITE_NAME,
        description: getDefaultDescription(),
        inLanguage: 'vi-VN',
        publisher: { '@id': `${siteUrl}#org` },
      },
      {
        '@type': 'Organization',
        '@id': `${siteUrl}#org`,
        name: SITE_NAME,
        url: siteUrl,
        logo: {
          '@type': 'ImageObject',
          url: absoluteUrl('/logo.png'),
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
