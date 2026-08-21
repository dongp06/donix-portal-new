import type { Metadata } from 'next';
import { ResourceHub, type ResourceListItem } from '@/components/resources/ResourceHub';
import { serverTransportFetch } from '@/lib/server-transport';

export const metadata: Metadata = { title: 'Tài nguyên', description: 'Source code, template và tài liệu chính thức cho bot và automation.' };

async function loadResources(): Promise<ResourceListItem[]> {
  try {
    const base = process.env.API_URL?.replace(/\/$/, '') ?? 'http://localhost:3002';
    const response = await serverTransportFetch(`${base}/api/resources`, { next: { revalidate: 60 }, headers: { Accept: 'application/json' } });
    const json = await response.json();
    return response.ok && json.success && Array.isArray(json.data) ? json.data as ResourceListItem[] : [];
  } catch {
    return [];
  }
}

export default async function ResourcesPage() {
  return <ResourceHub resources={await loadResources()} />;
}
