'use client';

import { use } from 'react';
import { SellerProfilePage } from '@/components/sellers/SellerProfilePage';

export default function SellerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return <SellerProfilePage slug={slug} />;
}
