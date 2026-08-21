'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * thuebot.org wordmark — self-contained SVGs with real font paths.
 * Shows the white variant in dark mode and the navy variant in light mode
 * (both rendered; toggled via `dark:` classes so it adapts to theme).
 */
const sizePreset = {
  sm: 'h-6 w-auto',
  md: 'h-8 w-auto',
  lg: 'h-10 w-auto',
} as const;

export type ThuebotLogoSize = keyof typeof sizePreset;

export interface ThuebotLogoProps {
  className?: string;
  size?: ThuebotLogoSize;
  /** Force the light-background (navy) variant instead of adapting. */
  variant?: 'adaptive' | 'light' | 'dark';
}

export function ThuebotLogo({
  className,
  size = 'md',
  variant = 'adaptive',
}: ThuebotLogoProps) {
  const isLight = variant === 'light';
  if (variant === 'dark') {
    return (
      <Image
        src="/wordmark-white.svg"
        alt="thuebot.org"
        width={494}
        height={150}
        priority
        className={cn(sizePreset[size], 'object-contain', className)}
      />
    );
  }
  if (isLight) {
    return (
      <Image
        src="/wordmark.svg"
        alt="thuebot.org"
        width={408}
        height={150}
        priority
        className={cn(sizePreset[size], 'object-contain', className)}
      />
    );
  }
  // Adaptive: white on dark, navy on light.
  return (
    <span className={cn('inline-flex', className)}>
      <Image
        src="/wordmark-white.svg"
        alt="thuebot.org"
        width={408}
        height={150}
        priority
        className={cn(sizePreset[size], 'object-contain dark:block hidden')}
      />
      <Image
        src="/wordmark.svg"
        alt="thuebot.org"
        width={408}
        height={150}
        priority
        className={cn(sizePreset[size], 'object-contain dark:hidden')}
      />
    </span>
  );
}
