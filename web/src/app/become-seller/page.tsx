'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Loader2, ShieldCheck, Store } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ThuebotLogo } from '@/components/brand/ThuebotLogo';
import { useRole } from '@/context/RoleContext';

export default function BecomeSellerPage() {
  const router = useRouter();
  const { authStatus, user, onboardingCompleted, becomeSeller } = useRole();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authStatus === 'loading') return;
    if (authStatus === 'unauthenticated') {
      router.replace('/login?returnTo=%2Fdashboard');
      return;
    }
    if (!onboardingCompleted) {
      router.replace('/onboarding/account-type?returnTo=%2Fdashboard');
      return;
    }
    if (user.role === 'seller') router.replace('/dashboard');
  }, [authStatus, onboardingCompleted, router, user.role]);

  const handleBecomeSeller = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await becomeSeller();
      toast.success('Đã nâng cấp tài khoản thành nhà cung cấp');
      router.replace('/dashboard');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể nâng cấp tài khoản');
      setBusy(false);
    }
  };

  if (authStatus === 'loading') {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground" aria-busy="true">
        <div className="flex flex-col items-center text-center" role="status" aria-live="polite">
          <ThuebotLogo size="lg" />
          <div className="mt-8 flex items-center gap-2 text-sm font-semibold"><Loader2 className="h-4 w-4 animate-spin text-brand" aria-hidden />Đang kiểm tra tài khoản…</div>
        </div>
      </main>
    );
  }

  if (authStatus !== 'authenticated' || user.role === 'seller') return null;

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-4 py-10 text-foreground sm:px-6">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_-10%,hsl(var(--brand)/0.14),transparent)]" />
      <section className="relative w-full max-w-lg rounded-3xl border border-border bg-card p-7 text-center shadow-[0_24px_70px_-30px_hsl(var(--brand)/0.35)] sm:p-9">
        <ThuebotLogo size="lg" className="mx-auto" />
        <div className="mx-auto mt-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand"><Store className="h-7 w-7" aria-hidden /></div>
        <p className="eyebrow mt-6">Dành cho seller</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Bắt đầu xây shop bot của bạn</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Đăng bot, xây dựng hồ sơ uy tín và kết nối trực tiếp với người mua trên thuebot.org.</p>
        <div className="mt-6 space-y-3 text-left text-sm"><div className="flex items-start gap-3 rounded-xl border border-border bg-background p-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden /><span><strong className="block">Hồ sơ seller rõ ràng</strong><span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">Quản lý bot, thông tin liên hệ và trạng thái hoạt động ở một nơi.</span></span></div><div className="flex items-start gap-3 rounded-xl border border-border bg-background p-3"><Store className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden /><span><strong className="block">Tiếp cận đúng người mua</strong><span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">Listing của bạn xuất hiện trong chợ bot và kết quả tìm kiếm.</span></span></div></div>
        <button type="button" onClick={() => void handleBecomeSeller()} disabled={busy} className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-brand-foreground transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ArrowRight className="h-4 w-4" aria-hidden />}{busy ? 'Đang nâng cấp…' : 'Trở thành nhà cung cấp'}</button>
        <button type="button" onClick={() => router.replace('/bots')} className="mt-3 text-xs font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground">Quay lại chợ bot</button>
      </section>
    </main>
  );
}
