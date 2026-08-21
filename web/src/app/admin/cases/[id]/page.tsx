import { AdminCaseDetail } from '@/components/admin/AdminCaseDetail';

export default async function AdminCaseRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminCaseDetail id={id} />;
}
