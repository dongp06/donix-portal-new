import { strict as assert } from 'node:assert';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { createCipheriv, createDecipheriv, createPublicKey, diffieHellman, generateKeyPairSync, hkdfSync, randomBytes, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../../../api/prisma/generated/prisma/client.js';
import { buildApp } from '../src/app/build-app.js';
import { AuthService } from '../src/core/auth.js';
import { assertProductionSecurityConfig, AUTH_COOKIE } from '../src/core/config.js';
import { bodyDigest, canonicalJson, hash } from '../src/core/crypto.js';
import { decodeCbor, decodeFrame, encodeCbor, encodeHeader, wireKidFromBase64Url } from '../src/core/thb4.js';
import { dpopHeaders } from './security-test-helpers.js';

const workspaceRoot = resolve(process.cwd(), '..', '..');

test('Fastify production startup fails closed when security secrets/config are missing', () => {
  const names = ['NODE_ENV', 'CORS_ORIGINS', 'SECURITY_IP_SALT', 'THB_TRANSPORT_PRIVATE_JWK', 'WEBAUTHN_RP_ID', 'WEBAUTHN_ORIGIN'];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    process.env.NODE_ENV = 'production';
    for (const name of names.slice(1)) delete process.env[name];
    assert.throws(() => assertProductionSecurityConfig(), /Production security configuration is missing/);
  } finally {
    for (const name of names) {
      const value = previous[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

function base64Url(value: Buffer): string {
  return value.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function transportKey(
  privateKey: ReturnType<typeof generateKeyPairSync>['privateKey'],
  serverPublicJwk: Record<string, unknown>,
  wireKid: Buffer,
  requestId: string,
  sequence: bigint,
  direction: 'c2s' | 's2c',
): Buffer {
  const shared = diffieHellman({
    privateKey,
    publicKey: createPublicKey({ key: serverPublicJwk, format: 'jwk' }),
  });
  const wire = wireKid.toString('hex');
  const root = Buffer.from(hkdfSync('sha256', shared, Buffer.from('thuebot-transport-v1', 'utf8'), Buffer.from(`thuebot-transport-root:${wire}`, 'utf8'), 32));
  const directional = Buffer.from(hkdfSync('sha256', root, Buffer.from('thuebot-transport-direction-v1', 'utf8'), Buffer.from(`thuebot-transport-direction:${direction}:${wire}`, 'utf8'), 32));
  return Buffer.from(hkdfSync('sha256', directional, Buffer.from('thuebot-transport-request-v1', 'utf8'), Buffer.from(`thuebot-transport-request:${requestId}:${sequence.toString()}`, 'utf8'), 32));
}

function transportFrame(
  privateKey: ReturnType<typeof generateKeyPairSync>['privateKey'],
  config: { wireKid: string; publicKeyJwk: Record<string, unknown> },
  kind: 'request' | 'response',
  requestId: string,
  sequence: bigint,
  value: unknown,
): Buffer {
  const wireKid = wireKidFromBase64Url(config.wireKid);
  const nonce = randomBytes(12);
  const plaintext = encodeCbor(value);
  const header = encodeHeader({ kind, flags: 1, wireKid, requestId, nonce, sequence, ciphertextLength: plaintext.length + 16 });
  const cipher = createCipheriv('aes-256-gcm', transportKey(privateKey, config.publicKeyJwk, wireKid, requestId, sequence, kind === 'request' ? 'c2s' : 's2c'), nonce);
  cipher.setAAD(header);
  return Buffer.concat([header, cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
}

function decryptTransportFrame(
  privateKey: ReturnType<typeof generateKeyPairSync>['privateKey'],
  config: { wireKid: string; publicKeyJwk: Record<string, unknown> },
  packet: Buffer,
): unknown {
  const frame = decodeFrame(packet);
  const ciphertext = frame.ciphertext;
  const decipher = createDecipheriv(
    'aes-256-gcm',
    transportKey(privateKey, config.publicKeyJwk, frame.wireKid, frame.requestId, frame.sequence, frame.kind === 'request' ? 'c2s' : 's2c'),
    frame.nonce,
  );
  decipher.setAAD(frame.header);
  decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16));
  const plaintext = Buffer.concat([decipher.update(ciphertext.subarray(0, ciphertext.length - 16)), decipher.final()]);
  return decodeCbor(plaintext);
}

test('THB/4 CBOR framing preserves UTF-8 strings and nested maps', () => {
  const value = {
    title: 'Thuê bot uy tín',
    nested: { message: 'Đăng ký thành công', list: ['bảo mật', '⭐'] },
  };
  assert.deepEqual(decodeCbor(encodeCbor(value)), value);
});

test('THB/4 rejects prototype-pollution map keys before exposing decoded payloads', () => {
  const hostile = JSON.parse('{"__proto__":{"polluted":true}}') as Record<string, unknown>;
  assert.throws(() => encodeCbor(hostile), /map key is reserved/);
  assert.throws(
    () => decodeCbor(Buffer.from([0xa1, 0x69, 0x5f, 0x5f, 0x70, 0x72, 0x6f, 0x74, 0x6f, 0x5f, 0x5f, 0xa1, 0x68, 0x70, 0x6f, 0x6c, 0x6c, 0x75, 0x74, 0x65, 0x64, 0xf5])),
    /map key is reserved/,
  );
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});

function jsonBody(response: { body: string }): Record<string, unknown> {
  return JSON.parse(response.body) as Record<string, unknown>;
}

test('Fastify control plane enforces transport, proof binding, renewal rotation and 404 cloaking', async () => {
  process.env.TB_SESSION_ROTATION_GRACE_MS = '1000';
  const directory = await mkdtemp(join(tmpdir(), 'thuebot-fastify-'));
  const databaseFile = join(directory, 'dev.db');
  await copyFile(join(workspaceRoot, 'api', 'prisma', 'dev.db'), databaseFile);
  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseFile }) });
  await db.$connect();

  const userId = `fastify-test-${randomUUID()}`;
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const publicKeyJwk = publicKey.export({ format: 'jwk' }) as Record<string, string>;
  const fingerprint = hash(canonicalJson(publicKeyJwk));
  await db.user.create({
    data: {
      id: userId,
      name: 'Fastify Contract Test',
      email: `${userId}@example.test`,
      avatar: '',
      role: 'buyer',
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
  const cookie = `${AUTH_COOKIE}=${session.token}`;
  let sequence = 0;

  const signedHeaders = (path: string, serverNonce = '') => {
    sequence += 1;
    return dpopHeaders({
      privateKey,
      publicKeyJwk,
      cookieToken: session.token,
      deviceId: device.id,
      sessionId: session.session.id,
      sequence,
      path,
      body: {},
      serverNonce,
    });
  };

  const app = await buildApp({ db, enforceTransport: false, logger: false });
  const secureRequest = async (path: string, serverNonce = '') => app.inject({ method: 'POST', url: path, headers: signedHeaders(path, serverNonce), payload: '{}' });

  try {
    const access = await secureRequest('/api/auth/access');
    assert.equal(access.statusCode, 200);
    const accessJson = jsonBody(access);
    assert.equal(accessJson.success, true);
    assert.match(String((accessJson.data as Record<string, unknown>).token), /^[A-Za-z0-9_-]{64,180}$/);
    assert.equal((accessJson.data as Record<string, unknown>).tokenType, 'DPoP');

    const challenge = await secureRequest('/api/auth/renew/challenge');
    assert.equal(challenge.statusCode, 200);
    const challengeValue = String(((jsonBody(challenge).data as Record<string, unknown>).challenge));
    assert.ok(challengeValue.length >= 24);

    const renewal = await secureRequest('/api/auth/renew', challengeValue);
    assert.equal(renewal.statusCode, 200);
    const renewalData = jsonBody(renewal).data as Record<string, unknown>;
    assert.equal(renewalData.rotated, true);
    assert.ok(String(renewal.headers['set-cookie'] ?? '').includes('x='));

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_150));
    const replay = await app.inject({ method: 'POST', url: '/api/auth/renew/challenge', headers: signedHeaders('/api/auth/renew/challenge'), payload: '{}' });
    assert.equal(replay.statusCode, 401);
    assert.equal((jsonBody(replay).code), 'SESSION_REUSE_DETECTED');

    const invalidShape = await app.inject({
      method: 'POST',
      url: '/api/bootstrap',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ publicKeyJwk, unexpected: true }),
    });
    assert.equal(invalidShape.statusCode, 400);
    assert.equal(jsonBody(invalidShape).code, 'VALIDATION_FAILED');

    // Chromium's Web Crypto JWK export may include the optional standard
    // metadata fields below. The boundary must allow those fields while still
    // rejecting arbitrary client-controlled properties.
    const browserLikeJwk = {
      ...publicKeyJwk,
      ext: true,
      alg: 'ES256',
      use: 'sig',
      key_ops: ['verify'],
    };
    const browserLikeBootstrap = await app.inject({
      method: 'POST',
      url: '/api/bootstrap',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ publicKeyJwk: browserLikeJwk }),
    });
    // No session is supplied in this probe; 401 proves the payload passed
    // schema validation and reached the authentication boundary.
    assert.equal(browserLikeBootstrap.statusCode, 401);
    assert.equal(jsonBody(browserLikeBootstrap).code, 'SESSION_INVALID');

    const expiredToken = `expired-${randomUUID()}-${randomUUID()}`;
    await db.actionPermit.create({
      data: {
        id: `expired-${randomUUID()}`,
        tokenHash: hash(expiredToken),
        userId,
        deviceId: device.id,
        action: 'bot.create',
        method: 'POST',
        path: '/api/bots',
        policyVersion: 'tsp-3',
        serverNonce: randomUUID(),
        issuedAt: new Date(Date.now() - 10_000).toISOString(),
        expiresAt: new Date(Date.now() - 1_000).toISOString(),
        metadata: '{}',
      },
    });
    const expired = await app.inject({ method: 'POST', url: `/api/m/${expiredToken}`, headers: { 'content-type': 'application/json' }, payload: '{}' });
    assert.equal(expired.statusCode, 404);

    const adminAccess = await app.inject({ method: 'GET', url: '/api/auth/admin-access' });
    assert.equal(adminAccess.statusCode, 404);
  } finally {
    await app.close();
    await db.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});

test('Fastify transport gate keeps public read probes clear-text while mutations stay protected', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'thuebot-fastify-transport-'));
  const databaseFile = join(directory, 'dev.db');
  await copyFile(join(workspaceRoot, 'api', 'prisma', 'dev.db'), databaseFile);
  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseFile }) });
  await db.$connect();
  const app = await buildApp({ db, logger: false });
  try {
    const health = await app.inject({ method: 'GET', url: '/api/health' });
    assert.equal(health.statusCode, 200);
    assert.equal(jsonBody(health).success, true);
    const blocked = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { 'content-type': 'application/json' }, payload: '{}' });
    assert.equal(blocked.statusCode, 426);
    assert.equal(blocked.headers['x-tb-transport-required'], 'v4');
    const config = await app.inject({ method: 'GET', url: '/api/transport/config' });
    assert.equal(config.statusCode, 200);
    assert.equal(jsonBody(config).success, true);

    const transportConfig = (app.transport.config() as { kid: string; wireKid: string; publicKeyJwk: Record<string, unknown> });
    const clientPair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const clientPublicJwk = clientPair.publicKey.export({ format: 'jwk' }) as Record<string, unknown>;
    const requestId = randomUUID();
    const sequence = BigInt(1);
    const frame = transportFrame(clientPair.privateKey, transportConfig, 'request', requestId, sequence, {});
    const encrypted = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        'content-type': 'application/x-thb',
        'x-tb-transport': '4',
        'x-tb-transport-kid': transportConfig.wireKid,
        'x-tb-transport-key': base64Url(Buffer.from(JSON.stringify(clientPublicJwk), 'utf8')),
        'x-tb-transport-request': requestId,
        'x-tb-transport-sequence': sequence.toString(),
        'x-tb-transport-mode': 'encrypted',
      },
      payload: frame,
    });
    const responsePacket = Buffer.from((encrypted as unknown as { rawPayload: Buffer }).rawPayload);
    const diagnostic = decryptTransportFrame(clientPair.privateKey, transportConfig, responsePacket);
    assert.equal(encrypted.statusCode, 200, JSON.stringify(diagnostic));
    assert.equal(encrypted.headers['x-tb-transport'], 'binary');
    assert.equal(encrypted.headers['content-type'], 'application/x-thb');
    assert.deepEqual(diagnostic, { success: true, data: true });
  } finally {
    await app.close();
    await db.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});

test('Fastify public-read routes expose bots, posts and sellers without internal fields', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'thuebot-fastify-public-'));
  const databaseFile = join(directory, 'dev.db');
  await copyFile(join(workspaceRoot, 'api', 'prisma', 'dev.db'), databaseFile);
  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseFile }) });
  await db.$connect();
  const app = await buildApp({ db, enforceTransport: false, logger: false });

  try {
    const bot = await db.bot.findFirst({
      where: { status: { in: ['online', 'maintenance', 'offline'] } },
      select: { id: true, slug: true },
    });
    const post = await db.post.findFirst({
      where: { status: 'published', deletedAt: null },
      select: { id: true, slug: true },
    });
    const seller = await db.user.findFirst({
      where: { role: 'seller' },
      select: { id: true },
    });
    if (!bot || !post || !seller) throw new Error('The public-read fixture is missing required seed data.');

    const categories = await app.inject({ method: 'GET', url: '/api/bots/categories' });
    assert.equal(categories.statusCode, 200);
    assert.equal(jsonBody(categories).success, true);
    assert.ok(Array.isArray(jsonBody(categories).data));

    const bots = await app.inject({ method: 'GET', url: '/api/bots?sort=rating' });
    assert.equal(bots.statusCode, 200);
    const botList = jsonBody(bots).data as Array<Record<string, unknown>>;
    assert.ok(botList.length > 0);
    assert.equal(botList[0]?.id !== undefined, true);
    assert.equal((botList[0]?.seller as Record<string, unknown>)?.id !== undefined, true);
    assert.equal((botList[0]?.pricing as Record<string, unknown>)?.monthlyPrice !== undefined, true);
    assert.equal('sellerVerificationState' in botList[0]!, false);

    const botDetail = await app.inject({ method: 'GET', url: `/api/bots/${encodeURIComponent(bot.slug)}` });
    assert.equal(botDetail.statusCode, 200);
    assert.equal((jsonBody(botDetail).data as Record<string, unknown>).id, bot.id);

    const reviews = await app.inject({ method: 'GET', url: `/api/bots/${encodeURIComponent(bot.id)}/reviews` });
    assert.equal(reviews.statusCode, 200);
    assert.ok(Array.isArray(jsonBody(reviews).data));

    const posts = await app.inject({ method: 'GET', url: '/api/posts?tab=featured' });
    assert.equal(posts.statusCode, 200);
    const postFeed = jsonBody(posts).data as { items: Array<Record<string, unknown>>; pagination: Record<string, unknown>; categories: unknown[]; trendingTags: unknown[] };
    assert.ok(postFeed.items.length > 0);
    assert.equal(typeof postFeed.items[0]?.title, 'string');
    assert.equal((postFeed.items[0]?.author as Record<string, unknown>)?.email, undefined);
    assert.equal(typeof postFeed.pagination.total, 'number');
    assert.ok(Array.isArray(postFeed.categories));
    assert.ok(Array.isArray(postFeed.trendingTags));

    const postBySlug = await app.inject({ method: 'GET', url: `/api/posts/slug/${encodeURIComponent(post.slug)}` });
    assert.equal(postBySlug.statusCode, 200);
    const postDetail = jsonBody(postBySlug).data as { post: Record<string, unknown>; related: unknown[] };
    assert.equal(postDetail.post.id, post.id);
    assert.ok(Array.isArray(postDetail.related));

    const postById = await app.inject({ method: 'GET', url: `/api/posts/${encodeURIComponent(post.id)}` });
    assert.equal(postById.statusCode, 200);
    assert.equal((jsonBody(postById).data as Record<string, unknown>).id, post.id);

    const comments = await app.inject({ method: 'GET', url: `/api/comments?targetType=post&targetId=${encodeURIComponent(post.id)}` });
    assert.equal(comments.statusCode, 200);
    assert.ok(Array.isArray(jsonBody(comments).data));

    const sellerProfile = await app.inject({ method: 'GET', url: `/api/sellers/${encodeURIComponent(seller.id)}` });
    assert.equal(sellerProfile.statusCode, 200);
    const sellerData = jsonBody(sellerProfile).data as Record<string, unknown>;
    assert.equal((sellerData.user as Record<string, unknown>)?.id, seller.id);
    assert.ok(Array.isArray(sellerData.bots));
    assert.ok(Array.isArray(sellerData.posts));

    const sellerFollow = await app.inject({ method: 'GET', url: `/api/sellers/${encodeURIComponent(seller.id)}/follow` });
    assert.equal(sellerFollow.statusCode, 200);
    assert.equal(typeof (jsonBody(sellerFollow).data as Record<string, unknown>).isFollowing, 'boolean');

    const lookup = await app.inject({ method: 'GET', url: '/api/sellers/lookup?query=Minh' });
    assert.equal(lookup.statusCode, 200);
    assert.ok(Array.isArray((jsonBody(lookup).data as Record<string, unknown>).matches));

    const invalidQuery = await app.inject({ method: 'GET', url: '/api/bots?unexpected=true' });
    assert.equal(invalidQuery.statusCode, 400);
    assert.equal(jsonBody(invalidQuery).code, 'VALIDATION_FAILED');
  } finally {
    await app.close();
    await db.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});

test('Fastify auth routes keep Google input bounded and complete onboarding from the session', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'thuebot-fastify-auth-'));
  const databaseFile = join(directory, 'dev.db');
  await copyFile(join(workspaceRoot, 'api', 'prisma', 'dev.db'), databaseFile);
  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseFile }) });
  await db.$connect();
  const app = await buildApp({ db, enforceTransport: false, logger: false });

  const userId = `fastify-auth-${randomUUID()}`;
  try {
    const missingGoogleToken = await app.inject({
      method: 'POST',
      url: '/api/auth/google',
      headers: { 'content-type': 'application/json' },
      payload: '{}',
    });
    assert.equal(missingGoogleToken.statusCode, 400);
    assert.equal(jsonBody(missingGoogleToken).code, 'GOOGLE_TOKEN_REQUIRED');

    await db.user.create({
      data: {
        id: userId,
        name: 'Fastify Onboarding Test',
        email: `${userId}@example.test`,
        avatar: '',
        role: 'buyer',
        onboardingCompleted: false,
        joinedDate: new Date().toISOString().slice(0, 10),
      },
    });
    const auth = new AuthService(db);
    const session = await auth.createSession(userId);
    const cookie = `${AUTH_COOKIE}=${session.token}`;

    const onboarding = await app.inject({
      method: 'POST',
      url: '/api/auth/onboarding',
      headers: { cookie, 'content-type': 'application/json' },
      payload: JSON.stringify({ role: 'seller' }),
    });
    assert.equal(onboarding.statusCode, 200);
    const onboardingUser = jsonBody(onboarding).data as Record<string, unknown>;
    assert.equal(onboardingUser.id, userId);
    assert.equal(onboardingUser.role, 'seller');
    assert.equal(onboardingUser.onboardingCompleted, true);
    assert.equal(onboardingUser.isNewUser, false);

    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    assert.equal(me.statusCode, 200);
    assert.equal((jsonBody(me).data as Record<string, unknown>).role, 'seller');

    const becomeSeller = await app.inject({
      method: 'POST',
      url: '/api/auth/become-seller',
      headers: { cookie },
    });
    assert.equal(becomeSeller.statusCode, 200);
    assert.equal((jsonBody(becomeSeller).data as Record<string, unknown>).role, 'seller');

    const unauthenticated = await app.inject({
      method: 'POST',
      url: '/api/auth/onboarding',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ role: 'buyer' }),
    });
    assert.equal(unauthenticated.statusCode, 401);
    assert.equal(jsonBody(unauthenticated).code, 'SESSION_INVALID');
  } finally {
    await app.close();
    await db.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});

test('Fastify capability gateway dispatches migrated reactions and reviews only through opaque permits', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'thuebot-fastify-mutation-'));
  const databaseFile = join(directory, 'dev.db');
  await copyFile(join(workspaceRoot, 'api', 'prisma', 'dev.db'), databaseFile);
  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseFile }) });
  await db.$connect();
  const userId = `fastify-mutation-${randomUUID()}`;
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const publicKeyJwk = publicKey.export({ format: 'jwk' }) as Record<string, string>;
  const fingerprint = hash(canonicalJson(publicKeyJwk));
  const app = await buildApp({ db, enforceTransport: false, logger: false });
  let sequence = 0;
  let accessToken = '';

  try {
    await db.user.create({
      data: {
        id: userId,
        name: 'Fastify Mutation Test',
        email: `${userId}@example.test`,
        avatar: '',
        role: 'seller',
        contact: JSON.stringify({ telegram: '@fastify-test' }),
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
    const post = await db.post.findFirst({ where: { status: 'published', deletedAt: null }, select: { id: true } });
    const bot = await db.bot.findFirst({ where: { status: { in: ['online', 'maintenance', 'offline'] } }, select: { id: true } });
    if (!post || !bot) throw new Error('The mutation fixture is missing a public post or bot.');

    const signedHeaders = (path: string, body: unknown, permit = '', serverNonce = '', method = 'POST') => {
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

    const access = await app.inject({
      method: 'POST',
      url: '/api/auth/access',
      headers: signedHeaders('/api/auth/access', {}),
      payload: '{}',
    });
    assert.equal(access.statusCode, 200);
    accessToken = String((jsonBody(access).data as Record<string, unknown>).token);

    const issuePermit = async (action: string, method: string, path: string, body: unknown) => {
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

    const profileBody = { bio: 'Fastify mutation tester', contact: { telegram: '@fastify-updated' } };
    const profilePermit = await issuePermit('profile.update', 'PATCH', '/api/users/me', profileBody);
    const profileResponse = await app.inject({
      method: 'PATCH',
      url: `/api/m/${profilePermit.permit}`,
      headers: signedHeaders(`/api/m/${profilePermit.permit}`, profileBody, profilePermit.permit, profilePermit.serverNonce, 'PATCH'),
      payload: JSON.stringify(profileBody),
    });
    assert.equal(profileResponse.statusCode, 200);
    assert.equal((jsonBody(profileResponse).data as Record<string, unknown>).bio, 'Fastify mutation tester');

    const reactionBody = { emoji: '\u{1F44D}' };
    const reactionPermit = await issuePermit('post.react', 'POST', `/api/posts/${post.id}/reactions`, reactionBody);
    const reaction = await app.inject({
      method: 'POST',
      url: `/api/m/${reactionPermit.permit}`,
      headers: signedHeaders(`/api/m/${reactionPermit.permit}`, reactionBody, reactionPermit.permit, reactionPermit.serverNonce),
      payload: JSON.stringify(reactionBody),
    });
    assert.equal(reaction.statusCode, 200);
    assert.ok(Array.isArray((jsonBody(reaction).data)));
    assert.equal(await db.reaction.count({ where: { targetType: 'post', targetId: post.id, userId } }), 1);

    const replay = await app.inject({
      method: 'POST',
      url: `/api/m/${reactionPermit.permit}`,
      headers: signedHeaders(`/api/m/${reactionPermit.permit}`, reactionBody, reactionPermit.permit, reactionPermit.serverNonce),
      payload: JSON.stringify(reactionBody),
    });
    assert.equal(replay.statusCode, 404);

    const reviewBody = { rating: 5, comment: 'Great bot' };
    const reviewPermit = await issuePermit('review.create', 'POST', `/api/bots/${bot.id}/reviews`, reviewBody);
    const review = await app.inject({
      method: 'POST',
      url: `/api/m/${reviewPermit.permit}`,
      headers: signedHeaders(`/api/m/${reviewPermit.permit}`, reviewBody, reviewPermit.permit, reviewPermit.serverNonce),
      payload: JSON.stringify(reviewBody),
    });
    assert.equal(review.statusCode, 200);
    assert.equal((jsonBody(review).data as Record<string, unknown>).rating, 5);
    assert.equal(await db.botReview.count({ where: { botId: bot.id, userId } }), 1);

    const createBotBody = {
      title: 'Fastify Contract Bot',
      tagline: 'A bot created through the capability gateway',
      description: 'This listing is created by the Fastify migration contract test.',
      coverImage: 'https://example.test/fastify-cover.png',
      gallery: ['https://example.test/fastify-1.png', 'https://example.test/fastify-2.png'],
      features: ['Fastify', 'Capability gateway', 'Contract tested'],
      pricing: { monthlyPrice: 125000 },
      status: 'pending',
      categorySlug: 'development',
      categoryName: 'Development',
      tags: ['fastify'],
      targetAudience: ['developers'],
    };
    const createBotPermit = await issuePermit('bot.create', 'POST', '/api/bots', createBotBody);
    const createdBotResponse = await app.inject({
      method: 'POST',
      url: `/api/m/${createBotPermit.permit}`,
      headers: signedHeaders(`/api/m/${createBotPermit.permit}`, createBotBody, createBotPermit.permit, createBotPermit.serverNonce),
      payload: JSON.stringify(createBotBody),
    });
    assert.equal(createdBotResponse.statusCode, 200);
    const createdBot = jsonBody(createdBotResponse).data as Record<string, unknown>;
    assert.equal(createdBot.status, 'pending');
    assert.equal(await db.bot.count({ where: { title: 'Fastify Contract Bot', sellerId: userId } }), 1);

    const updateBotBody = { title: 'Fastify Contract Bot Updated' };
    const updateBotPermit = await issuePermit('bot.update', 'PUT', `/api/bots/${String(createdBot.id)}`, updateBotBody);
    const updatedBotResponse = await app.inject({
      method: 'PUT',
      url: `/api/m/${updateBotPermit.permit}`,
      headers: signedHeaders(`/api/m/${updateBotPermit.permit}`, updateBotBody, updateBotPermit.permit, updateBotPermit.serverNonce, 'PUT'),
      payload: JSON.stringify(updateBotBody),
    });
    assert.equal(updatedBotResponse.statusCode, 200);
    assert.equal((jsonBody(updatedBotResponse).data as Record<string, unknown>).title, 'Fastify Contract Bot Updated');

    const createPostBody = {
      title: 'Fastify Capability Post',
      content: 'This post is created and updated through the opaque capability gateway contract.',
      type: 'share',
      category: 'development',
      tags: ['fastify', 'security'],
      status: 'published',
    };
    const createPostPermit = await issuePermit('post.create', 'POST', '/api/posts', createPostBody);
    const createdPostResponse = await app.inject({
      method: 'POST',
      url: `/api/m/${createPostPermit.permit}`,
      headers: signedHeaders(`/api/m/${createPostPermit.permit}`, createPostBody, createPostPermit.permit, createPostPermit.serverNonce),
      payload: JSON.stringify(createPostBody),
    });
    assert.equal(createdPostResponse.statusCode, 200);
    const createdPost = jsonBody(createdPostResponse).data as Record<string, unknown>;
    assert.equal(createdPost.title, 'Fastify Capability Post');

    const updatePostBody = { title: 'Fastify Capability Post Updated' };
    const updatePostPermit = await issuePermit('post.update', 'PATCH', `/api/posts/${String(createdPost.id)}`, updatePostBody);
    const updatedPostResponse = await app.inject({
      method: 'PATCH',
      url: `/api/m/${updatePostPermit.permit}`,
      headers: signedHeaders(`/api/m/${updatePostPermit.permit}`, updatePostBody, updatePostPermit.permit, updatePostPermit.serverNonce, 'PATCH'),
      payload: JSON.stringify(updatePostBody),
    });
    assert.equal(updatedPostResponse.statusCode, 200);
    assert.equal((jsonBody(updatedPostResponse).data as Record<string, unknown>).title, 'Fastify Capability Post Updated');

    const deletePostPermit = await issuePermit('post.delete', 'DELETE', `/api/posts/${String(createdPost.id)}`, {});
    const deletedPostResponse = await app.inject({
      method: 'DELETE',
      url: `/api/m/${deletePostPermit.permit}`,
      headers: signedHeaders(`/api/m/${deletePostPermit.permit}`, {}, deletePostPermit.permit, deletePostPermit.serverNonce, 'DELETE'),
      payload: '{}',
    });
    assert.equal(deletedPostResponse.statusCode, 200);
    assert.equal((await db.post.findUnique({ where: { id: String(createdPost.id) }, select: { status: true } }))?.status, 'removed');

    const fixedMutation = await app.inject({
      method: 'POST',
      url: `/api/posts/${post.id}/reactions`,
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(reactionBody),
    });
    assert.equal(fixedMutation.statusCode, 404);
  } finally {
    await app.close();
    await db.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});
