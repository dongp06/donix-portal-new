import { AdminBotDetail } from '@/components/admin/AdminBotDetail';

export default async function AdminBotDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminBotDetail id={id} />;
}
