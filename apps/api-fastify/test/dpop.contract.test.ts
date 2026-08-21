import { strict as assert } from 'node:assert';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { createHash, generateKeyPairSync, randomBytes, randomUUID, sign } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../../../api/prisma/generated/prisma/client.js';
import { buildApp } from '../src/app/build-app.js';
import { AuthService } from '../src/core/auth.js';
import { AUTH_COOKIE } from '../src/core/config.js';
import { bodyDigest, canonicalJson, hash } from '../src/core/crypto.js';

const workspaceRoot = resolve(process.cwd(), '..', '..');

function base64Url(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url');
}

function dpopProof(input: {
  privateKey: ReturnType<typeof generateKeyPairSync>['privateKey'];
  publicKeyJwk: Record<string, unknown>;
  method: string;
  url: string;
  accessToken?: string;
  deviceId: string;
  sessionId: string;
  requestId: string;
  timestamp: string;
  nonce: string;
  sequence: string;
  bodyHash: string;
  idempotencyKey: string;
}): string {
  const protectedSegment = base64Url(JSON.stringify({ typ: 'dpop+jwt', alg: 'ES256', jwk: input.publicKeyJwk }));
  const payload: Record<string, unknown> = {
    jti: input.requestId,
    htm: input.method,
    htu: input.url,
    iat: Math.floor(Date.now() / 1_000),
    tb_device: input.deviceId,
    tb_session: input.sessionId,
    tb_request: input.requestId,
    tb_time: input.timestamp,
    tb_nonce: input.nonce,
    tb_sequence: input.sequence,
    tb_body_sha256: input.bodyHash,
    tb_idempotency: input.idempotencyKey,
    tb_permit: '',
    tb_server_nonce: '',
  };
  if (input.accessToken) {
    payload.ath = base64Url(createHash('sha256').update(input.accessToken, 'utf8').digest());
  }
  const payloadSegment = base64Url(JSON.stringify(payload));
  const signingInput = `${protectedSegment}.${payloadSegment}`;
  const signature = sign('sha256', Buffer.from(signingInput, 'ascii'), {
    key: input.privateKey,
    dsaEncoding: 'ieee-p1363',
  });
  return `${signingInput}.${base64Url(signature)}`;
}

test('Fastify accepts standard DPoP proofs and rejects a tampered proof', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'thuebot-fastify-dpop-'));
  const databaseFile = join(directory, 'dev.db');
  await copyFile(join(workspaceRoot, 'api', 'prisma', 'dev.db'), databaseFile);
  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseFile }) });
  await db.$connect();
  const app = await buildApp({ db, enforceTransport: false, logger: false });
  const userId = `dpop-${randomUUID()}`;
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const publicKeyJwk = publicKey.export({ format: 'jwk' }) as Record<string, unknown>;
  const fingerprint = hash(canonicalJson(publicKeyJwk));
  const deviceId = `dev-${randomUUID()}`;
  try {
    await db.user.create({
      data: {
        id: userId,
        name: 'DPoP Test',
        email: `${userId}@example.test`,
        avatar: '',
        role: 'buyer',
        joinedDate: new Date().toISOString().slice(0, 10),
      },
    });
    await db.deviceIdentity.create({
      data: {
        id: deviceId,
        userId,
        publicKey: JSON.stringify(publicKeyJwk),
        fingerprint,
        createdAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
      },
    });
    const session = await new AuthService(db).createSession(userId, deviceId);
    const body = '{}';
    const bodyHash = bodyDigest({});
    const requestId = randomUUID();
    const timestamp = String(Date.now());
    const nonce = randomBytes(18).toString('base64url');
    const idempotencyKey = `dpop-${randomUUID()}`;
    const url = 'http://localhost:3002/api/auth/access';
    const headers = {
      cookie: `${AUTH_COOKIE}=${session.token}`,
      host: 'localhost:3002',
      'x-forwarded-host': 'localhost:3002',
      'x-forwarded-proto': 'http',
      'content-type': 'application/json',
      'x-tb-protocol': '3',
      'x-tb-device': deviceId,
      'x-tb-session': session.session.id,
      'x-tb-request': requestId,
      'x-tb-time': timestamp,
      'x-tb-nonce': nonce,
      'x-tb-sequence': '1',
      'x-tb-body-sha256': bodyHash,
      'x-tb-idempotency': idempotencyKey,
      dpop: dpopProof({
        privateKey,
        publicKeyJwk,
        method: 'POST',
        url,
        deviceId,
        sessionId: session.session.id,
        requestId,
        timestamp,
        nonce,
        sequence: '1',
        bodyHash,
        idempotencyKey,
      }),
    };
    const response = await app.inject({ method: 'POST', url: '/api/auth/access', headers, payload: body });
    assert.equal(response.statusCode, 200);
    const responseBody = JSON.parse(response.body) as { data?: { token?: string; tokenType?: string } };
    assert.match(String(responseBody.data?.token), /^[A-Za-z0-9_-]{64,180}$/);
    assert.equal(responseBody.data?.tokenType, 'DPoP');

    const bearer = await app.inject({
      method: 'POST',
      url: '/api/auth/access',
      headers: { ...headers, authorization: `Bearer ${'A'.repeat(64)}`, 'x-tb-request': randomUUID() },
      payload: body,
    });
    assert.equal(bearer.statusCode, 401);
    assert.equal((JSON.parse(bearer.body) as { code?: string }).code, 'ACCESS_TOKEN_INVALID');

    const legacyCookie = await app.inject({
      method: 'POST',
      url: '/api/auth/access',
      headers: { ...headers, cookie: `tb_session=${session.token}`, 'x-tb-request': randomUUID() },
      payload: body,
    });
    assert.equal(legacyCookie.statusCode, 401);

    const tampered = await app.inject({
      method: 'POST',
      url: '/api/auth/access',
      headers: { ...headers, 'x-tb-request': randomUUID(), dpop: `${headers.dpop.slice(0, -1)}A` },
      payload: body,
    });
    assert.equal(tampered.statusCode, 403);
    assert.equal((JSON.parse(tampered.body) as { code?: string }).code, 'DPOP_PROOF_INVALID');
  } finally {
    await app.close();
    await db.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});
