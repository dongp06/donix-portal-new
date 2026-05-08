'use client';

import { useCallback, useEffect, useState } from 'react';

export const POST_LIST_LAYOUT_KEY = 'donix-category-layout';

export type PostListLayout = 'grid' | 'list';

export function usePersistedPostLayout() {
  const [layout, setLayoutState] = useState<PostListLayout>('grid');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(POST_LIST_LAYOUT_KEY);
      if (stored === 'grid' || stored === 'list') {
        setLayoutState(stored);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const setLayout = useCallback((next: PostListLayout) => {
    setLayoutState(next);
    try {
      localStorage.setItem(POST_LIST_LAYOUT_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  return { layout, setLayout };
}
