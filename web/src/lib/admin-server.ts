import { cookies } from 'next/headers';
import { serverTransportFetch } from './server-transport';

export type AdminRole = 'owner' | 'admin' | 'moderator';

export type AdminAccess = {
  user: {
    id: string;
    name: string;
    email: string;
    avatar: string;
    role: 'buyer' | 'seller';
  };
  staff: { role: AdminRole };
};

const STAFF_ROLES: readonly AdminRole[] = ['owner', 'admin', 'moderator'];

/** Server-only access check. A failed check intentionally collapses to null. */
export async function getAdminAccess(): Promise<AdminAccess | null> {
  try {
    const cookieHeader = (await cookies()).toString();
    if (!cookieHeader) return null;

    const origin = process.env.API_URL ?? 'http://localhost:3002';
    const response = await serverTransportFetch(`${origin.replace(/\/$/, '')}/api/auth/admin-access`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as { success?: boolean; data?: AdminAccess };
    const role = payload.data?.staff?.role;
    if (!payload.success || !payload.data || !role || !STAFF_ROLES.includes(role)) return null;
    return payload.data;
  } catch {
    return null;
  }
}
