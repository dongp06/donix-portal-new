import { createHash, randomUUID } from 'node:crypto';
import {
  createReadStream,
  readdirSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { apiRoot } from '../../core/database.js';
import { AppError } from '../../core/errors.js';
import { digestFile, type FileDigest } from '../../core/storage-integrity.js';
import { Transform } from 'node:stream';

export const MEDIA_MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const IMAGE_TYPES = {
  jpeg: { mimeType: 'image/jpeg', extensions: ['.jpg', '.jpeg'] },
  png: { mimeType: 'image/png', extensions: ['.png'] },
  gif: { mimeType: 'image/gif', extensions: ['.gif'] },
  webp: { mimeType: 'image/webp', extensions: ['.webp'] },
} as const;

const IMAGE_USAGES = new Set([
  'post_inline',
  'post_cover',
  'bot_logo',
  'bot_cover',
  'bot_demo',
  'pricing_image',
  'resource_image',
  'review_image',
]);

export type MediaUsage =
  | 'post_inline'
  | 'post_cover'
  | 'bot_logo'
  | 'bot_cover'
  | 'bot_demo'
  | 'pricing_image'
  | 'resource_image'
  | 'review_image';

export type UploadedImage = {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  sha256: string;
  storageKey: string;
  buffer: Buffer;
};

export type MediaStorageFile = {
  storageKey: string;
  sizeBytes: number;
  modifiedAtMs: number;
};

type ImageDimensions = { width: number; height: number };
type ImageKind = keyof typeof IMAGE_TYPES;

export function normalizeMediaUsage(value?: string): MediaUsage {
  const usage = value?.trim().toLowerCase() || 'post_inline';
  if (!IMAGE_USAGES.has(usage)) {
    throw new AppError('MEDIA_USAGE_INVALID', 'Image usage is invalid.', 400);
  }
  return usage as MediaUsage;
}

function safeOriginalName(value: string | undefined): string {
  const withoutControls = Array.from(value || 'image')
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 0x20 && code !== 0x7f;
    })
    .join('');
  const name = basename(withoutControls.replace(/[\\/]+/g, '/')).trim();
  return name.slice(0, 180) || 'image';
}

function hasMagic(buffer: Buffer, kind: ImageKind): boolean {
  if (kind === 'jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (kind === 'png') {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (kind === 'gif') {
    const header = buffer.subarray(0, 6).toString('ascii');
    return header === 'GIF87a' || header === 'GIF89a';
  }
  return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
}

function detectKind(buffer: Buffer): ImageKind | null {
  for (const kind of Object.keys(IMAGE_TYPES) as ImageKind[]) {
    if (hasMagic(buffer, kind)) return kind;
  }
  return null;
}

function readUInt24LE(buffer: Buffer, offset: number): number {
  return (buffer[offset] ?? 0) | ((buffer[offset + 1] ?? 0) << 8) | ((buffer[offset + 2] ?? 0) << 16);
}

function readJpegDimensions(buffer: Buffer): ImageDimensions | null {
  let offset = 2;
  while (offset + 1 < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    if (offset >= buffer.length) return null;
    const marker = buffer[offset++] ?? 0;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (marker === 0xda || offset + 2 > buffer.length) break;
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) return null;
    const frame = (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (frame && segmentLength >= 7) {
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    offset += segmentLength;
  }
  return null;
}

function readWebpDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 16) return null;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkType = buffer.toString('ascii', offset, offset + 4);
    const chunkLength = buffer.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + chunkLength;
    if (dataEnd > buffer.length) return null;
    if (chunkType === 'VP8X' && chunkLength >= 10) {
      const width = 1 + readUInt24LE(buffer, dataStart + 4);
      const height = 1 + readUInt24LE(buffer, dataStart + 7);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    if (chunkType === 'VP8L' && chunkLength >= 5 && buffer[dataStart] === 0x2f) {
      const width = 1 + (((buffer[dataStart + 1] ?? 0) | ((buffer[dataStart + 2] ?? 0) << 8)) & 0x3fff);
      const height = 1 + ((((buffer[dataStart + 2] ?? 0) >> 6) | ((buffer[dataStart + 3] ?? 0) << 2) | (((buffer[dataStart + 4] ?? 0) & 0x3f) << 10)) & 0x3fff);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    if (chunkType === 'VP8 ' && chunkLength >= 10) {
      const frameStart = dataStart + 3;
      if (buffer[frameStart] === 0x9d && buffer[frameStart + 1] === 0x01 && buffer[frameStart + 2] === 0x2a) {
        const width = buffer.readUInt16LE(frameStart + 3) & 0x3fff;
        const height = buffer.readUInt16LE(frameStart + 5) & 0x3fff;
        return width > 0 && height > 0 ? { width, height } : null;
      }
    }
    offset = dataEnd + (chunkLength % 2);
  }
  return null;
}

function readImageDimensions(buffer: Buffer, kind: ImageKind): ImageDimensions | null {
  if (kind === 'png' && buffer.length >= 24) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return width > 0 && height > 0 ? { width, height } : null;
  }
  if (kind === 'gif' && buffer.length >= 10) {
    const width = buffer.readUInt16LE(6);
    const height = buffer.readUInt16LE(8);
    return width > 0 && height > 0 ? { width, height } : null;
  }
  if (kind === 'jpeg') return readJpegDimensions(buffer);
  if (kind === 'webp') return readWebpDimensions(buffer);
  return null;
}

export class MediaStorageService {
  private readonly root: string;

  constructor() {
    const configured = process.env.MEDIA_DIR?.trim();
    this.root = configured
      ? (isAbsolute(configured) ? resolve(configured) : resolve(apiRoot(), configured))
      : resolve(apiRoot(), 'storage', 'media');
    if (!isAbsolute(this.root)) throw new Error('MEDIA_DIR must resolve to an absolute path.');
    mkdirSync(this.root, { recursive: true });
  }

  saveImage(originalName: string | undefined, mimetype: string | undefined, buffer: Buffer): UploadedImage {
    if (!buffer?.length) throw new AppError('MEDIA_FILE_REQUIRED', 'An image file is required.', 400);
    if (buffer.length > MEDIA_MAX_IMAGE_SIZE) throw new AppError('MEDIA_TOO_LARGE', 'Image must be smaller than 10 MB.', 413);
    const safeName = safeOriginalName(originalName);
    const extension = safeName.includes('.') ? `.${safeName.split('.').pop()!.toLowerCase()}` : '';
    const kind = detectKind(buffer);
    const declaredMime = mimetype?.split(';', 1)[0]?.trim().toLowerCase() || '';
    if (!kind || !IMAGE_TYPES[kind].extensions.some((candidate) => candidate === extension)) {
      throw new AppError('MEDIA_FORMAT_INVALID', 'Image format or content is invalid.', 400);
    }
    if (declaredMime !== IMAGE_TYPES[kind].mimeType) {
      throw new AppError('MEDIA_MIME_MISMATCH', 'Image MIME type does not match its content.', 400);
    }
    const dimensions = readImageDimensions(buffer, kind);
    if (!dimensions) throw new AppError('MEDIA_DIMENSIONS_INVALID', 'Image dimensions could not be read.', 400);
    const date = new Date();
    const year = String(date.getUTCFullYear());
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    mkdirSync(join(this.root, year, month), { recursive: true });
    const storageKey = `${year}/${month}/${randomUUID()}.bin`;
    writeFileSync(this.resolveKey(storageKey), buffer, { flag: 'wx', mode: 0o600 });
    return {
      originalName: safeName,
      mimeType: IMAGE_TYPES[kind].mimeType,
      sizeBytes: buffer.length,
      width: dimensions.width,
      height: dimensions.height,
      sha256: createHash('sha256').update(buffer).digest('hex'),
      storageKey,
      buffer,
    };
  }

  read(storageKey: string): Buffer {
    const path = this.resolveKey(storageKey);
    if (!existsSync(path)) throw new AppError('MEDIA_NOT_FOUND', 'Media was not found.', 404);
    return readFileSync(path);
  }

  openVerified(storageKey: string, expectedSha256: string, expectedSizeBytes: number) {
    const path = this.resolveKey(storageKey);
    if (!existsSync(path)) throw new AppError('MEDIA_NOT_FOUND', 'Media was not found.', 404);
    let sizeBytes: number;
    try {
      const stat = statSync(path);
      if (!stat.isFile()) throw new Error('not a file');
      sizeBytes = stat.size;
    } catch {
      throw new AppError('MEDIA_NOT_FOUND', 'Media was not found.', 404);
    }
    if (sizeBytes !== expectedSizeBytes || !/^[a-f0-9]{64}$/i.test(expectedSha256)) {
      throw new AppError('MEDIA_NOT_FOUND', 'Media was not found.', 404);
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
          callback(new AppError('MEDIA_NOT_FOUND', 'Media was not found.', 404));
          return;
        }
        callback();
      },
    });
    const source = createReadStream(path);
    source.once('error', (error) => verifier.destroy(error as Error));
    source.pipe(verifier);
    return { stream: verifier, sizeBytes };
  }

  digest(storageKey: string): Promise<FileDigest> {
    return digestFile(this.resolveKey(storageKey));
  }

  remove(storageKey: string): void {
    const path = this.resolveKey(storageKey);
    if (existsSync(path)) unlinkSync(path);
  }

  listFiles(): MediaStorageFile[] {
    const files: MediaStorageFile[] = [];
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
          const storageKey = relative(this.root, path).replace(/\\/g, '/');
          if (storageKey) files.push({ storageKey, sizeBytes: stat.size, modifiedAtMs: stat.mtimeMs });
        } catch {
          // A concurrent upload/delete is reconciled on the next pass.
        }
      }
    };
    visit(this.root);
    return files;
  }

  private resolveKey(storageKey: string): string {
    if (typeof storageKey !== 'string' || !storageKey.trim()) throw new AppError('MEDIA_STORAGE_KEY_INVALID', 'Storage key is invalid.', 400);
    const normalized = storageKey.replace(/\\/g, '/').replace(/^\/+/, '');
    const candidate = resolve(this.root, normalized);
    const relativePath = relative(this.root, candidate);
    if (!relativePath || relativePath.startsWith('..') || isAbsolute(relativePath)) {
      throw new AppError('MEDIA_STORAGE_KEY_INVALID', 'Storage key is invalid.', 400);
    }
    return candidate;
  }
}
