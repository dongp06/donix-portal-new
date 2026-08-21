import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import dotenv from 'dotenv';
import { join } from 'node:path';
import { AuthService } from '../core/auth.js';
import { allowedOrigins, assertProductionSecurityConfig, requireMutationOrigin, TRANSPORT_CONFIG_PATH, TRANSPORT_ENVELOPE_CONTENT_TYPE, requestIdFrom, trustedProxy } from '../core/config.js';
import { apiRoot, configureDatabase, createDatabase, type Database } from '../core/database.js';
import {
  AppError,
  databaseErrorCode,
  isDatabaseAvailabilityError,
  isDatabaseSchemaError,
  isForeignKeyConstraintError,
  isRecordNotFoundError,
  isUniqueConstraintError,
} from '../core/errors.js';
import { fail } from '../core/response.js';
import { SecurityService } from '../core/security.js';
import { TransportService } from '../core/transport.js';
import { MULTIPART_MAX_FILE_SIZE } from '../core/multipart.js';
import { registerControlRoutes } from '../modules/control/control.routes.js';
import { registerPublicRoutes } from '../modules/public/public.routes.js';
import { ResourceStorageService } from '../modules/resources/resource-storage.service.js';
import { ResourcesService } from '../modules/resources/resources.service.js';
import { registerResourceRoutes } from '../modules/resources/resources.routes.js';

export type BuildAppOptions = {
  db?: Database;
  transport?: TransportService;
  logger?: boolean;
  enforceTransport?: boolean;
};

function loadEnvironment(): void {
  dotenv.config({ path: join(apiRoot(), '.env') });
}

function isApiPath(path: string): boolean {
  return path === '/api' || path.startsWith('/api/');
}

function isMutation(method: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
}

function isDeviceBootstrap(path: string, method: string): boolean {
  return method.toUpperCase() === 'POST' && path === '/api/bootstrap';
}

const TRANSPORT_FALLBACK_MUTATION_PATHS = new Set([
  '/api/auth/onboarding',
  '/api/auth/become-seller',
  '/api/client-errors',
]);

// These handlers do not consume a payload. Normalize a genuinely absent body
// to the same empty object the browser client sends, so old/native callers do
// not fail schema validation before the session check. Explicit malformed or
// non-empty payloads still go through the normal schema validator.
const EMPTY_BODY_NORMALIZATION_PATHS = new Set([
  '/api/auth/become-seller',
  '/api/auth/logout',
]);

/**
 * Session-lifecycle recovery only. These routes still require the session
 * cookie and the global mutation Origin check, but must remain usable when a
 * browser has lost its cached transport key. Access-token issuance/renewal,
 * permits, uploads, admin actions and domain writes stay transport-required.
 */
function isTransportFallbackMutation(path: string, method: string): boolean {
  if (method.toUpperCase() !== 'POST') return false;
  return TRANSPORT_FALLBACK_MUTATION_PATHS.has(path);
}

/**
 * Native browser consumers (img, download links, health probes, and an
 * anonymous page load) cannot attach the negotiated THB/4 headers. Keep a
 * narrow clear-text read lane for data that is already public or explicitly
 * guarded by its route with the session cookie. Mutations, admin reads,
 * E2EE, permits, and security endpoints remain transport-required.
 */
function isTransportOptionalRead(path: string, method: string): boolean {
  if (!['GET', 'HEAD'].includes(method.toUpperCase())) return false;
  if (path === '/api/health' || path === '/api/bootstrap' || path === '/api/auth/me') return true;
  if (path === '/api/bots' || path === '/api/bots/categories' || /^\/api\/bots\/[^/]+(?:\/reviews)?$/.test(path)) return true;
  if (path === '/api/posts' || path === '/api/posts/categories' || path === '/api/posts/tags') return true;
  if (/^\/api\/posts\/slug\/[^/]+$/.test(path) || /^\/api\/posts\/(?!me$|saved$)[^/]+$/.test(path)) return true;
  if (path === '/api/sellers/lookup' || /^\/api\/sellers\/[^/]+(?:\/follow)?$/.test(path)) return true;
  if (path === '/api/comments') return true;
  if (path === '/api/resources' || /^\/api\/resources\/post\/[^/]+$/.test(path) || /^\/api\/resources\/[^/]+$/.test(path)) return true;
  if (/^\/api\/resources\/files\/[^/]+\/(?:preview|download|view)$/.test(path)) return true;
  if (/^\/api\/media\/[^/]+$/.test(path)) return true;
  return false;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  loadEnvironment();
  assertProductionSecurityConfig();
  const db = options.db ?? createDatabase();
  const ownsDatabase = !options.db;
  const transport = options.transport ?? new TransportService();
  const auth = new AuthService(db);
  const security = new SecurityService(db, auth);
  const resources = new ResourcesService(db, new ResourceStorageService());
  const origins = allowedOrigins();
  const enforceTransport = options.enforceTransport ?? true;
  const app = Fastify({
    // Never let query strings reach structured request logs. OAuth callback
    // URLs contain one-time `code` and `state` values, and transport headers
    // contain request metadata that is not useful in ordinary access logs.
    logger: options.logger
      ? {
          redact: {
            paths: [
              'req.url',
              'req.headers.cookie',
              'req.headers.authorization',
              'req.headers.dpop',
              'req.headers.x-tb-transport-key',
            ],
            censor: '[Redacted]',
          },
        }
      : false,
    trustProxy: trustedProxy(),
    requestIdHeader: 'x-request-id',
    bodyLimit: 70 * 1024 * 1024,
    ajv: { customOptions: { removeAdditional: false } },
  });

  app.decorate('db', db);
  app.decorate('auth', auth);
  app.decorate('security', security);
  app.decorate('transport', transport);
  const databaseConfigured = await configureDatabase(db);
  if (!databaseConfigured) app.log.warn('Database connection configuration is degraded; requests will return retryable database errors.');

  await app.register(cookie);
  await app.register(multipart, {
    limits: {
      // The resource contract allows 50 MB. Image media keeps its stricter
      // 10 MB rule inside MediaStorageService after parsing.
      fileSize: MULTIPART_MAX_FILE_SIZE,
      files: 1,
      fields: 8,
      parts: 10,
      fieldSize: 256 * 1024,
    },
    throwFileSizeLimit: true,
  });
  await app.register(cors, {
    origin: origins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'DPoP',
      'x-request-id',
      'x-tb-protocol',
      'x-tb-device',
      'x-tb-session',
      'x-tb-request',
      'x-tb-time',
      'x-tb-nonce',
      'x-tb-sequence',
      'x-tb-body-sha256',
      'x-tb-idempotency',
      'x-tb-permit',
      'x-tb-server-nonce',
      'x-tb-transport',
      'x-tb-transport-key',
      'x-tb-transport-kid',
      'x-tb-transport-request',
      'x-tb-transport-sequence',
      'x-tb-transport-mode',
    ],
    exposedHeaders: ['X-Request-Id', 'X-TB-Transport', 'X-TB-Transport-Required', 'X-TB-Transport-Content-Type'],
  });
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    },
  });
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    errorResponseBuilder: (_request, context) => ({
      success: false,
      error: 'Too many requests.',
      code: 'RATE_LIMITED',
      retryAfter: context.after,
    }),
  });

  // Fastify's built-in JSON parser intentionally rejects a zero-byte body.
  // A few session-lifecycle endpoints are harmless empty-object commands and
  // have to remain compatible with older callers that omit both the body and
  // the content type. Keep the normal secure parser for every other request,
  // and only normalize an actually empty payload on those exact routes.
  const defaultJsonParser = app.getDefaultJsonParser('error', 'error');
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
    const path = request.raw.url?.split('?', 1)[0] || '/';
    const rawBody = typeof body === 'string' ? body : body.toString('utf8');
    if (
      rawBody.length === 0 &&
      request.method.toUpperCase() === 'POST' &&
      EMPTY_BODY_NORMALIZATION_PATHS.has(path)
    ) {
      done(null, {});
      return;
    }
    defaultJsonParser(request, rawBody, done);
  });

  app.addContentTypeParser(TRANSPORT_ENVELOPE_CONTENT_TYPE, { parseAs: 'buffer' }, (_request, body, done) => {
    if (Buffer.isBuffer(body)) {
      done(null, body);
      return;
    }
    done(null, Buffer.from(body as string));
  });

  app.addHook('onRequest', async (request, reply) => {
    const requestId = requestIdFrom(request.headers['x-request-id']);
    reply.header('x-request-id', requestId);
    reply.header('x-content-type-options', 'nosniff');
    reply.header('x-frame-options', 'DENY');
    reply.header('referrer-policy', 'strict-origin-when-cross-origin');
    reply.header('cross-origin-resource-policy', 'same-origin');
    reply.header('x-permitted-cross-domain-policies', 'none');
    reply.header('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    const path = request.url.split('?', 1)[0] || '/';
    const contentLength = request.headers['content-length'];
    const emptyRequestBody = !request.headers['content-type'] &&
      (!contentLength || contentLength === '0');
    if (
      request.method.toUpperCase() === 'POST' &&
      emptyRequestBody &&
      EMPTY_BODY_NORMALIZATION_PATHS.has(path)
    ) {
      // Fastify otherwise rejects a zero-byte POST without a media type
      // during content parsing, before the route's harmless empty-object
      // schema can run. Restrict this parser hint to lifecycle endpoints.
      request.headers['content-type'] = 'application/json';
    }
    if (isMutation(request.method)) {
      const origin = request.headers.origin;
      if (!origin && requireMutationOrigin()) {
        throw new AppError('ORIGIN_REQUIRED', 'Origin is required for this mutation.', 403);
      }
      if (origin && !origins.includes(origin)) throw new AppError('ORIGIN_NOT_ALLOWED', 'Origin is not allowed.', 403);
    }
    const deviceBootstrap = isDeviceBootstrap(path, request.method);
    const transportFallbackMutation = isTransportFallbackMutation(path, request.method);
    transport.attachRequestMetadata(request, {
      allowCleartextFallback: deviceBootstrap || transportFallbackMutation,
    });
    const isOAuthRedirect = path === '/api/auth/google/start' || path === '/api/auth/google/callback';
    if (
      enforceTransport &&
      isApiPath(path) &&
      path !== TRANSPORT_CONFIG_PATH &&
      !isOAuthRedirect &&
      request.method !== 'OPTIONS' &&
      !request.transport &&
       !isTransportOptionalRead(path, request.method) &&
       !deviceBootstrap &&
       !transportFallbackMutation
    ) {
      reply.header('x-tb-transport-required', 'v4');
      throw new AppError('TRANSPORT_REQUIRED', 'Encrypted transport negotiation is required.', 426);
    }
  });

  app.addHook('preValidation', async (request) => {
    transport.decryptRequestBody(request);
    const path = request.url.split('?', 1)[0] || '/';
    if (
      request.method.toUpperCase() === 'POST' &&
      request.body === undefined &&
      EMPTY_BODY_NORMALIZATION_PATHS.has(path)
    ) {
      request.body = {};
    }
  });

  app.addHook('onSend', async (request, reply, payload) => transport.encryptOnSend(request, reply, payload as string | Buffer));

  app.setErrorHandler((error, request, reply) => {
    if (reply.sent) return;
    const candidate = error as {
      validation?: unknown;
      validationContext?: unknown;
      statusCode?: unknown;
      message?: unknown;
      code?: unknown;
    };
    const validation = Array.isArray(candidate.validation);
    const databaseCode = databaseErrorCode(error);
    const frameworkCode = typeof candidate.code === 'string' ? candidate.code : '';
    const malformedJson = frameworkCode === 'FST_ERR_CTP_INVALID_JSON_BODY';
    const unsupportedMedia = frameworkCode === 'FST_ERR_CTP_INVALID_MEDIA_TYPE';
    const payloadTooLarge = frameworkCode === 'FST_ERR_CTP_BODY_TOO_LARGE' || candidate.statusCode === 413;
    const databaseFailure = !validation && !(error instanceof AppError) && isDatabaseAvailabilityError(error);
    const databaseSchemaFailure = !validation && !(error instanceof AppError) && isDatabaseSchemaError(error);
    const databaseNotFound = !validation && !(error instanceof AppError) && isRecordNotFoundError(error);
    const databaseConflict = !validation && !(error instanceof AppError) && (isUniqueConstraintError(error) || isForeignKeyConstraintError(error));
    if (validation) {
      // Keep the client response intentionally generic, but leave enough
      // server-side evidence to identify whether a failing request violated
      // its input schema or whether a handler produced an invalid response.
      // Never log the body, query values, cookies, authorization, or proof.
      const issues = (candidate.validation as unknown[]).slice(0, 8).map((item) => {
        if (!item || typeof item !== 'object') return { message: String(item) };
        const issue = item as Record<string, unknown>;
        return {
          instancePath: typeof issue.instancePath === 'string' ? issue.instancePath : undefined,
          schemaPath: typeof issue.schemaPath === 'string' ? issue.schemaPath : undefined,
          keyword: typeof issue.keyword === 'string' ? issue.keyword : undefined,
          message: typeof issue.message === 'string' ? issue.message : undefined,
        };
      });
      request.log.warn({
        requestId: request.id,
        method: request.method,
        path: request.url.split('?', 1)[0] || '/',
        validationContext: typeof candidate.validationContext === 'string' ? candidate.validationContext : 'unknown',
        issues,
      }, 'Fastify schema validation failed');
    }
    const statusCode = error instanceof AppError
      ? error.statusCode
        : validation
          ? 400
          : malformedJson
            ? 400
            : unsupportedMedia
              ? 415
              : payloadTooLarge
                ? 413
          : databaseNotFound
            ? 404
            : databaseConflict
              ? 409
          : databaseFailure
            ? 503
            : databaseSchemaFailure
              ? 503
            : typeof candidate.statusCode === 'number' && candidate.statusCode >= 400
              ? candidate.statusCode
              : 500;
    const code = error instanceof AppError
      ? error.code
        : validation
          ? 'VALIDATION_FAILED'
          : malformedJson
            ? 'INVALID_JSON'
            : unsupportedMedia
              ? 'UNSUPPORTED_MEDIA_TYPE'
              : payloadTooLarge
                ? 'PAYLOAD_TOO_LARGE'
          : databaseNotFound
            ? 'NOT_FOUND'
            : databaseConflict
              ? databaseCode === 'P2003' ? 'RELATION_CONFLICT' : 'CONFLICT'
          : databaseFailure
            ? 'DATABASE_UNAVAILABLE'
            : databaseSchemaFailure
              ? 'DATABASE_SCHEMA_UNAVAILABLE'
            : statusCode === 413
              ? 'PAYLOAD_TOO_LARGE'
              : 'INTERNAL_ERROR';
    const message = error instanceof AppError
      ? error.message
        : validation
          ? 'Request payload is invalid.'
          : malformedJson
            ? 'Request body is not valid JSON.'
            : unsupportedMedia
              ? 'Request content type is not supported.'
              : payloadTooLarge
                ? 'Request payload is too large.'
          : databaseNotFound
            ? 'Requested record was not found.'
            : databaseConflict
              ? databaseCode === 'P2003' ? 'The related record is unavailable.' : 'The requested record already exists.'
          : databaseFailure
            ? 'Database temporarily unavailable. Please retry.'
            : databaseSchemaFailure
              ? 'Database schema is temporarily unavailable. Please retry.'
            : statusCode >= 500
            ? 'Internal server error.'
            : typeof candidate.message === 'string'
              ? candidate.message
              : 'Request failed.';
    if (databaseFailure || databaseSchemaFailure) {
      reply.header('retry-after', '2');
      request.log.warn({ requestId: request.id, code: databaseSchemaFailure ? 'DATABASE_SCHEMA_UNAVAILABLE' : 'DATABASE_UNAVAILABLE', databaseCode }, 'Database temporarily unavailable');
    } else if (statusCode >= 500) {
      request.log.error({ err: error, requestId: request.id }, 'Fastify request failed');
    } else if (statusCode >= 400 && error instanceof AppError) {
      request.log.warn({
        requestId: request.id,
        method: request.method,
        path: request.url.split('?', 1)[0] || '/',
        statusCode,
        code: error.code,
      }, 'Fastify request rejected');
    }
    reply.code(statusCode).send(fail(message, code, request.id));
  });

  await app.register(async (api) => {
    await registerControlRoutes(api, { auth, security, transport, resources });
    await registerPublicRoutes(api, { db, auth });
    await registerResourceRoutes(api, { auth, security, resources });
  }, { prefix: '/api' });

  app.addHook('onClose', async () => {
    if (ownsDatabase) await db.$disconnect();
  });
  return app;
}
