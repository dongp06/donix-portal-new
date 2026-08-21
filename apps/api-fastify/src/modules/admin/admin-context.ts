import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from '../../core/auth.js';
import { sessionTokenFromRequest } from '../../core/crypto.js';
import type { SecurityService } from '../../core/security.js';

export type StaffRole = 'owner' | 'admin' | 'moderator';
export type StaffContext = { userId: string; role: StaffRole };
export type StaffPermission =
  | 'overview.read'
  | 'moderation.read'
  | 'moderation.write'
  | 'marketplace.read'
  | 'trust.read'
  | 'trust.checks'
  | 'trust.review'
  | 'trust.finalize'
  | 'posts.read'
  | 'posts.moderate'
  | 'reviews.read'
  | 'staff.read'
  | 'staff.write'
  | 'audit.read'
  | 'settings.read'
  | 'settings.write';

const STAFF_PERMISSIONS: Record<StaffRole, ReadonlySet<StaffPermission>> = {
  owner: new Set<StaffPermission>([
    'overview.read', 'moderation.read', 'moderation.write', 'marketplace.read',
    'trust.read', 'trust.checks', 'trust.review', 'trust.finalize',
    'posts.read', 'posts.moderate', 'reviews.read', 'staff.read', 'staff.write',
    'audit.read', 'settings.read', 'settings.write',
  ]),
  admin: new Set<StaffPermission>([
    'overview.read', 'moderation.read', 'moderation.write', 'marketplace.read',
    'trust.read', 'trust.checks', 'trust.review', 'trust.finalize',
    'posts.read', 'posts.moderate', 'reviews.read', 'staff.read', 'staff.write',
    'audit.read', 'settings.read',
  ]),
  moderator: new Set<StaffPermission>([
    'overview.read', 'moderation.read', 'moderation.write', 'marketplace.read',
    'trust.read', 'trust.checks', 'trust.review', 'posts.read', 'posts.moderate',
    'reviews.read', 'audit.read',
  ]),
};

export function hasStaffPermission(role: StaffRole, permission: StaffPermission): boolean {
  return STAFF_PERMISSIONS[role].has(permission);
}

export function isStaffRole(value: string | undefined): value is StaffRole {
  return value === 'owner' || value === 'admin' || value === 'moderator';
}

export function sendAdminNotFound(reply: FastifyReply): void {
  reply.code(404).send({ success: false, error: 'Not found.', code: 'NOT_FOUND' });
}

export async function requireStaff(
  auth: AuthService,
  request: FastifyRequest,
  reply: FastifyReply,
  requirement: { permission?: StaffPermission; roles?: readonly StaffRole[] } = {},
  security?: SecurityService,
): Promise<StaffContext | null> {
  const token = sessionTokenFromRequest(request);
  const resolved = token ? await auth.resolveSessionUser(token) : null;
  if (!resolved || !isStaffRole(resolved.user.staffRole)) {
    sendAdminNotFound(reply);
    return null;
  }
  if (requirement.roles?.length && !requirement.roles.includes(resolved.user.staffRole)) {
    reply.code(403).send({ success: false, error: 'Staff role is not allowed.', code: 'STAFF_ROLE_FORBIDDEN' });
    return null;
  }
  if (requirement.permission && !hasStaffPermission(resolved.user.staffRole, requirement.permission)) {
    reply.code(403).send({ success: false, error: 'Staff permission is not allowed.', code: 'STAFF_PERMISSION_REQUIRED' });
    return null;
  }
  // A session cookie identifies the staff account, but it is not enough to
  // read the admin console. Require the same short-lived access grant and
  // device-bound DPoP proof used by protected mutations.
  if (security) await security.verifyRequest(request);
  return { userId: resolved.user.id, role: resolved.user.staffRole };
}
