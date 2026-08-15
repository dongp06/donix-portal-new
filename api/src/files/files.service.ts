import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { MOCK_FILE_SEED } from '../data/mock-files';

export interface StoredFile {
  filename: string;
  mime: string;
  /** Đường dẫn file trên disk (upload thật) — buffer dùng cho seed mock */
  diskPath?: string;
  buffer?: Buffer;
}

function formatSizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

@Injectable()
export class FilesService {
  private readonly store = new Map<string, StoredFile>();
  /** Thư mục lưu file upload cục bộ — cấu hình qua UPLOAD_DIR nếu muốn */
  private readonly uploadDir: string;

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR?.trim() || join(process.cwd(), 'uploads');
    if (!existsSync(this.uploadDir)) {
      mkdirSync(this.uploadDir, { recursive: true });
    }
    // Seed mock (admin posts / bài viết mẫu)
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
    const diskPath = join(this.uploadDir, fileId);
    writeFileSync(diskPath, buffer); // Lưu cục bộ ra disk
    this.store.set(fileId, { filename: safeName, mime, diskPath });
    const sizeBytes = buffer.length;
    return {
      fileId,
      filename: safeName,
      mimeType: mime,
      sizeBytes,
      sizeLabel: formatSizeLabel(sizeBytes),
    };
  }

  /** Đọc nội dung file (disk hoặc seed mock trong RAM) */
  read(fileId: string): { filename: string; mime: string; buffer: Buffer } {
    const entry = this.store.get(fileId);
    if (entry) {
      if (entry.diskPath && existsSync(entry.diskPath)) {
        return { filename: entry.filename, mime: entry.mime, buffer: readFileSync(entry.diskPath) };
      }
      if (entry.buffer) {
        return { filename: entry.filename, mime: entry.mime, buffer: entry.buffer };
      }
      throw new NotFoundException({ success: false, error: 'File not found' });
    }
    // File upload cục bộ: sau khi restart API, map mất entry nhưng file vẫn còn trên disk
    // → thử đọc trực tiếp theo fileId (fileId được sinh an toàn, không chứa path separator)
    if (/^[a-zA-Z0-9-]+$/.test(fileId)) {
      const diskPath = join(this.uploadDir, fileId);
      if (existsSync(diskPath)) {
        const stat = require('fs').statSync(diskPath);
        return {
          filename: fileId,
          mime: 'application/octet-stream',
          buffer: readFileSync(diskPath),
        };
      }
    }
    throw new NotFoundException({ success: false, error: 'File not found' });
  }
}
