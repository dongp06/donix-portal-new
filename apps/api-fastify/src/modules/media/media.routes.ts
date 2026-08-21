import type { FastifyInstance } from 'fastify';
import { AuthService } from '../../core/auth.js';
import { sessionTokenFromRequest } from '../../core/crypto.js';
import { MediaService, type MediaActor } from './media.service.js';

const idParams = {
  type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string', minLength: 1, maxLength: 180 } },
} as const;

function safeFileName(value: string): string {
  return Array.from(value || 'image')
    .filter((character) => character.charCodeAt(0) >= 0x20 && character.charCodeAt(0) !== 0x7f)
    .join('')
    .replace(/[\\/\r\n\"]+/g, '_')
    .slice(0, 180) || 'image';
}

export async function registerMediaRoutes(
  app: FastifyInstance,
  services: { auth: AuthService; media: MediaService },
): Promise<void> {
  app.get<{ Params: { id: string } }>('/media/:id', { schema: { params: idParams } }, async (request, reply) => {
    const token = sessionTokenFromRequest(request);
    const resolved = token ? await services.auth.resolveSessionUser(token) : null;
    const actor: MediaActor | null = resolved
      ? { userId: resolved.user.id, staffRole: resolved.user.staffRole }
      : null;
    const attachment = await services.media.getStreamForDelivery(request.params.id, actor);
    reply.type(attachment.mimeType);
    reply.header('content-length', attachment.sizeBytes);
    reply.header('content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(safeFileName(attachment.originalName))}`);
    reply.header('cache-control', attachment.status === 'published' ? 'public, max-age=31536000, immutable' : 'private, no-store');
    reply.header('x-content-type-options', 'nosniff');
    return reply.send(attachment.stream);
  });
}
