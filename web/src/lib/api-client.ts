import type { ApiResponse } from '@shared/types';

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  const json = (await res.json()) as ApiResponse<T>;
  if (!res.ok || !json.success || json.data === undefined) {
    throw new Error(json.error || 'Request failed');
  }
  return json.data;
}

function adminKeyHeader(): Record<string, string> {
  const key = process.env.NEXT_PUBLIC_ADMIN_API_KEY?.trim();
  if (!key) return {};
  return { 'x-admin-key': key };
}

/** JSON admin API (CRUD bài viết, v.v.) — gửi `x-admin-key` nếu có ADMIN_API_KEY ở backend. */
export async function apiAdmin<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...adminKeyHeader(),
      ...init?.headers,
    },
  });
  const json = (await res.json()) as ApiResponse<T>;
  if (!res.ok || !json.success || json.data === undefined) {
    throw new Error(json.error || 'Request failed');
  }
  return json.data;
}

export type UploadResult = {
  fileId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sizeLabel: string;
};

export async function apiUploadAttachment(file: File): Promise<UploadResult> {
  const body = new FormData();
  body.append('file', file);
  // Admin post editor uploads tới endpoint công khai /api/files/upload
  // (AdminFilesController đã bị thay bằng FilesUploadController chung cho cả user lẫn admin)
  const res = await fetch('/api/files/upload', {
    method: 'POST',
    headers: adminKeyHeader(),
    body,
  });
  const json = (await res.json()) as ApiResponse<UploadResult>;
  if (!res.ok || !json.success || json.data === undefined) {
    throw new Error(json.error || 'Upload failed');
  }
  return json.data;
}
