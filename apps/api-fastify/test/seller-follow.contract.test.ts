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

test('Fastify seller follow mutation is permit-bound, idempotent and owner-safe', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'thuebot-fastify-seller-follow-'));
  const databaseFile = join(directory, 'dev.db');
  await copyFile(join(workspaceRoot, 'api', 'prisma', 'dev.db'), databaseFile);
  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseFile }) });
  await db.$connect();

  const followerId = `fastify-follow-${randomUUID()}`;
  const sellerId = `fastify-target-seller-${randomUUID()}`;
  const sellerSlug = `follow-target-${randomUUID().slice(0, 8)}`;
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const publicKeyJwk = publicKey.export({ format: 'jwk' }) as Record<string, string>;
  const fingerprint = hash(canonicalJson(publicKeyJwk));
  const app = await buildApp({ db, enforceTransport: false, logger: false });
  let sequence = 0;
  let accessToken = '';

  try {
    await db.user.create({
      data: {
        id: followerId,
        name: 'Fastify Follow Follower',
        email: `${followerId}@example.test`,
        avatar: '',
        role: 'seller',
        joinedDate: new Date().toISOString().slice(0, 10),
      },
    });
    await db.user.create({
      data: {
        id: sellerId,
        name: 'Fastify Follow Seller',
        email: `${sellerId}@example.test`,
        avatar: '',
        role: 'seller',
        joinedDate: new Date().toISOString().slice(0, 10),
      },
    });
    await db.sellerProfile.create({
      data: {
        id: `sp-${randomUUID()}`,
        userId: sellerId,
        shopName: 'Fastify Follow Seller',
        slug: sellerSlug,
        contact: '{}',
        updatedAt: new Date().toISOString(),
      },
    });
    const device = await db.deviceIdentity.create({
      data: {
        id: `dev-${randomUUID()}`,
        userId: followerId,
        publicKey: JSON.stringify(publicKeyJwk),
        fingerprint,
        createdAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
      },
    });
    const auth = new AuthService(db);
    const session = await auth.createSession(followerId, device.id);
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

    const unauthenticated = await app.inject({
      method: 'POST',
      url: '/api/i',
      headers: { 'content-type': 'application/json' },
      payload: '{}',
    });
    assert.equal(unauthenticated.statusCode, 401);

    const accessResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/access',
      headers: signedHeaders('/api/auth/access', {}),
      payload: '{}',
    });
    assert.equal(accessResponse.statusCode, 200);
    accessToken = String((jsonBody(accessResponse).data as Record<string, unknown>).token);

    const issuePermit = async (action: string, method: string, path: string) => {
      const body = {};
      const payload = { action, method, path, bodyHash: bodyDigest(body) };
      const response = await app.inject({
        method: 'POST',
        url: '/api/i',
        headers: signedHeaders('/api/i', payload),
        payload: JSON.stringify(payload),
      });
      assert.equal(response.statusCode, 200);
      return jsonBody(response).data as { permit: string; serverNonce: string };
    };

    const execute = async (permit: { permit: string; serverNonce: string }, method: 'PUT' | 'DELETE', path: string) => {
      const response = await app.inject({
        method,
        url: `/api/m/${permit.permit}`,
        headers: signedHeaders(`/api/m/${permit.permit}`, {}, permit.permit, permit.serverNonce, method),
        payload: '{}',
      });
      return { response, data: response.statusCode === 200 ? (jsonBody(response).data as Record<string, unknown>) : null };
    };

    const follow = await issuePermit('seller.follow', 'PUT', `/api/sellers/${sellerSlug}/follow`);
    const followed = await execute(follow, 'PUT', `/api/sellers/${sellerSlug}/follow`);
    assert.equal(followed.response.statusCode, 200);
    assert.equal(followed.data?.isFollowing, true);
    assert.equal(followed.data?.followerCount, 1);
    assert.equal(await db.sellerFollow.count({ where: { sellerId, followerId } }), 1);

    const duplicateFollow = await issuePermit('seller.follow', 'PUT', `/api/sellers/${sellerId}/follow`);
    const duplicated = await execute(duplicateFollow, 'PUT', `/api/sellers/${sellerId}/follow`);
    assert.equal(duplicated.response.statusCode, 200);
    assert.equal(duplicated.data?.isFollowing, true);
    assert.equal(duplicated.data?.followerCount, 1);
    assert.equal(await db.sellerFollow.count({ where: { sellerId, followerId } }), 1);

    const selfPermit = await issuePermit('seller.follow', 'PUT', `/api/sellers/${followerId}/follow`);
    const selfFollow = await execute(selfPermit, 'PUT', `/api/sellers/${followerId}/follow`);
    assert.equal(selfFollow.response.statusCode, 403);
    assert.equal(jsonBody(selfFollow.response).code, 'SELLER_FOLLOW_SELF');

    const unknownPermit = await issuePermit('seller.follow', 'PUT', '/api/sellers/missing-seller/follow');
    const unknown = await execute(unknownPermit, 'PUT', '/api/sellers/missing-seller/follow');
    assert.equal(unknown.response.statusCode, 404);
    assert.equal(jsonBody(unknown.response).code, 'SELLER_NOT_FOUND');

    const unfollow = await issuePermit('seller.unfollow', 'DELETE', `/api/sellers/${sellerId}/follow`);
    const unfollowed = await execute(unfollow, 'DELETE', `/api/sellers/${sellerId}/follow`);
    assert.equal(unfollowed.response.statusCode, 200);
    assert.equal(unfollowed.data?.isFollowing, false);
    assert.equal(unfollowed.data?.followerCount, 0);
    assert.equal(await db.sellerFollow.count({ where: { sellerId, followerId } }), 0);

    const reused = await execute(unfollow, 'DELETE', `/api/sellers/${sellerId}/follow`);
    assert.equal(reused.response.statusCode, 404);

    const directMutation = await app.inject({
      method: 'PUT',
      url: `/api/sellers/${sellerId}/follow`,
      headers: { 'content-type': 'application/json' },
      payload: '{}',
    });
    assert.equal(directMutation.statusCode, 404);
  } finally {
    await app.close();
    await db.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});
