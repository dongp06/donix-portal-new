import { strict as assert } from 'node:assert';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../../../api/prisma/generated/prisma/client.js';
import { buildApp } from '../src/app/build-app.js';
import { AuthService } from '../src/core/auth.js';
import { bodyDigest, canonicalJson, hash } from '../src/core/crypto.js';
import { AUTH_COOKIE } from '../src/core/config.js';
import { dpopHeaders } from './security-test-helpers.js';

const workspaceRoot = resolve(process.cwd(), '..', '..');

function jsonBody(response: { body: string }): Record<string, unknown> {
  return JSON.parse(response.body) as Record<string, unknown>;
}

test('Fastify admin trust queue issues opaque handles and enforces critical step-up', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'thuebot-fastify-admin-trust-'));
  const databaseFile = join(directory, 'dev.db');
  await copyFile(join(workspaceRoot, 'api', 'prisma', 'dev.db'), databaseFile);
  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseFile }) });
  await db.$connect();

  const previousOwnerEmail = process.env.OWNER_EMAIL;
  const adminId = `fastify-admin-${randomUUID()}`;
  const sellerId = `fastify-admin-seller-${randomUUID()}`;
  const adminEmail = `${adminId}@example.test`;
  process.env.OWNER_EMAIL = adminEmail;
  const adminKeys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const publicKeyJwk = adminKeys.publicKey.export({ format: 'jwk' }) as Record<string, string>;
  const fingerprint = hash(canonicalJson(publicKeyJwk));
  const timestamp = new Date().toISOString();
  const app = await buildApp({ db, enforceTransport: false, logger: false });
  const adminDeviceId = `dev-${randomUUID()}`;
  let sequence = 0;

  try {
    await db.user.create({
      data: {
        id: adminId,
        name: 'Fastify Trust Admin',
        email: adminEmail,
        avatar: '',
        role: 'buyer',
        joinedDate: timestamp.slice(0, 10),
      },
    });
    await db.user.create({
      data: {
        id: sellerId,
        name: 'Fastify Pending Seller',
        email: `${sellerId}@example.test`,
        avatar: '',
        role: 'seller',
        joinedDate: timestamp.slice(0, 10),
      },
    });
    await db.trustVerification.create({
      data: {
        id: `tv-${randomUUID()}`,
        userId: sellerId,
        status: 'pending',
        note: 'Please review.',
        submittedAt: timestamp,
        verificationVersion: 2,
      },
    });
    await db.deviceIdentity.create({
      data: {
        id: adminDeviceId,
        userId: adminId,
        publicKey: JSON.stringify(publicKeyJwk),
        fingerprint,
        createdAt: timestamp,
        lastSeenAt: timestamp,
      },
    });
    const auth = new AuthService(db);
    const session = await auth.createSession(adminId, adminDeviceId);
    const cookie = `${AUTH_COOKIE}=${session.token}`;

    const signedHeaders = (
      path: string,
      body: unknown,
      accessToken: string,
      permit = '',
      serverNonce = '',
      method = 'POST',
    ) => {
      sequence += 1;
      return dpopHeaders({
        privateKey: adminKeys.privateKey,
        publicKeyJwk,
        cookieToken: session.token,
        deviceId: adminDeviceId,
        sessionId: session.session.id,
        sequence,
        path,
        body,
        accessToken,
        permit,
        serverNonce,
        method,
      });
    };

    const accessResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/access',
      headers: signedHeaders('/api/auth/access', {}, ''),
      payload: '{}',
    });
    assert.equal(accessResponse.statusCode, 200);
    const accessToken = String((jsonBody(accessResponse).data as Record<string, unknown>).token);

    const guestOverview = await app.inject({ method: 'GET', url: '/api/admin/overview' });
    assert.equal(guestOverview.statusCode, 404);
    const overview = await app.inject({ method: 'GET', url: '/api/admin/overview', headers: signedHeaders('/api/admin/overview', undefined, accessToken, '', '', 'GET') });
    assert.equal(overview.statusCode, 200);
    assert.equal((jsonBody(overview).data as Record<string, unknown>).marketplace !== undefined, true);
    const analytics = await app.inject({ method: 'GET', url: '/api/admin/analytics', headers: signedHeaders('/api/admin/analytics', undefined, accessToken, '', '', 'GET') });
    assert.equal(analytics.statusCode, 200);

    const queue = await app.inject({ method: 'GET', url: '/api/admin/verifications', headers: signedHeaders('/api/admin/verifications', undefined, accessToken, '', '', 'GET') });
    assert.equal(queue.statusCode, 200);
    const rows = jsonBody(queue).data as Array<Record<string, unknown>>;
    assert.equal(rows.length, 1);
    const row = rows[0]!;
    const handle = row.actionHandle as Record<string, unknown>;
    assert.match(String(handle.endpoint), /^\/api\/m\/[A-Za-z0-9_-]{40,}$/);
    assert.equal(handle.requiresStepUp, true);

    const reviewBody = { action: 'approve' };
    const withoutStepUp = await app.inject({
      method: 'POST',
      url: String(handle.endpoint),
      headers: signedHeaders(String(handle.endpoint), reviewBody, accessToken, String(handle.endpoint).split('/').pop(), String(handle.serverNonce)),
      payload: JSON.stringify(reviewBody),
    });
    assert.equal(withoutStepUp.statusCode, 412);
    assert.equal(jsonBody(withoutStepUp).code, 'STEP_UP_REQUIRED');

    const changedBody = await app.inject({
      method: 'POST',
      url: String(handle.endpoint),
      headers: signedHeaders(String(handle.endpoint), { action: 'reject' }, accessToken, String(handle.endpoint).split('/').pop(), String(handle.serverNonce)),
      payload: JSON.stringify({ action: 'reject' }),
    });
    assert.equal(changedBody.statusCode, 403);
    assert.equal(jsonBody(changedBody).code, 'CAPABILITY_BODY_MISMATCH');

    await db.securityEvent.create({
      data: {
        id: `evt-${randomUUID()}`,
        userId: adminId,
        deviceId: adminDeviceId,
        eventType: 'webauthn.step_up',
        action: 'trust.review',
        riskScore: 0,
        metadata: '{}',
        createdAt: new Date().toISOString(),
      },
    });
    const approved = await app.inject({
      method: 'POST',
      url: String(handle.endpoint),
      headers: signedHeaders(String(handle.endpoint), reviewBody, accessToken, String(handle.endpoint).split('/').pop(), String(handle.serverNonce)),
      payload: JSON.stringify(reviewBody),
    });
    assert.equal(approved.statusCode, 200);
    assert.equal((jsonBody(approved).data as Record<string, unknown>).status, 'trusted');
    assert.equal((await db.user.findUnique({ where: { id: sellerId }, select: { verificationState: true } }))?.verificationState, 'trusted');
    const audit = await db.adminAuditLog.findFirst({ where: { targetId: String(row.id), action: 'verification.approve' } });
    assert.ok(audit?.eventHash);
    assert.equal(audit?.targetType, 'trust_verification');

    const replay = await app.inject({
      method: 'POST',
      url: String(handle.endpoint),
      headers: signedHeaders(String(handle.endpoint), reviewBody, accessToken, String(handle.endpoint).split('/').pop(), String(handle.serverNonce)),
      payload: JSON.stringify(reviewBody),
    });
    assert.equal(replay.statusCode, 404);

    const direct = await app.inject({
      method: 'PATCH',
      url: `/api/admin/verifications/${row.id}`,
      headers: { cookie, 'content-type': 'application/json' },
      payload: JSON.stringify(reviewBody),
    });
    assert.equal(direct.statusCode, 404);
  } finally {
    await app.close();
    await db.$disconnect();
    if (previousOwnerEmail === undefined) delete process.env.OWNER_EMAIL;
    else process.env.OWNER_EMAIL = previousOwnerEmail;
    await rm(directory, { recursive: true, force: true });
  }
});
