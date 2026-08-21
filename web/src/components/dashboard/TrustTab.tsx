'use client';

import { VerificationCenter } from '@/components/trust/VerificationCenter';

/** Dashboard entry point; the full flow lives in the canonical Verification Center. */
export function TrustTab() {
  return <VerificationCenter />;
}
