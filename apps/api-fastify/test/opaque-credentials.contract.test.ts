import { strict as assert } from 'node:assert';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../../../api/prisma/generated/prisma/client.js';
import { AuthService } from '../src/core/auth.js';
import {
  authCookieName,
  oauthStateCookieName,
  oauthStateCookieOptions,
  cookieOptions,
} from '../src/core/config.js';
import { clearAuthCookies, clearOAuthStateCookie, setAuthCookie, setOAuthStateCookie } from '../src/core/cookies.js';
import { hash, canonicalJson, isOpaqueCredential, randomToken } from '../src/core/crypto.js';

const workspaceRoot = resolve(process.cwd(), '..', '..');
const OPAQUE_TOKEN_RE = /^[A-Za-z0-9_-]{64}$/;

function restoreEnvironment(name: string, previous: string | undefined): void {
  if (previous === undefined) delete process.env[name];
  else process.env[name] = previous;
}

async function captureCookies(setter: (reply: Parameters<typeof setAuthCookie>[0]) => void): Promise<string[]> {
  const app = Fastify({ logger: false });
  await app.register(cookie);
  app.get('/', (_request, reply) => {
    setter(reply);
    return { ok: true };
  });
  try {
    const response = await app.inject({ method: 'GET', url: '/' });
    const header = response.headers['set-cookie'];
    return Array.isArray(header) ? header : header ? [String(header)] : [];
  } finally {
    await app.close();
  }
}

test('session and access credentials are exactly opaque 48-byte base64url values and only hashes persist', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'thuebot-fastify-opaque-'));
  const databaseFile = join(directory, 'dev.db');
  await copyFile(join(workspaceRoot, 'api', 'prisma', 'dev.db'), databaseFile);
  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseFile }) });
  await db.$connect();

  const userId = `opaque-${randomUUID()}`;
  const keyPair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const publicKeyJwk = keyPair.publicKey.export({ format: 'jwk' }) as Record<string, string>;
  const fingerprint = hash(canonicalJson(publicKeyJwk));
  const timestamp = new Date().toISOString();
  await db.user.create({
    data: {
      id: userId,
      name: 'Opaque Credential Test',
      email: `${userId}@example.test`,
      avatar: '',
      role: 'buyer',
      joinedDate: timestamp.slice(0, 10),
    },
  });
  const device = await db.deviceIdentity.create({
    data: {
      id: `dev-${randomUUID()}`,
      userId,
      publicKey: JSON.stringify(publicKeyJwk),
      fingerprint,
      createdAt: timestamp,
      lastSeenAt: timestamp,
    },
  });

  try {
    const auth = new AuthService(db);
    const session = await auth.createSession(userId, device.id);
    assert.match(session.token, OPAQUE_TOKEN_RE);
    assert.equal(session.token.includes('.'), false);
    assert.equal(session.token.startsWith('tb_'), false);
    const storedSession = await db.authSession.findUnique({ where: { id: session.session.id } });
    assert.equal(storedSession?.tokenHash, hash(session.token));
    assert.notEqual(storedSession?.tokenHash, session.token);
    assert.equal('token' in (storedSession ?? {}), false);
    assert.equal(await auth.resolveSession(`${session.token}x`), null);
    assert.equal(await auth.resolveSession(`${session.token}.legacy`), null);

    const access = await auth.createAccessToken({
      sessionId: session.session.id,
      userId,
      deviceId: device.id,
      keyThumbprint: fingerprint,
    });
    assert.match(access.token, OPAQUE_TOKEN_RE);
    assert.equal(access.token.includes('.'), false);
    assert.equal(access.token.startsWith('tb_at_'), false);
    const storedAccess = await db.authAccessToken.findUnique({ where: { id: access.tokenId } });
    assert.equal(storedAccess?.tokenHash, hash(access.token));
    assert.notEqual(storedAccess?.tokenHash, access.token);
    assert.equal('token' in (storedAccess ?? {}), false);
    assert.equal(await auth.resolveAccessToken(`${access.token}x`), null);
    assert.equal(await auth.resolveAccessToken(`Bearer ${access.token}`), null);

    const generated = randomToken(48);
    assert.match(generated, OPAQUE_TOKEN_RE);
    assert.equal(isOpaqueCredential(generated), true);
    assert.equal(isOpaqueCredential(`${generated}x`), false);
    assert.equal(isOpaqueCredential(`tb_${generated}`), false);
    assert.equal(isOpaqueCredential(`${generated}.suffix`), false);
  } finally {
    await db.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});

test('production auth and OAuth state cookies use host-only opaque names and secure attributes', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    assert.equal(authCookieName(), '__Host-x');
    assert.equal(oauthStateCookieName(), '__Host-y');
    assert.equal(cookieOptions().path, '/');
    assert.equal(cookieOptions().httpOnly, true);
    assert.equal(cookieOptions().secure, true);
    assert.equal(cookieOptions().sameSite, 'lax');
    assert.equal('domain' in cookieOptions(), false);
    assert.equal(oauthStateCookieOptions().path, '/');
    assert.equal(oauthStateCookieOptions().httpOnly, true);
    assert.equal(oauthStateCookieOptions().secure, true);
    assert.equal(oauthStateCookieOptions().sameSite, 'lax');
    assert.equal('domain' in oauthStateCookieOptions(), false);

    const authHeaders = await captureCookies((reply) => setAuthCookie(reply, randomToken(48)));
    assert.equal(authHeaders.length, 1);
    assert.match(authHeaders[0] ?? '', /^__Host-x=[A-Za-z0-9_-]{64};/);
    assert.match(authHeaders[0] ?? '', /; Path=\//i);
    assert.match(authHeaders[0] ?? '', /; HttpOnly/i);
    assert.match(authHeaders[0] ?? '', /; Secure/i);
    assert.match(authHeaders[0] ?? '', /; SameSite=Lax/i);
    assert.doesNotMatch(authHeaders[0] ?? '', /; Domain=/i);

    const state = randomToken(48);
    const stateHeaders = await captureCookies((reply) => setOAuthStateCookie(reply, state));
    assert.equal(stateHeaders.length, 1);
    assert.match(stateHeaders[0] ?? '', /^__Host-y=[A-Za-z0-9_-]{64};/);
    assert.match(stateHeaders[0] ?? '', /; HttpOnly/i);
    assert.match(stateHeaders[0] ?? '', /; Secure/i);
    assert.match(stateHeaders[0] ?? '', /; SameSite=Lax/i);
    assert.doesNotMatch(stateHeaders[0] ?? '', /; Domain=/i);

    const clearHeaders = await captureCookies((reply) => {
      clearAuthCookies(reply);
      clearOAuthStateCookie(reply);
    });
    assert.equal(clearHeaders.length, 2);
    assert.ok(clearHeaders.some((value) => value.startsWith('__Host-x=;')));
    assert.ok(clearHeaders.some((value) => value.startsWith('__Host-y=;')));
  } finally {
    restoreEnvironment('NODE_ENV', previousNodeEnv);
  }
});

test('OAuth state is opaque, server-side and consumed once', async () => {
  const names = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  process.env.GOOGLE_CLIENT_ID = 'opaque-oauth-contract-client';
  process.env.GOOGLE_CLIENT_SECRET = 'opaque-oauth-contract-secret';
  process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/api/auth/google/callback';

  const directory = await mkdtemp(join(tmpdir(), 'thuebot-fastify-oauth-opaque-'));
  const databaseFile = join(directory, 'dev.db');
  await copyFile(join(workspaceRoot, 'api', 'prisma', 'dev.db'), databaseFile);
  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseFile }) });
  await db.$connect();
  try {
    const auth = new AuthService(db);
    const created = await auth.createGoogleAuthorization('/dashboard');
    assert.match(created.state, OPAQUE_TOKEN_RE);
    assert.equal(created.state.includes('.'), false);
    assert.equal(created.state.startsWith('state_'), false);
    const stored = await db.oAuthState.findUnique({ where: { tokenHash: hash(created.state) } });
    assert.ok(stored);
    assert.equal(stored?.tokenHash, hash(created.state));
    assert.notEqual(stored?.tokenHash, created.state);
    assert.equal(stored?.consumedAt, null);

    const consumed = await auth.consumeGoogleAuthorizationState(created.state);
    assert.equal(consumed.tokenHash, hash(created.state));
    await assert.rejects(() => auth.consumeGoogleAuthorizationState(created.state), (error: unknown) => {
      return (error as { code?: string }).code === 'OAUTH_STATE_INVALID';
    });
    assert.ok((await db.oAuthState.findUnique({ where: { id: stored?.id } }))?.consumedAt);
  } finally {
    await db.$disconnect();
    await rm(directory, { recursive: true, force: true });
    for (const name of names) restoreEnvironment(name, previous[name]);
  }
});
