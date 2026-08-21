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

test('Fastify seller Trust Center computes eligibility and keeps verification state server-owned', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'thuebot-fastify-trust-'));
  const databaseFile = join(directory, 'dev.db');
  await copyFile(join(workspaceRoot, 'api', 'prisma', 'dev.db'), databaseFile);
  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseFile }) });
  await db.$connect();

  const sellerId = `fastify-trust-seller-${randomUUID()}`;
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const publicKeyJwk = publicKey.export({ format: 'jwk' }) as Record<string, string>;
  const fingerprint = hash(canonicalJson(publicKeyJwk));
  const app = await buildApp({ db, enforceTransport: false, logger: false });
  let sequence = 0;
  let accessToken = '';

  try {
    const oldDate = new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10);
    const email = `${sellerId}@example.test`;
    await db.user.create({
      data: {
        id: sellerId,
        googleId: `google-${randomUUID()}`,
        name: 'Fastify Trust Seller',
        email,
        avatar: '',
        role: 'seller',
        joinedDate: oldDate,
      },
    });
    await db.sellerProfile.create({
      data: {
        id: `sp-${randomUUID()}`,
        userId: sellerId,
        shopName: 'Fastify Trust Seller',
        slug: `trust-seller-${randomUUID().slice(0, 8)}`,
        bio: 'A complete seller profile for Trust Center contract coverage.',
        avatar: 'https://example.test/avatar.png',
        banner: 'https://example.test/banner.png',
        contact: JSON.stringify({ telegram: '@trust-seller', website: 'https://example.test' }),
        profileCompleteness: 100,
        updatedAt: new Date().toISOString(),
      },
    });
    const bot = await db.bot.findFirst({ where: { status: { in: ['online', 'maintenance', 'offline'] } }, select: { id: true } });
    if (!bot) throw new Error('Trust fixture is missing a bot.');
    await db.bot.update({ where: { id: bot.id }, data: { sellerId, status: 'online', sellerName: 'Fastify Trust Seller', sellerAvatar: '' } });

    for (let index = 0; index < 20; index += 1) {
      const reviewerId = `fastify-trust-reviewer-${randomUUID()}`;
      await db.user.create({
        data: {
          id: reviewerId,
          name: `Trust Reviewer ${index}`,
          email: `${reviewerId}@example.test`,
          avatar: '',
          role: 'buyer',
          joinedDate: oldDate,
        },
      });
      await db.botReview.create({
        data: {
          id: `review-${randomUUID()}`,
          botId: bot.id,
          userId: reviewerId,
          rating: 5,
          comment: 'Trust contract review',
          images: '[]',
          createdAt: new Date().toISOString(),
        },
      });
    }

    const timestamp = new Date().toISOString();
    for (const kind of ['email', 'phone', 'telegram', 'website', 'identity']) {
      await db.verificationCheck.create({
        data: {
          id: `vcheck-${randomUUID()}`,
          userId: sellerId,
          kind,
          status: 'verified',
          value: kind === 'email' ? email : `verified-${kind}`,
          method: 'contract-test',
          note: null,
          verifiedAt: timestamp,
          verifiedBy: sellerId,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      });
    }

    const device = await db.deviceIdentity.create({
      data: {
        id: `dev-${randomUUID()}`,
        userId: sellerId,
        publicKey: JSON.stringify(publicKeyJwk),
        fingerprint,
        createdAt: timestamp,
        lastSeenAt: timestamp,
      },
    });
    const auth = new AuthService(db);
    const session = await auth.createSession(sellerId, device.id);
    const cookie = `${AUTH_COOKIE}=${session.token}`;

    const signedHeaders = (
      path: string,
      body: unknown,
      permit = '',
      serverNonce = '',
      method = 'POST',
    ) => {
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
        permit,
        serverNonce,
        method,
      });
    };

    const summary = await app.inject({ method: 'GET', url: '/api/sellers/me/verification', headers: { cookie } });
    assert.equal(summary.statusCode, 200);
    const initial = jsonBody(summary).data as Record<string, unknown>;
    assert.equal(initial.state, 'verified');
    assert.equal(initial.isTrusted, false);
    assert.ok(Number((initial.score as Record<string, unknown>).score) >= 75);
    assert.equal((initial.checklist as Array<Record<string, unknown>>).every((item) => item.passed || item.blocking === false), true);

    const access = await app.inject({ method: 'POST', url: '/api/auth/access', headers: signedHeaders('/api/auth/access', {}), payload: '{}' });
    assert.equal(access.statusCode, 200);
    accessToken = String((jsonBody(access).data as Record<string, unknown>).token);

    const issuePermit = async (action: string, method: string, path: string, body: unknown) => {
      const intent = { action, method, path, bodyHash: bodyDigest(body) };
      const response = await app.inject({ method: 'POST', url: '/api/i', headers: signedHeaders('/api/i', intent), payload: JSON.stringify(intent) });
      assert.equal(response.statusCode, 200);
      return jsonBody(response).data as { permit: string; serverNonce: string };
    };

    const execute = async (permit: { permit: string; serverNonce: string }, method: 'POST' | 'DELETE', path: string, body: unknown) => app.inject({
      method,
      url: `/api/m/${permit.permit}`,
      headers: signedHeaders(`/api/m/${permit.permit}`, body, permit.permit, permit.serverNonce, method),
      payload: JSON.stringify(body),
    });

    const submitBody = { note: 'Ready for staff review.' };
    const submitPermit = await issuePermit('verification.submit', 'POST', '/api/sellers/me/verification', submitBody);
    const submitted = await execute(submitPermit, 'POST', '/api/sellers/me/verification', submitBody);
    assert.equal(submitted.statusCode, 200);
    assert.equal((jsonBody(submitted).data as Record<string, unknown>).status, 'pending');

    const pending = await app.inject({ method: 'GET', url: '/api/sellers/me/verification', headers: { cookie } });
    assert.equal((jsonBody(pending).data as Record<string, unknown>).state, 'pending');
    assert.equal(((jsonBody(pending).data as Record<string, unknown>).status as Record<string, unknown>).canCancel, true);

    const checkPermit = await issuePermit('verification.check', 'POST', '/api/sellers/me/verification/checks/phone', {});
    const check = await execute(checkPermit, 'POST', '/api/sellers/me/verification/checks/phone', {});
    assert.equal(check.statusCode, 200);
    const phone = (jsonBody(check).data as Array<Record<string, unknown>>).find((item) => item.kind === 'phone');
    assert.equal(phone?.status, 'pending');

    const cancelPermit = await issuePermit('verification.cancel', 'DELETE', '/api/sellers/me/verification', {});
    const cancelled = await execute(cancelPermit, 'DELETE', '/api/sellers/me/verification', {});
    assert.equal(cancelled.statusCode, 200);
    assert.equal((jsonBody(cancelled).data as Record<string, unknown>).status, 'revoked');

    const reused = await execute(cancelPermit, 'DELETE', '/api/sellers/me/verification', {});
    assert.equal(reused.statusCode, 404);

    const directMutation = await app.inject({ method: 'POST', url: '/api/sellers/me/verification', headers: { cookie }, payload: JSON.stringify(submitBody) });
    assert.equal(directMutation.statusCode, 404);
  } finally {
    await app.close();
    await db.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});
