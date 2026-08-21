import type { FastifyInstance, FastifyRequest } from 'fastify';
import { cleanupMultipartRequest, prepareMultipartRequest } from '../../core/multipart.js';
import { ok } from '../../core/response.js';
import { AuthService } from '../../core/auth.js';
import { SecurityService } from '../../core/security.js';
import { AppError } from '../../core/errors.js';
import { EncryptedAttachmentStorage, E2eeService } from './e2ee.service.js';
import { e2eeConversationBodySchema, e2eeDeviceBodySchema, e2eeMessageBodySchema } from '../../core/route-schemas.js';

const successSchema = {
  type: 'object',
  required: ['success', 'data'],
  additionalProperties: false,
  properties: { success: { const: true }, data: {} },
} as const;

const successWith = (data: Record<string, unknown>) => ({
  type: 'object', required: ['success', 'data'], additionalProperties: false, properties: { success: { const: true }, data },
});

const deviceKeySchema = {
  type: 'object', additionalProperties: false, required: ['id', 'deviceId', 'signalDeviceId', 'registrationId', 'protocolVersion', 'createdAt', 'rotatedAt'], properties: {
    id: { type: 'string' }, deviceId: { type: 'string' }, signalDeviceId: { type: 'integer' }, registrationId: { type: 'integer' }, protocolVersion: { type: 'string' }, createdAt: { type: 'string' }, rotatedAt: { type: ['string', 'null'] },
  },
} as const;

const signalBundleSchema = {
  type: 'object', additionalProperties: false, required: ['registration_id', 'device_id', 'pre_key_id', 'pre_key_public', 'signed_pre_key_id', 'signed_pre_key_public', 'signed_pre_key_signature', 'identity_key', 'kyber_pre_key_id', 'kyber_pre_key_public', 'kyber_pre_key_signature'], properties: {
    registration_id: { type: 'integer' }, device_id: { type: 'integer' }, pre_key_id: { type: ['integer', 'null'] }, pre_key_public: { type: ['string', 'null'] }, signed_pre_key_id: { type: 'integer' }, signed_pre_key_public: { type: 'string' }, signed_pre_key_signature: { type: 'string' }, identity_key: { type: 'string' }, kyber_pre_key_id: { type: 'integer' }, kyber_pre_key_public: { type: 'string' }, kyber_pre_key_signature: { type: 'string' },
  },
} as const;

const keyBundleDeviceSchema = {
  type: 'object', additionalProperties: false, required: ['deviceId', 'signalDeviceId', 'protocolVersion', 'bundle'], properties: { deviceId: { type: 'string' }, signalDeviceId: { type: 'integer' }, protocolVersion: { type: 'string' }, bundle: signalBundleSchema },
} as const;

const messageSchema = {
  type: 'object', additionalProperties: false, required: ['id', 'conversationId', 'senderDeviceId', 'recipientDeviceId', 'protocolVersion', 'message', 'clientMessageId', 'createdAt', 'deliveredAt'], properties: {
    id: { type: 'string' }, conversationId: { type: 'string' }, senderDeviceId: { type: 'string' }, recipientDeviceId: { type: ['string', 'null'] }, protocolVersion: { type: 'string' }, message: { type: 'object', additionalProperties: false, required: ['message_type', 'ciphertext'], properties: { message_type: { type: 'integer' }, ciphertext: { type: 'string' } } }, clientMessageId: { type: ['string', 'null'] }, createdAt: { type: 'string' }, deliveredAt: { type: ['string', 'null'] },
  },
} as const;

const conversationSchema = {
  type: 'object', additionalProperties: false, required: ['id', 'protocolVersion', 'createdAt', 'updatedAt', 'members'], properties: {
    id: { type: 'string' }, protocolVersion: { type: 'string' }, createdAt: { type: 'string' }, updatedAt: { type: 'string' }, members: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['userId', 'deviceId', 'joinedAt', 'revokedAt'], properties: { userId: { type: 'string' }, deviceId: { type: 'string' }, joinedAt: { type: 'string' }, revokedAt: { type: ['string', 'null'] } } } },
  },
} as const;

const userParams = { type: 'object', additionalProperties: false, required: ['userId'], properties: { userId: { type: 'string', minLength: 1, maxLength: 180 } } } as const;
const conversationParams = { type: 'object', additionalProperties: false, required: ['conversationId'], properties: { conversationId: { type: 'string', minLength: 1, maxLength: 180 } } } as const;
const attachmentParams = { type: 'object', additionalProperties: false, required: ['attachmentId'], properties: { attachmentId: { type: 'string', minLength: 1, maxLength: 180 } } } as const;

const limitQuery = {
  type: 'object',
  additionalProperties: false,
  properties: { limit: { type: 'string', pattern: '^[0-9]{1,3}$' } },
} as const;

async function verify(security: SecurityService, request: FastifyRequest): Promise<void> {
  if (typeof request.headers['x-tb-permit'] !== 'string' || !request.headers['x-tb-permit']) {
    throw new AppError('ACTION_PERMIT_INVALID', 'A one-time action permit is required.', 403);
  }
  await security.verifyRequest(request);
}

async function verifyRead(security: SecurityService, request: FastifyRequest): Promise<void> {
  await security.verifyRequest(request);
}

export async function registerE2eeRoutes(
  app: FastifyInstance,
  services: { auth: AuthService; security: SecurityService },
): Promise<E2eeService> {
  const e2ee = new E2eeService(app.db, services.auth, new EncryptedAttachmentStorage());

  app.post('/e2ee/devices', { schema: { body: e2eeDeviceBodySchema, response: { 200: successWith({ type: 'object', additionalProperties: false, required: ['protocolVersion', 'deviceId', 'keyId', 'signalDeviceId', 'registrationId', 'publishedAt', 'oneTimePrekeysAccepted'], properties: { protocolVersion: { type: 'string' }, deviceId: { type: 'string' }, keyId: { type: 'string' }, signalDeviceId: { type: 'integer' }, registrationId: { type: 'integer' }, publishedAt: { type: 'string' }, oneTimePrekeysAccepted: { type: 'integer' } } }) } }, preValidation: async (request) => verify(services.security, request) }, async (request) => ok(await e2ee.publishDeviceKeys(request, request.body)));
  app.get('/e2ee/devices', { schema: { response: { 200: successWith({ type: 'object', additionalProperties: false, required: ['protocolVersion', 'userId', 'devices'], properties: { protocolVersion: { type: 'string' }, userId: { type: 'string' }, devices: { type: 'array', items: deviceKeySchema } } }) } }, preHandler: async (request) => verifyRead(services.security, request) }, async (request) => ok(await e2ee.ownDevices(request)));
  app.get<{ Params: { userId: string } }>('/e2ee/users/:userId/key-bundle', {
    schema: { params: userParams, response: { 200: successWith({ type: 'object', additionalProperties: false, required: ['protocolVersion', 'userId', 'devices'], properties: { protocolVersion: { type: 'string' }, userId: { type: 'string' }, devices: { type: 'array', items: keyBundleDeviceSchema } } }) } },
    preHandler: async (request) => {
      await verifyRead(services.security, request);
      // Claiming a one-time pre-key mutates server state. Keep the budget
      // durable so an authenticated client cannot drain another user's pool
      // by restarting the API or opening many parallel tabs.
      await services.security.enforceReadBudget(request, {
        eventType: 'e2ee.key_bundle_claim',
        action: 'e2ee.key_bundle',
        maxPerWindow: 30,
        windowMs: 60_000,
      });
    },
  }, async (request) => ok(await e2ee.keyBundle(request, request.params.userId)));
  app.post('/e2ee/conversations', { schema: { body: e2eeConversationBodySchema, response: { 200: successWith({ type: 'object', additionalProperties: false, required: ['conversationId', 'protocolVersion', 'members', 'createdAt'], properties: { conversationId: { type: 'string' }, protocolVersion: { type: 'string' }, members: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['userId', 'deviceId', 'signalDeviceId'], properties: { userId: { type: 'string' }, deviceId: { type: 'string' }, signalDeviceId: { type: 'integer' } } } }, createdAt: { type: 'string' } } }) } }, preValidation: async (request) => verify(services.security, request) }, async (request) => ok(await e2ee.createConversation(request, request.body)));
  app.get('/e2ee/conversations', { schema: { response: { 200: successWith({ type: 'array', items: conversationSchema }) } }, preHandler: async (request) => verifyRead(services.security, request) }, async (request) => ok(await e2ee.listConversations(request)));
  app.get<{ Params: { conversationId: string }; Querystring: { limit?: string } }>('/e2ee/conversations/:conversationId/messages', { schema: { params: conversationParams, querystring: limitQuery, response: { 200: successWith({ type: 'array', items: messageSchema }) } }, preHandler: async (request) => verifyRead(services.security, request) }, async (request) => ok(await e2ee.messages(request, request.params.conversationId, request.query.limit)));
  app.post<{ Params: { conversationId: string } }>('/e2ee/conversations/:conversationId/messages', { schema: { params: conversationParams, body: e2eeMessageBodySchema, response: { 200: successWith(messageSchema) } }, preValidation: async (request) => verify(services.security, request) }, async (request) => ok(await e2ee.sendMessage(request, request.params.conversationId, request.body)));

  app.post<{ Params: { conversationId: string } }>('/e2ee/conversations/:conversationId/attachments', {
    schema: { params: conversationParams, response: { 200: successWith({ type: 'object', additionalProperties: false, required: ['attachmentId', 'conversationId', 'mimeType', 'sizeBytes', 'ciphertextSha256', 'encryptedFileKey', 'nonce', 'createdAt'], properties: { attachmentId: { type: 'string' }, conversationId: { type: 'string' }, mimeType: { type: 'string' }, sizeBytes: { type: 'integer' }, ciphertextSha256: { type: 'string' }, encryptedFileKey: { type: 'string' }, nonce: { type: 'string' }, createdAt: { type: 'string' } } }) } },
    preHandler: [
      async (request) => prepareMultipartRequest(request),
      async (request) => verify(services.security, request),
    ],
  }, async (request) => {
    try {
      const upload = request.multipartUpload;
      if (!upload?.file) return ok(await e2ee.uploadAttachment(request, request.params.conversationId, upload?.fields ?? {}, undefined));
      return ok(await e2ee.uploadAttachment(request, request.params.conversationId, upload.fields, upload.file.tempPath));
    } finally {
      await cleanupMultipartRequest(request);
    }
  });

  app.get<{ Params: { attachmentId: string } }>('/e2ee/attachments/:attachmentId', { schema: { params: attachmentParams }, preHandler: async (request) => verifyRead(services.security, request) }, async (request, reply) => {
    const { attachment, stream, sizeBytes } = await e2ee.streamAttachment(request, request.params.attachmentId);
    reply.type('application/octet-stream');
    reply.header('content-length', sizeBytes);
    reply.header('cache-control', 'private, no-store');
    reply.header('x-content-type-options', 'nosniff');
    reply.header('x-tb-ciphertext-sha256', attachment.ciphertextSha256);
    return reply.send(stream);
  });

  return e2ee;
}
