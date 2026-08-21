'use client';

import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { ImageOff } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/media';
import { cn } from '@/lib/utils';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';

type MediaImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> & {
  src?: string | null;
  fallbackSrc?: string;
};

export function MediaImage({ src, alt = '', fallbackSrc = '/logo.svg', className, ...props }: MediaImageProps) {
  const resolved = resolveMediaUrl(src);
  const fallback = resolveMediaUrl(fallbackSrc);
  const [failure, setFailure] = useState<{ source: string; fallbackFailed: boolean } | null>(null);
  const current = failure?.source === resolved
    ? failure.fallbackFailed ? '' : fallback
    : resolved || fallback;
  const protectedMedia = /^\/api\/(?:media|resources\/files\/[^/]+\/view)$/i.test(current);
  const [transported, setTransported] = useState<{ source: string; url: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!protectedMedia) {
      setTransported((previous) => {
        if (previous?.url) URL.revokeObjectURL(previous.url);
        return null;
      });
      return () => {
        cancelled = true;
      };
    }
    if (transported?.source === current) return () => {
      cancelled = true;
    };

    void fetchWithTimeout(current, { credentials: 'include', cache: 'no-store' }, 30_000)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Media request failed (${response.status}).`);
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setTransported((previous) => {
          if (previous?.url) URL.revokeObjectURL(previous.url);
          return { source: current, url };
        });
      })
      .catch(() => {
        if (!cancelled) setFailure({ source: resolved, fallbackFailed: current === fallback });
      });

    return () => {
      cancelled = true;
    };
  }, [current, fallback, protectedMedia, resolved, transported?.source]);

  if (!current) {
    return (
      <span role="img" aria-label={alt} className={cn('inline-flex items-center justify-center bg-muted text-muted-foreground', className)}>
        <ImageOff className="h-5 w-5" aria-hidden />
      </span>
    );
  }

  if (protectedMedia && transported?.source !== current) {
    return (
      <span role="img" aria-label={alt} className={cn('inline-flex items-center justify-center bg-muted text-muted-foreground', className)}>
        <ImageOff className="h-5 w-5 animate-pulse" aria-hidden />
      </span>
    );
  }

  return (
    <img
      {...props}
      src={protectedMedia ? transported?.url : current}
      alt={alt}
      className={className}
      onError={() => {
        if (resolved || fallback) setFailure({ source: resolved, fallbackFailed: current === fallback });
      }}
    />
  );
}
