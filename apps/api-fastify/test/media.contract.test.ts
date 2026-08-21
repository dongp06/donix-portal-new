import { strict as assert } from 'node:assert';
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { createHash, generateKeyPairSync, randomUUID } from 'node:crypto';
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
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

function jsonBody(response: { body: string }): Record<string, unknown> {
  return JSON.parse(response.body) as Record<string, unknown>;
}

function multipartPayload(): { boundary: string; body: Buffer; parts: Array<Record<string, unknown>> } {
  const boundary = `----thuebot-${randomUUID()}`;
  const parts = [
    { name: 'file', index: 0, kind: 'file', filename: 'pixel.png', mimeType: 'image/png', size: ONE_PIXEL_PNG.length, sha256: requireHash(ONE_PIXEL_PNG) },
    { name: 'usage', index: 0, kind: 'field', value: 'post_inline' },
  ];
  // The browser signs this sorted canonical representation before sending FormData.
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="usage"\r\n\r\npost_inline\r\n`, 'utf8'),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="pixel.png"\r\nContent-Type: image/png\r\n\r\n`, 'utf8'),
    ONE_PIXEL_PNG,
    Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'),
  ]);
  return { boundary, body, parts: parts.sort((left, right) => {
    const leftName = String(left.name);
    const rightName = String(right.name);
    return (leftName < rightName ? -1 : leftName > rightName ? 1 : 0) || Number(left.index) - Number(right.index);
  }) };
}

function requireHash(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

test('Fastify media uploads use multipart permits and keep draft media private', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'thuebot-fastify-media-'));
  const databaseFile = join(directory, 'dev.db');
  const mediaDirectory = join(directory, 'media');
  const previousMediaDir = process.env.MEDIA_DIR;
  await copyFile(join(workspaceRoot, 'api', 'prisma', 'dev.db'), databaseFile);
  process.env.MEDIA_DIR = mediaDirectory;
  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseFile }) });
  await db.$connect();

  const userId = `fastify-media-${randomUUID()}`;
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const publicKeyJwk = publicKey.export({ format: 'jwk' }) as Record<string, string>;
  const fingerprint = hash(canonicalJson(publicKeyJwk));
  await db.user.create({
    data: {
      id: userId,
      name: 'Fastify Media Tester',
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
  let accessToken = '';
  let sequence = 0;

  const signedHeaders = (path: string, value: unknown, permit = '', serverNonce = '', method = 'POST') => {
    sequence += 1;
    return dpopHeaders({
      privateKey,
      publicKeyJwk,
      cookieToken: session.token,
      deviceId: device.id,
      sessionId: session.session.id,
      sequence,
      path,
      body: value,
      accessToken,
      permit,
      serverNonce,
      method,
      contentType: value === undefined ? null : undefined,
    });
  };

  const app = await buildApp({ db, enforceTransport: false, logger: false });
  try {
    const access = await app.inject({
      method: 'POST',
      url: '/api/auth/access',
      headers: { ...signedHeaders('/api/auth/access', {}), 'content-type': 'application/json' },
      payload: '{}',
    });
    assert.equal(access.statusCode, 200);
    accessToken = String((jsonBody(access).data as Record<string, unknown>).token);

    const upload = multipartPayload();
    const uploadPath = '/api/uploads/images';
    const uploadBodyHash = bodyDigest(upload.parts);
    const permitBody = { action: 'media.upload', method: 'POST', path: uploadPath, bodyHash: uploadBodyHash };
    const permitResponse = await app.inject({
      method: 'POST',
      url: '/api/i',
      headers: { ...signedHeaders('/api/i', permitBody), 'content-type': 'application/json' },
      payload: JSON.stringify(permitBody),
    });
    assert.equal(permitResponse.statusCode, 200);
    const permitData = jsonBody(permitResponse).data as { permit: string; serverNonce: string };

    const uploaded = await app.inject({
      method: 'POST',
      url: `/api/m/${permitData.permit}`,
      headers: {
        ...signedHeaders(`/api/m/${permitData.permit}`, upload.parts, permitData.permit, permitData.serverNonce),
        'content-type': `multipart/form-data; boundary=${upload.boundary}`,
      },
      payload: upload.body,
    });
    assert.equal(uploaded.statusCode, 200);
    const uploadData = jsonBody(uploaded).data as { attachmentId: string; mimeType: string; sha256: string };
    assert.equal(uploadData.mimeType, 'image/png');
    assert.equal(uploadData.sha256, requireHash(ONE_PIXEL_PNG));
    const attachmentId = uploadData.attachmentId;
    const row = await db.attachment.findUnique({ where: { id: attachmentId } });
    assert.equal(row?.status, 'draft');
    assert.equal(row?.ownerUserId, userId);
    assert.deepEqual(await readFile(join(mediaDirectory, row!.storageKey)), ONE_PIXEL_PNG);

    const guest = await app.inject({ method: 'GET', url: `/api/media/${attachmentId}` });
    assert.equal(guest.statusCode, 404);
    const owner = await app.inject({ method: 'GET', url: `/api/media/${attachmentId}`, headers: { cookie } });
    assert.equal(owner.statusCode, 200);
    assert.equal(owner.headers['content-type'], 'image/png');
    assert.deepEqual(owner.rawPayload, ONE_PIXEL_PNG);

    const metadata = { altText: 'One pixel', caption: 'Media smoke test' };
    const metadataPermitBody = { action: 'media.update', method: 'PATCH', path: `/api/uploads/${attachmentId}`, bodyHash: bodyDigest(metadata) };
    const metadataPermitResponse = await app.inject({
      method: 'POST',
      url: '/api/i',
      headers: { ...signedHeaders('/api/i', metadataPermitBody), 'content-type': 'application/json' },
      payload: JSON.stringify(metadataPermitBody),
    });
    assert.equal(metadataPermitResponse.statusCode, 200);
    const metadataPermit = jsonBody(metadataPermitResponse).data as { permit: string; serverNonce: string };
    const updated = await app.inject({
      method: 'PATCH',
      url: `/api/m/${metadataPermit.permit}`,
      headers: { ...signedHeaders(`/api/m/${metadataPermit.permit}`, metadata, metadataPermit.permit, metadataPermit.serverNonce, 'PATCH'), 'content-type': 'application/json' },
      payload: JSON.stringify(metadata),
    });
    assert.equal(updated.statusCode, 200);
    assert.equal((jsonBody(updated).data as Record<string, unknown>).altText, 'One pixel');

    const deletePermitBody = { action: 'media.delete', method: 'DELETE', path: `/api/uploads/${attachmentId}`, bodyHash: bodyDigest(undefined) };
    const deletePermitResponse = await app.inject({
      method: 'POST',
      url: '/api/i',
      headers: { ...signedHeaders('/api/i', deletePermitBody), 'content-type': 'application/json' },
      payload: JSON.stringify(deletePermitBody),
    });
    assert.equal(deletePermitResponse.statusCode, 200);
    const deletePermit = jsonBody(deletePermitResponse).data as { permit: string; serverNonce: string };
    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/m/${deletePermit.permit}`,
      headers: signedHeaders(`/api/m/${deletePermit.permit}`, undefined, deletePermit.permit, deletePermit.serverNonce, 'DELETE'),
    });
    assert.equal(deleted.statusCode, 200, deleted.body);
    assert.equal(await db.attachment.findUnique({ where: { id: attachmentId } }), null);
    assert.equal((await app.inject({ method: 'GET', url: `/api/media/${attachmentId}`, headers: { cookie } })).statusCode, 404);
  } finally {
    await app.close();
    await db.$disconnect();
    if (previousMediaDir === undefined) delete process.env.MEDIA_DIR;
    else process.env.MEDIA_DIR = previousMediaDir;
    await rm(directory, { recursive: true, force: true });
  }
});
