import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../../../../api/prisma/generated/prisma/client.js';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDatabaseAvailabilityError } from './errors.js';

export type Database = InstanceType<typeof PrismaClient>;

function findApiRoot(): string {
  let current = resolve(dirname(fileURLToPath(import.meta.url)));
  for (let index = 0; index < 12; index += 1) {
    if (
      existsSync(join(current, 'api', 'prisma', 'schema.prisma')) ||
      existsSync(join(current, 'api', 'prisma', 'dev.db'))
    ) {
      return join(current, 'api');
    }
    if (
      existsSync(join(current, 'prisma', 'schema.prisma')) ||
      existsSync(join(current, 'prisma', 'dev.db'))
    ) return current;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return resolve(process.cwd(), '..', '..', 'api');
}

export function apiRoot(): string {
  return process.env.TB_API_ROOT?.trim() || findApiRoot();
}

export function sqliteDbPath(): string {
  const raw = (process.env.DATABASE_URL || 'file:./prisma/dev.db').replace(/^file:/, '').trim();
  if (raw === ':memory:') return raw;
  return resolve(apiRoot(), raw || './prisma/dev.db');
}

function sqliteBusyTimeoutMs(): number {
  const configured = Number(process.env.TB_SQLITE_BUSY_TIMEOUT_MS ?? 5_000);
  return Number.isFinite(configured)
    ? Math.min(Math.max(Math.floor(configured), 1_000), 30_000)
    : 5_000;
}

const RETRYABLE_OPERATION_NAMES = new Set([
  'aggregate',
  'count',
  'create',
  'createMany',
  'delete',
  'deleteMany',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'findUnique',
  'findUniqueOrThrow',
  'groupBy',
  'update',
  'updateMany',
  'upsert',
]);

const RETRYABLE_RAW_NAMES = new Set([
  '$executeRaw',
  '$executeRawUnsafe',
  '$queryRaw',
  '$queryRawUnsafe',
]);

function isPrismaDelegate(value: unknown): value is object {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return ['findUnique', 'findMany', 'create', 'update', 'delete'].some((name) => typeof candidate[name] === 'function');
}

/**
 * Prisma's SQLite adapter already waits for a busy writer, but individual
 * delegates still surface SQLITE_BUSY/P2034 when several browser tabs write
 * together. Wrap model operations once at the connection boundary so every
 * module gets the same bounded retry policy without duplicating try/catch
 * blocks throughout business code.
 */
function resilientDatabase(database: Database): Database {
  const delegateCache = new WeakMap<object, object>();
  const rawCache = new Map<string, unknown>();
  const wrapDelegate = (delegate: object): object => {
    const cached = delegateCache.get(delegate);
    if (cached) return cached;
    const methodCache = new Map<string, unknown>();
    const proxy = new Proxy(delegate, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        const name = typeof property === 'string' ? property : '';
        if (typeof value !== 'function' || !RETRYABLE_OPERATION_NAMES.has(name)) return value;
        const previous = methodCache.get(name);
        if (previous) return previous;
        const wrapped = (...args: unknown[]) => withDatabaseRetry(
          () => Promise.resolve(Reflect.apply(value, target, args)),
          3,
        );
        methodCache.set(name, wrapped);
        return wrapped;
      },
    });
    delegateCache.set(delegate, proxy);
    return proxy;
  };

  return new Proxy(database as unknown as object, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      const name = typeof property === 'string' ? property : '';
      if (name === '$transaction' && typeof value === 'function') {
        return (...args: unknown[]) => withDatabaseRetry(
          () => Promise.resolve(Reflect.apply(value, target, args)),
          3,
        );
      }
      if (RETRYABLE_RAW_NAMES.has(name) && typeof value === 'function') {
        const cached = rawCache.get(name);
        if (cached) return cached;
        const wrapped = (...args: unknown[]) => withDatabaseRetry(
          () => Promise.resolve(Reflect.apply(value, target, args)),
          3,
        );
        rawCache.set(name, wrapped);
        return wrapped;
      }
      return isPrismaDelegate(value) ? wrapDelegate(value) : value;
    },
  }) as unknown as Database;
}

export function createDatabase(): Database {
  const database = new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: sqliteDbPath(),
      timeout: sqliteBusyTimeoutMs(),
    }),
  });
  return resilientDatabase(database);
}

/**
 * SQLite is deliberately the local source of truth for this deployment. A
 * short writer collision is therefore a retryable condition, not a reason to
 * fail an otherwise safe request. Keep the retry small and bounded so a real
 * outage still reaches the normal DATABASE_UNAVAILABLE error handler.
 */
export async function withDatabaseRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  const totalAttempts = Math.max(1, Math.min(Math.floor(attempts), 4));
  let lastError: unknown;
  for (let attempt = 0; attempt < totalAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isDatabaseAvailabilityError(error) || attempt === totalAttempts - 1) throw error;
      const delay = Math.min(500, 40 * 2 ** attempt);
      await new Promise<void>((resolveDelay) => setTimeout(resolveDelay, delay));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Database operation failed.');
}

/**
 * Configure the SQLite connection for the single Fastify process. WAL keeps
 * readers from blocking short writes, while the adapter timeout absorbs a
 * brief writer collision. Configuration is best-effort so a degraded database
 * does not prevent the HTTP server from starting and exposing health/errors.
 */
export async function configureDatabase(database: Database): Promise<boolean> {
  const client = database as unknown as {
    $connect?: () => Promise<void>;
    $queryRawUnsafe?: (query: string) => Promise<unknown>;
    $executeRawUnsafe?: (query: string) => Promise<number>;
  };
  if (typeof client.$connect !== 'function' || typeof client.$queryRawUnsafe !== 'function') return false;
  try {
    await client.$connect();
    await client.$queryRawUnsafe('PRAGMA foreign_keys = ON');
    await client.$queryRawUnsafe(`PRAGMA busy_timeout = ${sqliteBusyTimeoutMs()}`);
    await client.$queryRawUnsafe('PRAGMA wal_autocheckpoint = 1000');
  } catch {
    return false;
  }
  // View aggregates are performance counters, while the event tables provide
  // hourly de-duplication. Keep this additive guard for older local databases
  // that predate the migration; it never drops or rewrites user data.
  try {
    if (typeof client.$executeRawUnsafe === 'function') {
      await client.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PostView" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "postId" TEXT NOT NULL,
        "viewerKey" TEXT NOT NULL,
        "windowKey" TEXT NOT NULL,
        "viewedAt" TEXT NOT NULL
      )`);
      await client.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "PostView_postId_viewerKey_windowKey_key" ON "PostView"("postId", "viewerKey", "windowKey")');
      await client.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "PostView_postId_viewedAt_idx" ON "PostView"("postId", "viewedAt")');
      await client.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "BotView" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "botId" TEXT NOT NULL,
        "viewerKey" TEXT NOT NULL,
        "windowKey" TEXT NOT NULL,
        "viewedAt" TEXT NOT NULL,
        CONSTRAINT "BotView_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )`);
      await client.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "BotView_botId_viewerKey_windowKey_key" ON "BotView"("botId", "viewerKey", "windowKey")');
      await client.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "BotView_botId_viewedAt_idx" ON "BotView"("botId", "viewedAt")');
    }
  } catch {
    // Read-only/legacy databases still use the counter-only fallback in the
    // public read service; a schema refresh can add the event tables later.
  }
  try {
    await client.$queryRawUnsafe('PRAGMA journal_mode = WAL');
    await client.$queryRawUnsafe('PRAGMA synchronous = NORMAL');
  } catch {
    // Read-only or unusual SQLite deployments can reject WAL. The connection
    // remains usable with foreign keys and busy_timeout already configured.
  }
  try {
    const quickCheck = await client.$queryRawUnsafe('PRAGMA quick_check');
    if (Array.isArray(quickCheck)) {
      const invalid = quickCheck.some((row) => {
        if (!row || typeof row !== 'object') return false;
        const value = Object.values(row as Record<string, unknown>)[0];
        return typeof value === 'string' && value.toLowerCase() !== 'ok';
      });
      if (invalid) return false;
    }
    const foreignKeyCheck = await client.$queryRawUnsafe('PRAGMA foreign_key_check');
    if (Array.isArray(foreignKeyCheck) && foreignKeyCheck.length > 0) return false;
  } catch {
    // Health checks are advisory. A driver that does not expose PRAGMA rows
    // must not turn an otherwise usable database into a startup failure.
  }
  return true;
}
