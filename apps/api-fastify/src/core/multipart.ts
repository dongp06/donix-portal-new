import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { FastifyRequest } from 'fastify';
import { bodyDigest } from './crypto.js';
import { AppError } from './errors.js';

/** Maximum bytes accepted by the shared multipart parser. Route-specific
 * policies may impose a smaller limit after the bounded stream is staged. */
export const MULTIPART_MAX_FILE_SIZE = 50 * 1024 * 1024;

export async function prepareMultipartRequest(request: FastifyRequest): Promise<void> {
  if (typeof request.parts !== 'function') throw new AppError('MULTIPART_UNAVAILABLE', 'Multipart parser is unavailable.', 500);
  const parts: Array<Record<string, unknown>> = [];
  const fields: Record<string, string> = {};
  const fieldIndexes = new Map<string, number>();
  let file: { tempPath: string; filename: string; mimetype: string; sizeBytes: number; sha256: string } | null = null;
  const tempPaths: string[] = [];

  try {
    for await (const part of request.parts()) {
      const index = fieldIndexes.get(part.fieldname) ?? 0;
      fieldIndexes.set(part.fieldname, index + 1);
      if (part.type === 'file') {
        if (file) throw new AppError('MULTIPART_FILE_COUNT', 'Only one file is allowed.', 400);
        const tempPath = join(tmpdir(), `thuebot-upload-${randomUUID()}.part`);
        tempPaths.push(tempPath);
        const digest = createHash('sha256');
        let sizeBytes = 0;
        const counter = new Transform({
          transform(chunk: Buffer, _encoding, callback) {
            if (sizeBytes + chunk.length > MULTIPART_MAX_FILE_SIZE) {
              callback(new AppError('PAYLOAD_TOO_LARGE', 'Uploaded file is too large.', 413));
              return;
            }
            sizeBytes += chunk.length;
            digest.update(chunk);
            callback(null, chunk);
          },
        });
        await pipeline(part.file, counter, createWriteStream(tempPath, { flags: 'wx', mode: 0o600 }));
        if (part.file.truncated) throw new AppError('PAYLOAD_TOO_LARGE', 'Uploaded file is too large.', 413);
        parts.push({
          name: part.fieldname,
          index,
          kind: 'file',
          filename: part.filename,
          mimeType: part.mimetype,
          size: sizeBytes,
          sha256: digest.digest('hex'),
        });
        file = { tempPath, filename: part.filename, mimetype: part.mimetype, sizeBytes, sha256: parts[parts.length - 1]!.sha256 as string };
      } else {
        const value = String(part.value ?? '');
        parts.push({ name: part.fieldname, index, kind: 'field', value });
        fields[part.fieldname] = value;
      }
    }
  } catch (error) {
    await Promise.all(tempPaths.map((path) => rm(path, { force: true }).catch(() => undefined)));
    if (error instanceof AppError) throw error;
    const statusCode = error && typeof error === 'object' && 'statusCode' in error
      ? Number((error as { statusCode?: unknown }).statusCode)
      : 0;
    if (statusCode === 413) throw new AppError('PAYLOAD_TOO_LARGE', 'Uploaded file is too large.', 413);
    throw new AppError('MULTIPART_INVALID', 'Multipart request is invalid.', 400);
  }

  parts.sort((left, right) => {
    const leftName = String(left.name);
    const rightName = String(right.name);
    return (leftName < rightName ? -1 : leftName > rightName ? 1 : 0) || Number(left.index) - Number(right.index);
  });
  request.body = parts;
  request.multipartUpload = { file, fields };
  void bodyDigest(parts);
}

export async function cleanupMultipartRequest(request: FastifyRequest): Promise<void> {
  const path = request.multipartUpload?.file?.tempPath;
  if (!path) return;
  request.multipartUpload = { file: null, fields: {} };
  await rm(path, { force: true }).catch(() => undefined);
}
