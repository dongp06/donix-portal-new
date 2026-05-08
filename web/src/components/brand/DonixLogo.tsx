'use client';

import { cn } from '@/lib/utils';

const sizePreset = {
  sm: {
    text: 'text-lg sm:text-xl',
    xScale: 'scale-110',
  },
  md: {
    text: 'text-xl sm:text-2xl',
    xScale: 'scale-110 sm:scale-[1.12]',
  },
  lg: {
    text: 'text-[1.35rem] sm:text-[1.58rem] md:text-[1.8rem] lg:text-[2rem]',
    xScale: 'scale-110 sm:scale-[1.14] lg:scale-[1.18]',
  },
} as const;

export type DonixLogoSize = keyof typeof sizePreset;

export interface DonixLogoProps {
  className?: string;
  size?: DonixLogoSize;
  variant?: 'adaptive' | 'darkBar';
}

export function DonixLogo({
  className,
  size = 'md',
  variant = 'adaptive',
}: DonixLogoProps) {
  const s = sizePreset[size];

  const doniClass =
    variant === 'darkBar'
      ? 'text-white'
      : cn('text-neutral-950', 'dark:text-white');

  return (
    <span className={cn('inline-flex items-center', className)}>
      <span
        className={cn(
          'font-donix-logo font-bold tracking-tight leading-none',
          s.text,
        )}
      >
        <span className={cn('inline-flex items-baseline', doniClass)}>
          <span className="inline-block text-[1.09em] leading-none tracking-tight translate-y-px">
            D
          </span>
          <span className="tracking-tight">ONI</span>
        </span>
        <span
          className={cn(
            'relative inline-block align-baseline font-bold tracking-tight',
            'ml-0.5 sm:ml-1',
            s.xScale,
            'origin-center',
          )}
          style={{
            filter:
              'drop-shadow(0 0 4px rgba(251, 146, 60, 0.75)) drop-shadow(0 0 12px rgba(234, 88, 12, 0.4))',
          }}
        >
          <span
            className={cn(
              'bg-gradient-to-b from-amber-400 via-orange-500 to-orange-600',
              'dark:from-amber-300 dark:via-orange-400 dark:to-orange-500',
              'bg-clip-text text-transparent',
            )}
          >
            X
          </span>
        </span>
      </span>
    </span>
  );
}
