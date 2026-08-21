import { strict as assert } from 'node:assert';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../../../api/prisma/generated/prisma/client.js';
import { buildApp } from '../src/app/build-app.js';
import { hash } from '../src/core/crypto.js';

const workspaceRoot = resolve(process.cwd(), '..', '..');

test('Google OAuth uses one-time opaque state cookie and server-side PKCE record', async () => {
  const names = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  process.env.GOOGLE_CLIENT_ID = 'oauth-contract-client';
  process.env.GOOGLE_CLIENT_SECRET = 'oauth-contract-secret';
  process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/api/auth/google/callback';
  const directory = await mkdtemp(join(tmpdir(), 'thuebot-fastify-oauth-'));
  const databaseFile = join(directory, 'dev.db');
  await copyFile(join(workspaceRoot, 'api', 'prisma', 'dev.db'), databaseFile);
  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseFile }) });
  await db.$connect();
  const app = await buildApp({ db, enforceTransport: true, logger: false });
  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/google/start?returnTo=%2Fdashboard',
      headers: { host: 'localhost:3000' },
    });
    assert.equal(response.statusCode, 303);
    const location = new URL(String(response.headers.location));
    assert.equal(location.hostname, 'accounts.google.com');
    assert.equal(location.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(location.searchParams.get('redirect_uri'), 'http://localhost:3000/api/auth/google/callback');
    const state = location.searchParams.get('state');
    assert.match(String(state), /^[A-Za-z0-9_-]{64,180}$/);
    assert.ok(location.searchParams.get('nonce'));
    const setCookie = Array.isArray(response.headers['set-cookie'])
      ? response.headers['set-cookie'].join(';')
      : String(response.headers['set-cookie'] ?? '');
    assert.match(setCookie, /(?:^|;) ?y=/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);
    const record = await db.oAuthState.findUnique({ where: { tokenHash: hash(String(state)) } });
    assert.equal(record?.provider, 'google');
    assert.equal(record?.returnTo, '/dashboard');
    assert.match(record?.codeVerifier ?? '', /^[A-Za-z0-9_-]{64,180}$/);
    assert.match(record?.nonce ?? '', /^[A-Za-z0-9_-]{40,180}$/);
    assert.equal(record?.consumedAt, null);

    const failedCallback = await app.inject({
      method: 'GET',
      // Google adds provider metadata to a successful callback. Keep those
      // fields in the contract so Fastify validation does not reject the
      // callback before the OAuth handler can consume state/PKCE.
      url: `/api/auth/google/callback?state=${encodeURIComponent(String(state))}&scope=openid%20email%20profile&authuser=0&prompt=select_account&flowName=GeneralOAuthFlow&session_state=provider-metadata`,
      headers: { cookie: `y=${state}`, host: 'localhost:3000' },
    });
    assert.equal(failedCallback.statusCode, 303);
    assert.equal(failedCallback.headers.location, '/login?oauth=failed');
    const cleared = Array.isArray(failedCallback.headers['set-cookie'])
      ? failedCallback.headers['set-cookie'].join(';')
      : String(failedCallback.headers['set-cookie'] ?? '');
    assert.match(cleared, /y=;/);
  } finally {
    await app.close();
    await db.$disconnect();
    await rm(directory, { recursive: true, force: true });
    for (const name of names) {
      const value = previous[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
