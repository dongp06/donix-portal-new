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
import { canonicalJson, hash } from '../src/core/crypto.js';
import { dpopHeaders } from './security-test-helpers.js';

const workspaceRoot = resolve(process.cwd(), '..', '..');

function jsonBody(response: { body: string }): Record<string, unknown> {
  return JSON.parse(response.body) as Record<string, unknown>;
}

test('Fastify admin read schemas serialize seeded runtime data without internal fields', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'thuebot-fastify-admin-read-'));
  const databaseFile = join(directory, 'dev.db');
  await copyFile(join(workspaceRoot, 'api', 'prisma', 'dev.db'), databaseFile);
  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseFile }) });
  await db.$connect();

  const previousOwnerEmail = process.env.OWNER_EMAIL;
  const ownerId = `fastify-read-owner-${randomUUID()}`;
  const ownerEmail = `${ownerId}@example.test`;
  process.env.OWNER_EMAIL = ownerEmail;
  const timestamp = new Date().toISOString();
  const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const publicKeyJwk = keys.publicKey.export({ format: 'jwk' }) as Record<string, string>;
  const deviceId = `dev-${randomUUID()}`;
  const fingerprint = hash(canonicalJson(publicKeyJwk));
  const app = await buildApp({ db, enforceTransport: false, logger: false });

  try {
    await db.user.create({
      data: {
        id: ownerId,
        name: 'Fastify Read Owner',
        email: ownerEmail,
        avatar: '',
        role: 'buyer',
        joinedDate: timestamp.slice(0, 10),
      },
    });
    await db.deviceIdentity.create({ data: { id: deviceId, userId: ownerId, publicKey: JSON.stringify(publicKeyJwk), fingerprint, createdAt: timestamp, lastSeenAt: timestamp } });
    const auth = new AuthService(db);
    const session = await auth.createSession(ownerId, deviceId);
    let sequence = 0;
    const accessRequest = await app.inject({ method: 'POST', url: '/api/auth/access', headers: dpopHeaders({ privateKey: keys.privateKey, publicKeyJwk, cookieToken: session.token, deviceId, sessionId: session.session.id, sequence: ++sequence, path: '/api/auth/access', body: {} }), payload: '{}' });
    assert.equal(accessRequest.statusCode, 200, accessRequest.body);
    const accessToken = String((jsonBody(accessRequest).data as Record<string, unknown>).token);

    const routes = [
      '/api/admin/overview',
      '/api/admin/moderation?limit=20',
      `/api/admin/search?q=${encodeURIComponent(ownerId)}`,
      '/api/admin/cases',
      '/api/admin/sellers',
      '/api/admin/bots',
      '/api/admin/users',
      '/api/admin/staff',
      '/api/admin/comments',
      '/api/admin/analytics',
      '/api/admin/audit',
      '/api/admin/reviews',
      '/api/admin/verifications',
      '/api/admin/posts/stats',
      '/api/admin/posts/categories',
      '/api/admin/posts/tags',
      '/api/admin/posts/reports',
      '/api/admin/posts',
    ];

    const seller = await db.user.findFirst({ where: { role: 'seller' }, select: { id: true } });
    const bot = await db.bot.findFirst({ select: { id: true } });
    const adminCase = await db.adminCase.findFirst({ select: { id: true } });
    const post = await db.post.findFirst({ select: { id: true } });
    if (seller) routes.push(`/api/admin/sellers/${seller.id}`);
    if (bot) routes.push(`/api/admin/bots/${bot.id}`);
    if (adminCase) routes.push(`/api/admin/cases/${adminCase.id}`);
    if (post) {
      routes.push(`/api/admin/posts/${post.id}`);
      routes.push(`/api/admin/posts/${post.id}/versions`);
    }

    for (const url of routes) {
      const path = url.split('?', 1)[0]!;
      const headers = dpopHeaders({ privateKey: keys.privateKey, publicKeyJwk, cookieToken: session.token, deviceId, sessionId: session.session.id, sequence: ++sequence, path, body: undefined, accessToken, method: 'GET' });
      const response = await app.inject({ method: 'GET', url, headers });
      assert.equal(response.statusCode, 200, `${url}: ${response.body}`);
      const body = jsonBody(response);
      assert.equal(body.success, true, `${url}: ${response.body}`);
      assert.notEqual(body.data, undefined, `${url}: missing data`);
    }
  } finally {
    await app.close();
    await db.$disconnect();
    if (previousOwnerEmail === undefined) delete process.env.OWNER_EMAIL;
    else process.env.OWNER_EMAIL = previousOwnerEmail;
    await rm(directory, { recursive: true, force: true });
  }
});
