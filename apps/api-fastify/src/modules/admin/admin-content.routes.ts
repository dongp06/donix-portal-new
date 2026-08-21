import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from '../../core/auth.js';
import type { SecurityService } from '../../core/security.js';
import { ok } from '../../core/response.js';
import { requireStaff, type StaffPermission } from './admin-context.js';
import { AdminContentService } from './admin-content.service.js';
import { categoriesResponse, postResponse, postsResponse, reportsResponse, statsResponse, tagsResponse, versionsResponse } from './admin-content.schemas.js';

const querySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    q: { type: 'string', maxLength: 120 },
    status: { type: 'string', maxLength: 30 },
    category: { type: 'string', maxLength: 60 },
    type: { type: 'string', maxLength: 40 },
  },
} as const;

const idParams = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: { id: { type: 'string', minLength: 1, maxLength: 160 } },
} as const;

export async function registerAdminContentRoutes(app: FastifyInstance, auth: AuthService, security: SecurityService): Promise<void> {
  const content = new AdminContentService(app.db);
  const read = async (request: FastifyRequest, reply: FastifyReply, permission: StaffPermission) => requireStaff(auth, request, reply, { permission }, security);

  app.get('/admin/posts/stats', { schema: { response: { 200: statsResponse } } }, async (request, reply) => {
    if (!await read(request, reply, 'posts.read')) return;
    return ok(await content.getStats());
  });
  app.get('/admin/posts/categories', { schema: { response: { 200: categoriesResponse } } }, async (request, reply) => {
    if (!await read(request, reply, 'posts.read')) return;
    return ok(await content.getCategories());
  });
  app.get('/admin/posts/tags', { schema: { response: { 200: tagsResponse } } }, async (request, reply) => {
    if (!await read(request, reply, 'posts.read')) return;
    return ok(await content.getTags());
  });
  app.get<{ Querystring: { status?: string } }>('/admin/posts/reports', { schema: { querystring: { type: 'object', additionalProperties: false, properties: { status: { type: 'string', maxLength: 30 } } }, response: { 200: reportsResponse } } }, async (request, reply) => {
    if (!await read(request, reply, 'moderation.read')) return;
    return ok(await content.listReports(request.query.status));
  });
  app.get<{ Querystring: { q?: string; status?: string; category?: string; type?: string } }>('/admin/posts', { schema: { querystring: querySchema, response: { 200: postsResponse } } }, async (request, reply) => {
    if (!await read(request, reply, 'posts.read')) return;
    return ok(await content.listPosts(request.query));
  });
  app.get<{ Params: { id: string } }>('/admin/posts/:id/versions', { schema: { params: idParams, response: { 200: versionsResponse } } }, async (request, reply) => {
    if (!await read(request, reply, 'posts.read')) return;
    return ok(await content.getVersions(request.params.id));
  });
  app.get<{ Params: { id: string } }>('/admin/posts/:id', { schema: { params: idParams, response: { 200: postResponse } } }, async (request, reply) => {
    if (!await read(request, reply, 'posts.read')) return;
    return ok(await content.getPost(request.params.id));
  });
}
