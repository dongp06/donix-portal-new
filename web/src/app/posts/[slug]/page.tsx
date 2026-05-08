import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { ArticleJsonLd } from '@/components/seo/ArticleJsonLd';
import { PostPage } from '@/components/pages/PostPage';
import { incrementPostViewsBySlug } from '@/lib/post-views-server';
import { fetchPostMetaServer, fetchPostPagePayloadServer } from '@/lib/post-payload-server';
import { SITE_NAME, absoluteOgImage, absoluteUrl, toIsoDateOrUndefined } from '@/lib/site';

type Props = { params: Promise<{ slug: string }> };

function isNextLinkPrefetch(h: Headers): boolean {
  return (
    h.get('Next-Router-Prefetch') === '1' ||
    h.get('next-router-prefetch') === '1' ||
    h.get('Sec-Purpose') === 'prefetch' ||
    h.get('Purpose') === 'prefetch'
  );
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  try {
    let initialPayload = await fetchPostPagePayloadServer(slug);
    const h = await headers();
    if (!isNextLinkPrefetch(h)) {
      const views = await incrementPostViewsBySlug(slug);
      if (views != null) {
        initialPayload = {
          ...initialPayload,
          post: { ...initialPayload.post, views },
        };
      }
    }
    return (
      <>
        <ArticleJsonLd post={initialPayload.post} canonicalPath={`/posts/${slug}`} />
        <PostPage slug={slug} initialPayload={initialPayload} />
      </>
    );
  } catch {
    notFound();
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const post = await fetchPostMetaServer(slug);
    const description = post.excerpt?.slice(0, 160);
    const canonical = absoluteUrl(`/posts/${encodeURIComponent(slug)}`);
    const ogImage = absoluteOgImage(post.coverImage);
    const publishedTime = toIsoDateOrUndefined(post.date);
    return {
      title: post.title,
      description,
      alternates: { canonical },
      openGraph: {
        type: 'article',
        locale: 'vi_VN',
        siteName: SITE_NAME,
        title: post.title,
        description,
        url: canonical,
        publishedTime,
        section: post.categoryName,
        images: ogImage ? [{ url: ogImage, alt: post.title }] : undefined,
      },
      twitter: {
        card: 'summary_large_image',
        title: post.title,
        description,
        images: ogImage ? [ogImage] : undefined,
      },
    };
  } catch {
    return { title: slug.replace(/-/g, ' ') };
  }
}
