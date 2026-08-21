import { AdminSellerDetail } from '@/components/admin/AdminSellerDetail';

export default async function AdminSellerDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminSellerDetail id={id} />;
}
