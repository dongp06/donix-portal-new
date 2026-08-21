import { randomUUID } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import type { AuthAccessTokenContext, AuthSessionContext } from './auth.js';
import { AuthService } from './auth.js';
import {
  NONCE_TTL_MS,
  PROTOCOL_VERSION,
  REQUEST_SKEW_MS,
  RENEWAL_CHALLENGE_TTL_MS,
} from './config.js';
import { bodyDigest, header, hash, ipDigest, publicKeyFromJwk, randomToken, requestPath, verifyDpopProof, accessTokenFromRequest, sessionTokenFromRequest, safeMetadata } from './crypto.js';
import { AppError, isUniqueConstraintError } from './errors.js';
import { withDatabaseRetry, type Database } from './database.js';

export type SecurityAction =
  | 'security.intent'
  | 'device.revoke'
  | 'bot.create'
  | 'bot.update'
  | 'bot.delete'
  | 'review.create'
  | 'review.update'
  | 'review.delete'
  | 'comment.create'
  | 'comment.update'
  | 'comment.delete'
  | 'comment.react'
  | 'post.create'
  | 'post.update'
  | 'post.delete'
  | 'post.react'
  | 'post.bookmark'
  | 'post.report'
  | 'profile.update'
  | 'seller.follow'
  | 'seller.unfollow'
  | 'media.upload'
  | 'media.update'
  | 'media.delete'
  | 'resource.upload'
  | 'resource.delete'
  | 'e2ee.device.publish'
  | 'e2ee.conversation.create'
  | 'e2ee.message.send'
  | 'e2ee.attachment.upload'
  | 'verification.submit'
  | 'verification.cancel'
  | 'verification.check'
  | 'trust.review'
  | 'moderation.write'
  | 'posts.moderate'
  | 'staff.manage'
  | 'deception.probe';

export type ActionPolicy = {
  action: SecurityAction;
  permitRequired: boolean;
  critical?: boolean;
  maxPerWindow: number;
  windowMs: number;
};

const POLICIES: Record<SecurityAction, ActionPolicy> = {
  'security.intent': { action: 'security.intent', permitRequired: false, maxPerWindow: 30, windowMs: 60_000 },
  'device.revoke': { action: 'device.revoke', permitRequired: true, critical: true, maxPerWindow: 10, windowMs: 60_000 },
  'bot.create': { action: 'bot.create', permitRequired: true, maxPerWindow: 20, windowMs: 86_400_000 },
  'bot.update': { action: 'bot.update', permitRequired: true, maxPerWindow: 30, windowMs: 60_000 },
  'bot.delete': { action: 'bot.delete', permitRequired: true, maxPerWindow: 20, windowMs: 86_400_000 },
  'review.create': { action: 'review.create', permitRequired: true, maxPerWindow: 10, windowMs: 86_400_000 },
  'review.update': { action: 'review.update', permitRequired: true, maxPerWindow: 20, windowMs: 86_400_000 },
  'review.delete': { action: 'review.delete', permitRequired: true, maxPerWindow: 20, windowMs: 86_400_000 },
  'comment.create': { action: 'comment.create', permitRequired: true, maxPerWindow: 60, windowMs: 60_000 },
  'comment.update': { action: 'comment.update', permitRequired: true, maxPerWindow: 30, windowMs: 60_000 },
  'comment.delete': { action: 'comment.delete', permitRequired: true, maxPerWindow: 30, windowMs: 60_000 },
  'comment.react': { action: 'comment.react', permitRequired: true, maxPerWindow: 120, windowMs: 60_000 },
  'post.create': { action: 'post.create', permitRequired: true, maxPerWindow: 20, windowMs: 86_400_000 },
  'post.update': { action: 'post.update', permitRequired: true, maxPerWindow: 40, windowMs: 60_000 },
  'post.delete': { action: 'post.delete', permitRequired: true, maxPerWindow: 20, windowMs: 86_400_000 },
  'post.react': { action: 'post.react', permitRequired: true, maxPerWindow: 120, windowMs: 60_000 },
  'post.bookmark': { action: 'post.bookmark', permitRequired: true, maxPerWindow: 120, windowMs: 60_000 },
  'post.report': { action: 'post.report', permitRequired: true, maxPerWindow: 10, windowMs: 86_400_000 },
  'profile.update': { action: 'profile.update', permitRequired: true, maxPerWindow: 10, windowMs: 60_000 },
  'seller.follow': { action: 'seller.follow', permitRequired: true, maxPerWindow: 60, windowMs: 60_000 },
  'seller.unfollow': { action: 'seller.unfollow', permitRequired: true, maxPerWindow: 60, windowMs: 60_000 },
  'media.upload': { action: 'media.upload', permitRequired: true, maxPerWindow: 30, windowMs: 60_000 },
  'media.update': { action: 'media.update', permitRequired: true, maxPerWindow: 60, windowMs: 60_000 },
  'media.delete': { action: 'media.delete', permitRequired: true, maxPerWindow: 30, windowMs: 60_000 },
  'resource.upload': { action: 'resource.upload', permitRequired: true, maxPerWindow: 40, windowMs: 60_000 },
  'resource.delete': { action: 'resource.delete', permitRequired: true, maxPerWindow: 40, windowMs: 60_000 },
  'e2ee.device.publish': { action: 'e2ee.device.publish', permitRequired: true, maxPerWindow: 20, windowMs: 60_000 },
  'e2ee.conversation.create': { action: 'e2ee.conversation.create', permitRequired: true, maxPerWindow: 20, windowMs: 60_000 },
  'e2ee.message.send': { action: 'e2ee.message.send', permitRequired: true, maxPerWindow: 120, windowMs: 60_000 },
  'e2ee.attachment.upload': { action: 'e2ee.attachment.upload', permitRequired: true, maxPerWindow: 30, windowMs: 60_000 },
  'verification.submit': { action: 'verification.submit', permitRequired: true, maxPerWindow: 5, windowMs: 86_400_000 },
  'verification.cancel': { action: 'verification.cancel', permitRequired: true, maxPerWindow: 5, windowMs: 86_400_000 },
  'verification.check': { action: 'verification.check', permitRequired: true, maxPerWindow: 20, windowMs: 86_400_000 },
  'trust.review': { action: 'trust.review', permitRequired: true, critical: true, maxPerWindow: 30, windowMs: 60_000 },
  'moderation.write': { action: 'moderation.write', permitRequired: true, maxPerWindow: 60, windowMs: 60_000 },
  'posts.moderate': { action: 'posts.moderate', permitRequired: true, maxPerWindow: 120, windowMs: 60_000 },
  'staff.manage': { action: 'staff.manage', permitRequired: true, critical: true, maxPerWindow: 10, windowMs: 86_400_000 },
  'deception.probe': { action: 'deception.probe', permitRequired: false, maxPerWindow: 10, windowMs: 60_000 },
};

export type ActionPermitRecord = {
  id: string;
  tokenHash: string;
  userId: string;
  deviceId: string | null;
  action: string;
  method: string;
  path: string;
  targetId: string | null;
  bodyHash: string | null;
  policyVersion: string;
  serverNonce: string;
  issuedAt: string;
  expiresAt: string;
  maxUses: number;
  uses: number;
  consumedAt: string | null;
  metadata: string | null;
};

export type ServerActionHandle = {
  endpoint: string;
  serverNonce: string;
  expiresAt: string;
  expiresInMs: number;
  requiresStepUp: boolean;
};

export type SecurityContext = {
  session: AuthSessionContext;
  accessToken: AuthAccessTokenContext | null;
  userId: string;
  deviceId: string;
  requestId: string;
  action: SecurityAction | null;
  bodyHash: string;
  idempotencyKey: string;
  riskScore: number;
};

function now(): string {
  return new Date().toISOString();
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max ? trimmed : null;
}

function normalizedPath(value: string): string {
  const path = value.split('?', 1)[0] || '/';
  return path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path;
}

function targetForPath(path: string, body: unknown): string | null {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const object = body as Record<string, unknown>;
    for (const key of ['targetId', 'sellerId', 'botId', 'postId', 'userId', 'id']) {
      if (typeof object[key] === 'string' && object[key].trim()) return object[key].trim();
    }
  }
  const parts = normalizedPath(path).split('/').filter(Boolean);
  if (parts.length >= 3 && ['bots', 'posts', 'comments', 'sellers'].includes(parts[1] ?? '')) {
    if (!(parts[1] === 'sellers' && parts[2] === 'me')) return parts[2] ?? null;
  }
  return null;
}

export function actionForPath(methodInput: string, pathInput: string): SecurityAction | null {
  const method = methodInput.toUpperCase();
  const path = normalizedPath(pathInput);
  if (method === 'POST' && path === '/api/i') return 'security.intent';
  if (method === 'DELETE' && /^\/api\/security\/devices\/[^/]+$/.test(path)) return 'device.revoke';
  if (method === 'POST' && path === '/api/bots') return 'bot.create';
  if (/^\/api\/bots\/[^/]+$/.test(path)) {
    if (method === 'PUT' || method === 'PATCH') return 'bot.update';
    if (method === 'DELETE') return 'bot.delete';
  }
  if (/^\/api\/bots\/[^/]+\/reviews$/.test(path) && method === 'POST') return 'review.create';
  if (/^\/api\/bots\/[^/]+\/reviews\/[^/]+$/.test(path)) {
    if (method === 'PATCH') return 'review.update';
    if (method === 'DELETE') return 'review.delete';
  }
  if (method === 'POST' && path === '/api/posts') return 'post.create';
  if (/^\/api\/posts\/[^/]+$/.test(path)) {
    if (method === 'PATCH') return 'post.update';
    if (method === 'DELETE') return 'post.delete';
  }
  if (/^\/api\/posts\/[^/]+\/(reactions|upvote)$/.test(path) && method === 'POST') return 'post.react';
  if (/^\/api\/posts\/[^/]+\/bookmark$/.test(path) && method === 'PUT') return 'post.bookmark';
  if (/^\/api\/posts\/[^/]+\/report$/.test(path) && method === 'POST') return 'post.report';
  if (method === 'POST' && path === '/api/comments') return 'comment.create';
  if (/^\/api\/comments\/[^/]+$/.test(path)) {
    if (method === 'PATCH') return 'comment.update';
    if (method === 'DELETE') return 'comment.delete';
  }
  if (/^\/api\/comments\/[^/]+\/react$/.test(path) && method === 'POST') return 'comment.react';
  if (/^\/api\/sellers\/[^/]+\/follow$/.test(path)) {
    if (method === 'PUT') return 'seller.follow';
    if (method === 'DELETE') return 'seller.unfollow';
  }
  if (method === 'PATCH' && path === '/api/users/me') return 'profile.update';
  if (method === 'PUT' && path === '/api/sellers/me/profile') return 'profile.update';
  if (path === '/api/sellers/me/verification') {
    if (method === 'POST') return 'verification.submit';
    if (method === 'DELETE') return 'verification.cancel';
  }
  if (method === 'POST' && /^\/api\/sellers\/me\/verification\/checks\/[^/]+$/.test(path)) return 'verification.check';
  if (method === 'POST' && path === '/api/uploads/images') return 'media.upload';
  if (/^\/api\/uploads\/[^/]+$/.test(path)) {
    if (method === 'PATCH') return 'media.update';
    if (method === 'DELETE') return 'media.delete';
  }
  if (method === 'POST' && path === '/api/e2ee/devices') return 'e2ee.device.publish';
  if (method === 'POST' && path === '/api/e2ee/conversations') return 'e2ee.conversation.create';
  if (method === 'POST' && /^\/api\/e2ee\/conversations\/[^/]+\/messages$/.test(path)) return 'e2ee.message.send';
  if (method === 'POST' && /^\/api\/e2ee\/conversations\/[^/]+\/attachments$/.test(path)) return 'e2ee.attachment.upload';
  if (method === 'POST' && path === '/api/admin/resources/upload') return 'resource.upload';
  if (method === 'DELETE' && /^\/api\/admin\/resources\/files\/[^/]+$/.test(path)) return 'resource.delete';
  if (path.startsWith('/api/admin/verifications')) return 'trust.review';
  if (path.startsWith('/api/admin/cases')) return 'moderation.write';
  if (path.startsWith('/api/admin/posts')) return 'posts.moderate';
  if (path.startsWith('/api/admin/staff')) return 'staff.manage';
  return null;
}

function policyFor(action: SecurityAction): ActionPolicy {
  return POLICIES[action];
}

function permitTtl(action: SecurityAction): number {
  if (policyFor(action).critical) return 10_000;
  if (['review.create', 'post.create', 'bot.create', 'bot.delete', 'trust.review'].includes(action)) return 15_000;
  return 30_000;
}

export class SecurityService {
  private readonly recentRequests = new Map<string, number[]>();
  private readonly sequenceSync = new Map<string, { value: number; syncedAt: number }>();

  constructor(private readonly db: Database, private readonly auth: AuthService) {}

  async sessionFromRequest(request: FastifyRequest, allowRotatedSession = false): Promise<AuthSessionContext | null> {
    const token = sessionTokenFromRequest(request);
    if (!token) return null;
    if (!allowRotatedSession) return this.auth.resolveSession(token);
    const resolution = await this.auth.resolveSessionForRenewal(token);
    if (resolution.status === 'reused') {
      if (resolution.session) {
        await this.auth.revokeSessionFamily(resolution.session.familyId);
        await this.recordEvent({
          eventType: 'session.reuse_detected',
          userId: resolution.session.userId,
          deviceId: resolution.session.deviceId,
          metadata: { familyGeneration: resolution.session.generation },
        });
      }
      throw new AppError('SESSION_REUSE_DETECTED', 'The previous session credential was reused.', 401);
    }
    return resolution.session;
  }

  async requireSession(request: FastifyRequest, allowRotatedSession = false): Promise<AuthSessionContext> {
    const session = await this.sessionFromRequest(request, allowRotatedSession);
    if (!session) throw new AppError('SESSION_INVALID', 'Login session is invalid.', 401);
    return session;
  }

  async verifyRequest(
    request: FastifyRequest,
    options: { requireAccessToken?: boolean; allowRotatedSession?: boolean; consumePermit?: boolean } = {},
  ): Promise<SecurityContext> {
    const session = await this.sessionFromRequest(request, options.allowRotatedSession ?? false);
    if (!session) throw new AppError('AUTH_REQUIRED', 'Authentication is required for this request.', 401);
    const protocol = Number(header(request, 'x-tb-protocol') || 0);
    if (protocol < PROTOCOL_VERSION) {
      await this.recordEvent({ eventType: 'protocol.downgrade', userId: session.userId, deviceId: session.deviceId, metadata: { protocol } });
      throw new AppError('PROTOCOL_UPGRADE_REQUIRED', 'Client security protocol must be upgraded.', 412);
    }
    const authorization = header(request, 'authorization');
    const dpop = header(request, 'dpop') || '';
    const accessTokenValue = accessTokenFromRequest(request);
    if (authorization && !accessTokenValue) throw new AppError('ACCESS_TOKEN_INVALID', 'Authorization token is invalid.', 401);
    const access = accessTokenValue ? await this.auth.resolveAccessToken(accessTokenValue) : null;
    const requireAccessToken = options.requireAccessToken !== false;
    if (requireAccessToken && !access) {
      throw new AppError(accessTokenValue ? 'ACCESS_EXPIRED' : 'ACCESS_TOKEN_REQUIRED', 'A valid access grant is required.', 401);
    }
    if (
      access &&
      (access.audience !== 'thuebot-api' ||
        access.userId !== session.userId ||
        access.sessionId !== session.id ||
        (session.deviceId && access.deviceId !== session.deviceId))
    ) {
      throw new AppError('AUTH_BINDING_MISMATCH', 'Session, access grant and device are not the same context.', 401);
    }
    if (!session.deviceId) throw new AppError('DEVICE_BOOTSTRAP_REQUIRED', 'Register a device before using this security boundary.', 412);

    const declaredSessionId = header(request, 'x-tb-session') || '';
    const deviceId = header(request, 'x-tb-device') || '';
    const timestamp = header(request, 'x-tb-time') || '';
    const nonce = header(request, 'x-tb-nonce') || '';
    const requestId = header(request, 'x-tb-request') || '';
    const declaredBodyHash = header(request, 'x-tb-body-sha256') || '';
    const idempotencyKey = header(request, 'x-tb-idempotency') || '';
    const permit = header(request, 'x-tb-permit') || '';
    if (
      !declaredSessionId ||
      declaredSessionId !== session.id ||
      !deviceId ||
      deviceId !== session.deviceId ||
      !timestamp ||
      !nonce ||
      !requestId ||
      !declaredBodyHash ||
      !idempotencyKey
    ) throw new AppError('DEVICE_PROOF_REQUIRED', 'Device proof is required.', 403);
    if (!dpop) {
      throw new AppError('DPOP_PROOF_REQUIRED', 'A DPoP proof is required.', 403);
    }
    const requestTime = Number(timestamp);
    if (!Number.isFinite(requestTime) || Math.abs(Date.now() - requestTime) > REQUEST_SKEW_MS) {
      throw new AppError('REQUEST_EXPIRED', 'Request timestamp is outside the allowed window.', 409);
    }
    if (!/^[A-Za-z0-9._:-]{8,160}$/.test(idempotencyKey)) throw new AppError('IDEMPOTENCY_KEY_INVALID', 'Idempotency key is invalid.', 403);
    if (nonce.length < 16 || nonce.length > 160 || requestId.length < 8 || requestId.length > 160) {
      throw new AppError('REQUEST_METADATA_INVALID', 'Request metadata is invalid.', 403);
    }
    const device = await this.db.deviceIdentity.findFirst({ where: { id: deviceId, userId: session.userId, revokedAt: null } });
    if (!device) throw new AppError('DEVICE_INVALID', 'Device identity is invalid.', 401);
    if (access && (access.deviceId !== device.id || access.keyThumbprint !== device.fingerprint)) {
      throw new AppError('AUTH_KEY_BINDING_MISMATCH', 'Access grant is bound to another device key.', 401);
    }
    const computedBodyHash = bodyDigest(request.body);
    if (computedBodyHash !== declaredBodyHash) throw new AppError('BODY_DIGEST_MISMATCH', 'Request body commitment does not match.', 409);

    const signedPath = request.signedPath || requestPath(request);
    const signedMethod = request.signedMethod || request.method;
    const permitHash = permit ? hash(permit) : '';
    const serverNonce = header(request, 'x-tb-server-nonce') || '';
    let dpopJti = nonce;
    const proof = verifyDpopProof({
      proof: dpop,
      request,
      expectedFingerprint: device.fingerprint,
      accessToken: accessTokenValue,
      deviceId,
      sessionId: session.id,
      bodyHash: declaredBodyHash,
      requestId,
      timestamp,
      nonce,
      sequence: header(request, 'x-tb-sequence') || '',
      idempotencyKey,
      permitHash,
      serverNonce,
    });
    if (!proof) {
      await this.recordEvent({ eventType: 'device.dpop_failed', userId: session.userId, deviceId, metadata: { path: signedPath } });
      throw new AppError('DPOP_PROOF_INVALID', 'DPoP proof is invalid.', 403);
    }
    dpopJti = proof.jti;
    await this.claimIdempotency({
      userId: session.userId,
      deviceId,
      method: signedMethod,
      path: signedPath,
      idempotencyKey,
      requestHash: hash([declaredBodyHash, accessTokenValue ? hash(accessTokenValue) : '', permitHash, serverNonce].join('\n')),
    });
    try {
      await withDatabaseRetry(() => this.db.securityNonce.create({
        data: {
          id: hash(`${deviceId}:${dpopJti}`),
          deviceId,
          requestId,
          createdAt: now(),
          expiresAt: new Date(Date.now() + NONCE_TTL_MS).toISOString(),
        },
      }), 3);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        await this.recordEvent({ eventType: 'request.replay', userId: session.userId, deviceId, metadata: { requestId } });
        throw new AppError('REPLAY_DETECTED', 'Request replay detected.', 409);
      }
      throw error;
    }
    const sequence = header(request, 'x-tb-sequence');
    if (sequence) {
      const numeric = Number(sequence);
      if (!Number.isSafeInteger(numeric) || numeric < 1) throw new AppError('SEQUENCE_INVALID', 'Sequence is invalid.', 409);
      const storedSequence = Number((device as { lastSequence?: unknown }).lastSequence ?? 0);
      const marker = this.sequenceSync.get(deviceId);
      const current = Math.max(storedSequence, marker?.value ?? 0);
      const shouldSync = numeric > current && (!marker || numeric - current >= 32 || Date.now() - marker.syncedAt >= 10_000);
      if (shouldSync) {
        this.sequenceSync.set(deviceId, { value: numeric, syncedAt: Date.now() });
        void withDatabaseRetry(
          () => this.db.deviceIdentity.updateMany({ where: { id: deviceId, lastSequence: { lt: numeric } }, data: { lastSequence: numeric } }),
          2,
        ).catch(() => undefined);
        if (this.sequenceSync.size > 2_000) {
          const oldest = this.sequenceSync.keys().next().value;
          if (oldest) this.sequenceSync.delete(oldest);
        }
      }
    }
    const internalPath = request.internalPath || requestPath(request);
    const internalMethod = request.internalMethod || request.method;
    const action = actionForPath(internalMethod, internalPath);
    const riskScore = await this.riskScore(session.userId, deviceId);
    const security: SecurityContext = {
      session,
      accessToken: access,
      userId: session.userId,
      deviceId,
      requestId,
      action,
      bodyHash: declaredBodyHash,
      idempotencyKey,
      riskScore,
    };
    request.security = security;
    if (permit && options.consumePermit !== false) await this.consumePermit(request, security, permit);
    return security;
  }

  /**
   * Claim a signed request key durably before executing any side effect.
   * A nonce protects one exact proof; this ledger also prevents a caller from
   * reusing the same idempotency key with a freshly signed proof. We do not
   * persist request bodies or secrets, and response replay is deliberately not
   * faked: callers receive a deterministic conflict and must obtain a new
   * intent/key when they did not receive the original response.
   */
  private async claimIdempotency(input: {
    userId: string;
    deviceId: string;
    method: string;
    path: string;
    idempotencyKey: string;
    requestHash: string;
  }): Promise<void> {
    const route = normalizedPath(input.path);
    const scopeKey = hash([input.deviceId, input.userId, input.method.toUpperCase(), route, input.idempotencyKey].join('\n'));
    const createdAt = now();
    try {
      await withDatabaseRetry(() => this.db.idempotencyRecord.create({
        data: {
          id: `idem-${randomUUID()}`,
          scopeKey,
          userId: input.userId,
          deviceId: input.deviceId,
          route,
          idempotencyKey: input.idempotencyKey,
          requestHash: input.requestHash,
          responseStatus: 0,
          responseBody: '{}',
          createdAt,
          expiresAt: new Date(Date.now() + Math.max(10 * 60_000, NONCE_TTL_MS)).toISOString(),
        },
      }), 3);
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const existing = await this.db.idempotencyRecord.findUnique({ where: { scopeKey } });
      if (!existing) throw error;
      await this.recordEvent({
        eventType: 'request.idempotency_replay',
        userId: input.userId,
        deviceId: input.deviceId,
        metadata: { route, requestHash: input.requestHash === existing.requestHash ? 'same' : 'different' },
      });
      if (existing.requestHash !== input.requestHash) {
        throw new AppError('IDEMPOTENCY_KEY_REUSED', 'Idempotency key was reused for a different request.', 409);
      }
      throw new AppError('IDEMPOTENCY_REPLAYED', 'Idempotency key was already accepted.', 409);
    }
  }

  async issueAccessGrant(request: FastifyRequest) {
    const security = await this.verifyRequest(request, { requireAccessToken: false });
    const device = await this.db.deviceIdentity.findFirst({ where: { id: security.deviceId, userId: security.userId, revokedAt: null } });
    if (!device) throw new AppError('DEVICE_INVALID', 'Device identity is invalid.', 401);
    const grant = await this.auth.createAccessToken({ sessionId: security.session.id, userId: security.userId, deviceId: device.id, keyThumbprint: device.fingerprint });
    return {
      protocolVersion: PROTOCOL_VERSION,
      token: grant.token,
      tokenType: 'DPoP',
      expiresAt: grant.expiresAt,
      expiresInMs: grant.expiresInMs,
      scopes: grant.scopes,
      deviceId: device.id,
      sessionId: security.session.id,
      sessionGeneration: security.session.generation,
    };
  }

  async issueRenewalChallenge(request: FastifyRequest) {
    const security = await this.verifyRequest(request, { requireAccessToken: false, allowRotatedSession: true });
    const challenge = randomToken(24);
    const expiresAt = new Date(Date.now() + RENEWAL_CHALLENGE_TTL_MS).toISOString();
    await withDatabaseRetry(() => this.db.securityNonce.create({
      data: {
        id: hash(`renewal-challenge:${security.deviceId}:${challenge}`),
        deviceId: security.deviceId,
        requestId: hash(challenge),
        createdAt: now(),
        expiresAt,
      },
    }), 3);
    return { protocolVersion: PROTOCOL_VERSION, challenge, expiresAt };
  }

  async renewAccessGrant(request: FastifyRequest) {
    const security = await this.verifyRequest(request, { requireAccessToken: false, allowRotatedSession: true });
    const challenge = header(request, 'x-tb-server-nonce') || '';
    const challengeId = hash(`renewal-challenge:${security.deviceId}:${challenge}`);
    const challengeRow = await this.db.securityNonce.findUnique({ where: { id: challengeId } });
    if (!challengeRow || challengeRow.deviceId !== security.deviceId || Date.parse(challengeRow.expiresAt) <= Date.now()) {
      throw new AppError('RENEWAL_CHALLENGE_REQUIRED', 'Renewal challenge is invalid or expired.', 401);
    }
    const consumed = await withDatabaseRetry(
      () => this.db.securityNonce.deleteMany({ where: { id: challengeId, deviceId: security.deviceId } }),
      3,
    );
    if (consumed.count !== 1) throw new AppError('RENEWAL_CHALLENGE_REQUIRED', 'Renewal challenge is invalid or expired.', 401);
    const rawSession = sessionTokenFromRequest(request);
    if (!rawSession) throw new AppError('SESSION_INVALID', 'Login session is invalid.', 401);
    const rotation = await this.auth.rotateSession(rawSession, security.deviceId);
    if (rotation.status === 'reused') {
      await this.recordEvent({ eventType: 'session.reuse_detected', userId: security.userId, deviceId: security.deviceId, metadata: { generation: security.session.generation } });
      throw new AppError('SESSION_REUSE_DETECTED', 'The previous session credential was reused.', 401);
    }
    if (!rotation.session || rotation.status === 'invalid') throw new AppError('SESSION_INVALID', 'Login session is invalid.', 401);
    const device = await this.db.deviceIdentity.findFirst({ where: { id: security.deviceId, userId: security.userId, revokedAt: null } });
    if (!device) throw new AppError('DEVICE_INVALID', 'Device identity is invalid.', 401);
    const grant = await this.auth.createAccessToken({ sessionId: rotation.session.id, userId: security.userId, deviceId: device.id, keyThumbprint: device.fingerprint });
    return {
      protocolVersion: PROTOCOL_VERSION,
      token: grant.token,
      tokenType: 'DPoP',
      expiresAt: grant.expiresAt,
      expiresInMs: grant.expiresInMs,
      scopes: grant.scopes,
      deviceId: device.id,
      sessionId: rotation.session.id,
      sessionGeneration: rotation.session.generation,
      rotated: rotation.status === 'rotated',
      previousSessionId: rotation.previousSessionId,
      sessionToken: rotation.token,
    };
  }

  async registerDevice(request: FastifyRequest, input: { publicKeyJwk?: unknown; deviceName?: unknown; platform?: unknown }) {
    const session = await this.requireSession(request);
    let key;
    try {
      key = publicKeyFromJwk(input.publicKeyJwk);
    } catch {
      throw new AppError('DEVICE_KEY_INVALID', 'Device public key is invalid.', 403);
    }
    const timestamp = now();
    const canary = randomToken(32);
    const result = await withDatabaseRetry(() => this.db.$transaction(async (tx) => {
      const existing = await tx.deviceIdentity.findUnique({ where: { fingerprint: key.fingerprint } });
      if (existing && existing.userId !== session.userId) {
        throw new AppError('DEVICE_KEY_BOUND_TO_OTHER_ACCOUNT', 'Device identity is already bound to another account.', 403);
      }
      const currentDevice = session.deviceId
        ? await tx.deviceIdentity.findFirst({ where: { id: session.deviceId, userId: session.userId } })
        : null;
      if (session.deviceId && (!currentDevice || currentDevice.revokedAt)) {
        throw new AppError('DEVICE_INVALID', 'Current device identity is invalid.', 401);
      }
      if (session.deviceId && currentDevice && currentDevice.fingerprint !== key.fingerprint) {
        throw new AppError('DEVICE_REPLACEMENT_REQUIRES_STEP_UP', 'Replacing a registered device requires an explicit security step-up.', 403);
      }
      if (!session.deviceId && existing?.revokedAt) {
        throw new AppError('DEVICE_REVOKED', 'This device identity has been revoked; register a new device key.', 403);
      }
      const device = existing
        ? await tx.deviceIdentity.update({ where: { id: existing.id }, data: { lastSeenAt: timestamp, revokedAt: null, deviceName: text(input.deviceName, 120), platform: text(input.platform, 80) } })
        : await tx.deviceIdentity.create({ data: { id: `dev-${randomUUID()}`, userId: session.userId, publicKey: JSON.stringify(key.jwk), fingerprint: key.fingerprint, deviceName: text(input.deviceName, 120), platform: text(input.platform, 80), createdAt: timestamp, lastSeenAt: timestamp } });
      await tx.authSession.update({ where: { id: session.id }, data: { deviceId: device.id, lastSeenAt: timestamp } });
      if (session.deviceId && session.deviceId !== device.id) {
        await tx.authAccessToken.updateMany({ where: { sessionId: session.id, revokedAt: null }, data: { revokedAt: timestamp } });
      }
      await tx.actionPermit.create({
        data: {
          id: `canary-${randomUUID()}`,
          tokenHash: hash(canary),
          userId: session.userId,
          deviceId: device.id,
          action: 'deception.canary',
          method: 'POST',
          path: '/api/i',
          policyVersion: 'tsp-3',
          serverNonce: randomToken(16),
          issuedAt: timestamp,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000).toISOString(),
          metadata: JSON.stringify({ canary: true }),
        },
      });
      return device;
    }), 3);
    return {
      protocolVersion: PROTOCOL_VERSION,
      sessionId: session.id,
      sessionGeneration: session.generation,
      deviceId: result.id,
      fingerprint: result.fingerprint,
      algorithm: result.algorithm,
      lastSequence: result.lastSequence,
      canary,
      expiresAt: session.expiresAt,
    };
  }

  async bootstrapInfo(request: FastifyRequest) {
    const session = await this.sessionFromRequest(request);
    return {
      protocolVersion: PROTOCOL_VERSION,
      authenticated: Boolean(session),
      sessionId: session?.id ?? null,
      sessionGeneration: session?.generation ?? null,
      deviceId: session?.deviceId ?? null,
      expiresAt: session?.expiresAt ?? null,
    };
  }

  async issuePermit(request: FastifyRequest, input: { action?: unknown; method?: unknown; path?: unknown; targetId?: unknown; bodyHash?: unknown }) {
    const session = await this.requireSession(request);
    const method = text(input.method, 12)?.toUpperCase() || '';
    const path = text(input.path, 500) || '';
    const requestedAction = text(input.action, 80);
    const bodyHash = text(input.bodyHash, 128)?.toLowerCase();
    const safePath = path.startsWith('/api/') && !path.includes('?') && !path.includes('#') && !path.includes('\\') && !path.includes('..') && !path.includes('//') && !path.startsWith('/api/m/');
    const resolvedAction = safePath ? actionForPath(method, path) : null;
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) || !resolvedAction || (requestedAction && requestedAction !== resolvedAction)) {
      throw new AppError('ACTION_ROUTE_MISMATCH', 'Action is not valid for this route.', 403);
    }
    const policy = policyFor(resolvedAction);
    const deviceId = session.deviceId;
    if (!deviceId) throw new AppError('DEVICE_BOOTSTRAP_REQUIRED', 'Register a device before requesting a permit.', 412);
    const device = await this.db.deviceIdentity.findFirst({ where: { id: deviceId, userId: session.userId, revokedAt: null } });
    if (!device) throw new AppError('DEVICE_INVALID', 'Device identity is invalid.', 401);
    if (policy.permitRequired && (!bodyHash || !/^[a-f0-9]{64}$/i.test(bodyHash))) throw new AppError('ACTION_BODY_COMMITMENT_REQUIRED', 'The action must be bound to a body digest.', 403);
    await this.enforceActionBudget(session.userId, deviceId, resolvedAction, policy);
    const token = randomToken(32);
    const issuedAt = now();
    const expiresAt = new Date(Date.now() + permitTtl(resolvedAction)).toISOString();
    const permit = await withDatabaseRetry(() => this.db.actionPermit.create({
      data: {
        id: `permit-${randomUUID()}`,
        tokenHash: hash(token),
        userId: session.userId,
        deviceId,
        action: resolvedAction,
        method,
        path: normalizedPath(path),
        targetId: text(input.targetId, 200) || targetForPath(path, input),
        bodyHash,
        policyVersion: `tsp-${PROTOCOL_VERSION}`,
        serverNonce: randomToken(18),
        issuedAt,
        expiresAt,
        metadata: JSON.stringify({ riskScore: 0 }),
      },
    }), 3);
    await this.recordEvent({ eventType: 'action.permit_issued', userId: session.userId, deviceId, action: resolvedAction, metadata: { permitId: permit.id } });
    return {
      protocolVersion: PROTOCOL_VERSION,
      intentId: permit.id,
      permit: token,
      endpoint: `/api/m/${token}`,
      serverNonce: permit.serverNonce,
      expiresAt,
      expiresInMs: permitTtl(resolvedAction),
      requiresStepUp: Boolean(policy.critical),
    };
  }

  async issueServerHandle(
    request: FastifyRequest,
    input: {
      action: SecurityAction;
      method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      path: string;
      targetId?: string | null;
      bodyHash?: string | null;
    },
  ): Promise<ServerActionHandle> {
    const session = await this.requireSession(request);
    const method = input.method.toUpperCase() as 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    const path = input.path.trim();
    const policy = policyFor(input.action);
    const safePath = path.startsWith('/api/') &&
      !path.includes('?') &&
      !path.includes('#') &&
      !path.includes('\\') &&
      !path.includes('..') &&
      !path.includes('//') &&
      !path.startsWith('/api/m/');
    const resolvedAction = actionForPath(method, path);
    if (!policy || !safePath || !resolvedAction || resolvedAction !== input.action) {
      throw new AppError('SERVER_HANDLE_INVALID', 'Server action handle context is invalid.', 403);
    }
    const requestedTarget = text(input.targetId, 200);
    const targetId = requestedTarget || targetForPath(path, undefined);
    const bodyHash = input.bodyHash?.trim() || null;
    if (bodyHash && !/^[a-f0-9]{64}$/i.test(bodyHash)) {
      throw new AppError('SERVER_HANDLE_BODY_COMMITMENT_INVALID', 'Server action handle body commitment is invalid.', 403);
    }
    if (!session.deviceId) throw new AppError('DEVICE_BOOTSTRAP_REQUIRED', 'Register a device before requesting an action handle.', 412);
    const device = await this.db.deviceIdentity.findFirst({ where: { id: session.deviceId, userId: session.userId, revokedAt: null } });
    if (!device) throw new AppError('DEVICE_INVALID', 'Device identity is invalid.', 401);

    const riskScore = await this.riskScore(session.userId, device.id);
    if (riskScore >= 85) {
      await this.recordEvent({ eventType: 'action.blocked', userId: session.userId, deviceId: device.id, action: input.action, riskScore, metadata: {} });
      throw new AppError('ACTION_BLOCKED', 'This action is temporarily unavailable.', 403);
    }
    await this.enforceActionBudget(session.userId, device.id, input.action, policy);
    const token = randomToken(32);
    const issuedAt = now();
    const expiresInMs = Math.min(permitTtl(input.action), 30_000);
    const expiresAt = new Date(Date.now() + expiresInMs).toISOString();
    const serverNonce = randomToken(18);
    const permit = await this.db.actionPermit.create({
      data: {
        id: `handle-${randomUUID()}`,
        tokenHash: hash(token),
        userId: session.userId,
        deviceId: device.id,
        action: input.action,
        method,
        path: normalizedPath(path),
        targetId,
        bodyHash,
        policyVersion: `tsp-${PROTOCOL_VERSION}`,
        serverNonce,
        issuedAt,
        expiresAt,
        metadata: JSON.stringify({ serverHandle: true, riskScore }),
      },
    });
    await this.recordEvent({ eventType: 'action.handle_issued', userId: session.userId, deviceId: device.id, action: input.action, riskScore, metadata: { handleId: permit.id } });
    await this.recordEvent({ eventType: 'server_handle.issued', userId: session.userId, deviceId: device.id, action: input.action, riskScore, metadata: { handleId: permit.id } });
    return {
      endpoint: `/api/m/${token}`,
      serverNonce,
      expiresAt,
      expiresInMs,
      requiresStepUp: Boolean(policy.critical),
    };
  }

  async actionForServerHandle(request: FastifyRequest, token: string): Promise<SecurityAction> {
    const session = await this.requireSession(request);
    if (!session.deviceId || !/^[A-Za-z0-9_-]{40,180}$/.test(token)) {
      throw new AppError('CAPABILITY_INVALID', 'Action capability is invalid.', 403);
    }
    const permit = (await this.db.actionPermit.findUnique({ where: { tokenHash: hash(token) } })) as ActionPermitRecord | null;
    if (!permit || !this.isServerHandle(permit) || permit.userId !== session.userId || permit.deviceId !== session.deviceId || permit.consumedAt || permit.uses >= permit.maxUses || Date.parse(permit.expiresAt) <= Date.now()) {
      throw new AppError('CAPABILITY_INVALID', 'Action capability is invalid.', 403);
    }
    const action = permit.action as SecurityAction;
    if (!policyFor(action)?.critical) throw new AppError('SERVER_HANDLE_STEP_UP_INVALID', 'This action does not require a step-up.', 403);
    return action;
  }

  async bindServerHandleBody(request: FastifyRequest, input: { handle?: unknown; bodyHash?: unknown }): Promise<{ bound: true }> {
    const security = request.security ?? await this.verifyRequest(request);
    const token = text(input.handle, 180);
    const bodyHash = text(input.bodyHash, 128)?.toLowerCase();
    if (!token || !/^[A-Za-z0-9_-]{40,180}$/.test(token) || !bodyHash || !/^[a-f0-9]{64}$/i.test(bodyHash)) {
      throw new AppError('SERVER_HANDLE_BODY_COMMITMENT_INVALID', 'Server action handle body commitment is invalid.', 403);
    }
    const permit = (await this.db.actionPermit.findUnique({ where: { tokenHash: hash(token) } })) as ActionPermitRecord | null;
    if (
      !permit ||
      !this.isServerHandle(permit) ||
      permit.userId !== security.userId ||
      permit.deviceId !== security.deviceId ||
      permit.consumedAt ||
      permit.uses >= permit.maxUses ||
      Date.parse(permit.expiresAt) <= Date.now()
    ) {
      throw new AppError('CAPABILITY_INVALID', 'Action capability is invalid.', 403);
    }
    if (permit.bodyHash && permit.bodyHash.toLowerCase() !== bodyHash.toLowerCase()) {
      throw new AppError('CAPABILITY_BODY_MISMATCH', 'Action payload does not match the permit.', 403);
    }
    if (!permit.bodyHash) {
      const updated = await this.db.actionPermit.updateMany({
        where: { id: permit.id, userId: security.userId, deviceId: security.deviceId, bodyHash: null, consumedAt: null, uses: { lt: permit.maxUses }, expiresAt: { gt: now() } },
        data: { bodyHash },
      });
      if (updated.count !== 1) {
        const current = (await this.db.actionPermit.findUnique({ where: { id: permit.id } })) as ActionPermitRecord | null;
        if (!current?.bodyHash || current.bodyHash.toLowerCase() !== bodyHash.toLowerCase()) {
          throw new AppError('CAPABILITY_BODY_MISMATCH', 'Action payload does not match the permit.', 403);
        }
      }
    }
    return { bound: true };
  }

  isServerHandle(permit: { metadata?: string | null }): boolean {
    try {
      return Boolean((JSON.parse(permit.metadata ?? '{}') as { serverHandle?: unknown }).serverHandle);
    } catch {
      return false;
    }
  }

  async resolveCapability(token: string, method: string): Promise<ActionPermitRecord | null> {
    if (!/^[A-Za-z0-9_-]{40,180}$/.test(token)) return null;
    const permit = (await this.db.actionPermit.findUnique({ where: { tokenHash: hash(token) } })) as ActionPermitRecord | null;
    if (!permit || permit.consumedAt || permit.uses >= permit.maxUses || Date.parse(permit.expiresAt) <= Date.now()) return null;
    if (this.isServerHandle(permit) ? method.toUpperCase() !== 'POST' : permit.method !== method.toUpperCase()) return null;
    return permit;
  }

  async consumePermit(request: FastifyRequest, context: SecurityContext, token: string): Promise<void> {
    const permit = (await this.db.actionPermit.findUnique({ where: { tokenHash: hash(token) } })) as ActionPermitRecord | null;
    const action = context.action;
    if (!action || !policyFor(action).permitRequired) return;
    if (!permit || permit.userId !== context.userId || permit.deviceId !== context.deviceId) throw new AppError('ACTION_PERMIT_INVALID', 'Action permit is invalid.', 403);
    if (permit.action !== action || permit.method !== (request.internalMethod || request.method).toUpperCase() || permit.path !== normalizedPath(request.internalPath || requestPath(request))) throw new AppError('ACTION_PERMIT_SCOPE_MISMATCH', 'Action permit scope does not match.', 403);
    if (this.isServerHandle(permit) && !permit.bodyHash) throw new AppError('ACTION_BODY_COMMITMENT_REQUIRED', 'The action must be bound to a body digest.', 403);
    if (permit.bodyHash && permit.bodyHash !== context.bodyHash) throw new AppError('CAPABILITY_BODY_MISMATCH', 'Action payload does not match the permit.', 403);
    const expectedNonce = header(request, 'x-tb-server-nonce');
    if (!expectedNonce || expectedNonce !== permit.serverNonce) throw new AppError('ACTION_NONCE_INVALID', 'Action nonce is invalid.', 403);
    if (policyFor(action).critical) {
      const recentStepUp = await this.db.securityEvent.findFirst({
        where: {
          userId: context.userId,
          deviceId: context.deviceId,
          action,
          eventType: 'webauthn.step_up',
          createdAt: { gt: new Date(Date.now() - 2 * 60_000).toISOString() },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!recentStepUp) throw new AppError('STEP_UP_REQUIRED', 'This action requires a recent passkey verification.', 412);
    }
    const updated = await this.db.actionPermit.updateMany({ where: { id: permit.id, userId: context.userId, deviceId: context.deviceId, uses: { lt: permit.maxUses }, consumedAt: null, expiresAt: { gt: now() } }, data: { uses: { increment: 1 }, consumedAt: now() } });
    if (updated.count !== 1) throw new AppError('ACTION_ALREADY_CONSUMED', 'Action permit was already consumed.', 409);
  }

  async markWebAuthnStepUp(request: FastifyRequest, actionInput: unknown): Promise<void> {
    const session = await this.requireSession(request);
    const action = typeof actionInput === 'string' ? actionInput.trim() : '';
    if (!action || !policyFor(action as SecurityAction)?.critical) {
      throw new AppError('WEBAUTHN_ACTION_INVALID', 'Passkey step-up is not valid for this action.', 403);
    }
    if (!session.deviceId) throw new AppError('DEVICE_BOOTSTRAP_REQUIRED', 'Register a device before step-up.', 412);
    await this.recordEvent({ eventType: 'webauthn.step_up', userId: session.userId, deviceId: session.deviceId, action, metadata: { sessionId: session.id } });
  }

  async listDevices(request: FastifyRequest) {
    const session = await this.requireSession(request);
    const rows = await this.db.deviceIdentity.findMany({ where: { userId: session.userId }, orderBy: { lastSeenAt: 'desc' }, select: { id: true, deviceName: true, platform: true, fingerprint: true, protocolVersion: true, trustState: true, createdAt: true, lastSeenAt: true, revokedAt: true } });
    return rows.map((row) => ({ ...row, current: row.id === session.deviceId }));
  }

  async revokeDevice(request: FastifyRequest, deviceId: string): Promise<boolean> {
    const session = await this.requireSession(request);
    const device = await this.db.deviceIdentity.findFirst({ where: { id: deviceId, userId: session.userId } });
    if (!device) throw new AppError('DEVICE_INVALID', 'Device identity is invalid.', 404);
    const revokedAt = now();
    await this.db.$transaction([
      this.db.deviceIdentity.update({ where: { id: device.id }, data: { revokedAt } }),
      this.db.authSession.updateMany({ where: { deviceId: device.id, revokedAt: null }, data: { revokedAt } }),
    ]);
    await this.auth.revokeAccessTokensForDevice(device.id);
    await this.recordEvent({ eventType: 'device.revoked', userId: session.userId, deviceId: device.id, metadata: {} });
    return true;
  }

  async inspectRequest(request: FastifyRequest) {
    return {
      protocolVersion: header(request, 'x-tb-protocol') || null,
      requestId: header(request, 'x-tb-request') || request.id,
      sessionId: request.security?.session.id ?? null,
      deviceId: request.security?.deviceId ?? null,
      action: request.security?.action ?? null,
      risk: request.security ? 'evaluated' : 'not_authenticated',
    };
  }

  async riskScore(userId: string, deviceId: string): Promise<number> {
    const [recentFailures, deception] = await Promise.all([
      this.db.securityEvent.count({ where: { userId, deviceId, eventType: { in: ['device.dpop_failed', 'request.replay', 'rate_limited'] }, createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString() } } }),
      this.db.securityEvent.count({ where: { userId, deviceId, eventType: { in: ['deception.probe', 'session.reuse_detected'] }, createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString() } } }),
    ]);
    return Math.min(100, recentFailures * 8 + deception * 25);
  }

  async recordEvent(input: { eventType: string; userId?: string | null; deviceId?: string | null; action?: string; metadata?: unknown; riskScore?: number }): Promise<void> {
    try {
      await this.db.securityEvent.create({ data: { id: `evt-${randomUUID()}`, userId: input.userId ?? null, deviceId: input.deviceId ?? null, eventType: input.eventType, action: input.action ?? null, riskScore: input.riskScore ?? 0, ipHash: null, metadata: safeMetadata(input.metadata), createdAt: now() } });
    } catch {
      // Security telemetry must not turn a valid revoke/replay decision into a second failure.
    }
  }

  /**
   * Durable budget for authenticated read operations that consume server
   * state. SecurityEvent is already indexed by actor/action/time and is part
   * of the SQLite source of truth, so this avoids a process-local counter (or
   * a new migration) for one-time E2EE pre-key claims. The count and claim are
   * committed in one transaction; a concurrent writer is retried by the
   * database boundary before the decision is returned.
   */
  async enforceReadBudget(
    request: FastifyRequest,
    input: { eventType: string; action: string; maxPerWindow: number; windowMs: number; metadata?: unknown },
  ): Promise<void> {
    const security = request.security;
    if (!security) throw new AppError('AUTH_REQUIRED', 'Authentication is required for this request.', 401);
    const maxPerWindow = Math.max(1, Math.floor(input.maxPerWindow));
    const windowMs = Math.max(1_000, Math.floor(input.windowMs));
    const createdAt = now();
    const since = new Date(Date.now() - windowMs).toISOString();
    const accepted = await withDatabaseRetry(
      () => this.db.$transaction(async (tx) => {
        const count = await tx.securityEvent.count({
          where: {
            userId: security.userId,
            deviceId: security.deviceId,
            eventType: input.eventType,
            action: input.action,
            createdAt: { gt: since },
          },
        });
        if (count >= maxPerWindow) return false;
        await tx.securityEvent.create({
          data: {
            id: `evt-${randomUUID()}`,
            userId: security.userId,
            deviceId: security.deviceId,
            eventType: input.eventType,
            action: input.action,
            riskScore: security.riskScore,
            ipHash: null,
            metadata: safeMetadata(input.metadata),
            createdAt,
          },
        });
        return true;
      }),
      3,
    );
    if (accepted) return;
    await this.recordEvent({
      eventType: 'rate_limited',
      userId: security.userId,
      deviceId: security.deviceId,
      action: input.action,
      metadata: { budget: input.eventType, maxPerWindow, windowMs },
      riskScore: Math.min(100, security.riskScore + 8),
    });
    throw new AppError('READ_RATE_LIMITED', 'This read operation is temporarily rate limited.', 429);
  }

  private async enforceActionBudget(userId: string, deviceId: string, action: SecurityAction, policy: ActionPolicy): Promise<void> {
    const since = new Date(Date.now() - policy.windowMs).toISOString();
    const issued = await withDatabaseRetry(
      () => this.db.securityEvent.count({
        where: {
          userId,
          deviceId,
          action,
          eventType: { in: ['action.permit_issued', 'action.handle_issued'] },
          createdAt: { gt: since },
        },
      }),
      2,
    );
    if (issued >= policy.maxPerWindow) {
      await this.recordEvent({ eventType: 'action.budget_exceeded', userId, deviceId, action, metadata: { max: policy.maxPerWindow, windowMs: policy.windowMs } });
      throw new AppError('ACTION_RATE_LIMITED', 'This action is temporarily rate limited.', 429);
    }
  }
}
