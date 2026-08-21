import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PostDetail } from '@/components/posts/PostDetail';
import type { ApiResponse, Post } from '@shared/types';
import { SITE_NAME, absoluteUrl, safeJsonLd } from '@/lib/site';
import { serverTransportFetch } from '@/lib/server-transport';

type Props = { params: Promise<{ slug: string }> };
type PostDetailData = { post: Post; related: Post[] };

function apiBase(): string {
  return process.env.API_URL?.replace(/\/$/, '') ?? 'http://localhost:3002';
}

async function fetchPostDetail(slug: string): Promise<PostDetailData | null> {
  try {
    const response = await serverTransportFetch(`${apiBase()}/api/posts/slug/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const json = (await response.json()) as ApiResponse<PostDetailData>;
    return json.success && json.data ? json.data : null;
  } catch {
    return null;
  }
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const detail = await fetchPostDetail(slug);
  if (!detail) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': detail.post.type === 'question' ? 'QAPage' : 'Article',
    headline: detail.post.title,
    description: detail.post.excerpt,
    datePublished: detail.post.publishedAt ?? detail.post.createdAt,
    dateModified: detail.post.updatedAt,
    author: detail.post.author.isOfficial
      ? { '@type': 'Organization', name: 'thuebot.org', url: absoluteUrl('/') }
      : { '@type': 'Person', name: detail.post.author.name },
    ...(detail.post.author.isOfficial ? {
      publisher: { '@type': 'Organization', name: 'thuebot.org', url: absoluteUrl('/') },
    } : {}),
    mainEntityOfPage: absoluteUrl(`/posts/${slug}`),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <PostDetail slug={slug} initialData={detail} />
    </>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const detail = await fetchPostDetail(slug);
  if (!detail) return { title: 'Không tìm thấy bài viết' };

  const description = detail.post.excerpt.slice(0, 160);
  const canonical = absoluteUrl(`/posts/${encodeURIComponent(slug)}`);
  return {
    title: detail.post.title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'article',
      locale: 'vi_VN',
      siteName: SITE_NAME,
      title: detail.post.title,
      description,
      url: canonical,
      publishedTime: detail.post.publishedAt ?? detail.post.createdAt,
      modifiedTime: detail.post.updatedAt,
      images: detail.post.coverImage ? [{ url: detail.post.coverImage, alt: detail.post.title }] : undefined,
    },
    twitter: { card: 'summary_large_image', title: detail.post.title, description },
  };
}
