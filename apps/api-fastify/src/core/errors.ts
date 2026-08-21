export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(
    code: string,
    message: string,
    statusCode = 400,
    details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function appError(
  code: string,
  message: string,
  statusCode = 400,
  details?: unknown,
): AppError {
  return new AppError(code, message, statusCode, details);
}

export function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002',
  );
}

function errorParts(error: unknown): Array<{ code?: unknown; message?: unknown }> {
  const parts: Array<{ code?: unknown; message?: unknown }> = [];
  let current: unknown = error;
  const seen = new Set<unknown>();
  for (let depth = 0; depth < 6 && current && !seen.has(current); depth += 1) {
    seen.add(current);
    if (typeof current !== 'object') break;
    const candidate = current as { code?: unknown; message?: unknown; cause?: unknown; originalError?: unknown };
    parts.push({ code: candidate.code, message: candidate.message });
    current = candidate.cause ?? candidate.originalError;
  }
  return parts;
}

export function databaseErrorCode(error: unknown): string {
  for (const part of errorParts(error)) {
    if (typeof part.code === 'string' && part.code.trim()) return part.code.trim();
  }
  return '';
}

export function isRecordNotFoundError(error: unknown): boolean {
  return databaseErrorCode(error) === 'P2025';
}

export function isForeignKeyConstraintError(error: unknown): boolean {
  return databaseErrorCode(error) === 'P2003';
}

export function isDatabaseSchemaError(error: unknown): boolean {
  const code = databaseErrorCode(error);
  return code === 'P2021' || code === 'P2022';
}

export function isDatabaseAvailabilityError(error: unknown): boolean {
  const parts = errorParts(error);
  const codes = parts
    .map((part) => typeof part.code === 'string' ? part.code : '')
    .filter(Boolean);
  if (codes.some((code) => /^(P1001|P1008|P1017|P2024|P2028|P2034)$/.test(code))) return true;
  if (codes.some((code) => /^(SQLITE_BUSY|SQLITE_BUSY_SNAPSHOT|SQLITE_LOCKED|SQLITE_IOERR|SQLITE_CANTOPEN|SQLITE_FULL|SQLITE_READONLY)$/.test(code))) return true;
  const messages = parts.map((part) => typeof part.message === 'string' ? part.message : '').join(' ');
  return /database is locked|database table is locked|database connection|unable to open database|cannot start a transaction|transaction.*conflict|sqlite_busy|sqlite_locked|disk i\/o error|database or disk is full|readonly database/i.test(messages);
}
