import assert from 'node:assert/strict';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { generateKeyPairSync } from 'node:crypto';

const workspaceRoot = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const apiRoot = join(workspaceRoot, 'api');
const sourceDatabase = join(apiRoot, 'prisma', 'dev.db');

async function freePort() {
  const server = createServer();
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port: 0 }, resolvePromise);
  });
  const address = server.address();
  assert.equal(typeof address, 'object');
  const port = address.port;
  await new Promise((resolvePromise) => server.close(resolvePromise));
  return port;
}

function launch(command, args, env) {
  const child = spawn(process.execPath, args, {
    cwd: workspaceRoot,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout = `${stdout}${chunk}`.slice(-8_000); });
  child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-8_000); });
  return { child, getLogs: () => ({ stdout, stderr }), command };
}

async function waitFor(url, expectedStatus, processRef) {
  const deadline = Date.now() + 45_000;
  let lastError = 'not attempted';
  while (Date.now() < deadline) {
    if (processRef.child.exitCode !== null) {
      const logs = processRef.getLogs();
      throw new Error(`${processRef.command} exited early (${processRef.child.exitCode}).\n${logs.stdout}\n${logs.stderr}`);
    }
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.status === expectedStatus) return response;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  const logs = processRef.getLogs();
  throw new Error(`Timed out waiting for ${url} (${lastError}).\n${logs.stdout}\n${logs.stderr}`);
}

async function stop(processRef) {
  if (processRef.child.exitCode !== null) return;
  processRef.child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolvePromise) => processRef.child.once('close', resolvePromise)),
    new Promise((resolvePromise) => setTimeout(resolvePromise, 5_000)),
  ]);
  if (processRef.child.exitCode === null) processRef.child.kill('SIGKILL');
}

const directory = await mkdtemp(join(tmpdir(), 'thuebot-fastify-web-smoke-'));
const database = join(directory, 'dev.db');
const apiPort = await freePort();
const webPort = await freePort();
const internalPort = await freePort();
const transportKey = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ format: 'jwk' });
let apiProcess;
let webProcess;

try {
  await copyFile(sourceDatabase, database);
  apiProcess = launch('fastify', ['--enable-source-maps', 'apps/api-fastify/dist/apps/api-fastify/src/app/server.js'], {
    NODE_ENV: 'production',
    TB_API_ROOT: apiRoot,
    DATABASE_URL: `file:${database}`,
    FASTIFY_HOST: '127.0.0.1',
    FASTIFY_PORT: String(apiPort),
    CORS_ORIGINS: `http://127.0.0.1:${webPort}`,
    GOOGLE_CLIENT_ID: 'fresh-web-smoke-client',
    GOOGLE_CLIENT_SECRET: 'fresh-web-smoke-secret',
    GOOGLE_REDIRECT_URI: `http://127.0.0.1:${webPort}/api/auth/google/callback`,
    PUBLIC_ORIGIN: `http://127.0.0.1:${webPort}`,
    MEDIA_DIR: join(directory, 'media'),
    RESOURCE_UPLOAD_DIR: join(directory, 'resources'),
    SECURITY_IP_SALT: 'fresh-web-smoke-only',
    THB_TRANSPORT_PRIVATE_JWK: JSON.stringify(transportKey),
    WEBAUTHN_RP_ID: '127.0.0.1',
    WEBAUTHN_ORIGIN: `http://127.0.0.1:${webPort}`,
  });
  await waitFor(`http://127.0.0.1:${apiPort}/api/transport/config`, 200, apiProcess);

  webProcess = launch('web', ['web/server.mjs'], {
    NODE_ENV: 'production',
    HOSTNAME: '127.0.0.1',
    PORT: String(webPort),
    TB_NEXT_INTERNAL_PORT: String(internalPort),
    API_URL: `http://127.0.0.1:${apiPort}`,
  });
  const home = await waitFor(`http://127.0.0.1:${webPort}/`, 200, webProcess);
  const homeHtml = await home.text();
  assert.match(homeHtml, /<html/i);
  assert.equal(home.headers.get('x-content-type-options'), 'nosniff');
  const pages = [
    { path: '/bots', expectedStatus: 200 },
    { path: '/posts', expectedStatus: 200 },
    { path: '/resources', expectedStatus: 200 },
    { path: '/login', expectedStatus: 200 },
    // Admin intentionally collapses unauthenticated access to 404 so the
    // public web surface does not disclose that the admin console exists.
    { path: '/dashboard', expectedStatus: 200 },
    { path: '/admin', expectedStatus: 404 },
  ];
  for (const page of pages) {
    const response = await waitFor(`http://127.0.0.1:${webPort}${page.path}`, page.expectedStatus, webProcess);
    assert.match(await response.text(), /<html/i);
  }

  const transport = await waitFor(`http://127.0.0.1:${webPort}/api/transport/config`, 200, webProcess);
  const transportBody = await transport.json();
  assert.equal(transportBody.success, true);
  assert.equal(transportBody.data.protocolVersion, 4);

  // The production OAuth state cookie must survive the Next proxy unchanged.
  // This is a direct proxy check; no real Google account or callback is used.
  const oauthStart = await fetch(
    `http://127.0.0.1:${webPort}/api/auth/google/start?returnTo=%2Flogin`,
    { redirect: 'manual', cache: 'no-store' },
  );
  assert.equal(oauthStart.status, 303);
  const oauthCookie = oauthStart.headers.get('set-cookie') || '';
  assert.match(oauthCookie, /^__Host-y=[A-Za-z0-9_-]{64};/);
  assert.match(oauthCookie, /; Path=\//i);
  assert.match(oauthCookie, /; HttpOnly/i);
  assert.match(oauthCookie, /; Secure/i);
  assert.match(oauthCookie, /; SameSite=Lax/i);
  assert.doesNotMatch(oauthCookie, /; Domain=/i);

  const health = await waitFor(`http://127.0.0.1:${webPort}/api/health`, 200, webProcess);
  const healthBody = await health.json();
  assert.equal(healthBody.success, true);
  assert.equal(health.headers.get('x-content-type-options'), 'nosniff');

  // Production cookie mutations require an explicit same-origin signal. This
  // catches accidental reintroduction of a missing-Origin fallback while
  // leaving the anonymous GET/read surface usable.
  const missingOriginMutation = await fetch(`http://127.0.0.1:${webPort}/api/bootstrap`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  assert.equal(missingOriginMutation.status, 403);
  const missingOriginBody = await missingOriginMutation.json();
  assert.equal(missingOriginBody.code, 'ORIGIN_REQUIRED');

  console.log(JSON.stringify({
    smoke: 'fastify-web-rewrite-fresh-build',
    status: 'pass',
    apiPort,
    webPort,
    internalPort,
    transportProtocolVersion: transportBody.data.protocolVersion,
    oauthCookieForwarded: true,
    missingOriginMutationRejected: true,
    healthWithoutTransport: health.status,
  }));
} finally {
  await stop(webProcess).catch(() => undefined);
  await stop(apiProcess).catch(() => undefined);
  await rm(directory, { recursive: true, force: true });
}
