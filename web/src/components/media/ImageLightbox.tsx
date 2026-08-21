'use client';

import { useEffect, useRef, useState, type TouchEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { MediaImage } from './MediaImage';

export type LightboxImage = {
  src: string;
  alt: string;
};

type ImageLightboxProps = {
  images: LightboxImage[];
  initialIndex?: number;
  onClose: () => void;
};

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(Math.max(index, 0), length - 1);
}

export function ImageLightbox({ images, initialIndex = 0, onClose }: ImageLightboxProps) {
  const selectionKey = `${images.length}:${initialIndex}`;
  const [selection, setSelection] = useState<{ key: string; index: number }>(() => ({
    key: selectionKey,
    index: clampIndex(initialIndex, images.length),
  }));
  const activeIndex = selection.key === selectionKey
    ? selection.index
    : clampIndex(initialIndex, images.length);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!images.length) {
      onClose();
      return;
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'ArrowLeft' && images.length > 1) {
        event.preventDefault();
        setSelection((current) => {
          const index = current.key === selectionKey ? current.index : clampIndex(initialIndex, images.length);
          return { key: selectionKey, index: (index - 1 + images.length) % images.length };
        });
        return;
      }

      if (event.key === 'ArrowRight' && images.length > 1) {
        event.preventDefault();
        setSelection((current) => {
          const index = current.key === selectionKey ? current.index : clampIndex(initialIndex, images.length);
          return { key: selectionKey, index: (index + 1) % images.length };
        });
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled])'),
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [images.length, initialIndex, onClose, selectionKey]);

  if (!images.length || typeof document === 'undefined') return null;

  const activeImage = images[activeIndex] ?? images[0];
  const hasNavigation = images.length > 1;

  const move = (direction: -1 | 1) => {
    setSelection((current) => ({
      key: selectionKey,
      index: ((current.key === selectionKey ? current.index : activeIndex) + direction + images.length) % images.length,
    }));
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.changedTouches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || !hasNavigation) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 50 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    move(deltaX > 0 ? -1 : 1);
  };

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Xem ảnh"
      className="fixed inset-0 z-[60] flex min-h-full items-center justify-center bg-black/85 p-4 backdrop-blur-sm sm:p-8"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        aria-label="Đóng ảnh"
        className="absolute right-4 top-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-6 sm:top-6"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>

      <div
        className="relative flex max-h-full max-w-full flex-col items-center justify-center gap-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="relative flex max-h-[calc(100vh-7rem)] max-w-[92vw] items-center justify-center sm:max-h-[calc(100vh-8rem)] sm:max-w-[90vw]"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <MediaImage
            src={activeImage.src}
            alt={activeImage.alt}
            draggable={false}
            className="max-h-[calc(100vh-7rem)] max-w-[92vw] select-none object-contain sm:max-h-[calc(100vh-8rem)] sm:max-w-[90vw]"
          />

          {hasNavigation ? (
            <>
              <button
                type="button"
                onClick={() => move(-1)}
                aria-label="Ảnh trước"
                className="absolute left-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white transition-colors hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:-left-16"
              >
                <ChevronLeft className="h-6 w-6" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => move(1)}
                aria-label="Ảnh tiếp theo"
                className="absolute right-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white transition-colors hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:-right-16"
              >
                <ChevronRight className="h-6 w-6" aria-hidden="true" />
              </button>
            </>
          ) : null}
        </div>

        <p className="rounded-full bg-black/45 px-3 py-1 text-xs font-medium text-white/85" aria-live="polite">
          {activeIndex + 1} / {images.length}
        </p>
      </div>
    </div>,
    document.body,
  );
}
