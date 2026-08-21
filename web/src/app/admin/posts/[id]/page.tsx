import { AdminPostDetail } from '@/components/admin/AdminPostDetail';

export default async function AdminPostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminPostDetail id={id} />;
}
