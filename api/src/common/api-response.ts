import type { ApiResponse as ApiBody } from '../data/types';

export function ok<T>(data: T): ApiBody<T> {
  return { success: true, data };
}

export function fail(message: string): ApiBody<never> {
  return { success: false, error: message };
}
