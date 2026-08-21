import { strict as assert } from 'node:assert';
import test from 'node:test';
import type { FastifyRequest } from 'fastify';
import { AuthService } from '../src/core/auth.js';
import type { Database } from '../src/core/database.js';
import { AppError } from '../src/core/errors.js';
import { SecurityService } from '../src/core/security.js';

test('durable authenticated read budget survives a new SecurityService instance', async () => {
  const events: Array<Record<string, unknown>> = [];
  const securityEvent = {
    count: async ({ where }: { where: Record<string, any> }) => events.filter((event) => {
      const createdAt = typeof event.createdAt === 'string' ? Date.parse(event.createdAt) : 0;
      const since = Date.parse(where.createdAt.gt as string);
      return event.userId === where.userId &&
        event.deviceId === where.deviceId &&
        event.eventType === where.eventType &&
        event.action === where.action &&
        createdAt > since;
    }).length,
    create: async ({ data }: { data: Record<string, unknown> }) => {
      events.push(data);
      return data;
    },
  };
  const db = {
    $transaction: async <T>(operation: (tx: { securityEvent: typeof securityEvent }) => Promise<T>) => operation({ securityEvent }),
    securityEvent,
  } as unknown as Database;
  const securityContext = {
    userId: 'user-budget-test',
    deviceId: 'device-budget-test',
    riskScore: 0,
  };
  const request = { security: securityContext } as unknown as FastifyRequest;

  const first = new SecurityService(db, {} as AuthService);
  await first.enforceReadBudget(request, { eventType: 'e2ee.key_bundle_claim', action: 'e2ee.key_bundle', maxPerWindow: 2, windowMs: 60_000 });
  await first.enforceReadBudget(request, { eventType: 'e2ee.key_bundle_claim', action: 'e2ee.key_bundle', maxPerWindow: 2, windowMs: 60_000 });
  await assert.rejects(
    () => first.enforceReadBudget(request, { eventType: 'e2ee.key_bundle_claim', action: 'e2ee.key_bundle', maxPerWindow: 2, windowMs: 60_000 }),
    (error: unknown) => error instanceof AppError && error.code === 'READ_RATE_LIMITED' && error.statusCode === 429,
  );

  const afterRestart = new SecurityService(db, {} as AuthService);
  await assert.rejects(
    () => afterRestart.enforceReadBudget(request, { eventType: 'e2ee.key_bundle_claim', action: 'e2ee.key_bundle', maxPerWindow: 2, windowMs: 60_000 }),
    (error: unknown) => error instanceof AppError && error.code === 'READ_RATE_LIMITED',
  );
});
