import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AdminShell } from '@/components/admin/AdminShell';
import { getAdminAccess } from '@/lib/admin-server';

export const metadata: Metadata = {
  title: 'Quản trị',
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = await getAdminAccess();
  if (!access) notFound();

  return <AdminShell initialAccess={access}>{children}</AdminShell>;
}
