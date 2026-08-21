export type ApiSuccess<T> = { success: true; data: T };
export type ApiFailure = {
  success: false;
  error: string;
  code?: string;
  requestId?: string;
};

export function ok<T>(data: T): ApiSuccess<T> {
  return { success: true, data };
}

export function fail(
  error: string,
  code?: string,
  requestId?: string,
): ApiFailure {
  return { success: false, error, ...(code ? { code } : {}), ...(requestId ? { requestId } : {}) };
}
