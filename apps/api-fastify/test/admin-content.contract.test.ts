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

test('Fastify admin content parity keeps reads staff-only and mutations permit-bound', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'thuebot-fastify-admin-content-'));
  const databaseFile = join(directory, 'dev.db');
  await copyFile(join(workspaceRoot, 'api', 'prisma', 'dev.db'), databaseFile);
  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseFile }) });
  await db.$connect();
  const previousOwnerEmail = process.env.OWNER_EMAIL;
  const ownerId = `fastify-content-owner-${randomUUID()}`;
  const ownerEmail = `${ownerId}@example.test`;
  process.env.OWNER_EMAIL = ownerEmail;
  const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const publicKeyJwk = keys.publicKey.export({ format: 'jwk' }) as Record<string, string>;
  const fingerprint = hash(canonicalJson(publicKeyJwk));
  const timestamp = new Date().toISOString();
  const deviceId = `dev-${randomUUID()}`;
  let sequence = 0;
  const app = await buildApp({ db, enforceTransport: false, logger: false });
  await db.user.create({ data: { id: ownerId, name: 'Fastify Content Owner', email: ownerEmail, avatar: '', role: 'buyer', joinedDate: timestamp.slice(0, 10) } });
  await db.deviceIdentity.create({ data: { id: deviceId, userId: ownerId, publicKey: JSON.stringify(publicKeyJwk), fingerprint, createdAt: timestamp, lastSeenAt: timestamp } });
  const auth = new AuthService(db);
  const session = await auth.createSession(ownerId, deviceId);
  const cookie = `${AUTH_COOKIE}=${session.token}`;
  const signedHeaders = (path: string, body: unknown, accessToken = '', options: { method?: string; permit?: string; serverNonce?: string } = {}) => {
    sequence += 1;
    return dpopHeaders({
      privateKey: keys.privateKey,
      publicKeyJwk,
      cookieToken: session.token,
      deviceId,
      sessionId: session.session.id,
      sequence,
      path,
      body,
      accessToken,
      method: options.method,
      permit: options.permit,
      serverNonce: options.serverNonce,
    });
  };

  try {
    const accessRequest = await app.inject({ method: 'POST', url: '/api/auth/access', headers: signedHeaders('/api/auth/access', {}, ''), payload: '{}' });
    assert.equal(accessRequest.statusCode, 200, accessRequest.body);
    const accessToken = String((jsonBody(accessRequest).data as Record<string, unknown>).token);
    const readHeaders = (path: string) => signedHeaders(path, undefined, accessToken, { method: 'GET' });
    const guest = await app.inject({ method: 'GET', url: '/api/admin/posts/stats' });
    assert.equal(guest.statusCode, 404);
    const stats = await app.inject({ method: 'GET', url: '/api/admin/posts/stats', headers: readHeaders('/api/admin/posts/stats') });
    assert.equal(stats.statusCode, 200);
    assert.equal(typeof (jsonBody(stats).data as Record<string, unknown>).all, 'number');
    const list = await app.inject({ method: 'GET', url: '/api/admin/posts?status=published', headers: readHeaders('/api/admin/posts') });
    assert.equal(list.statusCode, 200);
    const posts = jsonBody(list).data as Array<Record<string, unknown>>;
    assert.ok(posts.length > 0);
    const postId = String(posts[0]!.id);
    const detail = await app.inject({ method: 'GET', url: `/api/admin/posts/${postId}`, headers: readHeaders(`/api/admin/posts/${postId}`) });
    assert.equal(detail.statusCode, 200);
    const versions = await app.inject({ method: 'GET', url: `/api/admin/posts/${postId}/versions`, headers: readHeaders(`/api/admin/posts/${postId}/versions`) });
    assert.equal(versions.statusCode, 200);
    const reports = await app.inject({ method: 'GET', url: '/api/admin/posts/reports?status=open', headers: readHeaders('/api/admin/posts/reports') });
    assert.equal(reports.statusCode, 200);

    const adminCreateBody = {
      title: `Scheduled admin post ${randomUUID()}`,
      excerpt: 'Created through the admin capability gateway.',
      content: 'This scheduled admin post exercises the Fastify admin creation route through an opaque permit.',
      type: 'announcement',
      category: 'guides',
      tags: ['fastify', 'admin'],
      status: 'scheduled',
      scheduledAt: new Date(Date.now() + 60 * 60 * 1_000).toISOString(),
      official: false,
      isPinned: false,
      isFeatured: false,
      commentsLocked: false,
    };
    const createIntent = { action: 'posts.moderate', method: 'POST', path: '/api/admin/posts', bodyHash: bodyDigest(adminCreateBody) };
    const createPermitResponse = await app.inject({ method: 'POST', url: '/api/i', headers: signedHeaders('/api/i', createIntent, accessToken), payload: JSON.stringify(createIntent) });
    assert.equal(createPermitResponse.statusCode, 200, createPermitResponse.body);
    const createPermit = jsonBody(createPermitResponse).data as Record<string, unknown>;
    const createEndpoint = String(createPermit.endpoint);
    const created = await app.inject({
      method: 'POST',
      url: createEndpoint,
      headers: signedHeaders(createEndpoint, adminCreateBody, accessToken, { method: 'POST', permit: createEndpoint.split('/').pop(), serverNonce: String(createPermit.serverNonce) }),
      payload: JSON.stringify(adminCreateBody),
    });
    assert.equal(created.statusCode, 200, created.body);
    const createdPost = jsonBody(created).data as { id: string };
    const createdRow = await db.post.findUnique({ where: { id: createdPost.id }, select: { status: true, scheduledAt: true } });
    assert.equal(createdRow?.status, 'scheduled');
    assert.ok(createdRow?.scheduledAt);

    const updateBody = { locked: true };
    const intent = { action: 'posts.moderate', method: 'PATCH', path: `/api/admin/posts/${postId}/comments`, bodyHash: bodyDigest(updateBody) };
    const permitRequest = await app.inject({ method: 'POST', url: '/api/i', headers: signedHeaders('/api/i', intent, accessToken), payload: JSON.stringify(intent) });
    assert.equal(permitRequest.statusCode, 200);
    const permit = jsonBody(permitRequest).data as Record<string, unknown>;
    const endpoint = String(permit.endpoint);
    const changed = await app.inject({ method: 'PATCH', url: endpoint, headers: signedHeaders(endpoint, updateBody, accessToken, { method: 'PATCH', permit: endpoint.split('/').pop(), serverNonce: String(permit.serverNonce) }), payload: JSON.stringify(updateBody) });
    assert.equal(changed.statusCode, 200);
    assert.equal((jsonBody(changed).data as Record<string, unknown>).commentsLocked, true);
    const replay = await app.inject({ method: 'PATCH', url: endpoint, headers: signedHeaders(endpoint, updateBody, accessToken, { method: 'PATCH', permit: endpoint.split('/').pop(), serverNonce: String(permit.serverNonce) }), payload: JSON.stringify(updateBody) });
    assert.equal(replay.statusCode, 404);
    const direct = await app.inject({ method: 'PATCH', url: `/api/admin/posts/${postId}/comments`, headers: { cookie, 'content-type': 'application/json' }, payload: JSON.stringify({ locked: false }) });
    assert.equal(direct.statusCode, 404);
  } finally {
    await app.close();
    await db.$disconnect();
    if (previousOwnerEmail === undefined) delete process.env.OWNER_EMAIL;
    else process.env.OWNER_EMAIL = previousOwnerEmail;
    await rm(directory, { recursive: true, force: true });
  }
});
