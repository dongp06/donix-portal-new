import { AdminPostEditor } from '@/components/admin/AdminPostEditor';
import { getAdminAccess } from '@/lib/admin-server';

export default async function AdminNewPostPage() {
  const access = await getAdminAccess();
  return <AdminPostEditor initialRole={access?.staff.role} />;
}
