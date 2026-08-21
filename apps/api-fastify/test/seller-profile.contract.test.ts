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

test('Fastify seller profile keeps session reads and permit-bound writes validated', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'thuebot-fastify-seller-profile-'));
  const databaseFile = join(directory, 'dev.db');
  await copyFile(join(workspaceRoot, 'api', 'prisma', 'dev.db'), databaseFile);
  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseFile }) });
  await db.$connect();

  const sellerId = `fastify-profile-seller-${randomUUID()}`;
  const buyerId = `fastify-profile-buyer-${randomUUID()}`;
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const publicKeyJwk = publicKey.export({ format: 'jwk' }) as Record<string, string>;
  const fingerprint = hash(canonicalJson(publicKeyJwk));
  const app = await buildApp({ db, enforceTransport: false, logger: false });
  let sequence = 0;
  let accessToken = '';

  try {
    await db.user.create({
      data: {
        id: sellerId,
        name: 'Fastify Profile Seller',
        email: `${sellerId}@example.test`,
        avatar: '',
        role: 'seller',
        contact: JSON.stringify({ telegram: '@old-profile' }),
        joinedDate: new Date().toISOString().slice(0, 10),
      },
    });
    await db.user.create({
      data: {
        id: buyerId,
        name: 'Fastify Profile Buyer',
        email: `${buyerId}@example.test`,
        avatar: '',
        role: 'buyer',
        joinedDate: new Date().toISOString().slice(0, 10),
      },
    });
    const device = await db.deviceIdentity.create({
      data: {
        id: `dev-${randomUUID()}`,
        userId: sellerId,
        publicKey: JSON.stringify(publicKeyJwk),
        fingerprint,
        createdAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
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

    const initial = await app.inject({
      method: 'GET',
      url: '/api/sellers/me/profile',
      headers: { cookie },
    });
    assert.equal(initial.statusCode, 200);
    const initialProfile = jsonBody(initial).data as Record<string, unknown>;
    assert.equal(initialProfile.shopName, 'Fastify Profile Seller');
    assert.equal((initialProfile.contact as Record<string, unknown>).telegram, '@old-profile');

    const publicProfileResponse = await app.inject({
      method: 'GET',
      url: `/api/sellers/${sellerId}`,
    });
    assert.equal(publicProfileResponse.statusCode, 200);
    const publicProfile = jsonBody(publicProfileResponse).data as Record<string, unknown>;
    assert.ok(Array.isArray(publicProfile.trustEvents));
    assert.ok(Array.isArray(publicProfile.reviews));
    assert.equal((publicProfile.reviewSummary as Record<string, unknown>).total, 0);
    assert.equal((publicProfile.user as Record<string, unknown>).basicVerifiedTotal, 5);
    assert.ok((publicProfile.user as Record<string, unknown>).trustScore !== undefined);

    const lookupResponse = await app.inject({
      method: 'GET',
      url: '/api/sellers/lookup?query=Fastify%20Profile%20Seller',
    });
    assert.equal(lookupResponse.statusCode, 200);
    const lookup = jsonBody(lookupResponse).data as { matches: Array<Record<string, unknown>> };
    assert.equal(lookup.matches.length, 1);
    assert.equal((lookup.matches[0]?.verificationChecks as unknown[]).length, 5);
    assert.ok(['clear', 'limited', 'caution'].includes(String(lookup.matches[0]?.riskStatus)));
    assert.equal(typeof lookup.matches[0]?.riskMessage, 'string');
    assert.equal(typeof lookup.matches[0]?.reviewCount, 'number');
    assert.equal(typeof lookup.matches[0]?.botCount, 'number');

    const accessResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/access',
      headers: signedHeaders('/api/auth/access', {}),
      payload: '{}',
    });
    assert.equal(accessResponse.statusCode, 200);
    accessToken = String((jsonBody(accessResponse).data as Record<string, unknown>).token);

    const body = {
      shopName: 'Fastify Profile Updated',
      bio: 'Profile maintained by the Fastify seller module.',
      contact: { telegram: '@new-profile', website: 'https://example.test/seller' },
    };
    const permitBody = { action: 'profile.update', method: 'PUT', path: '/api/sellers/me/profile', bodyHash: bodyDigest(body) };
    const permitResponse = await app.inject({
      method: 'POST',
      url: '/api/i',
      headers: signedHeaders('/api/i', permitBody),
      payload: JSON.stringify(permitBody),
    });
    assert.equal(permitResponse.statusCode, 200);
    const permit = jsonBody(permitResponse).data as { permit: string; serverNonce: string };
    const updated = await app.inject({
      method: 'PUT',
      url: `/api/m/${permit.permit}`,
      headers: signedHeaders(`/api/m/${permit.permit}`, body, permit.permit, permit.serverNonce, 'PUT'),
      payload: JSON.stringify(body),
    });
    assert.equal(updated.statusCode, 200);
    const updatedProfile = jsonBody(updated).data as Record<string, unknown>;
    assert.equal(updatedProfile.shopName, body.shopName);
    assert.equal(updatedProfile.bio, body.bio);
    assert.equal((updatedProfile.contact as Record<string, unknown>).telegram, '@new-profile');
    assert.equal((updatedProfile.contact as Record<string, unknown>).website, 'https://example.test/seller');
    assert.equal(updatedProfile.profileCompleteness, 75);

    const invalidBody = { shopName: 'Still valid', unexpected: true };
    const invalidIntent = { action: 'profile.update', method: 'PUT', path: '/api/sellers/me/profile', bodyHash: bodyDigest(invalidBody) };
    const invalidPermitResponse = await app.inject({
      method: 'POST',
      url: '/api/i',
      headers: signedHeaders('/api/i', invalidIntent),
      payload: JSON.stringify(invalidIntent),
    });
    assert.equal(invalidPermitResponse.statusCode, 200);
    const invalidPermit = jsonBody(invalidPermitResponse).data as { permit: string; serverNonce: string };
    const invalid = await app.inject({
      method: 'PUT',
      url: `/api/m/${invalidPermit.permit}`,
      headers: signedHeaders(`/api/m/${invalidPermit.permit}`, invalidBody, invalidPermit.permit, invalidPermit.serverNonce, 'PUT'),
      payload: JSON.stringify(invalidBody),
    });
    assert.equal(invalid.statusCode, 400);
    assert.equal(jsonBody(invalid).code, 'BODY_FIELD_UNEXPECTED');

    const buyerSession = await auth.createSession(buyerId);
    const buyerRead = await app.inject({
      method: 'GET',
      url: '/api/sellers/me/profile',
      headers: { cookie: `${AUTH_COOKIE}=${buyerSession.token}` },
    });
    assert.equal(buyerRead.statusCode, 403);
    assert.equal(jsonBody(buyerRead).code, 'SELLER_REQUIRED');

    const unauthenticated = await app.inject({ method: 'GET', url: '/api/sellers/me/profile' });
    assert.equal(unauthenticated.statusCode, 401);
  } finally {
    await app.close();
    await db.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});
