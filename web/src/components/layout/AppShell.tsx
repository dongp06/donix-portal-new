'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  if (path?.startsWith('/admin')) {
    return (
      <div className="min-h-screen bg-background text-foreground antialiased">{children}</div>
    );
  }
  return <MainLayout>{children}</MainLayout>;
}
