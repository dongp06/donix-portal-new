import { createHash, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { extname, isAbsolute, join, resolve } from 'node:path';
import { apiRoot } from '../../core/database.js';
import { AppError } from '../../core/errors.js';
import { digestFile, type FileDigest } from '../../core/storage-integrity.js';

export const RESOURCE_MAX_FILE_SIZE = 50 * 1024 * 1024;
export const RESOURCE_MAX_FILES = 20;
export const RESOURCE_PREVIEW_MAX_BYTES = 2 * 1024 * 1024;

type ResourceFileRule = {
  mimeType: string;
  previewable: boolean;
  language?: string;
  acceptedMimeTypes: readonly string[];
};

const FILE_RULES: Record<string, ResourceFileRule> = {
  '.js': { mimeType: 'text/javascript', previewable: true, language: 'javascript', acceptedMimeTypes: ['text/javascript', 'application/javascript', 'text/plain', 'application/octet-stream'] },
  '.ts': { mimeType: 'text/typescript', previewable: true, language: 'typescript', acceptedMimeTypes: ['text/typescript', 'text/plain', 'application/octet-stream'] },
  '.tsx': { mimeType: 'text/tsx', previewable: true, language: 'typescript', acceptedMimeTypes: ['text/tsx', 'text/typescript', 'text/plain', 'application/octet-stream'] },
  '.jsx': { mimeType: 'text/jsx', previewable: true, language: 'javascript', acceptedMimeTypes: ['text/jsx', 'text/javascript', 'text/plain', 'application/octet-stream'] },
  '.json': { mimeType: 'application/json', previewable: true, language: 'json', acceptedMimeTypes: ['application/json', 'text/json', 'text/plain', 'application/octet-stream'] },
  '.py': { mimeType: 'text/x-python', previewable: true, language: 'python', acceptedMimeTypes: ['text/x-python', 'text/plain', 'application/octet-stream'] },
  '.html': { mimeType: 'text/html', previewable: true, language: 'html', acceptedMimeTypes: ['text/html', 'text/plain', 'application/octet-stream'] },
  '.css': { mimeType: 'text/css', previewable: true, language: 'css', acceptedMimeTypes: ['text/css', 'text/plain', 'application/octet-stream'] },
  '.md': { mimeType: 'text/markdown', previewable: true, language: 'markdown', acceptedMimeTypes: ['text/markdown', 'text/plain', 'application/octet-stream'] },
  '.txt': { mimeType: 'text/plain', previewable: true, language: 'text', acceptedMimeTypes: ['text/plain', 'application/octet-stream'] },
  '.sql': { mimeType: 'application/sql', previewable: true, language: 'sql', acceptedMimeTypes: ['application/sql', 'text/sql', 'text/plain', 'application/octet-stream'] },
  '.yaml': { mimeType: 'text/yaml', previewable: true, language: 'yaml', acceptedMimeTypes: ['text/yaml', 'application/yaml', 'text/plain', 'application/octet-stream'] },
  '.yml': { mimeType: 'text/yaml', previewable: true, language: 'yaml', acceptedMimeTypes: ['text/yaml', 'application/yaml', 'text/plain', 'application/octet-stream'] },
  '.xml': { mimeType: 'application/xml', previewable: true, language: 'xml', acceptedMimeTypes: ['application/xml', 'text/xml', 'text/plain', 'application/octet-stream'] },
  '.csv': { mimeType: 'text/csv', previewable: true, language: 'csv', acceptedMimeTypes: ['text/csv', 'application/csv', 'text/plain', 'application/octet-stream'] },
  '.zip': { mimeType: 'application/zip', previewable: false, acceptedMimeTypes: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'] },
  '.rar': { mimeType: 'application/vnd.rar', previewable: false, acceptedMimeTypes: ['application/vnd.rar', 'application/x-rar-compressed', 'application/octet-stream'] },
  '.7z': { mimeType: 'application/x-7z-compressed', previewable: false, acceptedMimeTypes: ['application/x-7z-compressed', 'application/octet-stream'] },
  '.pdf': { mimeType: 'application/pdf', previewable: false, acceptedMimeTypes: ['application/pdf', 'application/octet-stream'] },
  '.png': { mimeType: 'image/png', previewable: false, acceptedMimeTypes: ['image/png'] },
  '.jpg': { mimeType: 'image/jpeg', previewable: false, acceptedMimeTypes: ['image/jpeg'] },
  '.jpeg': { mimeType: 'image/jpeg', previewable: false, acceptedMimeTypes: ['image/jpeg'] },
  '.gif': { mimeType: 'image/gif', previewable: false, acceptedMimeTypes: ['image/gif'] },
  '.webp': { mimeType: 'image/webp', previewable: false, acceptedMimeTypes: ['image/webp'] },
};

export type ResourceUploadFile = {
  originalname: string;
  mimetype: string;
  buffer?: Buffer;
  tempPath?: string;
};

export type StoredResourceFile = {
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  previewable: boolean;
  language?: string;
};

export type OpenedResourceFile = {
  stream: NodeJS.ReadableStream;
  sizeBytes: number;
};

export type ResourceStorageFile = {
  storageKey: string;
  sizeBytes: number;
  modifiedAtMs: number;
};

function safeOriginalName(value: string): string {
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/]+/g, '-')
    .trim()
    .slice(0, 180);
  return cleaned || 'resource-file';
}

export function normalizeResourceMime(value: string | undefined): string {
  return value?.split(';', 1)[0]?.trim().toLowerCase() || '';
}

export function magicBytesMatch(extension: string, buffer: Buffer): boolean {
  if (['.js', '.ts', '.tsx', '.jsx', '.json', '.py', '.html', '.css', '.md', '.txt', '.sql', '.yaml', '.yml', '.xml', '.csv'].includes(extension)) return true;
  if (extension === '.pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  if (extension === '.zip') return buffer.subarray(0, 2).toString('ascii') === 'PK';
  if (extension === '.rar') return buffer.subarray(0, 4).toString('ascii') === 'Rar!';
  if (extension === '.7z') return buffer.subarray(0, 6).equals(Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]));
  if (extension === '.png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (extension === '.jpg' || extension === '.jpeg') return buffer.subarray(0, 2).equals(Buffer.from([0xff, 0xd8]));
  if (extension === '.gif') return ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'));
  if (extension === '.webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  return false;
}

function isSafeTextPayload(buffer: Buffer): boolean {
  if (buffer.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

async function isSafeTextFile(path: string): Promise<boolean> {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    for await (const chunk of createReadStream(path)) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      if (buffer.includes(0)) return false;
      decoder.decode(buffer, { stream: true });
    }
    decoder.decode();
    return true;
  } catch {
    return false;
  }
}

function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function resourceSizeLabel(bytes: number): string {
  return sizeLabel(bytes);
}

export class ResourceStorageService {
  private readonly root: string;

  constructor() {
    const configured = process.env.RESOURCE_UPLOAD_DIR?.trim();
    const fallback = join(apiRoot(), 'storage', 'resources');
    this.root = configured ? (isAbsolute(configured) ? resolve(configured) : resolve(apiRoot(), configured)) : fallback;
    mkdirSync(this.root, { recursive: true });
  }

  save(file: ResourceUploadFile): StoredResourceFile {
    if (!file?.buffer?.length) throw new AppError('RESOURCE_FILE_INVALID', 'Resource file is empty or invalid.', 400);
    if (file.buffer.length > RESOURCE_MAX_FILE_SIZE) throw new AppError('RESOURCE_FILE_TOO_LARGE', 'A resource file may not exceed 50 MB.', 413);

    const originalName = safeOriginalName(file.originalname);
    const extension = extname(originalName).toLowerCase();
    const rule = FILE_RULES[extension];
    if (!rule) throw new AppError('RESOURCE_FORMAT_INVALID', 'This resource file format is not supported.', 400);
    const declaredMime = normalizeResourceMime(file.mimetype);
    if (!declaredMime || !rule.acceptedMimeTypes.includes(declaredMime)) throw new AppError('RESOURCE_MIME_MISMATCH', 'The file MIME type does not match its extension.', 400);
    if (!magicBytesMatch(extension, file.buffer)) throw new AppError('RESOURCE_MAGIC_MISMATCH', 'The file content does not match its extension.', 400);
    if (rule.previewable && !isSafeTextPayload(file.buffer)) throw new AppError('RESOURCE_TEXT_INVALID', 'Previewable resource files must be valid UTF-8 text without binary bytes.', 400);

    const storageKey = `${new Date().toISOString().slice(0, 10).replaceAll('-', '/')}/${randomBytes(20).toString('hex')}.bin`;
    const diskPath = this.resolveStorageKey(storageKey);
    mkdirSync(resolve(diskPath, '..'), { recursive: true });
    try {
      writeFileSync(diskPath, file.buffer, { flag: 'wx', mode: 0o600 });
    } catch {
      throw new AppError('RESOURCE_STORAGE_WRITE_FAILED', 'Resource file could not be stored.', 500);
    }
    return {
      storageKey,
      originalName,
      mimeType: rule.mimeType,
      sizeBytes: file.buffer.length,
      sha256: createHash('sha256').update(file.buffer).digest('hex'),
      previewable: rule.previewable,
      ...(rule.language ? { language: rule.language } : {}),
    };
  }

  async saveTempFile(file: ResourceUploadFile): Promise<StoredResourceFile> {
    const tempPath = file.tempPath;
    if (!tempPath) throw new AppError('RESOURCE_FILE_INVALID', 'Resource file is empty or invalid.', 400);
    let sizeBytes: number;
    try {
      sizeBytes = statSync(tempPath).size;
    } catch {
      throw new AppError('RESOURCE_FILE_INVALID', 'Resource file is empty or invalid.', 400);
    }
    if (sizeBytes <= 0) throw new AppError('RESOURCE_FILE_INVALID', 'Resource file is empty or invalid.', 400);
    if (sizeBytes > RESOURCE_MAX_FILE_SIZE) throw new AppError('RESOURCE_FILE_TOO_LARGE', 'A resource file may not exceed 50 MB.', 413);

    const originalName = safeOriginalName(file.originalname);
    const extension = extname(originalName).toLowerCase();
    const rule = FILE_RULES[extension];
    if (!rule) throw new AppError('RESOURCE_FORMAT_INVALID', 'This resource file format is not supported.', 400);
    const declaredMime = normalizeResourceMime(file.mimetype);
    if (!declaredMime || !rule.acceptedMimeTypes.includes(declaredMime)) throw new AppError('RESOURCE_MIME_MISMATCH', 'The file MIME type does not match its extension.', 400);
    const prefix = await this.readPrefix(tempPath);
    if (!magicBytesMatch(extension, prefix)) throw new AppError('RESOURCE_MAGIC_MISMATCH', 'The file content does not match its extension.', 400);
    if (rule.previewable && !(await isSafeTextFile(tempPath))) throw new AppError('RESOURCE_TEXT_INVALID', 'Previewable resource files must be valid UTF-8 text without binary bytes.', 400);

    const storageKey = `${new Date().toISOString().slice(0, 10).replaceAll('-', '/')}/${randomBytes(20).toString('hex')}.bin`;
    const diskPath = this.resolveStorageKey(storageKey);
    mkdirSync(resolve(diskPath, '..'), { recursive: true });
    const digest = createHash('sha256');
    let copiedBytes = 0;
    const counter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        copiedBytes += chunk.length;
        digest.update(chunk);
        callback(null, chunk);
      },
    });
    try {
      await pipeline(createReadStream(tempPath), counter, createWriteStream(diskPath, { flags: 'wx', mode: 0o600 }));
    } catch {
      await rm(diskPath, { force: true }).catch(() => undefined);
      throw new AppError('RESOURCE_STORAGE_WRITE_FAILED', 'Resource file could not be stored.', 500);
    }
    if (copiedBytes !== sizeBytes) {
      await rm(diskPath, { force: true }).catch(() => undefined);
      throw new AppError('RESOURCE_FILE_INVALID', 'Resource file changed during upload.', 400);
    }
    return {
      storageKey,
      originalName,
      mimeType: rule.mimeType,
      sizeBytes: copiedBytes,
      sha256: digest.digest('hex'),
      previewable: rule.previewable,
      ...(rule.language ? { language: rule.language } : {}),
    };
  }

  read(storageKey: string): Buffer {
    const diskPath = this.resolveStorageKey(storageKey);
    if (!existsSync(diskPath)) throw new AppError('RESOURCE_NOT_FOUND', 'Resource file was not found.', 404);
    try {
      return readFileSync(diskPath);
    } catch {
      throw new AppError('RESOURCE_STORAGE_READ_FAILED', 'Resource file could not be read.', 500);
    }
  }

  openVerified(storageKey: string, expectedSha256: string, expectedSizeBytes: number): OpenedResourceFile {
    const diskPath = this.resolveStorageKey(storageKey);
    if (!existsSync(diskPath)) throw new AppError('RESOURCE_NOT_FOUND', 'Resource file was not found.', 404);
    let sizeBytes: number;
    try {
      const stat = statSync(diskPath);
      if (!stat.isFile()) throw new Error('not a file');
      sizeBytes = stat.size;
    } catch {
      throw new AppError('RESOURCE_STORAGE_READ_FAILED', 'Resource file could not be read.', 500);
    }
    if (sizeBytes !== expectedSizeBytes || !/^[a-f0-9]{64}$/i.test(expectedSha256)) {
      throw new AppError('RESOURCE_STORAGE_INTEGRITY_FAILED', 'Resource file integrity check failed.', 409);
    }

    const digest = createHash('sha256');
    let copiedBytes = 0;
    const verifier = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        copiedBytes += chunk.length;
        digest.update(chunk);
        callback(null, chunk);
      },
      flush(callback) {
        if (copiedBytes !== expectedSizeBytes || digest.digest('hex') !== expectedSha256.toLowerCase()) {
          callback(new AppError('RESOURCE_STORAGE_INTEGRITY_FAILED', 'Resource file integrity check failed.', 409));
          return;
        }
        callback();
      },
    });
    const source = createReadStream(diskPath);
    source.once('error', (error) => verifier.destroy(error as Error));
    source.pipe(verifier);
    return { stream: verifier, sizeBytes };
  }

  digest(storageKey: string): Promise<FileDigest> {
    return digestFile(this.resolveStorageKey(storageKey));
  }

  remove(storageKey: string): void {
    const diskPath = this.resolveStorageKey(storageKey);
    if (existsSync(diskPath)) unlinkSync(diskPath);
  }

  listFiles(): ResourceStorageFile[] {
    const files: ResourceStorageFile[] = [];
    const root = resolve(this.root);
    const visit = (directory: string): void => {
      let entries;
      try {
        entries = readdirSync(directory, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry.isSymbolicLink()) continue;
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          visit(path);
          continue;
        }
        if (!entry.isFile() || !entry.name.endsWith('.bin')) continue;
        try {
          const stat = statSync(path);
          const storageKey = path.slice(root.length + 1).replace(/\\/g, '/');
          if (storageKey) files.push({ storageKey, sizeBytes: stat.size, modifiedAtMs: stat.mtimeMs });
        } catch {
          // A concurrent upload/delete is reconciled on the next pass.
        }
      }
    };
    visit(root);
    return files;
  }

  private resolveStorageKey(storageKey: string): string {
    if (!/^[a-zA-Z0-9/_-]+\.bin$/.test(storageKey)) throw new AppError('RESOURCE_STORAGE_KEY_INVALID', 'Resource storage key is invalid.', 404);
    const path = resolve(this.root, storageKey);
    const root = resolve(this.root);
    if (path !== root && !path.startsWith(`${root}\\`) && !path.startsWith(`${root}/`)) throw new AppError('RESOURCE_STORAGE_KEY_INVALID', 'Resource storage key is invalid.', 404);
    return path;
  }

  private async readPrefix(path: string): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of createReadStream(path, { start: 0, end: 64 * 1024 - 1 })) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks);
  }
}
