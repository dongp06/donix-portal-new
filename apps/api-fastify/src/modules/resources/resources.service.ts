import { randomBytes } from 'node:crypto';
import { withDatabaseRetry, type Database } from '../../core/database.js';
import { AppError } from '../../core/errors.js';
import { rotateChecksumBatch, storageChecksumMaxFiles } from '../../core/storage-integrity.js';
import {
  RESOURCE_MAX_FILES,
  RESOURCE_PREVIEW_MAX_BYTES,
  ResourceStorageService,
  resourceSizeLabel,
  type ResourceUploadFile,
} from './resource-storage.service.js';

const LICENSES = ['MIT', 'Apache-2.0', 'GPL-3.0', 'BSD-3-Clause', 'ISC', 'Proprietary', 'Other'] as const;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

export type ResourceInput = {
  title?: string;
  description?: string;
  version?: string;
  changelog?: string;
  license?: string;
  allowDownload?: boolean;
  showSource?: boolean;
  requiresLogin?: boolean;
  fileIds?: string[];
};

export type ResourceActor = {
  userId: string;
  staffRole?: string | null;
};

export type ResourceFileOutput = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sizeLabel: string;
  sha256: string;
  previewable: boolean;
  downloadCount: number;
  language?: string;
};

export type ResourceVersionOutput = {
  id: string;
  version: string;
  changelog: string;
  publishedAt: string | null;
  files: ResourceFileOutput[];
};

export type PostResourceOutput = {
  id: string;
  title: string;
  description: string;
  license: string;
  allowDownload: boolean;
  showSource: boolean;
  requiresLogin: boolean;
  currentVersion: ResourceVersionOutput;
  versions?: ResourceVersionOutput[];
};

export type ResourceListItem = PostResourceOutput & {
  postSlug: string;
  postTitle: string;
  postExcerpt: string;
  postCoverImage?: string | null;
  authorName: string;
  authorAvatar: string;
  publishedAt?: string | null;
};

export type ResourcePreviewOutput = {
  fileId: string;
  filename: string;
  mimeType: string;
  sha256: string;
  sizeBytes: number;
  content: string;
};

const STAGED_FILE_TTL_MS = 72 * 60 * 60 * 1_000;

function orphanGraceMs(): number {
  const configured = Number(process.env.TB_RESOURCE_ORPHAN_GRACE_MS ?? 24 * 60 * 60 * 1_000);
  return Number.isFinite(configured)
    ? Math.min(Math.max(configured, 60_000), 30 * 24 * 60 * 60 * 1_000)
    : 24 * 60 * 60 * 1_000;
}

function id(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${randomBytes(5).toString('hex')}`;
}

function now(): string {
  return new Date().toISOString();
}

function normalizeVersion(value: string | undefined): string {
  const version = (value ?? '1.0.0').trim().replace(/^v/i, '');
  if (!VERSION_PATTERN.test(version)) throw new AppError('RESOURCE_VERSION_INVALID', 'Resource version must use the form 1.0.0.', 400);
  return version;
}

function normalizeLicense(value: string | undefined): string {
  const license = value?.trim() || 'Other';
  if (!LICENSES.includes(license as (typeof LICENSES)[number])) throw new AppError('RESOURCE_LICENSE_INVALID', 'Resource license is invalid.', 400);
  return license;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function parseResourceInput(value: unknown): ResourceInput | undefined {
  if (!isRecord(value)) return undefined;
  const allowed = new Set(['title', 'description', 'version', 'changelog', 'license', 'allowDownload', 'showSource', 'requiresLogin', 'fileIds']);
  const unexpected = Object.keys(value).find((key) => !allowed.has(key));
  if (unexpected) throw new AppError('RESOURCE_FIELD_UNEXPECTED', `Unexpected resource field '${unexpected}'.`, 400);
  if (value.title !== undefined && typeof value.title !== 'string') throw new AppError('RESOURCE_FIELD_INVALID', 'Resource title is invalid.', 400);
  if (value.description !== undefined && typeof value.description !== 'string') throw new AppError('RESOURCE_FIELD_INVALID', 'Resource description is invalid.', 400);
  if (value.version !== undefined && typeof value.version !== 'string') throw new AppError('RESOURCE_FIELD_INVALID', 'Resource version is invalid.', 400);
  if (value.changelog !== undefined && typeof value.changelog !== 'string') throw new AppError('RESOURCE_FIELD_INVALID', 'Resource changelog is invalid.', 400);
  if (value.license !== undefined && typeof value.license !== 'string') throw new AppError('RESOURCE_FIELD_INVALID', 'Resource license is invalid.', 400);
  for (const key of ['allowDownload', 'showSource', 'requiresLogin'] as const) {
    if (value[key] !== undefined && typeof value[key] !== 'boolean') throw new AppError('RESOURCE_FIELD_INVALID', `Resource field '${key}' is invalid.`, 400);
  }
  if (value.fileIds !== undefined && (!Array.isArray(value.fileIds) || value.fileIds.some((item) => typeof item !== 'string'))) {
    throw new AppError('RESOURCE_FILE_IDS_INVALID', 'Resource fileIds must be an array of strings.', 400);
  }
  return {
    title: typeof value.title === 'string' ? value.title : undefined,
    description: typeof value.description === 'string' ? value.description : undefined,
    version: typeof value.version === 'string' ? value.version : undefined,
    changelog: typeof value.changelog === 'string' ? value.changelog : undefined,
    license: typeof value.license === 'string' ? value.license : undefined,
    allowDownload: typeof value.allowDownload === 'boolean' ? value.allowDownload : undefined,
    showSource: typeof value.showSource === 'boolean' ? value.showSource : undefined,
    requiresLogin: typeof value.requiresLogin === 'boolean' ? value.requiresLogin : undefined,
    fileIds: Array.isArray(value.fileIds) ? value.fileIds.filter((item): item is string => typeof item === 'string') : undefined,
  };
}

function languageForName(filename: string): string | undefined {
  const extension = filename.toLowerCase().split('.').pop();
  return {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    json: 'json',
    py: 'python',
    html: 'html',
    css: 'css',
    md: 'markdown',
    txt: 'text',
    sql: 'sql',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    csv: 'csv',
  }[extension ?? ''];
}

function ownerRequired(actor: ResourceActor, message: string): void {
  if (actor.staffRole !== 'owner') throw new AppError('RESOURCE_OWNER_REQUIRED', message, 403);
}

export function resourceToPostOut(
  row: {
    id: string;
    title: string;
    description: string;
    license: string;
    allowDownload: boolean;
    showSource: boolean;
    requiresLogin: boolean;
  },
  versions: Array<{
    id: string;
    version: string;
    changelog: string;
    publishedAt: string | null;
    files: Array<{
      id: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
      sha256: string;
      previewable: boolean;
      downloadCount: number;
    }>;
  }>,
  includeVersions = false,
): PostResourceOutput {
  const publicVersions = versions.map((version) => ({
    id: version.id,
    version: version.version,
    changelog: version.changelog,
    publishedAt: version.publishedAt,
    files: version.files.map((file) => ({
      id: file.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      sizeLabel: resourceSizeLabel(file.sizeBytes),
      sha256: file.sha256,
      previewable: file.previewable,
      downloadCount: file.downloadCount,
      ...(languageForName(file.originalName) ? { language: languageForName(file.originalName) } : {}),
    })),
  }));
  const currentVersion = publicVersions[0];
  if (!currentVersion) throw new AppError('RESOURCE_VERSION_NOT_FOUND', 'Resource has no published version.', 404);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    license: row.license,
    allowDownload: row.allowDownload,
    showSource: row.showSource,
    requiresLogin: row.requiresLogin,
    currentVersion,
    ...(includeVersions ? { versions: publicVersions } : {}),
  };
}

export class ResourcesService {
  private checksumCursor = '';

  constructor(private readonly db: Database, private readonly storage: ResourceStorageService) {}

  async stageUpload(actor: ResourceActor, file: ResourceUploadFile): Promise<ResourceFileOutput> {
    ownerRequired(actor, 'Only the owner can upload resource files.');
    const stored = file.tempPath ? await this.storage.saveTempFile(file) : this.storage.save(file);
    try {
      const row = await this.db.resourceFile.create({
        data: {
          id: id('rfile'),
          uploadedBy: actor.userId,
          status: 'staged',
          originalName: stored.originalName,
          storageKey: stored.storageKey,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          sha256: stored.sha256,
          previewable: stored.previewable,
          createdAt: now(),
        },
      });
      return this.fileToOut(row, stored.language);
    } catch (error) {
      try {
        this.storage.remove(stored.storageKey);
      } catch {
        // Preserve the original DB error; the cleanup worker can reconcile storage later.
      }
      throw error;
    }
  }

  async removeStagedFile(fileId: string, actor: ResourceActor): Promise<void> {
    ownerRequired(actor, 'Only the owner can remove a staged resource file.');
    const file = await this.db.$transaction(async (tx) => {
      const current = await tx.resourceFile.findFirst({ where: { id: fileId, uploadedBy: actor.userId, status: { in: ['staged', 'deleting'] }, resourceVersionId: null } });
      if (!current) throw new AppError('RESOURCE_STAGED_NOT_FOUND', 'Staged resource file was not found.', 404);
      if (current.status !== 'deleting') {
        const claimed = await tx.resourceFile.updateMany({ where: { id: current.id, uploadedBy: actor.userId, status: 'staged', resourceVersionId: null }, data: { status: 'deleting' } });
        if (claimed.count !== 1) throw new AppError('RESOURCE_STAGED_CHANGED', 'The staged resource file changed; retry the operation.', 404);
      }
      return current;
    });
    this.storage.remove(file.storageKey);
    await this.db.resourceFile.deleteMany({ where: { id: file.id, uploadedBy: actor.userId, status: 'deleting', resourceVersionId: null } });
  }

  async createForPost(
    postId: string,
    postStatus: string,
    postTitle: string,
    postExcerpt: string,
    input: ResourceInput,
    actor: ResourceActor,
  ): Promise<{ fileIds: string[]; storageKeys: string[] }> {
    ownerRequired(actor, 'Only the owner can publish resources.');
    const fileIds = [...new Set((input.fileIds ?? []).map((item) => item.trim()).filter(Boolean))];
    if (fileIds.length === 0 || fileIds.length > RESOURCE_MAX_FILES) throw new AppError('RESOURCE_FILE_COUNT_INVALID', `A resource needs 1 to ${RESOURCE_MAX_FILES} files.`, 400);
    const files = await this.db.resourceFile.findMany({ where: { id: { in: fileIds }, uploadedBy: actor.userId, status: 'staged', resourceVersionId: null } });
    if (files.length !== fileIds.length) throw new AppError('RESOURCE_FILE_FORBIDDEN', 'One or more resource files are no longer valid.', 400);
    const title = (input.title?.trim() || postTitle.trim()).slice(0, 200);
    const description = (input.description?.trim() || postExcerpt.trim()).slice(0, 2_000);
    if (title.length < 3) throw new AppError('RESOURCE_TITLE_INVALID', 'Resource title is too short.', 400);
    const version = normalizeVersion(input.version);
    const license = normalizeLicense(input.license);
    const timestamp = now();
    const resourceId = id('resource');
    const versionId = id('rver');
    const publishedAt = postStatus === 'published' ? timestamp : null;
    await this.db.$transaction(async (tx) => {
      await tx.resource.create({ data: { id: resourceId, postId, title, description, license, allowDownload: input.allowDownload !== false, showSource: input.showSource !== false, requiresLogin: input.requiresLogin === true, status: 'active', createdAt: timestamp, updatedAt: timestamp } });
      await tx.resourceVersion.create({ data: { id: versionId, resourceId, version, changelog: input.changelog?.trim().slice(0, 4_000) || '', status: postStatus === 'published' ? 'published' : postStatus, publishedAt, createdAt: timestamp } });
      const attached = await tx.resourceFile.updateMany({ where: { id: { in: fileIds }, uploadedBy: actor.userId, status: 'staged', resourceVersionId: null }, data: { resourceVersionId: versionId, status: 'active' } });
      if (attached.count !== fileIds.length) throw new AppError('RESOURCE_FILE_CHANGED', 'One or more resource files changed while publishing.', 400);
    });
    return { fileIds, storageKeys: files.map((file) => file.storageKey) };
  }

  async listPublished(query?: { q?: string; limit?: string }): Promise<ResourceListItem[]> {
    const limit = Math.min(40, Math.max(1, Number(query?.limit) || 24));
    const q = query?.q?.trim().slice(0, 120);
    const rows = await this.db.resource.findMany({
      where: { status: 'active', post: { status: 'published', deletedAt: null, ...(q ? { OR: [{ title: { contains: q } }, { excerpt: { contains: q } }, { content: { contains: q } }] } : {}) } },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        post: { select: { slug: true, title: true, excerpt: true, coverImage: true, authorName: true, authorAvatar: true, publishedAt: true } },
        versions: { where: { status: 'published' }, orderBy: { createdAt: 'desc' }, take: 1, include: { files: { where: { status: 'active' }, orderBy: { createdAt: 'asc' } } } },
      },
    });
    return rows.flatMap((row) => {
      if (!row.versions[0]) return [];
      return [{ ...resourceToPostOut(row, row.versions), postSlug: row.post.slug, postTitle: row.post.title, postExcerpt: row.post.excerpt, postCoverImage: row.post.coverImage, authorName: row.post.authorName, authorAvatar: row.post.authorAvatar, publishedAt: row.post.publishedAt }];
    });
  }

  async getPublishedByPostSlug(slug: string, includeVersions = true): Promise<ResourceListItem | null> {
    const row = await this.db.resource.findFirst({
      where: { status: 'active', post: { slug, status: 'published', deletedAt: null } },
      include: {
        post: { select: { slug: true, title: true, excerpt: true, coverImage: true, authorName: true, authorAvatar: true, publishedAt: true } },
        versions: { where: { status: 'published' }, orderBy: { createdAt: 'desc' }, ...(includeVersions ? {} : { take: 1 }), include: { files: { where: { status: 'active' }, orderBy: { createdAt: 'asc' } } } },
      },
    });
    if (!row || !row.versions[0]) return null;
    return { ...resourceToPostOut(row, row.versions, includeVersions), postSlug: row.post.slug, postTitle: row.post.title, postExcerpt: row.post.excerpt, postCoverImage: row.post.coverImage, authorName: row.post.authorName, authorAvatar: row.post.authorAvatar, publishedAt: row.post.publishedAt };
  }

  async getPublishedById(resourceId: string): Promise<ResourceListItem | null> {
    const row = await this.db.resource.findFirst({
      where: { id: resourceId, status: 'active', post: { status: 'published', deletedAt: null } },
      include: {
        post: { select: { slug: true, title: true, excerpt: true, coverImage: true, authorName: true, authorAvatar: true, publishedAt: true } },
        versions: { where: { status: 'published' }, orderBy: { createdAt: 'desc' }, include: { files: { where: { status: 'active' }, orderBy: { createdAt: 'asc' } } } },
      },
    });
    if (!row || !row.versions[0]) return null;
    return { ...resourceToPostOut(row, row.versions, true), postSlug: row.post.slug, postTitle: row.post.title, postExcerpt: row.post.excerpt, postCoverImage: row.post.coverImage, authorName: row.post.authorName, authorAvatar: row.post.authorAvatar, publishedAt: row.post.publishedAt };
  }

  async previewFile(fileId: string, userId?: string | null): Promise<ResourcePreviewOutput> {
    const file = await this.publishedFile(fileId);
    const resource = file.resourceVersion!.resource;
    if (resource.requiresLogin && !userId) throw new AppError('RESOURCE_LOGIN_REQUIRED', 'Log in to preview this resource source.', 401);
    return this.previewRecord(file, resource.showSource);
  }

  async previewStagedFile(fileId: string, actor: ResourceActor): Promise<ResourcePreviewOutput> {
    ownerRequired(actor, 'Only the owner can preview staged resource files.');
    const file = await this.db.resourceFile.findFirst({ where: { id: fileId, uploadedBy: actor.userId, status: 'staged', resourceVersionId: null } });
    if (!file) throw new AppError('RESOURCE_STAGED_NOT_FOUND', 'Staged resource file was not found.', 404);
    return this.previewRecord(file, true);
  }

  async downloadFile(fileId: string, userId?: string | null): Promise<{ filename: string; mimeType: string; buffer: Buffer }> {
    const file = await this.publishedFile(fileId);
    const resource = file.resourceVersion!.resource;
    if (!resource.allowDownload) throw new AppError('RESOURCE_DOWNLOAD_DISABLED', 'This resource is view-only and cannot be downloaded.', 403);
    if (resource.requiresLogin && !userId) throw new AppError('RESOURCE_LOGIN_REQUIRED', 'Log in to download this resource.', 401);
    const buffer = this.storage.read(file.storageKey);
    // Delivery has already succeeded. Counter telemetry is best-effort so a
    // concurrent SQLite writer cannot turn a valid download into an error.
    void withDatabaseRetry(
      () => this.db.resourceFile.update({ where: { id: file.id }, data: { downloadCount: { increment: 1 } } }),
      2,
    ).catch(() => undefined);
    return { filename: file.originalName, mimeType: file.mimeType, buffer };
  }

  async downloadFileStream(fileId: string, userId?: string | null) {
    const file = await this.publishedFile(fileId);
    const resource = file.resourceVersion!.resource;
    if (!resource.allowDownload) throw new AppError('RESOURCE_DOWNLOAD_DISABLED', 'This resource is view-only and cannot be downloaded.', 403);
    if (resource.requiresLogin && !userId) throw new AppError('RESOURCE_LOGIN_REQUIRED', 'Log in to download this resource.', 401);
    const opened = this.storage.openVerified(file.storageKey, file.sha256, file.sizeBytes);
    void withDatabaseRetry(
      () => this.db.resourceFile.update({ where: { id: file.id }, data: { downloadCount: { increment: 1 } } }),
      2,
    ).catch(() => undefined);
    return { filename: file.originalName, mimeType: file.mimeType, sizeBytes: opened.sizeBytes, stream: opened.stream };
  }

  async viewImage(fileId: string, userId?: string | null): Promise<{ filename: string; mimeType: string; buffer: Buffer }> {
    const file = await this.publishedFile(fileId);
    const resource = file.resourceVersion!.resource;
    if (!file.mimeType.startsWith('image/')) throw new AppError('RESOURCE_IMAGE_NOT_FOUND', 'This resource file is not an image.', 404);
    if (resource.requiresLogin && !userId) throw new AppError('RESOURCE_LOGIN_REQUIRED', 'Log in to view this resource image.', 401);
    return { filename: file.originalName, mimeType: file.mimeType, buffer: this.storage.read(file.storageKey) };
  }

  async viewImageStream(fileId: string, userId?: string | null) {
    const file = await this.publishedFile(fileId);
    const resource = file.resourceVersion!.resource;
    if (!file.mimeType.startsWith('image/')) throw new AppError('RESOURCE_IMAGE_NOT_FOUND', 'This resource file is not an image.', 404);
    if (resource.requiresLogin && !userId) throw new AppError('RESOURCE_LOGIN_REQUIRED', 'Log in to view this resource image.', 401);
    const opened = this.storage.openVerified(file.storageKey, file.sha256, file.sizeBytes);
    return { filename: file.originalName, mimeType: file.mimeType, sizeBytes: opened.sizeBytes, stream: opened.stream };
  }

  removeStorageKeys(storageKeys: string[]): void {
    for (const storageKey of storageKeys) {
      try {
        this.storage.remove(storageKey);
      } catch {
        // Best effort; reconciliation can remove an orphan later.
      }
    }
  }

  async reconcileStorage(graceMs = orphanGraceMs()): Promise<{
    missingResourceFiles: number;
    sizeMismatches: number;
    sha256Mismatches: number;
    checksumFilesChecked: number;
    checksumFilesSkipped: number;
    removedOrphanFiles: number;
    skippedRecentFiles: number;
  }> {
    const rows = await this.db.resourceFile.findMany({
      select: { id: true, storageKey: true, sizeBytes: true, sha256: true, status: true },
    });
    const diskFiles = this.storage.listFiles();
    const diskByKey = new Map(diskFiles.map((file) => [file.storageKey, file]));
    let missingResourceFiles = 0;
    let sizeMismatches = 0;
    let sha256Mismatches = 0;
    for (const row of rows) {
      const diskFile = diskByKey.get(row.storageKey);
      const missing = !diskFile;
      const sizeMismatch = Boolean(diskFile && diskFile.sizeBytes !== row.sizeBytes);
      if (!missing && !sizeMismatch) continue;
      const updated = await this.db.resourceFile.updateMany({
        where: {
          id: row.id,
          storageKey: row.storageKey,
          status: { in: ['staged', 'active', 'deleting'] },
        },
        data: { status: 'orphaned' },
      });
      if (updated.count !== 1) continue;
      if (missing) missingResourceFiles += 1;
      if (sizeMismatch) sizeMismatches += 1;
    }

    const checksumCandidates = rows.filter((row) => {
      const diskFile = diskByKey.get(row.storageKey);
      return ['staged', 'active', 'deleting'].includes(row.status)
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
      const updated = await this.db.resourceFile.updateMany({
        where: {
          id: row.id,
          storageKey: row.storageKey,
          status: { in: ['staged', 'active', 'deleting'] },
        },
        data: { status: 'orphaned' },
      });
      if (updated.count !== 1) continue;
      if (digestSize !== row.sizeBytes) sizeMismatches += 1;
      else sha256Mismatches += 1;
    }

    const knownKeys = new Set(rows.map((row) => row.storageKey));
    const configuredGrace = Number.isFinite(graceMs) ? graceMs : orphanGraceMs();
    const cutoff = Date.now() - Math.max(60_000, configuredGrace);
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
      missingResourceFiles,
      sizeMismatches,
      sha256Mismatches,
      checksumFilesChecked,
      checksumFilesSkipped: checksumBatch.skipped,
      removedOrphanFiles,
      skippedRecentFiles,
    };
  }

  /**
   * Remove abandoned staged files without touching files already attached to a
   * resource version. Claiming the row before deleting bytes makes this safe
   * against a concurrent publish/delete request; a failed storage operation
   * returns the claim to `staged` so a later maintenance pass can retry it.
   */
  async cleanupStagedFiles(olderThanMs = STAGED_FILE_TTL_MS): Promise<number> {
    const ttl = Number.isFinite(olderThanMs) ? Math.min(Math.max(olderThanMs, 60_000), 30 * 24 * 60 * 60 * 1_000) : STAGED_FILE_TTL_MS;
    const cutoff = new Date(Date.now() - ttl).toISOString();
    const stale = await this.db.resourceFile.findMany({
      where: { status: 'staged', resourceVersionId: null, createdAt: { lt: cutoff } },
      select: { id: true, storageKey: true },
    });
    let removed = 0;
    for (const file of stale) {
      const claimed = await this.db.resourceFile.updateMany({
        where: { id: file.id, status: 'staged', resourceVersionId: null },
        data: { status: 'deleting' },
      });
      if (claimed.count !== 1) continue;
      try {
        this.storage.remove(file.storageKey);
      } catch {
        await this.db.resourceFile.updateMany({ where: { id: file.id, status: 'deleting', resourceVersionId: null }, data: { status: 'staged' } });
        continue;
      }
      const deleted = await this.db.resourceFile.deleteMany({
        where: { id: file.id, status: 'deleting', resourceVersionId: null },
      });
      removed += deleted.count;
    }
    return removed;
  }

  toPostResource(row: Parameters<typeof resourceToPostOut>[0], versions: Parameters<typeof resourceToPostOut>[1], includeVersions = false): PostResourceOutput {
    return resourceToPostOut(row, versions, includeVersions);
  }

  private fileToOut(file: { id: string; originalName: string; mimeType: string; sizeBytes: number; sha256: string; previewable: boolean; downloadCount: number }, language?: string): ResourceFileOutput {
    return { id: file.id, originalName: file.originalName, mimeType: file.mimeType, sizeBytes: file.sizeBytes, sizeLabel: resourceSizeLabel(file.sizeBytes), sha256: file.sha256, previewable: file.previewable, downloadCount: file.downloadCount, ...(language ? { language } : {}) };
  }

  private previewRecord(file: { id: string; originalName: string; mimeType: string; sha256: string; sizeBytes: number; storageKey: string; previewable: boolean }, showSource: boolean): ResourcePreviewOutput {
    if (!showSource || !file.previewable) throw new AppError('RESOURCE_SOURCE_HIDDEN', 'This resource file does not allow source preview.', 403);
    if (file.sizeBytes > RESOURCE_PREVIEW_MAX_BYTES) throw new AppError('RESOURCE_PREVIEW_TOO_LARGE', 'This file is too large for inline preview.', 400);
    return { fileId: file.id, filename: file.originalName, mimeType: file.mimeType, sha256: file.sha256, sizeBytes: file.sizeBytes, content: this.storage.read(file.storageKey).toString('utf8') };
  }

  private async publishedFile(fileId: string) {
    const file = await this.db.resourceFile.findFirst({
      where: { id: fileId, status: 'active', resourceVersion: { status: 'published', resource: { status: 'active', post: { status: 'published', deletedAt: null } } } },
      include: { resourceVersion: { include: { resource: { include: { post: { select: { status: true, deletedAt: true } } } } } } },
    });
    if (!file?.resourceVersion) throw new AppError('RESOURCE_FILE_NOT_FOUND', 'Published resource file was not found.', 404);
    return file;
  }
}
