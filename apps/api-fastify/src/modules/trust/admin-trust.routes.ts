import type { FastifyInstance, FastifyRequest } from 'fastify';
import { AuthService } from '../../core/auth.js';
import { ok } from '../../core/response.js';
import { SecurityService } from '../../core/security.js';
import { TrustService } from './trust.service.js';
import { requireStaff } from '../admin/admin-context.js';
import { successWithSchema, trustCheckSchema } from '../../core/route-schemas.js';

const applicationSchema = {
  type: 'object', additionalProperties: false,
  required: ['id', 'userId', 'status', 'submittedAt', 'user', 'trustScore', 'trustScoreReady', 'reviewCount', 'avgRating', 'checks', 'basicVerifiedCount', 'basicVerifiedTotal'],
  properties: {
    id: { type: 'string' }, userId: { type: 'string' }, status: { type: 'string' }, submittedAt: { type: 'string' }, reviewedAt: { type: 'string' }, trustedAt: { type: 'string' }, trustedUntil: { type: 'string' }, note: { type: 'string' }, recommendation: { type: 'string', enum: ['approve', 'reject'] }, actionHandle: { type: 'object', additionalProperties: false, required: ['endpoint', 'serverNonce', 'expiresAt', 'expiresInMs', 'requiresStepUp'], properties: { endpoint: { type: 'string' }, serverNonce: { type: 'string' }, expiresAt: { type: 'string' }, expiresInMs: { type: 'integer' }, requiresStepUp: { type: 'boolean' } } },
    user: { type: 'object', additionalProperties: false, required: ['id', 'name', 'email', 'avatar', 'joinedDate', 'trustScore', 'verificationState'], properties: { id: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' }, avatar: { type: 'string' }, joinedDate: { type: 'string' }, trustScore: { type: 'number' }, trustScoreUpdatedAt: { type: 'string' }, verificationState: { type: 'string' }, trustedAt: { type: 'string' }, trustedUntil: { type: 'string' } } },
    trustScore: { type: 'number' }, trustScoreReady: { type: 'boolean' }, reviewCount: { type: 'integer' }, avgRating: { type: 'number' }, checks: { type: 'array', items: trustCheckSchema }, basicVerifiedCount: { type: 'integer' }, basicVerifiedTotal: { type: 'integer' },
  },
};
const successSchema = successWithSchema({ type: 'array', items: applicationSchema });

const querySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', maxLength: 40 },
  },
} as const;

export async function registerAdminTrustRoutes(
  app: FastifyInstance,
  services: { auth: AuthService; security: SecurityService; trust: TrustService },
): Promise<void> {
  app.get<{ Querystring: { status?: string } }>(
    '/admin/verifications',
    { schema: { querystring: querySchema, response: { 200: successSchema } } },
    async (request, reply) => {
      const staff = await requireStaff(services.auth, request, reply, { permission: 'trust.read' }, services.security);
      if (!staff) return;
      const rows = await services.trust.listAdminApplications(request.query.status);
      const withHandles = await Promise.all(rows.map(async (row) => {
        const reviewable = row.status === 'pending' || row.status === 'under_review';
        const canAdmin = staff.role === 'owner' || staff.role === 'admin';
        if (!reviewable && !(row.status === 'trusted' && canAdmin)) return row;
        const actionHandle = await services.security.issueServerHandle(request, {
          action: 'trust.review',
          method: 'PATCH',
          path: `/api/admin/verifications/${row.id}`,
          targetId: row.id,
        });
        return { ...row, actionHandle };
      }));
      return ok(withHandles);
    },
  );
  // Direct PATCH routes are intentionally absent. Review and check mutations
  // are dispatched only through /api/m/:cap after a scoped permit is consumed.
}
