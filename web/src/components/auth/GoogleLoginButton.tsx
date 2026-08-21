'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { safeInternalPath } from '@/lib/safe-redirect';

type Props = {
  redirectTo?: string;
  className?: string;
  buttonText?: 'signin_with' | 'signup_with' | 'continue_with';
  variant?: 'surface' | 'plain';
};

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path fill="#4285F4" d="M21.35 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h5.24a4.47 4.47 0 0 1-1.94 2.93v2.39h3.14c1.84-1.69 2.91-4.18 2.91-7.35Z" />
      <path fill="#34A853" d="M12 21.75c2.63 0 4.84-.87 6.45-2.36l-3.14-2.39c-.87.58-1.98.93-3.31.93-2.54 0-4.69-1.72-5.46-4.03H3.29v2.47A9.75 9.75 0 0 0 12 21.75Z" />
      <path fill="#FBBC05" d="M6.54 13.9a5.86 5.86 0 0 1 0-3.8V7.63H3.29a9.76 9.76 0 0 0 0 8.74l3.25-2.47Z" />
      <path fill="#EA4335" d="M12 6.08c1.43 0 2.72.49 3.73 1.46l2.8-2.8C16.84 3.13 14.63 2.25 12 2.25a9.75 9.75 0 0 0-8.71 5.38l3.25 2.47C7.31 7.8 9.46 6.08 12 6.08Z" />
    </svg>
  );
}

export function GoogleLoginButton({
  redirectTo,
  className,
  buttonText = 'continue_with',
  variant = 'surface',
}: Props) {
  const redirectToRef = useRef(redirectTo);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    redirectToRef.current = redirectTo;
  }, [redirectTo]);

  useEffect(() => {
    setReady(true);
  }, []);

  const label = busy
    ? 'Đang kết nối Google…'
    : buttonText === 'signup_with'
      ? 'Đăng ký bằng Google'
      : buttonText === 'signin_with'
        ? 'Đăng nhập bằng Google'
        : 'Tiếp tục với Google';

  return (
    <div
      className={cn(
        'relative w-full',
        variant === 'surface' && 'rounded-2xl border border-border/80 bg-background/60 p-1.5 dark:border-white/10 dark:bg-black/20',
        className,
      )}
      aria-busy={busy || !ready}
    >
      <button
        type="button"
        onClick={() => {
          if (busy || !ready) return;
          setBusy(true);
          const target = safeInternalPath(redirectToRef.current) ?? '/profile';
          window.location.assign(`/api/auth/google/start?returnTo=${encodeURIComponent(target)}`);
        }}
        disabled={!ready || busy}
        className={cn(
          'flex h-[52px] w-full items-center justify-center gap-3 rounded-xl border px-4 text-[15px] font-semibold',
          'border-[#dadce0] bg-white text-[#1f1f1f] shadow-[0_1px_2px_rgba(60,64,67,0.12)]',
          'transition-[background-color,border-color,box-shadow,transform] duration-200',
          'hover:border-[#c5cbd4] hover:bg-[#f8fafd] hover:shadow-[0_1px_3px_rgba(60,64,67,0.2)]',
          'active:translate-y-px active:shadow-none',
          'focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:cursor-not-allowed disabled:opacity-70',
          'dark:border-[#5f6368] dark:bg-[#202124] dark:text-[#e8eaed] dark:shadow-[0_1px_2px_rgba(0,0,0,0.35)]',
          'dark:hover:border-[#80868b] dark:hover:bg-[#2b2c2f] dark:hover:shadow-[0_1px_3px_rgba(0,0,0,0.45)]',
        )}
        aria-label={label}
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin text-brand" aria-hidden /> : <GoogleIcon />}
        <span>{label}</span>
      </button>
    </div>
  );
}
