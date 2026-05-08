import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { MOCK_FILE_SEED } from '../data/mock-files';

export interface StoredFile {
  filename: string;
  mime: string;
  buffer: Buffer;
}

function formatSizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

@Injectable()
export class FilesService {
  private readonly store = new Map<string, StoredFile>();

  constructor() {
    for (const [fileId, entry] of Object.entries(MOCK_FILE_SEED)) {
      this.store.set(fileId, {
        filename: entry.filename,
        mime: entry.mime,
        buffer: Buffer.from(entry.body, 'utf-8'),
      });
    }
  }

  get(fileId: string): StoredFile | undefined {
    return this.store.get(fileId);
  }

  saveUpload(originalname: string, mimetype: string, buffer: Buffer): {
    fileId: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    sizeLabel: string;
  } {
    const fileId = `u-${Date.now()}-${randomBytes(4).toString('hex')}`;
    const safeName = originalname?.trim() || 'upload.bin';
    const mime = mimetype?.trim() || 'application/octet-stream';
    this.store.set(fileId, { filename: safeName, mime, buffer });
    const sizeBytes = buffer.length;
    return {
      fileId,
      filename: safeName,
      mimeType: mime,
      sizeBytes,
      sizeLabel: formatSizeLabel(sizeBytes),
    };
  }
}
