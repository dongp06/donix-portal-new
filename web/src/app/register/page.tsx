'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * /register giữ lại cho SEO/điều hướng cũ, nhưng chuyển hướng sang /login —
 * nút "Tiếp tục với Google" vừa đăng nhập vừa đăng ký (không tách hai luồng).
 */
export default function RegisterPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/login');
  }, [router]);
  return null;
}
