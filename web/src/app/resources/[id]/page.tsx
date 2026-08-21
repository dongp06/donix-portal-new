import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ResourceDetail, type ResourceListItem } from '@/components/resources/ResourceHub';
import { serverTransportFetch } from '@/lib/server-transport';

type Props = { params: Promise<{ id: string }> };

async function loadResource(id: string): Promise<ResourceListItem | null> {
  try {
    const base = process.env.API_URL?.replace(/\/$/, '') ?? 'http://localhost:3002';
    const response = await serverTransportFetch(`${base}/api/resources/${encodeURIComponent(id)}`, { next: { revalidate: 60 }, headers: { Accept: 'application/json' } });
    const json = await response.json();
    return response.ok && json.success && json.data ? json.data as ResourceListItem : null;
  } catch {
    return null;
  }
}

export default async function ResourcePage({ params }: Props) {
  const { id } = await params;
  const resource = await loadResource(id);
  if (!resource) notFound();
  return <ResourceDetail resource={resource} />;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resource = await loadResource((await params).id);
  return resource ? { title: resource.title, description: resource.description || resource.postExcerpt } : { title: 'Không tìm thấy tài nguyên' };
}
