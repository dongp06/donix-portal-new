import type { Post } from '@shared/types';
import { SITE_NAME, absoluteOgImage, absoluteUrl, toIsoDateOrUndefined } from '@/lib/site';

/** JSON-LD Article (Google Rich Results). */
export function ArticleJsonLd({ post, canonicalPath }: { post: Post; canonicalPath: string }) {
  const url = absoluteUrl(canonicalPath);
  const img = absoluteOgImage(post.coverImage);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt?.slice(0, 300),
    datePublished: toIsoDateOrUndefined(post.date),
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    image: img ? [img] : undefined,
    author: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: absoluteUrl('/'),
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: {
        '@type': 'ImageObject',
        url: absoluteUrl('/logo.png'),
      },
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
