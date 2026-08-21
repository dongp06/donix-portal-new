'use client';

import { createContext, useContext } from 'react';
import type { AdminAccess, AdminRole } from '@/lib/admin-server';

export type AdminAccessContextValue = {
  access: AdminAccess;
  role: AdminRole | null;
  authResolved: boolean;
};

const AdminAccessContext = createContext<AdminAccessContextValue | null>(null);

export function AdminAccessProvider({
  value,
  children,
}: {
  value: AdminAccessContextValue;
  children: React.ReactNode;
}) {
  return (
    <AdminAccessContext.Provider value={value}>
      {children}
    </AdminAccessContext.Provider>
  );
}

export function useAdminAccess(): AdminAccessContextValue {
  const value = useContext(AdminAccessContext);
  if (!value) {
    throw new Error('useAdminAccess must be used within an AdminAccessProvider');
  }
  return value;
}
