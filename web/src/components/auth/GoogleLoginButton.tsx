'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRole } from '@/context/RoleContext';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (resp: { credential?: string }) => void;
          }) => void;
          renderButton: (
            el: HTMLElement,
            options: {
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              width?: number;
            },
          ) => void;
        };
      };
    };
  }
}

type Props = {
  /** Vai trò mặc định khi tạo tài khoản mới (gửi kèm lên backend) */
  role?: 'renter' | 'provider';
  className?: string;
};

/**
 * Nút đăng nhập Google (Google Identity Services).
 * Backend verify idToken qua google-auth-library, set JWT cookie httpOnly.
 */
export function GoogleLoginButton({ role, className }: Props) {
  const { loginWithGoogle } = useRole();
  const btnRef = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    let cancelled = false;
    const init = () => {
      if (!window.google?.accounts?.id) return;
      if (cancelled) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (resp) => {
          if (!resp.credential) return;
          setBusy(true);
          try {
            // Gửi idToken lên backend — nút Google button vẫn dùng luồng này
            const res = await fetch('/api/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                idToken: resp.credential,
                role: role === 'provider' ? 'provider' : 'renter',
              }),
            });
            const json = await res.json();
            if (!res.ok || !json.success || !json.data) {
              throw new Error(json.error || 'Đăng nhập thất bại');
            }
            // update user trong context
            const { data } = json;
            window.location.href =
              data.role === 'provider' ? '/dashboard' : '/profile';
          } catch (e) {
            console.error(e);
            alert(e instanceof Error ? e.message : 'Đăng nhập Google thất bại');
          } finally {
            setBusy(false);
          }
        },
      });
      if (btnRef.current) {
        window.google.accounts.id.renderButton(btnRef.current, {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          width: 320,
        });
      }
    };

    if (window.google?.accounts?.id) {
      init();
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      init();
      setScriptLoaded(true);
    };
    document.head.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, [role]);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!clientId) {
    return (
      <div
        className={className}
        role="status"
        aria-live="polite"
        style={{ textAlign: 'center' }}
      >
        <p className="text-xs text-muted-foreground">
          Đăng nhập Google chưa được cấu hình (thiếu NEXT_PUBLIC_GOOGLE_CLIENT_ID).
        </p>
      </div>
    );
  }

  return (
    <div ref={btnRef} className={className} aria-label="Đăng nhập bằng Google" />
  );
}
