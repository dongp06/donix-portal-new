import { strict as assert } from 'node:assert';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { FastifyRequest } from 'fastify';
import { E2eeService, EncryptedAttachmentStorage } from '../src/modules/e2ee/e2ee.service.js';
import type { AuthService } from '../src/core/auth.js';
import type { Database } from '../src/core/database.js';
import { copyFile } from 'node:fs/promises';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../../../api/prisma/generated/prisma/client.js';
import { buildApp } from '../src/app/build-app.js';
import { AUTH_COOKIE } from '../src/core/config.js';

const workspaceRoot = join(process.cwd(), '..', '..');

const session = {
  id: 'session-e2ee-test',
  userId: 'user-e2ee-test',
  deviceId: 'device-e2ee-test',
  familyId: 'family-e2ee-test',
  generation: 0,
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  idleExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  absoluteExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  lastSeenAt: new Date().toISOString(),
  rotatedFrom: null,
  replacedById: null,
  rotatedAt: null,
  graceUntil: null,
  reuseDetectedAt: null,
};
const opaqueSessionCredential = 'A'.repeat(64);

function request(): FastifyRequest {
  return { cookies: { [AUTH_COOKIE]: opaqueSessionCredential } } as unknown as FastifyRequest;
}

function material(length: number): string {
  return 'A'.repeat(length);
}

function bundle() {
  return {
    registration_id: 1234,
    device_id: 7,
    pre_key_id: 1,
    pre_key_public: material(44),
    signed_pre_key_id: 1,
    signed_pre_key_public: material(44),
    signed_pre_key_signature: material(86),
    identity_key: material(44),
    kyber_pre_key_id: 1,
    kyber_pre_key_public: material(2092),
    kyber_pre_key_signature: material(86),
  };
}

test('Fastify E2EE boundary rejects private material before persistence', async () => {
  const prisma = {
    deviceIdentity: { findFirst: async () => ({ id: session.deviceId, userId: session.userId }) },
    e2eeDeviceKey: { findFirst: async () => null, create: async () => ({}) },
  } as unknown as Database;
  const auth = { resolveSession: async () => session } as unknown as AuthService;
  const service = new E2eeService(prisma, auth, {} as EncryptedAttachmentStorage);

  await assert.rejects(
    () => service.publishDeviceKeys(request(), { privateKey: 'must-not-arrive', bundle: bundle(), preKeys: [] }),
    (error: unknown) => Boolean(error && typeof error === 'object' && (error as { code?: string }).code === 'E2EE_PRIVATE_MATERIAL_REJECTED'),
  );
});

test('Fastify E2EE boundary accepts only the public PQXDH bundle contract', async () => {
  let created = false;
  const prisma = {
    deviceIdentity: { findFirst: async () => ({ id: session.deviceId, userId: session.userId }) },
    e2eeDeviceKey: {
      findFirst: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => { created = !('privateKey' in data) && !('plaintext' in data); return { id: 'key-1', signalDeviceId: data.signalDeviceId, registrationId: data.registrationId }; },
    },
    e2eeOneTimePrekey: { upsert: async () => ({}) },
  } as unknown as Database;
  const auth = { resolveSession: async () => session } as unknown as AuthService;
  const service = new E2eeService(prisma, auth, {} as EncryptedAttachmentStorage);
  const result = await service.publishDeviceKeys(request(), { bundle: bundle(), preKeys: [{ id: 1, public_key: material(44) }] });
  assert.equal(result.protocolVersion, 'signal-pqxdh-v1');
  assert.equal(result.oneTimePrekeysAccepted, 1);
  assert.equal(created, true);
});

test('Fastify encrypted attachment storage stages and verifies files without a source Buffer', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'thuebot-fastify-e2ee-storage-'));
  const previous = process.env.MEDIA_STORAGE_DIR;
  process.env.MEDIA_STORAGE_DIR = join(directory, 'storage');
  try {
    const sourcePath = join(directory, 'ciphertext.bin');
    const ciphertext = Buffer.alloc(128 * 1024, 0x5a);
    await writeFile(sourcePath, ciphertext);
    const storage = new EncryptedAttachmentStorage();
    const stored = await storage.saveFile(sourcePath);
    assert.equal(stored.sizeBytes, ciphertext.length);
    const opened = storage.open(stored.storageKey, stored.sizeBytes, stored.ciphertextSha256);
    const chunks: Buffer[] = [];
    for await (const chunk of opened.stream as AsyncIterable<Buffer>) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    assert.deepEqual(Buffer.concat(chunks), ciphertext);
  } finally {
    if (previous === undefined) delete process.env.MEDIA_STORAGE_DIR;
    else process.env.MEDIA_STORAGE_DIR = previous;
    await rm(directory, { recursive: true, force: true });
  }
});

test('Fastify rejects removed legacy file routes and direct E2EE bypasses', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'thuebot-fastify-route-guards-'));
  const databaseFile = join(directory, 'dev.db');
  await copyFile(join(workspaceRoot, 'api', 'prisma', 'dev.db'), databaseFile);
  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseFile }) });
  await db.$connect();
  const app = await buildApp({ db, enforceTransport: false, logger: false });
  try {
    const fileUpload = await app.inject({
      method: 'POST',
      url: '/api/files/upload',
    });
    assert.equal(fileUpload.statusCode, 404);
    assert.equal((JSON.parse(fileUpload.body) as { code?: string }).code, 'NOT_FOUND');

    const fileDownload = await app.inject({
      method: 'GET',
      url: '/api/files/file-1',
    });
    assert.equal(fileDownload.statusCode, 404);
    assert.equal((JSON.parse(fileDownload.body) as { code?: string }).code, 'NOT_FOUND');

    const e2eeConversation = await app.inject({
      method: 'POST',
      url: '/api/e2ee/conversations',
      headers: { 'content-type': 'application/json' },
      payload: '{}',
    });
    assert.equal(e2eeConversation.statusCode, 403);
    assert.equal((JSON.parse(e2eeConversation.body) as { code?: string }).code, 'ACTION_PERMIT_INVALID');

    const e2eeMessage = await app.inject({
      method: 'POST',
      url: '/api/e2ee/conversations/conversation-1/messages',
      headers: { 'content-type': 'application/json' },
      payload: '{}',
    });
    assert.equal(e2eeMessage.statusCode, 403);
    assert.equal((JSON.parse(e2eeMessage.body) as { code?: string }).code, 'ACTION_PERMIT_INVALID');
  } finally {
    await app.close();
    await db.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});
