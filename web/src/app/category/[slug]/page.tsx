import { CategoryPage } from '@/components/pages/CategoryPage';
import type { Metadata } from 'next';
import { SITE_NAME, absoluteUrl } from '@/lib/site';
import { fetchCategoryMetaServer } from '@/lib/seo-server';

type Props = { params: Promise<{ slug: string }> };

export default async function Page({ params }: Props) {
  const { slug } = await params;
  return <CategoryPage slug={slug} />;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const cat = await fetchCategoryMetaServer(slug);
  const title = cat ? `${cat.name} — chuyên mục` : `Chuyên mục ${slug}`;
  const description =
    cat?.description ??
    `Bài viết, tool và hướng dẫn theo chuyên mục tại ${SITE_NAME}.`;
  const canonical = absoluteUrl(`/category/${encodeURIComponent(slug)}`);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      siteName: SITE_NAME,
      locale: 'vi_VN',
    },
  };
}
