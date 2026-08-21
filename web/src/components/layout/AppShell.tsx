'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useRole } from '@/context/RoleContext';

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { authStatus } = useRole();
  // Các route "trần" — không dùng navbar/footer marketplace (admin + auth flow)
  const isBareRoute =
    path?.startsWith('/admin') ||
    path?.startsWith('/login') ||
    path?.startsWith('/register') ||
    path?.startsWith('/onboarding') ||
    path?.startsWith('/become-seller') ||
    ((path?.startsWith('/dashboard') || path?.startsWith('/seller/verification')) && authStatus !== 'authenticated');
  if (isBareRoute) {
    return (
      <div className="min-h-screen bg-background text-foreground antialiased">{children}</div>
    );
  }
  return <MainLayout>{children}</MainLayout>;
}
