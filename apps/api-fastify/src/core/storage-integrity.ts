import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

export type FileDigest = {
  sizeBytes: number;
  sha256: string;
};

export const STORAGE_CHECKSUM_DEFAULT_MAX_FILES = 256;
const STORAGE_CHECKSUM_MAX_FILES_LIMIT = 100_000;

/**
 * Keep the maintenance pass bounded by default. A value of 0 explicitly
 * requests a full pass; positive values are rotated between passes by the
 * caller so a large storage tree is eventually covered without starving
 * later keys.
 */
export function storageChecksumMaxFiles(): number {
  const configured = process.env.TB_STORAGE_CHECKSUM_MAX_FILES;
  if (configured === undefined || configured.trim() === '') return STORAGE_CHECKSUM_DEFAULT_MAX_FILES;
  const value = Number(configured);
  if (!Number.isFinite(value) || value < 0) return STORAGE_CHECKSUM_DEFAULT_MAX_FILES;
  if (value === 0) return 0;
  return Math.min(Math.max(Math.floor(value), 1), STORAGE_CHECKSUM_MAX_FILES_LIMIT);
}

export function rotateChecksumBatch<T extends { storageKey: string }>(
  values: readonly T[],
  cursor: string,
  maxFiles: number,
): { selected: T[]; skipped: number } {
  const ordered = [...values].sort((left, right) => left.storageKey.localeCompare(right.storageKey));
  if (ordered.length === 0) return { selected: [], skipped: 0 };
  if (maxFiles === 0 || maxFiles >= ordered.length) return { selected: ordered, skipped: 0 };

  const firstAfterCursor = cursor
    ? ordered.findIndex((value) => value.storageKey > cursor)
    : 0;
  const start = firstAfterCursor >= 0 ? firstAfterCursor : 0;
  const selected = ordered.slice(start, start + maxFiles);
  if (selected.length < maxFiles && start > 0) {
    selected.push(...ordered.slice(0, maxFiles - selected.length));
  }
  return { selected, skipped: ordered.length - selected.length };
}

export async function digestFile(path: string): Promise<FileDigest> {
  const metadata = await stat(path);
  if (!metadata.isFile()) throw new Error('Storage path is not a file.');
  const digest = createHash('sha256');
  let sizeBytes = 0;
  for await (const chunk of createReadStream(path)) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    sizeBytes += buffer.length;
    digest.update(buffer);
  }
  return { sizeBytes, sha256: digest.digest('hex') };
}
