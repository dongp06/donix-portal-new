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
import { AppError } from '../src/core/errors.js';
import { RESOURCE_MAX_FILE_SIZE, ResourceStorageService } from '../src/modules/resources/resource-storage.service.js';

const workspaceRoot = resolve(process.cwd(), '..', '..');

function jsonBody(response: { body: string }): Record<string, unknown> {
  return JSON.parse(response.body) as Record<string, unknown>;
}

function multipartPayload(filename: string, mimeType: string, content: Buffer) {
  const boundary = `----thuebot-resource-${randomUUID()}`;
  const parts = [{ name: 'file', index: 0, kind: 'file', filename, mimeType, size: content.length, sha256: createHash('sha256').update(content).digest('hex') }];
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`, 'utf8'),
    content,
    Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'),
  ]);
  return { boundary, body, parts };
}

test('Fastify resources enforce staged ownership, publication visibility and file policy', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'thuebot-fastify-resource-'));
  const databaseFile = join(directory, 'dev.db');
  const resourceDirectory = join(directory, 'resources');
  const previousResourceDir = process.env.RESOURCE_UPLOAD_DIR;
  const previousOwnerEmail = process.env.OWNER_EMAIL;
  await copyFile(join(workspaceRoot, 'api', 'prisma', 'dev.db'), databaseFile);
  process.env.RESOURCE_UPLOAD_DIR = resourceDirectory;

  const userId = `fastify-resource-${randomUUID()}`;
  const email = `${userId}@example.test`;
  process.env.OWNER_EMAIL = email;
  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseFile }) });
  await db.$connect();
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const publicKeyJwk = publicKey.export({ format: 'jwk' }) as Record<string, string>;
  const fingerprint = hash(canonicalJson(publicKeyJwk));
  const timestamp = new Date().toISOString();
  await db.user.create({ data: { id: userId, name: 'Resource Owner', email, avatar: '', role: 'buyer', joinedDate: timestamp.slice(0, 10) } });
  const device = await db.deviceIdentity.create({ data: { id: `dev-${randomUUID()}`, userId, publicKey: JSON.stringify(publicKeyJwk), fingerprint, createdAt: timestamp, lastSeenAt: timestamp } });
  const auth = new AuthService(db);
  const session = await auth.createSession(userId, device.id);
  const cookie = `${AUTH_COOKIE}=${session.token}`;
  let accessToken = '';
  let sequence = 0;
  const app = await buildApp({ db, enforceTransport: false, logger: false });

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
    });
  };

  const issuePermit = async (action: string, method: string, path: string, value: unknown) => {
    const body = { action, method, path, bodyHash: bodyDigest(value) };
    const response = await app.inject({ method: 'POST', url: '/api/i', headers: { ...signedHeaders('/api/i', body), 'content-type': 'application/json' }, payload: JSON.stringify(body) });
    assert.equal(response.statusCode, 200, response.body);
    return jsonBody(response).data as { permit: string; serverNonce: string };
  };

  try {
    const access = await app.inject({ method: 'POST', url: '/api/auth/access', headers: { ...signedHeaders('/api/auth/access', {}), 'content-type': 'application/json' }, payload: '{}' });
    assert.equal(access.statusCode, 200, access.body);
    accessToken = String((jsonBody(access).data as Record<string, unknown>).token);

    const readme = Buffer.from('# Private resource\n', 'utf8');
    const upload = multipartPayload('README.md', 'text/markdown', readme);
    const uploadPermit = await issuePermit('resource.upload', 'POST', '/api/admin/resources/upload', upload.parts);
    const uploaded = await app.inject({
      method: 'POST',
      url: `/api/m/${uploadPermit.permit}`,
      headers: { ...signedHeaders(`/api/m/${uploadPermit.permit}`, upload.parts, uploadPermit.permit, uploadPermit.serverNonce), 'content-type': `multipart/form-data; boundary=${upload.boundary}` },
      payload: upload.body,
    });
    assert.equal(uploaded.statusCode, 200, uploaded.body);
    const staged = jsonBody(uploaded).data as { id?: string; fileId?: string; originalName?: string; filename?: string; previewable: boolean; sha256: string };
    const stagedFileId = String(staged.fileId ?? staged.id);
    assert.equal(staged.originalName ?? staged.filename, 'README.md');
    assert.equal(staged.previewable, true);
    assert.equal(staged.sha256, createHash('sha256').update(readme).digest('hex'));
    const stagedRow = await db.resourceFile.findUnique({ where: { id: stagedFileId } });
    assert.equal(stagedRow?.status, 'staged');
    assert.deepEqual(await readFile(join(resourceDirectory, stagedRow!.storageKey)), readme);

    const stagedPreview = await app.inject({ method: 'GET', url: `/api/admin/resources/files/${stagedFileId}/preview`, headers: signedHeaders(`/api/admin/resources/files/${stagedFileId}/preview`, undefined, '', '', 'GET') });
    assert.equal(stagedPreview.statusCode, 200, stagedPreview.body);
    assert.equal((jsonBody(stagedPreview).data as Record<string, unknown>).content, '# Private resource\n');

    const deleteContent = Buffer.from('delete me\n', 'utf8');
    const deleteUpload = multipartPayload('delete.txt', 'text/plain', deleteContent);
    const deleteUploadPermit = await issuePermit('resource.upload', 'POST', '/api/admin/resources/upload', deleteUpload.parts);
    const deleteUploadResponse = await app.inject({ method: 'POST', url: `/api/m/${deleteUploadPermit.permit}`, headers: { ...signedHeaders(`/api/m/${deleteUploadPermit.permit}`, deleteUpload.parts, deleteUploadPermit.permit, deleteUploadPermit.serverNonce), 'content-type': `multipart/form-data; boundary=${deleteUpload.boundary}` }, payload: deleteUpload.body });
    assert.equal(deleteUploadResponse.statusCode, 200, deleteUploadResponse.body);
    const deleteUploadData = jsonBody(deleteUploadResponse).data as Record<string, unknown>;
    const deleteFileId = String(deleteUploadData.fileId ?? deleteUploadData.id);
    const deletePermit = await issuePermit('resource.delete', 'DELETE', `/api/admin/resources/files/${deleteFileId}`, {});
    const deleted = await app.inject({ method: 'DELETE', url: `/api/m/${deletePermit.permit}`, headers: { ...signedHeaders(`/api/m/${deletePermit.permit}`, {}, deletePermit.permit, deletePermit.serverNonce, 'DELETE'), 'content-type': 'application/json' }, payload: '{}' });
    assert.equal(deleted.statusCode, 200, deleted.body);
    assert.equal(await db.resourceFile.findUnique({ where: { id: deleteFileId } }), null);

    const postBody = {
      title: 'Private Fastify Resource',
      content: 'This post publishes a private resource through the Fastify capability gateway.',
      type: 'resource',
      category: 'development',
      status: 'published',
      resource: { title: 'Private Fastify Resource', description: 'Private source package', version: '1.0.0', license: 'MIT', allowDownload: true, showSource: true, requiresLogin: true, fileIds: [stagedFileId] },
    };
    const postPermit = await issuePermit('post.create', 'POST', '/api/posts', postBody);
    const created = await app.inject({ method: 'POST', url: `/api/m/${postPermit.permit}`, headers: { ...signedHeaders(`/api/m/${postPermit.permit}`, postBody, postPermit.permit, postPermit.serverNonce), 'content-type': 'application/json' }, payload: JSON.stringify(postBody) });
    assert.equal(created.statusCode, 200, created.body);
    const post = jsonBody(created).data as { id: string; slug: string };
    const publishedRow = await db.resource.findUnique({ where: { postId: post.id } });
    assert.ok(publishedRow);

    const list = await app.inject({ method: 'GET', url: '/api/resources' });
    assert.equal(list.statusCode, 200, list.body);
    const listData = jsonBody(list).data as Array<Record<string, unknown>>;
    assert.ok(listData.some((item) => item.id === publishedRow!.id));
    const detail = await app.inject({ method: 'GET', url: `/api/resources/${publishedRow!.id}` });
    assert.equal(detail.statusCode, 200, detail.body);
    const detailData = jsonBody(detail).data as Record<string, unknown>;
    assert.equal(detailData.requiresLogin, true);
    const byPost = await app.inject({ method: 'GET', url: `/api/resources/post/${post.slug}` });
    assert.equal(byPost.statusCode, 200, byPost.body);

    const guestPreview = await app.inject({ method: 'GET', url: `/api/resources/files/${stagedFileId}/preview` });
    assert.equal(guestPreview.statusCode, 401);
    const ownerPreview = await app.inject({ method: 'GET', url: `/api/resources/files/${stagedFileId}/preview`, headers: { cookie } });
    assert.equal(ownerPreview.statusCode, 200, ownerPreview.body);
    const guestDownload = await app.inject({ method: 'GET', url: `/api/resources/files/${stagedFileId}/download` });
    assert.equal(guestDownload.statusCode, 401);
    const download = await app.inject({ method: 'GET', url: `/api/resources/files/${stagedFileId}/download`, headers: { cookie } });
    assert.equal(download.statusCode, 200, download.body);
    assert.equal(download.headers['content-disposition']?.toString().includes('README.md'), true);
    assert.deepEqual(download.rawPayload, readme);
    assert.equal((await db.resourceFile.findUnique({ where: { id: stagedFileId } }))?.downloadCount, 1);

    await db.resource.update({ where: { id: publishedRow!.id }, data: { showSource: false, allowDownload: false } });
    assert.equal((await app.inject({ method: 'GET', url: `/api/resources/files/${stagedFileId}/preview`, headers: { cookie } })).statusCode, 403);
    assert.equal((await app.inject({ method: 'GET', url: `/api/resources/files/${stagedFileId}/download`, headers: { cookie } })).statusCode, 403);

    const storage = new ResourceStorageService();
    assert.throws(() => storage.save({ originalname: 'payload.exe', mimetype: 'application/octet-stream', buffer: Buffer.from('MZ') }), (error: unknown) => error instanceof AppError && error.code === 'RESOURCE_FORMAT_INVALID');
    assert.throws(() => storage.save({ originalname: 'payload.js', mimetype: 'application/pdf', buffer: Buffer.from('console.log(1)') }), (error: unknown) => error instanceof AppError && error.code === 'RESOURCE_MIME_MISMATCH');
    assert.throws(() => storage.save({ originalname: 'payload.pdf', mimetype: 'application/pdf', buffer: Buffer.from('not pdf') }), (error: unknown) => error instanceof AppError && error.code === 'RESOURCE_MAGIC_MISMATCH');
    assert.throws(() => storage.save({ originalname: 'payload.txt', mimetype: 'text/plain', buffer: Buffer.alloc(RESOURCE_MAX_FILE_SIZE + 1) }), (error: unknown) => error instanceof AppError && error.code === 'RESOURCE_FILE_TOO_LARGE');
    assert.throws(() => storage.read('../escape.bin'), (error: unknown) => error instanceof AppError && error.code === 'RESOURCE_STORAGE_KEY_INVALID');
  } finally {
    await app.close();
    await db.$disconnect();
    if (previousResourceDir === undefined) delete process.env.RESOURCE_UPLOAD_DIR;
    else process.env.RESOURCE_UPLOAD_DIR = previousResourceDir;
    if (previousOwnerEmail === undefined) delete process.env.OWNER_EMAIL;
    else process.env.OWNER_EMAIL = previousOwnerEmail;
    await rm(directory, { recursive: true, force: true });
  }
});
