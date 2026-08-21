import { strict as assert } from 'node:assert';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { generateKeyPairSync } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../../../api/prisma/generated/prisma/client.js';
import { buildApp } from '../src/app/build-app.js';
import { AUTH_COOKIE } from '../src/core/config.js';
import { AuthService } from '../src/core/auth.js';
import { canonicalJson, hash } from '../src/core/crypto.js';

const workspaceRoot = resolve(process.cwd(), '..', '..');

test('bootstrap rejects a device key already bound to another account', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'thuebot-fastify-device-'));
  const databaseFile = join(directory, 'dev.db');
  await copyFile(join(workspaceRoot, 'api', 'prisma', 'dev.db'), databaseFile);
  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseFile }) });
  await db.$connect();

  const userA = `device-owner-a-${Date.now()}`;
  const userB = `device-owner-b-${Date.now()}`;
  const publicKey = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey;
  const publicKeyJwk = publicKey.export({ format: 'jwk' }) as Record<string, string>;
  const fingerprint = hash(canonicalJson(publicKeyJwk));

  await db.user.createMany({
    data: [
      { id: userA, name: 'Device Owner A', email: `${userA}@example.test`, avatar: '', role: 'buyer', joinedDate: '2026-08-21' },
      { id: userB, name: 'Device Owner B', email: `${userB}@example.test`, avatar: '', role: 'buyer', joinedDate: '2026-08-21' },
    ],
  });
  await db.deviceIdentity.create({
    data: {
      id: `dev-${Date.now()}`,
      userId: userA,
      publicKey: JSON.stringify(publicKeyJwk),
      fingerprint,
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    },
  });

  const auth = new AuthService(db);
  const session = await auth.createSession(userB);
  const app = await buildApp({ db, enforceTransport: false, logger: false });

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/bootstrap',
      headers: {
        cookie: `${AUTH_COOKIE}=${session.token}`,
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ publicKeyJwk }),
    });

    assert.equal(response.statusCode, 403);
    const body = JSON.parse(response.body) as { success?: boolean; code?: string };
    assert.equal(body.success, false);
    assert.equal(body.code, 'DEVICE_KEY_BOUND_TO_OTHER_ACCOUNT');
  } finally {
    await app.close();
    await db.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});

test('bootstrap cannot replace a device key on an already-bound session with only the cookie', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'thuebot-fastify-device-replace-'));
  const databaseFile = join(directory, 'dev.db');
  await copyFile(join(workspaceRoot, 'api', 'prisma', 'dev.db'), databaseFile);
  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseFile }) });
  await db.$connect();

  const userId = `device-replace-${Date.now()}`;
  const first = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const second = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const firstJwk = first.publicKey.export({ format: 'jwk' }) as Record<string, string>;
  const secondJwk = second.publicKey.export({ format: 'jwk' }) as Record<string, string>;
  const firstFingerprint = hash(canonicalJson(firstJwk));
  await db.user.create({
    data: { id: userId, name: 'Bound Device User', email: `${userId}@example.test`, avatar: '', role: 'buyer', joinedDate: '2026-08-21' },
  });
  const device = await db.deviceIdentity.create({
    data: {
      id: `dev-${Date.now()}`,
      userId,
      publicKey: JSON.stringify(firstJwk),
      fingerprint: firstFingerprint,
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    },
  });
  const auth = new AuthService(db);
  const session = await auth.createSession(userId, device.id);
  const app = await buildApp({ db, enforceTransport: false, logger: false });

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/bootstrap',
      headers: { cookie: `${AUTH_COOKIE}=${session.token}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ publicKeyJwk: secondJwk }),
    });
    assert.equal(response.statusCode, 403);
    assert.equal((JSON.parse(response.body) as { code?: string }).code, 'DEVICE_REPLACEMENT_REQUIRES_STEP_UP');
  } finally {
    await app.close();
    await db.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});

test('transport recovery keeps bootstrap and onboarding usable without weakening access-token issuance', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'thuebot-fastify-device-recovery-'));
  const databaseFile = join(directory, 'dev.db');
  await copyFile(join(workspaceRoot, 'api', 'prisma', 'dev.db'), databaseFile);
  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseFile }) });
  await db.$connect();

  const userId = `device-recovery-${Date.now()}`;
  const publicKey = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey;
  const publicKeyJwk = publicKey.export({ format: 'jwk' }) as Record<string, string>;
  await db.user.create({
    data: {
      id: userId,
      name: 'Transport Recovery User',
      email: `${userId}@example.test`,
      avatar: '',
      role: 'buyer',
      onboardingCompleted: false,
      joinedDate: '2026-08-21',
    },
  });
  const auth = new AuthService(db);
  const session = await auth.createSession(userId);
  const cookie = `${AUTH_COOKIE}=${session.token}`;
  const app = await buildApp({ db, enforceTransport: true, logger: false });

  try {
    const bootstrap = await app.inject({
      method: 'POST',
      url: '/api/bootstrap',
      headers: { cookie, 'content-type': 'application/json' },
      payload: JSON.stringify({ publicKeyJwk }),
    });
    assert.equal(bootstrap.statusCode, 200);

    const onboarding = await app.inject({
      method: 'POST',
      url: '/api/auth/onboarding',
      headers: { cookie, 'content-type': 'application/json' },
      payload: JSON.stringify({ role: 'seller' }),
    });
    assert.equal(onboarding.statusCode, 200);
    assert.equal((JSON.parse(onboarding.body).data as { role?: string }).role, 'seller');

    const accessWithoutTransport = await app.inject({
      method: 'POST',
      url: '/api/auth/access',
      headers: { cookie, 'content-type': 'application/json' },
      payload: '{}',
    });
    assert.equal(accessWithoutTransport.statusCode, 426);
    assert.equal(JSON.parse(accessWithoutTransport.body).code, 'TRANSPORT_REQUIRED');
  } finally {
    await app.close();
    await db.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});
