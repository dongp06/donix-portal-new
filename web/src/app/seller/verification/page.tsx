'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { VerificationCenter } from '@/components/trust/VerificationCenter';
import { ThuebotLogo } from '@/components/brand/ThuebotLogo';
import { useRole } from '@/context/RoleContext';

export default function SellerVerificationPage() {
  const { authStatus, onboardingCompleted, user } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (authStatus === 'loading') return;
    if (authStatus === 'unauthenticated') {
      router.replace('/login?returnTo=%2Fseller%2Fverification');
      return;
    }
    if (!onboardingCompleted) {
      router.replace('/onboarding/account-type?returnTo=%2Fseller%2Fverification');
      return;
    }
    if (user.role !== 'seller') router.replace('/become-seller');
  }, [authStatus, onboardingCompleted, router, user.role]);

  if (authStatus === 'loading') {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground" aria-busy="true">
        <div className="flex w-full max-w-sm flex-col items-center text-center" role="status" aria-live="polite">
          <ThuebotLogo size="lg" />
          <div className="mt-8 flex items-center gap-2 text-sm font-semibold">
            <Loader2 className="h-4 w-4 animate-spin text-brand" aria-hidden />
            Đang mở trung tâm xác minh…
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Đang kiểm tra phiên đăng nhập của bạn.
          </p>
        </div>
      </main>
    );
  }

  if (authStatus !== 'authenticated' || user.role !== 'seller') return null;

  return <VerificationCenter standalone />;
}
