import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, rm, truncate, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import type { FastifyRequest } from 'fastify';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../../../api/prisma/generated/prisma/client.js';
import type { Database } from '../src/core/database.js';
import { MaintenanceService } from '../src/core/maintenance.js';
import { cleanupMultipartRequest, MULTIPART_MAX_FILE_SIZE, prepareMultipartRequest } from '../src/core/multipart.js';
import { AppError } from '../src/core/errors.js';
import { ResourcesService } from '../src/modules/resources/resources.service.js';
import { ResourceStorageService, RESOURCE_MAX_FILE_SIZE } from '../src/modules/resources/resource-storage.service.js';
import { MediaService } from '../src/modules/media/media.service.js';
import { MediaStorageService } from '../src/modules/media/media-storage.service.js';
import { TrustService } from '../src/modules/trust/trust.service.js';
import { rotateChecksumBatch, storageChecksumMaxFiles } from '../src/core/storage-integrity.js';

const workspaceRoot = resolve(process.cwd(), '..', '..');

test('Fastify checksum batches are bounded and rotate without starving later keys', () => {
  const previous = process.env.TB_STORAGE_CHECKSUM_MAX_FILES;
  try {
    process.env.TB_STORAGE_CHECKSUM_MAX_FILES = '1';
    assert.equal(storageChecksumMaxFiles(), 1);
    const files = [{ storageKey: '2026/08/a.bin' }, { storageKey: '2026/08/b.bin' }, { storageKey: '2026/08/c.bin' }];
    const first = rotateChecksumBatch(files, '', storageChecksumMaxFiles());
    assert.deepEqual(first.selected.map((file) => file.storageKey), ['2026/08/a.bin']);
    assert.equal(first.skipped, 2);
    const second = rotateChecksumBatch(files, first.selected.at(-1)!.storageKey, storageChecksumMaxFiles());
    assert.deepEqual(second.selected.map((file) => file.storageKey), ['2026/08/b.bin']);
    const third = rotateChecksumBatch(files, second.selected.at(-1)!.storageKey, storageChecksumMaxFiles());
    assert.deepEqual(third.selected.map((file) => file.storageKey), ['2026/08/c.bin']);
    process.env.TB_STORAGE_CHECKSUM_MAX_FILES = '0';
    assert.equal(storageChecksumMaxFiles(), 0);
    assert.equal(rotateChecksumBatch(files, '', 0).selected.length, 3);
  } finally {
    if (previous === undefined) delete process.env.TB_STORAGE_CHECKSUM_MAX_FILES;
    else process.env.TB_STORAGE_CHECKSUM_MAX_FILES = previous;
  }
});

test('Fastify maintenance cleans security state once and does not overlap runs', async () => {
  const calls: string[] = [];
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolveGate) => { release = resolveGate; });
  const deleteMany = async (name: string, args: unknown) => {
    calls.push(name);
    assert.equal(typeof args, 'object');
    await gate;
    return { count: 1 };
  };
  const db = {
    securityNonce: { deleteMany: (args: unknown) => deleteMany('securityNonce', args) },
    actionPermit: { deleteMany: (args: unknown) => deleteMany('actionPermit', args) },
    authAccessToken: { deleteMany: (args: unknown) => deleteMany('authAccessToken', args) },
    webAuthnChallenge: { deleteMany: (args: unknown) => deleteMany('webAuthnChallenge', args) },
    idempotencyRecord: { deleteMany: (args: unknown) => deleteMany('idempotencyRecord', args) },
  } as unknown as Database;
  const trust = {
    expireTrustedApplications: async () => {
      calls.push('trust');
      await gate;
      return 2;
    },
  } as unknown as TrustService;
  const service = new MaintenanceService(db, trust);

  const firstRun = service.runOnce();
  const overlapping = await service.runOnce();
  assert.deepEqual(overlapping, {
    expiredTrustedApplications: 0,
    securityNonces: 0,
    actionPermits: 0,
    accessTokens: 0,
    webAuthnChallenges: 0,
    idempotencyRecords: 0,
    stagedResourceFiles: 0,
    mediaMissingAttachments: 0,
    mediaSizeMismatches: 0,
    mediaSha256Mismatches: 0,
    mediaChecksumFilesChecked: 0,
    mediaChecksumFilesSkipped: 0,
    mediaOrphanFiles: 0,
    resourceMissingFiles: 0,
    resourceSizeMismatches: 0,
    resourceSha256Mismatches: 0,
    resourceChecksumFilesChecked: 0,
    resourceChecksumFilesSkipped: 0,
    resourceOrphanFiles: 0,
  });
  release?.();
  assert.deepEqual(await firstRun, {
    expiredTrustedApplications: 2,
    securityNonces: 1,
    actionPermits: 1,
    accessTokens: 1,
    webAuthnChallenges: 1,
    idempotencyRecords: 1,
    stagedResourceFiles: 0,
    mediaMissingAttachments: 0,
    mediaSizeMismatches: 0,
    mediaSha256Mismatches: 0,
    mediaChecksumFilesChecked: 0,
    mediaChecksumFilesSkipped: 0,
    mediaOrphanFiles: 0,
    resourceMissingFiles: 0,
    resourceSizeMismatches: 0,
    resourceSha256Mismatches: 0,
    resourceChecksumFilesChecked: 0,
    resourceChecksumFilesSkipped: 0,
    resourceOrphanFiles: 0,
  });
  assert.deepEqual(calls.sort(), ['actionPermit', 'authAccessToken', 'idempotencyRecord', 'securityNonce', 'trust', 'webAuthnChallenge'].sort());
});

test('Fastify maintenance promotes due scheduled posts and attached resource versions', async () => {
  let postPublished = false;
  let resourceVersionArgs: Record<string, unknown> | undefined;
  const db = {
    post: {
      findMany: async () => (postPublished ? [] : [{ id: 'scheduled-post-1' }]),
      updateMany: async () => {
        if (postPublished) return { count: 0 };
        postPublished = true;
        return { count: 1 };
      },
    },
    resourceVersion: {
      updateMany: async (args: Record<string, unknown>) => {
        resourceVersionArgs = args;
        return { count: 1 };
      },
    },
    securityNonce: { deleteMany: async () => ({ count: 0 }) },
    actionPermit: { deleteMany: async () => ({ count: 0 }) },
    authAccessToken: { deleteMany: async () => ({ count: 0 }) },
    webAuthnChallenge: { deleteMany: async () => ({ count: 0 }) },
    idempotencyRecord: { deleteMany: async () => ({ count: 0 }) },
  } as unknown as Database;
  const trust = { expireTrustedApplications: async () => 0 } as unknown as TrustService;
  const resources = { cleanupStagedFiles: async () => 0 } as unknown as ResourcesService;

  const result = await new MaintenanceService(db, trust, resources).runOnce();

  assert.equal(postPublished, true);
  assert.equal(result.stagedResourceFiles, 0);
  assert.equal((resourceVersionArgs?.where as Record<string, unknown>).resource && ((resourceVersionArgs?.where as Record<string, unknown>).resource as Record<string, unknown>).postId, 'scheduled-post-1');
  assert.deepEqual((resourceVersionArgs?.where as Record<string, unknown>).status, { in: ['draft', 'scheduled', 'pending', 'hidden'] });
  assert.equal((resourceVersionArgs?.data as Record<string, unknown>).status, 'published');
  assert.equal(typeof (resourceVersionArgs?.data as Record<string, unknown>).publishedAt, 'string');
});

test('Fastify storage reconciliation marks missing rows and removes only old unknown files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'thuebot-fastify-reconcile-'));
  const mediaDirectory = join(directory, 'media');
  const resourceDirectory = join(directory, 'resources');
  const previousMediaDir = process.env.MEDIA_DIR;
  const previousResourceDir = process.env.RESOURCE_UPLOAD_DIR;
  process.env.MEDIA_DIR = mediaDirectory;
  process.env.RESOURCE_UPLOAD_DIR = resourceDirectory;
  try {
    const mediaStorage = new MediaStorageService();
    const resourceStorage = new ResourceStorageService();
    const oldMediaOrphan = join(mediaDirectory, '2026', '08', 'old.bin');
    const recentMediaOrphan = join(mediaDirectory, '2026', '08', 'recent.bin');
    const recentUnknownMedia = join(mediaDirectory, '2026', '08', 'recent-unknown.bin');
    const tamperedMedia = join(mediaDirectory, '2026', '08', 'tampered.bin');
    const oldResourceOrphan = join(resourceDirectory, '2026', '08', 'old.bin');
    const unknownResourceOrphan = join(resourceDirectory, '2026', '08', 'unknown.bin');
    const tamperedResource = join(resourceDirectory, '2026', '08', 'tampered.bin');
    await mkdir(join(mediaDirectory, '2026', '08'), { recursive: true });
    await mkdir(join(resourceDirectory, '2026', '08'), { recursive: true });
    await writeFile(oldMediaOrphan, Buffer.from('old-media'));
    await writeFile(recentMediaOrphan, Buffer.from('recent-media'));
    await writeFile(recentUnknownMedia, Buffer.from('recent-unknown-media'));
    await writeFile(tamperedMedia, Buffer.from('changed!'));
    await writeFile(oldResourceOrphan, Buffer.from('old-resource'));
    await writeFile(unknownResourceOrphan, Buffer.from('unknown-resource'));
    await writeFile(tamperedResource, Buffer.from('changed!'));
    const oldDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1_000);
    await import('node:fs/promises').then(async ({ utimes }) => {
      await utimes(oldMediaOrphan, oldDate, oldDate);
      await utimes(oldResourceOrphan, oldDate, oldDate);
      await utimes(unknownResourceOrphan, oldDate, oldDate);
    });

    const mediaUpdates: Array<Record<string, unknown>> = [];
    const mediaDb = {
      attachment: {
        findMany: async () => [
          { id: 'missing-media', storageKey: '2026/08/missing.bin', sizeBytes: 4, status: 'published' },
          { id: 'bad-size-media', storageKey: '2026/08/recent.bin', sizeBytes: 999, status: 'draft' },
          { id: 'tampered-media', storageKey: '2026/08/tampered.bin', sizeBytes: 8, sha256: createHash('sha256').update('original').digest('hex'), status: 'draft' },
        ],
        updateMany: async (args: Record<string, unknown>) => {
          mediaUpdates.push(args);
          return { count: 1 };
        },
      },
    } as unknown as Database;
    const mediaResult = await new MediaService(mediaDb, mediaStorage).reconcileStorage(60_000);
    assert.equal(mediaResult.missingAttachments, 1);
    assert.equal(mediaResult.sizeMismatches, 1);
    assert.equal(mediaResult.sha256Mismatches, 1);
    assert.equal(mediaResult.checksumFilesChecked, 1);
    assert.equal(mediaResult.checksumFilesSkipped, 0);
    assert.equal(mediaResult.removedOrphanFiles, 1);
    assert.equal(mediaResult.skippedRecentFiles, 1);
    assert.equal(mediaUpdates.length, 3);
    assert.equal(existsSync(oldMediaOrphan), false);
    assert.equal(existsSync(recentMediaOrphan), true);
    assert.equal(existsSync(recentUnknownMedia), true);

    const resourceUpdates: Array<Record<string, unknown>> = [];
    const resourceDb = {
      resourceFile: {
        findMany: async () => [
          { id: 'missing-resource', storageKey: '2026/08/missing.bin', sizeBytes: 4, status: 'active' },
          { id: 'bad-size-resource', storageKey: '2026/08/old.bin', sizeBytes: 999, status: 'active' },
          { id: 'tampered-resource', storageKey: '2026/08/tampered.bin', sizeBytes: 8, sha256: createHash('sha256').update('original').digest('hex'), status: 'active' },
        ],
        updateMany: async (args: Record<string, unknown>) => {
          resourceUpdates.push(args);
          return { count: 1 };
        },
      },
    } as unknown as Database;
    const resourceResult = await new ResourcesService(resourceDb, resourceStorage).reconcileStorage(60_000);
    assert.equal(resourceResult.missingResourceFiles, 1);
    assert.equal(resourceResult.sizeMismatches, 1);
    assert.equal(resourceResult.sha256Mismatches, 1);
    assert.equal(resourceResult.checksumFilesChecked, 1);
    assert.equal(resourceResult.checksumFilesSkipped, 0);
    assert.equal(resourceResult.removedOrphanFiles, 1);
    assert.equal(resourceUpdates.length, 3);
    assert.equal(existsSync(oldResourceOrphan), true);
    assert.equal(existsSync(unknownResourceOrphan), false);
    assert.equal(existsSync(tamperedMedia), true);
    assert.equal(existsSync(tamperedResource), true);
  } finally {
    if (previousMediaDir === undefined) delete process.env.MEDIA_DIR;
    else process.env.MEDIA_DIR = previousMediaDir;
    if (previousResourceDir === undefined) delete process.env.RESOURCE_UPLOAD_DIR;
    else process.env.RESOURCE_UPLOAD_DIR = previousResourceDir;
    await rm(directory, { recursive: true, force: true });
  }
});

test('Fastify multipart stages a stream and cleanup removes its temporary file', async () => {
  const content = Buffer.from('streamed upload\n', 'utf8');
  const stream = Object.assign(Readable.from([content]), { truncated: false });
  const request = {
    parts: async function* () {
      yield { type: 'file', fieldname: 'file', filename: 'README.md', mimetype: 'text/markdown', file: stream };
    },
  } as unknown as FastifyRequest;

  await prepareMultipartRequest(request);
  const upload = request.multipartUpload;
  assert.ok(upload?.file?.tempPath);
  assert.equal(upload.file?.sizeBytes, content.length);
  assert.equal(upload.file?.sha256, createHash('sha256').update(content).digest('hex'));
  assert.equal(existsSync(upload.file!.tempPath), true);

  await cleanupMultipartRequest(request);
  assert.equal(existsSync(upload.file!.tempPath), false);
  assert.equal(request.multipartUpload?.file, null);
});

test('Fastify multipart preserves parser size errors and resource storage uses temp-file streaming', async () => {
  const oversizedStream = Object.assign(Readable.from([Buffer.from('too large')]), { truncated: true });
  const oversizedRequest = {
    parts: async function* () {
      yield { type: 'file', fieldname: 'file', filename: 'payload.txt', mimetype: 'text/plain', file: oversizedStream };
    },
  } as unknown as FastifyRequest;
  await assert.rejects(
    () => prepareMultipartRequest(oversizedRequest),
    (error: unknown) => error instanceof AppError && error.code === 'PAYLOAD_TOO_LARGE',
  );
  assert.equal(oversizedRequest.multipartUpload, undefined);
  assert.equal(MULTIPART_MAX_FILE_SIZE, 50 * 1024 * 1024);

  const directory = await mkdtemp(join(tmpdir(), 'thuebot-fastify-resource-stream-'));
  const previousResourceDir = process.env.RESOURCE_UPLOAD_DIR;
  process.env.RESOURCE_UPLOAD_DIR = directory;
  try {
    const input = join(directory, 'source.txt');
    const content = Buffer.from('resource streamed to disk\n', 'utf8');
    await writeFile(input, content, { mode: 0o600 });
    const storage = new ResourceStorageService();
    const stored = await storage.saveTempFile({ originalname: 'source.txt', mimetype: 'text/plain', tempPath: input });
    assert.equal(stored.sizeBytes, content.length);
    assert.equal(stored.sha256, createHash('sha256').update(content).digest('hex'));
    assert.deepEqual(await readFile(join(directory, ...stored.storageKey.split('/'))), content);

    const oversizedPath = join(directory, 'oversized.txt');
    await writeFile(oversizedPath, Buffer.alloc(0), { mode: 0o600 });
    await truncate(oversizedPath, RESOURCE_MAX_FILE_SIZE + 1);
    await assert.rejects(
      () => storage.saveTempFile({ originalname: 'oversized.txt', mimetype: 'text/plain', tempPath: oversizedPath }),
      (error: unknown) => error instanceof AppError && error.code === 'RESOURCE_FILE_TOO_LARGE',
    );

    let row: { id: string; storageKey: string; status: string; resourceVersionId: string | null; createdAt: string } | null = {
      id: `rfile-${randomUUID()}`,
      storageKey: stored.storageKey,
      status: 'staged',
      resourceVersionId: null,
      createdAt: new Date(Date.now() - 4 * 86_400_000).toISOString(),
    };
    const cleanupDb = {
      resourceFile: {
        findMany: async () => row && row.status === 'staged' && row.resourceVersionId === null ? [row] : [],
        updateMany: async () => {
          if (!row || row.status !== 'staged') return { count: 0 };
          row.status = 'deleting';
          return { count: 1 };
        },
        deleteMany: async () => {
          if (!row || row.status !== 'deleting') return { count: 0 };
          row = null;
          return { count: 1 };
        },
      },
    } as unknown as Database;
    const resources = new ResourcesService(cleanupDb, storage);
    assert.equal(await resources.cleanupStagedFiles(), 1);
    assert.equal(row, null);
    assert.equal(existsSync(join(directory, ...stored.storageKey.split('/'))), false);
  } finally {
    if (previousResourceDir === undefined) delete process.env.RESOURCE_UPLOAD_DIR;
    else process.env.RESOURCE_UPLOAD_DIR = previousResourceDir;
    await rm(directory, { recursive: true, force: true });
  }
});

test('Fastify trust expiry revokes expired Trusted Seller state and recomputes projections', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'thuebot-fastify-trust-expiry-'));
  const databaseFile = join(directory, 'dev.db');
  await copyFile(join(workspaceRoot, 'api', 'prisma', 'dev.db'), databaseFile);
  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseFile }) });
  await db.$connect();
  const sellerId = `fastify-expired-trust-${randomUUID()}`;
  try {
    const timestamp = new Date(Date.now() - 400 * 86_400_000).toISOString();
    const expiredAt = new Date(Date.now() - 60_000).toISOString();
    await db.user.create({ data: { id: sellerId, name: 'Expired Trust Seller', email: `${sellerId}@example.test`, avatar: '', role: 'seller', joinedDate: timestamp.slice(0, 10) } });
    const bot = await db.bot.findFirst({ where: { status: { in: ['online', 'maintenance', 'offline'] } }, select: { id: true } });
    if (!bot) throw new Error('Trust expiry fixture is missing a bot.');
    await db.bot.update({ where: { id: bot.id }, data: { sellerId, sellerName: 'Expired Trust Seller', sellerVerificationState: 'trusted', sellerTrustedUntil: expiredAt } });
    const verification = await db.trustVerification.create({
      data: {
        id: `tv-${randomUUID()}`,
        userId: sellerId,
        status: 'trusted',
        note: 'expired fixture',
        submittedAt: timestamp,
        reviewedAt: timestamp,
        reviewedBy: sellerId,
        expiresAt: expiredAt,
        trustedAt: timestamp,
        trustedUntil: expiredAt,
        approvedBy: sellerId,
        verificationVersion: 2,
      },
    });
    const profiles = { getOrCreateProfile: async () => ({ profile: { profileCompleteness: 100, shopName: 'Expired Trust Seller', avatar: '', slug: 'expired-trust-seller' } }) } as never;
    const trust = new TrustService(db, profiles);
    assert.equal(await trust.expireTrustedApplications(), 1);
    assert.equal((await db.trustVerification.findUnique({ where: { id: verification.id } }))?.status, 'revoked');
    const user = await db.user.findUnique({ where: { id: sellerId }, select: { verificationState: true, trustedAt: true, trustedUntil: true } });
    assert.equal(user?.verificationState, 'revoked');
    assert.equal(user?.trustedAt, null);
    assert.equal(user?.trustedUntil, null);
    assert.equal((await db.bot.findUnique({ where: { id: bot.id }, select: { sellerVerificationState: true, sellerTrustedUntil: true } }))?.sellerVerificationState, 'revoked');
    assert.equal((await db.trustEvent.findFirst({ where: { userId: sellerId, type: 'trusted_expired' } }))?.userId, sellerId);
  } finally {
    await db.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});
