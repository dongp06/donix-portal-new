import type { ApiResponse } from '@shared/types';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import {
  ensureWebAuthnStepUpForHandle,
  type OpaqueActionHandle,
} from '@/lib/security-client';

async function readApiResponse<T>(res: Response): Promise<ApiResponse<T>> {
  const text = await res.text();
  if (!text.trim()) throw new Error(`Request failed (${res.status})`);
  try {
    return JSON.parse(text) as ApiResponse<T>;
  } catch {
    throw new Error(`Máy chủ trả về phản hồi không hợp lệ (${res.status}).`);
  }
}

function responseError<T>(res: Response, json: ApiResponse<T>): Error {
  const body = json as ApiResponse<T> & { message?: unknown };
  const message = body.message;
  if (typeof message === 'string' && message.trim()) {
    return new Error(message);
  }
  if (Array.isArray(message)) {
    const messages = message.filter(
      (item): item is string =>
        typeof item === 'string' && item.trim().length > 0,
    );
    if (messages.length) return new Error(messages.join(' '));
  }
  if (typeof json.error === 'string' && json.error !== 'Bad Request') {
    return new Error(json.error);
  }
  return new Error(`Request failed (${res.status})`);
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithTimeout(path, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  }, 30_000);
  const json = await readApiResponse<T>(res);
  if (!res.ok || !json.success || json.data === undefined) {
    throw responseError(res, json);
  }
  return json.data;
}

/** JSON admin API — xác thực bằng cookie đăng nhập (StaffGuard kiểm tra staff_members). */
export async function apiAdmin<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithTimeout(path, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  }, 30_000);
  const json = await readApiResponse<T>(res);
  if (!res.ok || !json.success || json.data === undefined) {
    throw responseError(res, json);
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

export type ResourceUploadResult = UploadResult & {
  sha256: string;
  previewable: boolean;
  language?: string;
};

export async function apiUploadAttachment(file: File): Promise<UploadResult> {
  const body = new FormData();
  body.append('file', file);
  const res = await fetchWithTimeout('/api/uploads/images', {
    method: 'POST',
    credentials: 'include',
    body,
  });
  const json = await readApiResponse<{ attachmentId: string; originalName: string; mimeType: string; sizeBytes: number; sizeLabel: string }>(res);
  if (!res.ok || !json.success || !json.data?.attachmentId) {
    throw responseError(res, json);
  }
  return {
    fileId: json.data.attachmentId,
    filename: json.data.originalName,
    mimeType: json.data.mimeType,
    sizeBytes: json.data.sizeBytes,
    sizeLabel: json.data.sizeLabel,
  };
}

export async function apiUploadResourceFile(file: File): Promise<ResourceUploadResult> {
  const body = new FormData();
  body.append('file', file);
  const res = await fetchWithTimeout('/api/admin/resources/upload', {
    method: 'POST',
    credentials: 'include',
    body,
  });
  const json = await readApiResponse<ResourceUploadResult & { id?: string; originalName?: string }>(res);
  if (!res.ok || !json.success || json.data === undefined) {
    throw new Error(json.error || 'Không tải được file tài nguyên');
  }
  return {
    ...json.data,
    fileId: json.data.fileId || json.data.id || '',
    filename: json.data.filename || json.data.originalName || 'resource-file',
  };
}

/**
 * Execute a server-driven mutation. The browser receives only an opaque
 * endpoint and nonce; route/action/target binding remains inside the API.
 */
export async function apiAction<T>(
  handle: OpaqueActionHandle,
  body: unknown = {},
): Promise<T> {
  if (handle.requiresStepUp) {
    const verified = await ensureWebAuthnStepUpForHandle(handle.endpoint);
    if (!verified) {
      throw new Error('Thao tác này cần xác nhận bằng passkey/WebAuthn.');
    }
  }
  const res = await fetchWithTimeout(handle.endpoint, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-TB-Server-Nonce': handle.serverNonce,
    },
    body: JSON.stringify(body ?? {}),
  });
  const json = await readApiResponse<T>(res);
  if (!res.ok || !json.success || json.data === undefined) {
    throw responseError(res, json);
  }
  return json.data;
}

export async function apiDeleteResourceFile(fileId: string): Promise<void> {
  await apiAdmin(`/api/admin/resources/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
}

export type ResourcePreview = {
  fileId: string;
  filename: string;
  mimeType: string;
  sha256: string;
  sizeBytes: number;
  content: string;
};

export async function apiPreviewResourceFile(fileId: string): Promise<ResourcePreview> {
  return api<ResourcePreview>(`/api/resources/files/${encodeURIComponent(fileId)}/preview`, { credentials: 'include' });
}

export async function apiPreviewAdminResourceFile(fileId: string): Promise<ResourcePreview> {
  return apiAdmin<ResourcePreview>(`/api/admin/resources/files/${encodeURIComponent(fileId)}/preview`);
}
