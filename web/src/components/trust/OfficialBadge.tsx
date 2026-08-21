'use client';

import { cn } from '@/lib/utils';

type OfficialBadgeSize = 'sm' | 'md' | 'lg';

function OfficialMark({ size, inverse = false }: { size: OfficialBadgeSize; inverse?: boolean }) {
  const className = size === 'lg' ? 'h-[22px] w-[22px]' : size === 'md' ? 'h-[18px] w-[18px]' : 'h-4 w-4';
  const fill = inverse ? '#FFFFFF' : '#1677FF';
  const check = inverse ? '#1677FF' : '#FFFFFF';

  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path
        d="M12 2.5 14 3.8l2.4-.2 1.1 2.1 2.2 1.1-.2 2.4 1.5 1.8-1.5 2 .2 2.3-2.2 1.1-1.1 2.2-2.4-.2-2 1.4-2-1.4-2.4.2-1.1-2.2-2.2-1.1.2-2.3L3 11l1.5-1.8-.2-2.4 2.2-1.1 1.1-2.1 2.4.2Z"
        fill={fill}
      />
      <path
        d="m8.3 11.1 2.4 2.4 5.1-5.1"
        fill="none"
        stroke={check}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Brand authority mark for thuebot.org system, owner and admin content. */
export function OfficialBadge({
  size = 'md',
  showLabel = false,
  showMark = true,
  className,
}: {
  size?: OfficialBadgeSize;
  showLabel?: boolean;
  showMark?: boolean;
  className?: string;
}) {
  if (showLabel) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full bg-[#1677FF] px-2.5 py-1 text-[11px] font-bold leading-none text-white',
          className,
        )}
        role="img"
        aria-label="Official — tài khoản chính thức thuebot.org"
      >
        {showMark ? <OfficialMark size={size} inverse /> : null}
        <span>Official</span>
      </span>
    );
  }

  return (
    <span
      className={cn('inline-flex shrink-0 items-center', className)}
      title="Official — tài khoản chính thức thuebot.org"
      role="img"
      aria-label="Official — tài khoản chính thức thuebot.org"
    >
      <OfficialMark size={size} />
    </span>
  );
}
