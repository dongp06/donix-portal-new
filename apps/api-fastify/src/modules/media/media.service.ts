import { createHash, randomUUID } from 'node:crypto';
import type { Database } from '../../core/database.js';
import { AppError } from '../../core/errors.js';
import { rotateChecksumBatch, storageChecksumMaxFiles } from '../../core/storage-integrity.js';
import { normalizeMediaUsage, type UploadedImage, MediaStorageService } from './media-storage.service.js';

const ATTACHMENT_PATTERN = /attachment:\/\/([A-Za-z0-9_-]+)/g;
const MEDIA_URL_PATTERN = /\/api\/media\/([A-Za-z0-9_-]+)/g;
const PUBLIC_BOT_STATUSES = ['online', 'maintenance', 'offline'];

export type MediaActor = {
  userId: string;
  staffRole?: string | null;
};

type AttachmentReferenceDb = Pick<Database, 'post' | 'postVersion' | 'bot' | 'botReview' | 'user' | 'sellerProfile'>;

function now(): string {
  return new Date().toISOString();
}

function orphanGraceMs(): number {
  const configured = Number(process.env.TB_MEDIA_ORPHAN_GRACE_MS ?? 24 * 60 * 60 * 1_000);
  return Number.isFinite(configured)
    ? Math.min(Math.max(configured, 60_000), 30 * 24 * 60 * 60 * 1_000)
    : 24 * 60 * 60 * 1_000;
}

function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extractAttachmentIds(values: Array<string | null | undefined>): string[] {
  const source = values.filter((value): value is string => typeof value === 'string').join('\n');
  return [...new Set([
    ...[...source.matchAll(ATTACHMENT_PATTERN)].map((match) => match[1]),
    ...[...source.matchAll(MEDIA_URL_PATTERN)].map((match) => match[1]),
  ].filter((value): value is string => Boolean(value)))];
}

function normalizeMetadataInput(input: unknown): { altText?: string; caption?: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new AppError('MEDIA_METADATA_INVALID', 'Media metadata is invalid.', 400);
  }
  const value = input as Record<string, unknown>;
  const result: { altText?: string; caption?: string } = {};
  for (const [key, maxLength] of [['altText', 240], ['caption', 500]] as const) {
    if (value[key] === undefined) continue;
    if (typeof value[key] !== 'string') throw new AppError('MEDIA_METADATA_INVALID', `Metadata '${key}' must be a string.`, 400);
    const normalized = value[key].trim();
    if (normalized.length > maxLength) throw new AppError('MEDIA_METADATA_INVALID', `Metadata '${key}' is too long.`, 400);
    result[key] = normalized;
  }
  const unexpected = Object.keys(value).find((key) => key !== 'altText' && key !== 'caption');
  if (unexpected) throw new AppError('MEDIA_METADATA_INVALID', `Unexpected metadata field '${unexpected}'.`, 400);
  return result;
}

function referencesForField(field: string, id: string): Array<Record<string, unknown>> {
  return [
    { [field]: { contains: `attachment://${id}` } },
    { [field]: { contains: `/api/media/${id}` } },
  ];
}

async function hasAttachmentReference(db: AttachmentReferenceDb, id: string): Promise<boolean> {
  const [post, postVersion, bot, review, user, profile] = await Promise.all([
    db.post.findFirst({ where: { OR: [...referencesForField('content', id), ...referencesForField('coverImage', id)] }, select: { id: true } }),
    db.postVersion.findFirst({ where: { OR: referencesForField('content', id) }, select: { id: true } }),
    db.bot.findFirst({ where: { OR: [
      ...referencesForField('description', id),
      ...referencesForField('coverImage', id),
      ...referencesForField('gallery', id),
      ...referencesForField('pricingDescription', id),
      ...referencesForField('pricingImages', id),
    ] }, select: { id: true } }),
    db.botReview.findFirst({ where: { OR: referencesForField('images', id) }, select: { id: true } }),
    db.user.findFirst({ where: { OR: referencesForField('avatar', id) }, select: { id: true } }),
    db.sellerProfile.findFirst({ where: { OR: [...referencesForField('avatar', id), ...referencesForField('banner', id)] }, select: { id: true } }),
  ]);
  return Boolean(post || postVersion || bot || review || user || profile);
}

async function hasPublicAttachmentReference(db: AttachmentReferenceDb, id: string): Promise<boolean> {
  const [post, bot, review, user, profile] = await Promise.all([
    db.post.findFirst({ where: { status: 'published', deletedAt: null, OR: [...referencesForField('content', id), ...referencesForField('coverImage', id)] }, select: { id: true } }),
    db.bot.findFirst({ where: { status: { in: PUBLIC_BOT_STATUSES }, OR: [
      ...referencesForField('description', id),
      ...referencesForField('coverImage', id),
      ...referencesForField('gallery', id),
      ...referencesForField('pricingDescription', id),
      ...referencesForField('pricingImages', id),
    ] }, select: { id: true } }),
    db.botReview.findFirst({ where: { OR: referencesForField('images', id), bot: { status: { in: PUBLIC_BOT_STATUSES } } }, select: { id: true } }),
    db.user.findFirst({ where: { OR: referencesForField('avatar', id) }, select: { id: true } }),
    db.sellerProfile.findFirst({ where: { OR: [...referencesForField('avatar', id), ...referencesForField('banner', id)] }, select: { id: true } }),
  ]);
  return Boolean(post || bot || review || user || profile);
}

function staffActor(actor: MediaActor | null | undefined): boolean {
  return actor?.staffRole === 'owner' || actor?.staffRole === 'admin' || actor?.staffRole === 'moderator';
}

export class MediaService {
  private checksumCursor = '';

  constructor(private readonly db: Database, private readonly storage: MediaStorageService) {}

  async reconcileStorage(graceMs = orphanGraceMs()): Promise<{
    missingAttachments: number;
    sizeMismatches: number;
    sha256Mismatches: number;
    checksumFilesChecked: number;
    checksumFilesSkipped: number;
    removedOrphanFiles: number;
    skippedRecentFiles: number;
  }> {
    const rows = await this.db.attachment.findMany({
      select: { id: true, storageKey: true, sizeBytes: true, sha256: true, status: true },
    });
    const diskFiles = this.storage.listFiles();
    const diskByKey = new Map(diskFiles.map((file) => [file.storageKey, file]));
    const timestamp = now();
    let missingAttachments = 0;
    let sizeMismatches = 0;
    let sha256Mismatches = 0;

    for (const row of rows) {
      const diskFile = diskByKey.get(row.storageKey);
      const missing = !diskFile;
      const sizeMismatch = Boolean(diskFile && diskFile.sizeBytes !== row.sizeBytes);
      if (!missing && !sizeMismatch) continue;
      const updated = await this.db.attachment.updateMany({
        where: {
          id: row.id,
          storageKey: row.storageKey,
          status: { in: ['draft', 'published', 'deleting'] },
        },
        data: { status: 'orphaned', updatedAt: timestamp },
      });
      if (updated.count !== 1) continue;
      if (missing) missingAttachments += 1;
      if (sizeMismatch) sizeMismatches += 1;
    }

    const checksumCandidates = rows.filter((row) => {
      const diskFile = diskByKey.get(row.storageKey);
      return ['draft', 'published', 'deleting'].includes(row.status)
        && Boolean(diskFile)
        && diskFile!.sizeBytes === row.sizeBytes;
    });
    const checksumBatch = rotateChecksumBatch(checksumCandidates, this.checksumCursor, storageChecksumMaxFiles());
    if (checksumBatch.selected.length > 0) this.checksumCursor = checksumBatch.selected.at(-1)!.storageKey;
    let checksumFilesChecked = 0;
    for (const row of checksumBatch.selected) {
      checksumFilesChecked += 1;
      let digestMatches = false;
      let digestSize = row.sizeBytes;
      try {
        const digest = await this.storage.digest(row.storageKey);
        digestSize = digest.sizeBytes;
        digestMatches = digest.sizeBytes === row.sizeBytes
          && /^[a-f0-9]{64}$/i.test(row.sha256)
          && digest.sha256 === row.sha256.toLowerCase();
      } catch {
        // An unreadable file is unavailable even when its directory entry
        // was present in the initial listing. The next pass can retry it.
      }
      if (digestMatches) continue;
      const updated = await this.db.attachment.updateMany({
        where: {
          id: row.id,
          storageKey: row.storageKey,
          status: { in: ['draft', 'published', 'deleting'] },
        },
        data: { status: 'orphaned', updatedAt: timestamp },
      });
      if (updated.count !== 1) continue;
      if (digestSize !== row.sizeBytes) sizeMismatches += 1;
      else sha256Mismatches += 1;
    }

    const knownKeys = new Set(rows.map((row) => row.storageKey));
    const cutoff = Date.now() - Math.max(60_000, graceMs);
    let removedOrphanFiles = 0;
    let skippedRecentFiles = 0;
    for (const file of diskFiles) {
      if (knownKeys.has(file.storageKey)) continue;
      if (file.modifiedAtMs > cutoff) {
        skippedRecentFiles += 1;
        continue;
      }
      try {
        this.storage.remove(file.storageKey);
        removedOrphanFiles += 1;
      } catch {
        // A concurrent writer or filesystem failure is retried on the next pass.
      }
    }
    return {
      missingAttachments,
      sizeMismatches,
      sha256Mismatches,
      checksumFilesChecked,
      checksumFilesSkipped: checksumBatch.skipped,
      removedOrphanFiles,
      skippedRecentFiles,
    };
  }

  async uploadImage(actor: MediaActor, file: { originalname?: string; mimetype?: string; buffer: Buffer }, usage?: string) {
    const stored = this.storage.saveImage(file.originalname, file.mimetype, file.buffer);
    const timestamp = now();
    try {
      const row = await this.db.attachment.create({
        data: {
          id: `att-${randomUUID()}`,
          ownerUserId: actor.userId,
          type: 'image',
          usage: normalizeMediaUsage(usage),
          originalName: stored.originalName,
          storageKey: stored.storageKey,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          width: stored.width,
          height: stored.height,
          sha256: stored.sha256,
          status: 'draft',
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      });
      return this.toUploadOut(row);
    } catch (error) {
      try {
        this.storage.remove(stored.storageKey);
      } catch {
        // Keep the database error as the primary failure; cleanup is best effort.
      }
      throw error;
    }
  }

  async updateMetadata(id: string, actor: MediaActor, input: unknown) {
    const metadata = normalizeMetadataInput(input);
    const attachment = await this.db.attachment.findFirst({ where: { id, ownerUserId: actor.userId } });
    if (!attachment) throw new AppError('MEDIA_NOT_FOUND', 'Attachment was not found.', 404);
    const row = await this.db.attachment.update({
      where: { id },
      data: { altText: metadata.altText ?? attachment.altText, caption: metadata.caption ?? attachment.caption, updatedAt: now() },
    });
    return this.toUploadOut(row);
  }

  async remove(id: string, actor: MediaActor): Promise<void> {
    const attachment = await this.db.$transaction(async (tx) => {
      const row = await tx.attachment.findFirst({ where: { id, ownerUserId: actor.userId, status: { in: ['draft', 'published', 'orphaned', 'deleting'] } } });
      if (!row) throw new AppError('MEDIA_NOT_FOUND', 'Attachment was not found.', 404);
      if (await hasAttachmentReference(tx, id)) throw new AppError('MEDIA_IN_USE', 'This attachment is still referenced by content.', 409);
      if (row.status !== 'deleting') await tx.attachment.update({ where: { id }, data: { status: 'deleting', updatedAt: now() } });
      return row;
    });

    this.storage.remove(attachment.storageKey);
    await this.db.$transaction(async (tx) => {
      const current = await tx.attachment.findFirst({ where: { id, ownerUserId: actor.userId, status: 'deleting' } });
      if (!current) return;
      if (await hasAttachmentReference(tx, id)) throw new AppError('MEDIA_IN_USE', 'This attachment is still referenced by content.', 409);
      await tx.attachment.delete({ where: { id } });
    });
  }

  async validateReferences(values: Array<string | null | undefined>, actor: MediaActor): Promise<string[]> {
    const ids = extractAttachmentIds(values);
    if (!ids.length) return [];
    const attachments = await this.db.attachment.findMany({ where: { id: { in: ids } } });
    if (attachments.length !== ids.length) {
      const found = new Set(attachments.map((attachment) => attachment.id));
      throw new AppError('ATTACHMENT_NOT_FOUND', `Attachment '${ids.find((id) => !found.has(id)) ?? 'unknown'}' was not found.`, 400);
    }
    const invalidType = attachments.find((attachment) => attachment.type !== 'image');
    if (invalidType) throw new AppError('ATTACHMENT_TYPE_INVALID', 'Only image attachments can be used here.', 400);
    const inaccessible = attachments.find((attachment) => (
      !['draft', 'published'].includes(attachment.status) ||
      (attachment.status === 'draft' && attachment.ownerUserId !== actor.userId)
    ));
    if (inaccessible) throw new AppError('ATTACHMENT_FORBIDDEN', 'You cannot use one of these attachments.', 403);
    return ids;
  }

  async publishReferences(values: Array<string | null | undefined>, actor: MediaActor): Promise<string[]> {
    const ids = await this.validateReferences(values, actor);
    if (!ids.length) return [];
    return this.db.$transaction(async (tx) => {
      const drafts = await tx.attachment.findMany({
        where: { id: { in: ids }, ownerUserId: actor.userId, status: 'draft' },
        select: { id: true },
      });
      const promotedIds = drafts.map((attachment) => attachment.id);
      if (!promotedIds.length) return [];
      const timestamp = now();
      await tx.attachment.updateMany({
        where: { id: { in: promotedIds }, status: 'draft' },
        data: { status: 'published', publishedAt: timestamp, updatedAt: timestamp },
      });
      return promotedIds;
    });
  }

  async rollbackPublishedReferences(ids: string[]): Promise<void> {
    const uniqueIds = [...new Set(ids)].filter(Boolean);
    if (!uniqueIds.length) return;
    await this.db.$transaction(async (tx) => {
      const published = await tx.attachment.findMany({
        where: { id: { in: uniqueIds }, status: 'published' },
        select: { id: true },
      });
      const timestamp = now();
      for (const attachment of published) {
        if (await hasAttachmentReference(tx, attachment.id)) continue;
        await tx.attachment.update({
          where: { id: attachment.id },
          data: { status: 'draft', publishedAt: null, updatedAt: timestamp },
        });
      }
    });
  }

  async getForDelivery(id: string, actor?: MediaActor | null) {
    const attachment = await this.deliveryAttachment(id, actor);
    const buffer = this.storage.read(attachment.storageKey);
    const digest = createHash('sha256').update(buffer).digest('hex');
    if (attachment.sizeBytes !== buffer.length || !/^[a-f0-9]{64}$/i.test(attachment.sha256) || attachment.sha256.toLowerCase() !== digest) {
      throw new AppError('MEDIA_NOT_FOUND', 'Media was not found.', 404);
    }
    return { ...attachment, buffer };
  }

  async getStreamForDelivery(id: string, actor?: MediaActor | null) {
    const attachment = await this.deliveryAttachment(id, actor);
    const opened = this.storage.openVerified(attachment.storageKey, attachment.sha256, attachment.sizeBytes);
    return { ...attachment, stream: opened.stream, sizeBytes: opened.sizeBytes };
  }

  private async deliveryAttachment(id: string, actor?: MediaActor | null) {
    if (!/^[A-Za-z0-9_-]{1,180}$/.test(id)) throw new AppError('MEDIA_NOT_FOUND', 'Media was not found.', 404);
    const attachment = await this.db.attachment.findUnique({ where: { id } });
    if (!attachment || attachment.type !== 'image') throw new AppError('MEDIA_NOT_FOUND', 'Media was not found.', 404);
    const canViewDraft = attachment.status === 'draft' && actor?.userId === attachment.ownerUserId;
    const canViewPrivatePublished = staffActor(actor);
    if (attachment.status === 'published' && !canViewPrivatePublished && !(await hasPublicAttachmentReference(this.db, id))) {
      throw new AppError('MEDIA_NOT_FOUND', 'Media was not found.', 404);
    }
    if (attachment.status !== 'published' && !canViewDraft) throw new AppError('MEDIA_NOT_FOUND', 'Media was not found.', 404);
    return attachment;
  }

  private toUploadOut(row: {
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
    sha256: string;
    usage: string;
    altText?: string;
    caption?: string;
  }) {
    return {
      attachmentId: row.id,
      originalName: row.originalName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      sizeLabel: sizeLabel(row.sizeBytes),
      width: row.width,
      height: row.height,
      sha256: row.sha256,
      usage: normalizeMediaUsage(row.usage),
      altText: row.altText ?? '',
      caption: row.caption ?? '',
      markdown: `![${row.altText || row.originalName}](attachment://${row.id})`,
    };
  }
}
