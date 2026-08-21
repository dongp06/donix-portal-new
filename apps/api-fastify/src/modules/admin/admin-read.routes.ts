import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from '../../core/auth.js';
import type { SecurityService } from '../../core/security.js';
import { ok } from '../../core/response.js';
import { AdminReadService } from './admin-read.service.js';
import { requireStaff, type StaffPermission } from './admin-context.js';
import { analyticsResponse, auditResponse, botResponse, botsResponse, caseResponse, casesResponse, commentsResponse, moderationResponse, overviewResponse, riskyReviewsResponse, searchResponse, sellerResponse, sellersResponse, staffResponse, usersResponse } from './admin-read.schemas.js';

const querySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    q: { type: 'string', maxLength: 120 },
    search: { type: 'string', maxLength: 120 },
    status: { type: 'string', maxLength: 40 },
    role: { type: 'string', maxLength: 40 },
    type: { type: 'string', maxLength: 40 },
    priority: { type: 'string', maxLength: 40 },
    assigned: { type: 'string', maxLength: 40 },
    limit: { type: 'string', maxLength: 8 },
  },
} as const;

const idParams = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: { id: { type: 'string', minLength: 1, maxLength: 160 } },
} as const;

export async function registerAdminReadRoutes(app: FastifyInstance, auth: AuthService, security: SecurityService): Promise<void> {
  const admin = new AdminReadService(app.db);
  const read = async (request: FastifyRequest, reply: FastifyReply, permission: StaffPermission) => requireStaff(auth, request, reply, { permission }, security);

  app.get('/admin/overview', { schema: { response: { 200: overviewResponse } } }, async (request, reply) => {
    if (!await read(request, reply, 'overview.read')) return;
    return ok(await admin.getOverview());
  });
  app.get('/admin/moderation', { schema: { querystring: querySchema, response: { 200: moderationResponse } } }, async (request, reply) => {
    const staff = await read(request, reply, 'moderation.read');
    if (!staff) return;
    const query = request.query as { type?: string; priority?: string; assigned?: string; limit?: string };
    return ok(await admin.getModeration({ ...query, limit: Number(query.limit) || 50 }, staff));
  });
  app.get('/admin/search', { schema: { querystring: querySchema, response: { 200: searchResponse } } }, async (request, reply) => {
    if (!await read(request, reply, 'marketplace.read')) return;
    return ok(await admin.search((request.query as { q?: string }).q));
  });
  app.get('/admin/cases', { schema: { querystring: querySchema, response: { 200: casesResponse } } }, async (request, reply) => {
    if (!await read(request, reply, 'moderation.read')) return;
    return ok(await admin.listCases((request.query as { status?: string }).status));
  });
  app.get<{ Params: { id: string } }>('/admin/cases/:id', { schema: { params: idParams, response: { 200: caseResponse } } }, async (request, reply) => {
    if (!await read(request, reply, 'moderation.read')) return;
    return ok(await admin.getCase(request.params.id));
  });
  app.get('/admin/sellers', { schema: { querystring: querySchema, response: { 200: sellersResponse } } }, async (request, reply) => {
    if (!await read(request, reply, 'marketplace.read')) return;
    return ok(await admin.listSellers((request.query as { search?: string }).search));
  });
  app.get<{ Params: { id: string } }>('/admin/sellers/:id', { schema: { params: idParams, response: { 200: sellerResponse } } }, async (request, reply) => {
    if (!await read(request, reply, 'marketplace.read')) return;
    return ok(await admin.getSeller(request.params.id));
  });
  app.get('/admin/bots', { schema: { querystring: querySchema, response: { 200: botsResponse } } }, async (request, reply) => {
    if (!await read(request, reply, 'marketplace.read')) return;
    const query = request.query as { search?: string; status?: string };
    return ok(await admin.listBots(query.search, query.status));
  });
  app.get<{ Params: { id: string } }>('/admin/bots/:id', { schema: { params: idParams, response: { 200: botResponse } } }, async (request, reply) => {
    if (!await read(request, reply, 'marketplace.read')) return;
    return ok(await admin.getBot(request.params.id));
  });
  app.get('/admin/users', { schema: { querystring: querySchema, response: { 200: usersResponse } } }, async (request, reply) => {
    if (!await read(request, reply, 'marketplace.read')) return;
    const query = request.query as { search?: string; role?: string };
    return ok(await admin.listUsers(query.search, query.role));
  });
  app.get('/admin/staff', { schema: { response: { 200: staffResponse, 403: { type: 'object', additionalProperties: false, required: ['success', 'error', 'code'], properties: { success: { const: false }, error: { type: 'string' }, code: { type: 'string' } } } } } }, async (request, reply) => {
    const staff = await read(request, reply, 'staff.read');
    if (!staff) return;
    if (staff.role !== 'owner' && staff.role !== 'admin') {
      reply.code(403).send({ success: false, error: 'Staff role is not allowed.', code: 'STAFF_ROLE_FORBIDDEN' });
      return;
    }
    return ok(await admin.listStaff());
  });
  app.get('/admin/comments', { schema: { querystring: querySchema, response: { 200: commentsResponse } } }, async (request, reply) => {
    if (!await read(request, reply, 'moderation.read')) return;
    return ok(await admin.listComments((request.query as { search?: string }).search));
  });
  app.get('/admin/analytics', { schema: { response: { 200: analyticsResponse } } }, async (request, reply) => {
    if (!await read(request, reply, 'overview.read')) return;
    return ok(await admin.getAnalytics());
  });
  app.get('/admin/audit', { schema: { querystring: querySchema, response: { 200: auditResponse } } }, async (request, reply) => {
    if (!await read(request, reply, 'audit.read')) return;
    return ok(await admin.listAudit(Number((request.query as { limit?: string }).limit) || 100));
  });
  app.get('/admin/reviews', { schema: { response: { 200: riskyReviewsResponse } } }, async (request, reply) => {
    if (!await read(request, reply, 'reviews.read')) return;
    return ok(await admin.listRiskyReviews());
  });
}
