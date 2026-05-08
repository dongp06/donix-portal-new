'use client';

import { Button } from '@/components/ui/button';
import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="max-w-lg mx-auto px-4 py-24 text-center">
      <h1 className="text-2xl font-bold mb-2">Đã xảy ra lỗi</h1>
      <p className="text-muted-foreground mb-6">{error.message}</p>
      <Button onClick={() => reset()}>Thử lại</Button>
    </div>
  );
}
