import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { clearAuthCookies, clearOAuthStateCookie, setAuthCookie, setOAuthStateCookie, sessionTokenFromRequest } from '../../core/cookies.js';
import { oauthStateCookieName } from '../../core/config.js';
import { AppError } from '../../core/errors.js';
import { ok } from '../../core/response.js';
import { actionForPath, SecurityService } from '../../core/security.js';
import { AuthService } from '../../core/auth.js';
import { TransportService } from '../../core/transport.js';
import { cleanupMultipartRequest, prepareMultipartRequest } from '../../core/multipart.js';
import { MediaService } from '../media/media.service.js';
import { MediaStorageService } from '../media/media-storage.service.js';
import { registerMediaRoutes } from '../media/media.routes.js';
import { MutationService } from '../mutations/mutation.service.js';
import type { ResourcesService } from '../resources/resources.service.js';
import { SellerProfileService } from '../sellers/seller-profile.service.js';
import { registerSellerProfileRoutes } from '../sellers/seller-profile.routes.js';
import { TrustService } from '../trust/trust.service.js';
import { registerTrustRoutes } from '../trust/trust.routes.js';
import { registerAdminTrustRoutes } from '../trust/admin-trust.routes.js';
import { registerWebAuthnRoutes } from '../security/webauthn.routes.js';
import { registerAdminReadRoutes } from '../admin/admin-read.routes.js';
import { AdminWriteService } from '../admin/admin-write.service.js';
import { AdminContentService } from '../admin/admin-content.service.js';
import { registerAdminContentRoutes } from '../admin/admin-content.routes.js';
import { MaintenanceService } from '../../core/maintenance.js';
import { registerE2eeRoutes } from '../e2ee/e2ee.routes.js';

const emptyBodySchema = {
  type: 'object',
  additionalProperties: false,
} as const;

const capabilityParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['cap'],
  properties: {
    cap: { type: 'string', minLength: 40, maxLength: 180, pattern: '^[A-Za-z0-9_-]+$' },
  },
} as const;

const clientErrorBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    message: { type: 'string', maxLength: 4_000 },
    stack: { type: 'string', maxLength: 32_000 },
    componentStack: { type: 'string', maxLength: 32_000 },
    url: { type: 'string', maxLength: 2_048 },
    timestamp: { type: 'string', maxLength: 80 },
    level: { type: 'string', enum: ['error', 'warning', 'info'] },
    category: { type: 'string', enum: ['react', 'javascript', 'network', 'user', 'unknown'] },
    route: { type: 'string', maxLength: 512 },
    component: { type: 'string', maxLength: 256 },
  },
} as const;

const googleBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    idToken: { type: 'string', minLength: 1, maxLength: 20_000 },
    accessToken: { type: 'string', minLength: 1, maxLength: 20_000 },
  },
} as const;

const googleStartQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    returnTo: { type: 'string', maxLength: 512 },
  },
} as const;

const googleCallbackQuerySchema = {
  type: 'object',
  // OAuth providers may add non-security metadata to the callback query
  // (for example flowName/session_state). The handler intentionally consumes
  // only code, state and error fields, so rejecting unknown metadata here
  // would break provider-compatible callbacks without improving auth safety.
  additionalProperties: true,
  properties: {
    code: { type: 'string', minLength: 1, maxLength: 4_096 },
    state: { type: 'string', minLength: 1, maxLength: 180 },
    // Google includes these fields on a successful authorization-code
    // callback. They are provider metadata; the server still validates the
    // code, state cookie, PKCE verifier and OIDC nonce in the handler.
    scope: { type: 'string', maxLength: 4_096 },
    authuser: { type: 'string', maxLength: 32 },
    prompt: { type: 'string', maxLength: 64 },
    hd: { type: 'string', maxLength: 255 },
    error: { type: 'string', maxLength: 200 },
    error_description: { type: 'string', maxLength: 1_000 },
    error_uri: { type: 'string', maxLength: 2_048 },
    error_subtype: { type: 'string', maxLength: 200 },
  },
} as const;

const onboardingBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['role'],
  properties: {
    role: { type: 'string', enum: ['buyer', 'seller'] },
  },
} as const;

const successSchema = {
  type: 'object',
  required: ['success', 'data'],
  additionalProperties: false,
  properties: { success: { const: true }, data: {} },
} as const;

const successWith = (data: Record<string, unknown>) => ({
  type: 'object',
  required: ['success', 'data'],
  additionalProperties: false,
  properties: { success: { const: true }, data },
});

const userDataSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'email', 'avatar', 'role', 'verificationState', 'trustedAt', 'trustedUntil', 'bio', 'joinedDate', 'onboardingCompleted', 'isTrusted', 'contact', 'isNewUser'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    email: { type: 'string' },
    avatar: { type: 'string' },
    role: { enum: ['buyer', 'seller'] },
    verificationState: { type: 'string' },
    trustedAt: { type: ['string', 'null'] },
    trustedUntil: { type: ['string', 'null'] },
    bio: { type: ['string', 'null'] },
    joinedDate: { type: 'string' },
    onboardingCompleted: { type: 'boolean' },
    isTrusted: { type: 'boolean' },
    contact: { type: 'object', additionalProperties: { type: 'string' } },
    isNewUser: { type: 'boolean' },
    staffRole: { type: 'string' },
    staff: { type: 'object', additionalProperties: false, required: ['role'], properties: { role: { type: 'string' } } },
  },
} as const;

const transportDataSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['protocolVersion', 'algorithm', 'kid', 'wireKid', 'publicKeyJwk'],
  properties: {
    protocolVersion: { type: 'integer' },
    algorithm: { type: 'integer', const: 1 },
    kid: { type: 'string' },
    wireKid: { type: 'string', pattern: '^[A-Za-z0-9_-]{11}$' },
    publicKeyJwk: { type: 'object', additionalProperties: false, required: ['kty', 'crv', 'x', 'y'], properties: { kty: { const: 'EC' }, crv: { const: 'P-256' }, x: { type: 'string' }, y: { type: 'string' } } },
  },
} as const;

const healthDataSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'timestamp', 'database'],
  properties: { status: { enum: ['healthy', 'degraded'] }, timestamp: { type: 'string' }, database: { type: 'boolean' } },
} as const;

const deviceBootstrapDataSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['protocolVersion', 'sessionId', 'sessionGeneration', 'deviceId', 'fingerprint', 'algorithm', 'lastSequence', 'canary', 'expiresAt'],
  properties: {
    protocolVersion: { type: 'integer' }, sessionId: { type: 'string' }, sessionGeneration: { type: 'integer' }, deviceId: { type: 'string' }, fingerprint: { type: 'string' }, algorithm: { type: 'string' }, lastSequence: { type: 'integer' }, canary: { type: 'string' }, expiresAt: { type: 'string' },
  },
} as const;

const renewalChallengeDataSchema = {
  type: 'object', additionalProperties: false, required: ['protocolVersion', 'challenge', 'expiresAt'], properties: { protocolVersion: { type: 'integer' }, challenge: { type: 'string' }, expiresAt: { type: 'string' } },
} as const;

const deviceListDataSchema = {
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'deviceName', 'platform', 'fingerprint', 'protocolVersion', 'trustState', 'createdAt', 'lastSeenAt', 'revokedAt', 'current'],
    properties: { id: { type: 'string' }, deviceName: { type: ['string', 'null'] }, platform: { type: ['string', 'null'] }, fingerprint: { type: 'string' }, protocolVersion: { type: 'integer' }, trustState: { type: 'string' }, createdAt: { type: 'string' }, lastSeenAt: { type: 'string' }, revokedAt: { type: ['string', 'null'] }, current: { type: 'boolean' } },
  },
} as const;

const inspectDataSchema = {
  type: 'object', additionalProperties: false, required: ['protocolVersion', 'requestId', 'sessionId', 'deviceId', 'action', 'risk'], properties: { protocolVersion: { type: ['string', 'null'] }, requestId: { type: 'string' }, sessionId: { type: ['string', 'null'] }, deviceId: { type: ['string', 'null'] }, action: { type: ['string', 'null'] }, risk: { enum: ['evaluated', 'not_authenticated'] } },
} as const;

const adminAccessDataSchema = {
  type: 'object', additionalProperties: false, required: ['user', 'staff'], properties: {
    user: { type: 'object', additionalProperties: false, required: ['id', 'name', 'email', 'avatar', 'role'], properties: { id: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' }, avatar: { type: 'string' }, role: { enum: ['buyer', 'seller'] } } },
    staff: { type: 'object', additionalProperties: false, required: ['role'], properties: { role: { type: 'string' } } },
  },
} as const;

const bootstrapResponse = {
  ...successSchema,
  properties: {
    success: { const: true },
    data: {
      type: 'object',
      additionalProperties: false,
      required: ['protocolVersion', 'authenticated'],
      properties: {
        protocolVersion: { type: 'integer' },
        authenticated: { type: 'boolean' },
        sessionId: { type: ['string', 'null'] },
        sessionGeneration: { type: ['integer', 'null'] },
        deviceId: { type: ['string', 'null'] },
        expiresAt: { type: ['string', 'null'] },
      },
    },
  },
} as const;

const deviceBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['publicKeyJwk'],
  properties: {
    publicKeyJwk: {
      type: 'object',
      additionalProperties: false,
      required: ['kty', 'crv', 'x', 'y'],
      properties: {
        kty: { const: 'EC' },
        crv: { const: 'P-256' },
        // Web Crypto emits unpadded base64url. Some browser interop layers
        // preserve up to two padding characters; createPublicKey below
        // normalizes the accepted JWK before it is stored.
        x: { type: 'string', pattern: '^[A-Za-z0-9_-]{20,100}={0,2}$' },
        y: { type: 'string', pattern: '^[A-Za-z0-9_-]{20,100}={0,2}$' },
        ext: { type: 'boolean' },
        alg: { const: 'ES256' },
        use: { const: 'sig' },
        key_ops: {
          type: 'array',
          minItems: 1,
          maxItems: 2,
          uniqueItems: true,
          items: { type: 'string', enum: ['sign', 'verify'] },
        },
      },
    },
    deviceName: { type: 'string', maxLength: 120 },
    platform: { type: 'string', maxLength: 80 },
  },
} as const;

const permitBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    action: { type: 'string', maxLength: 80 },
    method: { type: 'string', enum: ['POST', 'PUT', 'PATCH', 'DELETE', 'post', 'put', 'patch', 'delete'] },
    path: { type: 'string', minLength: 1, maxLength: 500 },
    targetId: { type: 'string', maxLength: 200 },
    bodyHash: { type: 'string', pattern: '^[a-fA-F0-9]{64}$' },
  },
} as const;

const permitResponse = {
  ...successSchema,
  properties: {
    success: { const: true },
    data: {
      type: 'object',
      additionalProperties: false,
      required: ['protocolVersion', 'intentId', 'permit', 'endpoint', 'serverNonce', 'expiresAt', 'expiresInMs', 'requiresStepUp'],
      properties: {
        protocolVersion: { type: 'integer' },
        intentId: { type: 'string' },
        permit: { type: 'string' },
        endpoint: { type: 'string' },
        serverNonce: { type: 'string' },
        expiresAt: { type: 'string' },
        expiresInMs: { type: 'integer' },
        requiresStepUp: { type: 'boolean' },
      },
    },
  },
} as const;

const accessResponse = {
  ...successSchema,
  properties: {
    success: { const: true },
    data: {
      type: 'object',
      additionalProperties: false,
      required: ['protocolVersion', 'token', 'tokenType', 'expiresAt', 'expiresInMs', 'scopes', 'deviceId', 'sessionId', 'sessionGeneration'],
      properties: {
        protocolVersion: { type: 'integer' },
        token: { type: 'string' },
        tokenType: { const: 'DPoP' },
        expiresAt: { type: 'string' },
        expiresInMs: { type: 'integer' },
        scopes: { type: 'array', items: { type: 'string' } },
        deviceId: { type: 'string' },
        sessionId: { type: 'string' },
        sessionGeneration: { type: 'integer' },
      },
    },
  },
} as const;

const renewResponse = {
  ...successSchema,
  properties: {
    success: { const: true },
    data: {
      type: 'object',
      additionalProperties: false,
      required: ['protocolVersion', 'token', 'tokenType', 'expiresAt', 'expiresInMs', 'scopes', 'deviceId', 'sessionId', 'sessionGeneration', 'rotated'],
      properties: {
        protocolVersion: { type: 'integer' },
        token: { type: 'string' },
        tokenType: { const: 'DPoP' },
        expiresAt: { type: 'string' },
        expiresInMs: { type: 'integer' },
        scopes: { type: 'array', items: { type: 'string' } },
        deviceId: { type: 'string' },
        sessionId: { type: 'string' },
        sessionGeneration: { type: 'integer' },
        rotated: { type: 'boolean' },
        previousSessionId: { type: ['string', 'null'] },
      },
    },
  },
} as const;

function notFound(reply: FastifyReply): void {
  reply.code(404).send({ success: false, error: 'Not found.', code: 'NOT_FOUND' });
}

export async function registerControlRoutes(
  app: FastifyInstance,
  services: { auth: AuthService; security: SecurityService; transport: TransportService; resources: ResourcesService },
): Promise<void> {
  const { auth, security, transport, resources } = services;
  const media = new MediaService(app.db, new MediaStorageService());
  const sellerProfiles = new SellerProfileService(app.db, media);
  const trust = new TrustService(app.db, sellerProfiles);
  const adminWrites = new AdminWriteService(app.db);
  const adminContent = new AdminContentService(app.db);
  const e2ee = await registerE2eeRoutes(app, { auth, security });
  const mutations = new MutationService(app.db, auth, media, resources, sellerProfiles, trust, adminWrites, adminContent, security, e2ee);
  const maintenance = new MaintenanceService(app.db, trust, resources, media);
  await maintenance.runOnce();
  maintenance.start();
  app.addHook('onClose', async () => maintenance.stop());

  await registerMediaRoutes(app, { auth, media });
  await registerSellerProfileRoutes(app, { auth, profiles: sellerProfiles });
  await registerTrustRoutes(app, { auth, trust });
  await registerAdminTrustRoutes(app, { auth, security, trust });
  await registerWebAuthnRoutes(app, { auth, security });
  await registerAdminReadRoutes(app, auth, security);
  await registerAdminContentRoutes(app, auth, security);

  app.get('/transport/config', { schema: { response: { 200: successWith(transportDataSchema) } } }, async () => ok(transport.config()));

  app.get('/health', { schema: { response: { 200: successWith(healthDataSchema) } } }, async () => {
    let database = false;
    try {
      await app.db.$queryRaw`SELECT 1`;
      database = true;
    } catch {
      database = false;
    }
    return ok({ status: database ? 'healthy' : 'degraded', timestamp: new Date().toISOString(), database });
  });

  app.get('/bootstrap', { schema: { response: { 200: bootstrapResponse } } }, async (request) => ok(await security.bootstrapInfo(request)));

  app.post('/bootstrap', { schema: { body: deviceBodySchema, response: { 200: successWith(deviceBootstrapDataSchema) } } }, async (request) => {
    return ok(await security.registerDevice(request, request.body as { publicKeyJwk?: unknown; deviceName?: unknown; platform?: unknown }));
  });

  app.get('/auth/google/start', { schema: { querystring: googleStartQuerySchema } }, async (request, reply) => {
    const query = request.query as { returnTo?: string };
    const rawReturnTo = typeof query.returnTo === 'string' ? query.returnTo : '/profile';
    const returnTo = rawReturnTo.startsWith('/') && !rawReturnTo.startsWith('//') && !rawReturnTo.includes('\\') && !rawReturnTo.includes('\n') && !rawReturnTo.includes('\r') && !rawReturnTo.startsWith('/api/auth/google')
      ? rawReturnTo
      : '/profile';
    const oauth = await auth.createGoogleAuthorization(returnTo);
    setOAuthStateCookie(reply, oauth.state);
    return reply.redirect(oauth.authorizationUrl, 303);
  });

  app.get('/auth/google/callback', { schema: { querystring: googleCallbackQuerySchema } }, async (request, reply) => {
    const query = request.query as { code?: string; state?: string; error?: string };
    try {
      if (query.error || !query.code || !query.state) throw new AppError('GOOGLE_AUTH_CANCELLED', 'Google authentication was not completed.', 400);
      const cookieState = request.cookies?.[oauthStateCookieName()];
      if (!cookieState || !auth.constantTimeOAuthStateMatches(cookieState, query.state)) throw new AppError('OAUTH_STATE_INVALID', 'OAuth state is invalid or expired.', 400);
      const state = await auth.consumeGoogleAuthorizationState(query.state);
      const user = await auth.authenticateGoogleAuthorizationCode(query.code, state);
      const session = await auth.createSession(user.id);
      setAuthCookie(reply, session.token);
      clearOAuthStateCookie(reply);
      return reply.redirect(state.returnTo, 303);
    } catch (error) {
      clearOAuthStateCookie(reply);
      request.log.warn({ requestId: request.id, code: error instanceof AppError ? error.code : 'GOOGLE_AUTH_FAILED' }, 'Google OAuth callback failed');
      return reply.redirect('/login?oauth=failed', 303);
    }
  });

  app.post('/auth/google', { schema: { body: googleBodySchema, response: { 200: successWith(userDataSchema) } } }, async (request, reply) => {
    const body = request.body as { idToken?: string; accessToken?: string };
    if (!body.idToken && !body.accessToken) throw new AppError('GOOGLE_TOKEN_REQUIRED', 'Google authentication token is required.', 400);
    throw new AppError('OAUTH_CODE_FLOW_REQUIRED', 'Use the Google authorization-code flow.', 410);
  });

  app.post('/auth/onboarding', { schema: { body: onboardingBodySchema, response: { 200: successWith(userDataSchema) } } }, async (request) => {
    const token = sessionTokenFromRequest(request);
    if (!token) throw new AppError('SESSION_INVALID', 'Login session is invalid.', 401);
    const resolved = await auth.resolveSessionUser(token);
    if (!resolved) throw new AppError('SESSION_INVALID', 'Login session is invalid.', 401);
    const body = request.body as { role: 'buyer' | 'seller' };
    return ok(await auth.completeOnboarding(resolved.session.userId, body.role, resolved.user.email));
  });

  app.post('/auth/become-seller', { schema: { body: emptyBodySchema, response: { 200: successWith(userDataSchema) } } }, async (request) => {
    const token = sessionTokenFromRequest(request);
    if (!token) throw new AppError('SESSION_INVALID', 'Login session is invalid.', 401);
    const resolved = await auth.resolveSessionUser(token);
    if (!resolved) throw new AppError('SESSION_INVALID', 'Login session is invalid.', 401);
    return ok(await auth.promoteToSeller(resolved.session.userId, resolved.user.email));
  });

  app.post('/auth/access', { schema: { body: emptyBodySchema, response: { 200: accessResponse } } }, async (request) => ok(await security.issueAccessGrant(request)));

  app.post('/auth/renew/challenge', { schema: { body: emptyBodySchema, response: { 200: successWith(renewalChallengeDataSchema) } } }, async (request) => ok(await security.issueRenewalChallenge(request)));

  app.post('/auth/renew', { schema: { body: emptyBodySchema, response: { 200: renewResponse } } }, async (request, reply) => {
    try {
      const result = await security.renewAccessGrant(request);
      const { sessionToken, ...publicResult } = result;
      if (sessionToken) setAuthCookie(reply, sessionToken);
      return ok(publicResult);
    } catch (error) {
      if (error instanceof AppError && (error.code === 'SESSION_REUSE_DETECTED' || error.code === 'SESSION_INVALID')) clearAuthCookies(reply);
      throw error;
    }
  });

  app.post('/auth/logout', { schema: { body: emptyBodySchema, response: { 200: successWith({ const: true }) } } }, async (request, reply) => {
    const token = sessionTokenFromRequest(request);
    if (token) await auth.revokeSession(token);
    clearAuthCookies(reply);
    return ok(true);
  });

  app.post('/client-errors', { bodyLimit: 64 * 1024, schema: { body: clientErrorBodySchema, response: { 200: successWith({ const: true }) } } }, async (request) => {
    const body = request.body && typeof request.body === 'object' && !Array.isArray(request.body)
      ? request.body as Record<string, unknown>
      : {};
    const safe = Object.fromEntries(
      ['message', 'url', 'timestamp', 'route', 'component'].flatMap((key) => {
        const value = body[key];
        return typeof value === 'string' ? [[key, value.slice(0, 2_000)]] : [];
      }),
    );
    app.log.error({ requestId: request.id, clientError: safe }, 'Client error reported');
    return { success: true };
  });

  app.get('/auth/me', {
    schema: {
      response: {
        200: successWith(userDataSchema),
        401: {
          type: 'object',
          additionalProperties: false,
          required: ['success', 'error', 'code'],
          properties: {
            success: { const: false },
            error: { type: 'string' },
            code: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const token = sessionTokenFromRequest(request);
    const resolved = token ? await auth.resolveSessionUser(token) : null;
    if (!resolved) return reply.code(401).send({ success: false, error: 'Login session is invalid.', code: 'SESSION_INVALID' });
    return ok(resolved.user);
  });

  app.get('/auth/admin-access', { schema: { response: { 200: successWith(adminAccessDataSchema) } } }, async (request, reply) => {
    const token = sessionTokenFromRequest(request);
    const resolved = token ? await auth.resolveSessionUser(token) : null;
    if (!resolved?.user.staffRole) return notFound(reply);
    return ok({ user: { id: resolved.user.id, name: resolved.user.name, email: resolved.user.email, avatar: resolved.user.avatar, role: resolved.user.role }, staff: { role: resolved.user.staffRole } });
  });

  app.post('/i', { schema: { body: permitBodySchema, response: { 200: permitResponse } }, preHandler: async (request) => { await security.verifyRequest(request); } }, async (request) => {
    return ok(await security.issuePermit(request, request.body as { action?: unknown; method?: unknown; path?: unknown; targetId?: unknown; bodyHash?: unknown }));
  });

  app.get('/security/devices', { schema: { response: { 200: successWith(deviceListDataSchema) } }, preHandler: async (request) => { await security.verifyRequest(request); } }, async (request) => ok(await security.listDevices(request)));

  app.get('/security/request', { schema: { response: { 200: successWith(inspectDataSchema) } }, preHandler: async (request) => { await security.verifyRequest(request); } }, async (request) => ok(await security.inspectRequest(request)));

  app.all<{ Params: { cap: string } }>('/m/:cap', { schema: { params: capabilityParamsSchema } }, async (request, reply) => {
    const permit = await security.resolveCapability(request.params.cap, request.method);
    if (!permit) {
      await security.recordEvent({ eventType: 'deception.probe', metadata: { path: '/api/m/<capability>' } });
      return notFound(reply);
    }
    request.capability = permit;
    request.internalPath = permit.path;
    request.internalMethod = permit.method;
    try {
      if (request.isMultipart?.()) await prepareMultipartRequest(request);
      request.signedPath = request.url.split('?', 1)[0];
      request.signedMethod = request.method;
      if (security.isServerHandle(permit) && !permit.bodyHash) {
        const verified = await security.verifyRequest(request, { consumePermit: false });
        await security.bindServerHandleBody(request, { handle: request.params.cap, bodyHash: verified.bodyHash });
        await security.consumePermit(request, verified, request.params.cap);
      } else {
        await security.verifyRequest(request);
      }
      return ok(await mutations.dispatch(request));
    } finally {
      await cleanupMultipartRequest(request);
    }
  });

  app.setNotFoundHandler(async (request, reply) => {
    const path = request.url.split('?', 1)[0] ?? '/';
    if (path.startsWith('/api/admin') || path.startsWith('/api/admin-api')) return notFound(reply);
    return notFound(reply);
  });
}
