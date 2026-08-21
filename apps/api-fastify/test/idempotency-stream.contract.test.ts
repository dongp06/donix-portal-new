import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../../../api/prisma/generated/prisma/client.js';
import { buildApp } from '../src/app/build-app.js';
import { AuthService } from '../src/core/auth.js';
import { bodyDigest, canonicalJson, hash } from '../src/core/crypto.js';
import { dpopHeaders } from './security-test-helpers.js';

const workspaceRoot = resolve(process.cwd(), '..', '..');

function jsonBody(response: { body: string }): Record<string, unknown> {
  return JSON.parse(response.body) as Record<string, unknown>;
}

test('Fastify idempotency ledger rejects fresh-proof reuse without creating another permit', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'thuebot-fastify-idempotency-'));
  const databaseFile = join(directory, 'dev.db');
  await copyFile(join(workspaceRoot, 'api', 'prisma', 'dev.db'), databaseFile);
  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseFile }) });
  await db.$connect();

  const userId = `fastify-idempotency-${randomUUID()}`;
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const publicKeyJwk = publicKey.export({ format: 'jwk' }) as Record<string, string>;
  const fingerprint = hash(canonicalJson(publicKeyJwk));
  const app = await buildApp({ db, enforceTransport: false, logger: false });
  let sequence = 0;
  let accessToken = '';
  const idempotencyKey = `idem-${randomUUID()}`;

  try {
    await db.user.create({
      data: {
        id: userId,
        name: 'Fastify Idempotency Tester',
        email: `${userId}@example.test`,
        avatar: '',
        role: 'seller',
        joinedDate: new Date().toISOString().slice(0, 10),
      },
    });
    const device = await db.deviceIdentity.create({
      data: {
        id: `dev-${randomUUID()}`,
        userId,
        publicKey: JSON.stringify(publicKeyJwk),
        fingerprint,
        createdAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
      },
    });
    const auth = new AuthService(db);
    const session = await auth.createSession(userId, device.id);
    const signRequest = (path: string, body: Record<string, unknown>, key = idempotencyKey) => {
      sequence += 1;
      return dpopHeaders({
        privateKey,
        publicKeyJwk,
        cookieToken: session.token,
        deviceId: device.id,
        sessionId: session.session.id,
        sequence,
        path,
        body,
        accessToken,
        idempotencyKey: key,
      });
    };

    const access = await app.inject({
      method: 'POST',
      url: '/api/auth/access',
      headers: signRequest('/api/auth/access', {}, `access-${randomUUID()}`),
      payload: '{}',
    });
    assert.equal(access.statusCode, 200, access.body);
    accessToken = String((jsonBody(access).data as Record<string, unknown>).token);

    const firstBody = {
      action: 'seller.follow',
      method: 'PUT',
      path: '/api/sellers/missing-seller/follow',
      bodyHash: bodyDigest({}),
    };
    const first = await app.inject({
      method: 'POST',
      url: '/api/i',
      headers: signRequest('/api/i', firstBody),
      payload: JSON.stringify(firstBody),
    });
    assert.equal(first.statusCode, 200, first.body);
    assert.equal(await db.idempotencyRecord.count({ where: { userId, idempotencyKey } }), 1);
    assert.equal(await db.actionPermit.count({ where: { userId, action: 'seller.follow' } }), 1);

    const replay = await app.inject({
      method: 'POST',
      url: '/api/i',
      headers: signRequest('/api/i', firstBody),
      payload: JSON.stringify(firstBody),
    });
    assert.equal(replay.statusCode, 409, replay.body);
    assert.equal(jsonBody(replay).code, 'IDEMPOTENCY_REPLAYED');
    assert.equal(await db.actionPermit.count({ where: { userId, action: 'seller.follow' } }), 1);

    const changedBody = { ...firstBody, targetId: 'different-target' };
    const reused = await app.inject({
      method: 'POST',
      url: '/api/i',
      headers: signRequest('/api/i', changedBody),
      payload: JSON.stringify(changedBody),
    });
    assert.equal(reused.statusCode, 409, reused.body);
    assert.equal(jsonBody(reused).code, 'IDEMPOTENCY_KEY_REUSED');
    assert.equal(await db.actionPermit.count({ where: { userId, action: 'seller.follow' } }), 1);
    assert.equal(await db.securityEvent.count({ where: { userId, eventType: 'request.idempotency_replay' } }), 2);
  } finally {
    await app.close();
    await db.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});

test('Fastify THB/4 rejects unknown-length binary streams instead of leaking cleartext', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'thuebot-fastify-stream-'));
  const databaseFile = join(directory, 'dev.db');
  await copyFile(join(workspaceRoot, 'api', 'prisma', 'dev.db'), databaseFile);
  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseFile }) });
  await db.$connect();
  const app = await buildApp({ db, enforceTransport: false, logger: false });

  try {
    const request = {
      method: 'GET',
      transport: {
        clientPublicJwk: { kty: 'EC', crv: 'P-256', x: 'x'.repeat(43), y: 'y'.repeat(43) },
        kid: 'test-kid',
        wireKid: Buffer.alloc(8),
        requestId: randomUUID(),
        sequence: BigInt(1),
        encryptedRequest: false,
      },
    } as never;
    const headers: Record<string, string> = {
      'content-type': 'application/octet-stream',
      'content-disposition': 'attachment; filename="payload.bin"',
    };
    const reply = {
      statusCode: 200,
      getHeader: (name: string) => headers[name],
      header: (name: string, value: unknown) => { headers[name] = String(value); },
      removeHeader: () => undefined,
    } as never;
    const stream = Readable.from([Buffer.from('binary-payload', 'utf8')]);
    await assert.rejects(
      () => app.transport.encryptOnSend(request, reply, stream),
      (error: unknown) => Boolean(error && typeof error === 'object' && (error as { code?: unknown }).code === 'TRANSPORT_STREAM_LENGTH_REQUIRED'),
    );
  } finally {
    await app.close();
    await db.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});
