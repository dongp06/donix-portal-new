'use client';

import '@/lib/errorReporter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { enableMapSet } from 'immer';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { RoleProvider } from '@/context/RoleContext';
import { useState, type ReactNode } from 'react';

enableMapSet();

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <RoleProvider>
          {children}
          <Toaster />
        </RoleProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
