import { createHash, randomUUID, type KeyObject, sign } from 'node:crypto';
import { AUTH_COOKIE } from '../src/core/config.js';
import { bodyDigest, hash } from '../src/core/crypto.js';

type DpopInput = {
  privateKey: KeyObject;
  publicKeyJwk: Record<string, unknown>;
  method: string;
  path: string;
  accessToken?: string;
  deviceId: string;
  sessionId: string;
  requestId: string;
  timestamp: string;
  nonce: string;
  sequence: string;
  bodyHash: string;
  idempotencyKey: string;
  permitHash: string;
  serverNonce: string;
};

export type DpopHeadersInput = {
  privateKey: KeyObject;
  publicKeyJwk: Record<string, unknown>;
  cookieToken: string;
  deviceId: string;
  sessionId: string;
  sequence: number;
  path: string;
  body: unknown;
  accessToken?: string;
  method?: string;
  permit?: string;
  serverNonce?: string;
  contentType?: string | null;
  idempotencyKey?: string;
};

function base64Url(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url');
}

function dpopProof(input: DpopInput): string {
  const protectedSegment = base64Url(JSON.stringify({
    typ: 'dpop+jwt',
    alg: 'ES256',
    jwk: input.publicKeyJwk,
  }));
  const payload: Record<string, unknown> = {
    jti: input.requestId,
    htm: input.method.toUpperCase(),
    htu: `http://localhost:3002${input.path}`,
    iat: Math.floor(Date.now() / 1_000),
    tb_device: input.deviceId,
    tb_session: input.sessionId,
    tb_request: input.requestId,
    tb_time: input.timestamp,
    tb_nonce: input.nonce,
    tb_sequence: input.sequence,
    tb_body_sha256: input.bodyHash,
    tb_idempotency: input.idempotencyKey,
    tb_permit: input.permitHash,
    tb_server_nonce: input.serverNonce,
  };
  if (input.accessToken) {
    payload.ath = base64Url(createHash('sha256').update(input.accessToken, 'utf8').digest());
  }
  if (input.serverNonce) payload.nonce = input.serverNonce;
  const payloadSegment = base64Url(JSON.stringify(payload));
  const signingInput = `${protectedSegment}.${payloadSegment}`;
  const signature = sign('sha256', Buffer.from(signingInput, 'ascii'), {
    key: input.privateKey,
    dsaEncoding: 'ieee-p1363',
  });
  return `${signingInput}.${base64Url(signature)}`;
}

/** Build the current production request contract used by Fastify tests. */
export function dpopHeaders(input: DpopHeadersInput): Record<string, string> {
  const method = (input.method ?? 'POST').toUpperCase();
  const bodyHash = bodyDigest(input.body);
  const timestamp = String(Date.now());
  const nonce = `test-${randomUUID().replace(/-/g, '')}`;
  const requestId = randomUUID();
  const idempotencyKey = input.idempotencyKey ?? `test-${randomUUID()}`;
  const sequence = String(input.sequence);
  const permitHash = input.permit ? hash(input.permit) : '';
  const serverNonce = input.serverNonce ?? '';
  const dpop = dpopProof({
    privateKey: input.privateKey,
    publicKeyJwk: input.publicKeyJwk,
    method,
    path: input.path,
    accessToken: input.accessToken,
    deviceId: input.deviceId,
    sessionId: input.sessionId,
    requestId,
    timestamp,
    nonce,
    sequence,
    bodyHash,
    idempotencyKey,
    permitHash,
    serverNonce,
  });
  return {
    cookie: `${AUTH_COOKIE}=${input.cookieToken}`,
    host: 'localhost:3002',
    'x-forwarded-host': 'localhost:3002',
    'x-forwarded-proto': 'http',
    ...(input.contentType !== null ? { 'content-type': input.contentType ?? 'application/json' } : {}),
    'x-tb-protocol': '3',
    'x-tb-device': input.deviceId,
    'x-tb-session': input.sessionId,
    'x-tb-request': requestId,
    'x-tb-time': timestamp,
    'x-tb-nonce': nonce,
    'x-tb-sequence': sequence,
    'x-tb-body-sha256': bodyHash,
    'x-tb-idempotency': idempotencyKey,
    ...(input.accessToken ? { authorization: `DPoP ${input.accessToken}` } : {}),
    dpop,
    ...(input.permit ? { 'x-tb-permit': input.permit } : {}),
    ...(serverNonce ? { 'x-tb-server-nonce': serverNonce } : {}),
  };
}
