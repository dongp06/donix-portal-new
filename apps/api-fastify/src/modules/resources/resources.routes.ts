import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AppError, isDatabaseAvailabilityError, isDatabaseSchemaError } from '../../core/errors.js';
import { ok } from '../../core/response.js';
import { sessionTokenFromRequest } from '../../core/crypto.js';
import { AuthService } from '../../core/auth.js';
import type { SecurityService } from '../../core/security.js';
import { ResourcesService } from './resources.service.js';
import { publicResourceSchema, successWithSchema } from '../../core/route-schemas.js';

const publicResponse = successWithSchema(publicResourceSchema);
const previewResponse = successWithSchema({
  type: 'object', additionalProperties: false,
  required: ['fileId', 'filename', 'mimeType', 'sha256', 'sizeBytes', 'content'],
  properties: { fileId: { type: 'string' }, filename: { type: 'string' }, mimeType: { type: 'string' }, sha256: { type: 'string', pattern: '^[a-f0-9]{64}$' }, sizeBytes: { type: 'integer', minimum: 0 }, content: { type: 'string' } },
});
const listResponse = successWithSchema({ type: 'array', items: publicResourceSchema });

const listQuery = {
  type: 'object',
  additionalProperties: false,
  properties: {
    q: { type: 'string', maxLength: 120 },
    limit: { type: 'string', pattern: '^[0-9]{1,3}$' },
  },
} as const;

const idParams = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: { id: { type: 'string', minLength: 1, maxLength: 180 } },
} as const;

const slugParams = {
  type: 'object',
  additionalProperties: false,
  required: ['slug'],
  properties: { slug: { type: 'string', minLength: 1, maxLength: 180 } },
} as const;

function safeFileName(value: string): string {
  return Array.from(value || 'resource-file')
    .filter((character) => character.charCodeAt(0) >= 0x20 && character.charCodeAt(0) !== 0x7f)
    .join('')
    .replace(/[\\/\r\n"]+/g, '_')
    .slice(0, 180) || 'resource-file';
}

function notFound(): AppError {
  return new AppError('NOT_FOUND', 'Not found.', 404);
}

async function publicResourceList<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isDatabaseAvailabilityError(error) || isDatabaseSchemaError(error)) return fallback;
    throw error;
  }
}

async function viewerId(auth: AuthService, request: FastifyRequest): Promise<string | null> {
  const token = sessionTokenFromRequest(request);
  if (!token) return null;
  const resolved = await auth.resolveSessionUser(token);
  return resolved?.user.id ?? null;
}

async function requireOwner(auth: AuthService, request: FastifyRequest): Promise<{ userId: string; staffRole: string }> {
  const token = sessionTokenFromRequest(request);
  const resolved = token ? await auth.resolveSessionUser(token) : null;
  if (!resolved?.user.staffRole || resolved.user.staffRole !== 'owner') throw notFound();
  return { userId: resolved.user.id, staffRole: resolved.user.staffRole };
}

function sendStream(reply: FastifyReply, file: { filename: string; mimeType: string; sizeBytes: number; stream: NodeJS.ReadableStream }, disposition: 'inline' | 'attachment'): FastifyReply {
  reply.header('x-content-type-options', 'nosniff');
  reply.header('cache-control', 'private, no-store');
  reply.type(file.mimeType);
  reply.header('content-length', file.sizeBytes);
  reply.header('content-disposition', `${disposition}; filename="resource-file"; filename*=UTF-8''${encodeURIComponent(safeFileName(file.filename))}`);
  return reply.send(file.stream);
}

export async function registerResourceRoutes(app: FastifyInstance, services: { auth: AuthService; security: SecurityService; resources: ResourcesService }): Promise<void> {
  const { auth, resources } = services;

  app.get<{ Querystring: { q?: string; limit?: string } }>('/resources', { schema: { querystring: listQuery, response: { 200: listResponse } } }, async (request) => ok(await publicResourceList(() => resources.listPublished(request.query), [])));

  app.get<{ Params: { slug: string } }>('/resources/post/:slug', { schema: { params: slugParams, response: { 200: publicResponse } } }, async (request, reply) => {
    const data = await resources.getPublishedByPostSlug(request.params.slug, true);
    if (!data) return reply.code(404).send({ success: false, error: 'Resource was not found.', code: 'RESOURCE_NOT_FOUND' });
    return ok(data);
  });

  app.get<{ Params: { id: string } }>('/resources/:id', { schema: { params: idParams, response: { 200: publicResponse } } }, async (request, reply) => {
    const data = await resources.getPublishedById(request.params.id);
    if (!data) return reply.code(404).send({ success: false, error: 'Resource was not found.', code: 'RESOURCE_NOT_FOUND' });
    return ok(data);
  });

  app.get<{ Params: { id: string } }>('/resources/files/:id/preview', { schema: { params: idParams, response: { 200: previewResponse } } }, async (request) => ok(await resources.previewFile(request.params.id, await viewerId(auth, request))));

  app.get<{ Params: { id: string } }>('/resources/files/:id/download', { schema: { params: idParams } }, async (request, reply) => sendStream(reply, await resources.downloadFileStream(request.params.id, await viewerId(auth, request)), 'attachment'));

  app.get<{ Params: { id: string } }>('/resources/files/:id/view', { schema: { params: idParams } }, async (request, reply) => sendStream(reply, await resources.viewImageStream(request.params.id, await viewerId(auth, request)), 'inline'));

  // Staged resource previews are owner-only and intentionally kept outside the
  // public resource state machine. Upload/delete mutations still enter through
  // the opaque capability gateway.
  app.get<{ Params: { id: string } }>('/admin/resources/files/:id/preview', { schema: { params: idParams, response: { 200: previewResponse } }, preHandler: async (request) => { await services.security.verifyRequest(request); } }, async (request) => ok(await resources.previewStagedFile(request.params.id, await requireOwner(auth, request))));
}
