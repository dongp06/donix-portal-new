import {
  createHash,
  createPublicKey,
  randomBytes,
  randomUUID,
  verify as verifySignature,
  type KeyObject,
} from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { authCookieName } from './config.js';

export type JsonRecord = Record<string, unknown>;

/**
 * Browser credentials are deliberately fixed-size opaque values.  Keeping
 * this contract in one place prevents a parser from accidentally accepting a
 * legacy JWT, a semantic prefix, or an oversized attacker-controlled lookup
 * string even though the generator emits a 48-byte random value.
 */
export const OPAQUE_CREDENTIAL_BYTES = 48;
export const OPAQUE_CREDENTIAL_LENGTH = 64;
const OPAQUE_CREDENTIAL_PATTERN = /^[A-Za-z0-9_-]{64}$/;

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function randomOpaqueCredential(): string {
  return randomToken(OPAQUE_CREDENTIAL_BYTES);
}

export function isOpaqueCredential(value: unknown): value is string {
  return typeof value === 'string' && OPAQUE_CREDENTIAL_PATTERN.test(value);
}

export function hash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function randomRequestId(): string {
  return randomUUID();
}

export function canonicalJson(value: unknown): string {
  if (value === undefined) return '';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const object = value as JsonRecord;
  return `{${Object.keys(object)
    .filter((key) => object[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
    .join(',')}}`;
}

export function bodyDigest(value: unknown): string {
  return hash(canonicalJson(value));
}

export function base64UrlToBuffer(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized + '='.repeat((4 - (normalized.length % 4)) % 4), 'base64');
}

export function bufferToBase64Url(value: Buffer): string {
  return value.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function publicKeyFromJwk(value: unknown): {
  jwk: Record<string, string>;
  key: KeyObject;
  fingerprint: string;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid device public key.');
  }
  const input = value as JsonRecord;
  if (
    input.kty !== 'EC' ||
    input.crv !== 'P-256' ||
    typeof input.x !== 'string' ||
    typeof input.y !== 'string' ||
    !/^[A-Za-z0-9_-]{20,100}={0,2}$/.test(input.x) ||
    !/^[A-Za-z0-9_-]{20,100}={0,2}$/.test(input.y)
  ) {
    throw new Error('Only ECDSA P-256 device keys are supported.');
  }
  // Accept the padded representation some browser bridges emit, then store
  // the canonical Node-exported unpadded JWK for stable fingerprints.
  const normalized = {
    ...input,
    x: input.x.replace(/=+$/g, ''),
    y: input.y.replace(/=+$/g, ''),
  };
  const key = createPublicKey({ key: normalized, format: 'jwk' });
  const jwk = key.export({ format: 'jwk' }) as Record<string, string>;
  return { jwk, key, fingerprint: hash(canonicalJson(jwk)) };
}

export function header(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' ? value : undefined;
}

export function requestPath(request: FastifyRequest): string {
  const value = request.url.split('?', 1)[0] || '/';
  return value.startsWith('/') ? value : `/${value}`;
}

export function clientIp(request: FastifyRequest): string {
  // Fastify already resolves request.ip according to its trustProxy policy.
  // Reading x-forwarded-for directly would let an arbitrary client spoof risk
  // scoring and rate-limit identity when the API is reached without the
  // configured proxy hop.
  return request.ip || request.socket.remoteAddress || 'unknown';
}

export function ipDigest(request: FastifyRequest): string {
  return hash(`${process.env.SECURITY_IP_SALT || 'thuebot-ip-v1'}:${clientIp(request)}`);
}

export function accessTokenFromRequest(request: FastifyRequest): string | undefined {
  const value = header(request, 'authorization');
  const match = value?.match(/^DPoP\s+([^\s]+)$/i);
  const token = match?.[1];
  if (!isOpaqueCredential(token)) return undefined;
  return token;
}

export function sessionTokenFromRequest(request: FastifyRequest): string | undefined {
  const token = request.cookies?.[authCookieName()];
  return isOpaqueCredential(token) ? token : undefined;
}

export function requestAbsoluteUrl(request: FastifyRequest): string {
  // request.host/protocol are Fastify's trusted view.  Do not consume raw
  // x-forwarded-* headers here: DPoP htu must be checked against a canonical
  // URL that an untrusted caller cannot rewrite.
  const host = request.host || header(request, 'host') || 'localhost';
  const protocol = request.protocol === 'https' ? 'https' : 'http';
  return `${protocol}://${host}${requestPath(request)}`;
}

type DpopPayload = {
  htm?: unknown;
  htu?: unknown;
  jti?: unknown;
  iat?: unknown;
  ath?: unknown;
  nonce?: unknown;
  tb_device?: unknown;
  tb_session?: unknown;
  tb_request?: unknown;
  tb_time?: unknown;
  tb_nonce?: unknown;
  tb_sequence?: unknown;
  tb_body_sha256?: unknown;
  tb_idempotency?: unknown;
  tb_permit?: unknown;
  tb_server_nonce?: unknown;
};

function decodeJsonSegment(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(base64UrlToBuffer(value).toString('utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function base64UrlSha256(value: string): string {
  return bufferToBase64Url(createHash('sha256').update(value, 'utf8').digest());
}

export function verifyDpopProof(input: {
  proof: string;
  request: FastifyRequest;
  expectedFingerprint: string;
  accessToken?: string;
  deviceId: string;
  sessionId: string;
  bodyHash: string;
  requestId: string;
  timestamp: string;
  nonce: string;
  sequence: string;
  idempotencyKey: string;
  permitHash: string;
  serverNonce: string;
}): { jti: string; publicKeyFingerprint: string } | null {
  const segments = input.proof.split('.');
  if (segments.length !== 3 || segments.some((segment) => !segment)) return null;
  const [protectedSegment, payloadSegment, signatureSegment] = segments;
  if (!protectedSegment || !payloadSegment || !signatureSegment) return null;
  const protectedHeader = decodeJsonSegment(protectedSegment);
  const payload = decodeJsonSegment(payloadSegment) as DpopPayload | null;
  if (!protectedHeader || !payload) return null;
  if (protectedHeader.typ !== 'dpop+jwt' || protectedHeader.alg !== 'ES256') return null;
  if (!protectedHeader.jwk || typeof protectedHeader.jwk !== 'object' || Array.isArray(protectedHeader.jwk)) return null;
  const jwk = protectedHeader.jwk as Record<string, unknown>;
  if ('d' in jwk) return null;
  let publicKey: KeyObject;
  let fingerprint: string;
  try {
    const parsed = publicKeyFromJwk(jwk);
    publicKey = parsed.key;
    fingerprint = parsed.fingerprint;
  } catch {
    return null;
  }
  if (fingerprint !== input.expectedFingerprint) return null;
  const signingInput = Buffer.from(`${protectedSegment}.${payloadSegment}`, 'ascii');
  const signature = base64UrlToBuffer(signatureSegment);
  if (signature.length !== 64) return null;
  try {
    if (!verifySignature('sha256', signingInput, { key: publicKey, dsaEncoding: 'ieee-p1363' }, signature)) return null;
  } catch {
    return null;
  }
  const expectedUrl = requestAbsoluteUrl(input.request);
  const iat = typeof payload.iat === 'number' ? payload.iat : Number(payload.iat);
  const jti = typeof payload.jti === 'string' ? payload.jti : '';
  if (
    payload.htm !== input.request.method.toUpperCase() ||
    payload.htu !== expectedUrl ||
    !jti || !/^[A-Za-z0-9._~-]{8,200}$/.test(jti) ||
    !Number.isSafeInteger(iat) || Math.abs(Math.floor(Date.now() / 1_000) - iat) > 90
  ) return null;
  if (input.accessToken) {
    if (payload.ath !== base64UrlSha256(input.accessToken)) return null;
  } else if (payload.ath !== undefined) {
    return null;
  }
  const matches = (value: unknown, expected: string): boolean => value === expected;
  if (
    !matches(payload.tb_device, input.deviceId) ||
    !matches(payload.tb_session, input.sessionId) ||
    !matches(payload.tb_request, input.requestId) ||
    !matches(payload.tb_time, input.timestamp) ||
    !matches(payload.tb_nonce, input.nonce) ||
    !matches(payload.tb_sequence, input.sequence) ||
    !matches(payload.tb_body_sha256, input.bodyHash) ||
    !matches(payload.tb_idempotency, input.idempotencyKey) ||
    !matches(payload.tb_permit, input.permitHash) ||
    !matches(payload.tb_server_nonce, input.serverNonce) ||
    (input.serverNonce && payload.nonce !== input.serverNonce)
  ) return null;
  return { jti, publicKeyFingerprint: fingerprint };
}

export function safeMetadata(value: unknown, max = 4_000): string {
  try {
    const encoded = JSON.stringify(value ?? {});
    return encoded.length <= max ? encoded : encoded.slice(0, max);
  } catch {
    return '{}';
  }
}
