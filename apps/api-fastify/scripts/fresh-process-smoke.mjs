import assert from 'node:assert/strict';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(scriptDirectory, '../../..');
const apiRoot = join(workspaceRoot, 'api');
const sourceDatabase = join(apiRoot, 'prisma', 'dev.db');
const temporaryDirectory = await mkdtemp(join(tmpdir(), 'thuebot-fastify-fresh-'));
const temporaryDatabase = join(temporaryDirectory, 'dev.db');

const previousEnvironment = {
  TB_API_ROOT: process.env.TB_API_ROOT,
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV,
  CORS_ORIGINS: process.env.CORS_ORIGINS,
};

try {
  await copyFile(sourceDatabase, temporaryDatabase);
  process.env.TB_API_ROOT = apiRoot;
  process.env.DATABASE_URL = `file:${temporaryDatabase}`;
  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGINS = 'http://127.0.0.1:0';

  const buildAppUrl = pathToFileURL(join(
    workspaceRoot,
    'apps',
    'api-fastify',
    'dist',
    'apps',
    'api-fastify',
    'src',
    'app',
    'build-app.js',
  )).href;
  const { buildApp } = await import(buildAppUrl);
  const app = await buildApp({ logger: false, enforceTransport: true });

  try {
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();
    assert.equal(typeof address, 'object');
    assert.ok(address && typeof address.port === 'number' && address.port > 0);
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const transport = await fetch(`${baseUrl}/api/transport/config`);
    assert.equal(transport.status, 200);
    const transportBody = await transport.json();
    assert.equal(transportBody.success, true);
    assert.equal(transportBody.data.protocolVersion, 4);

    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);
    const healthBody = await health.json();
    assert.equal(healthBody.success, true);

    console.log(JSON.stringify({
      smoke: 'fastify-fresh-build',
      status: 'pass',
      port: address.port,
      transportProtocolVersion: transportBody.data.protocolVersion,
      healthWithoutTransport: health.status,
    }));
  } finally {
    await app.close();
  }
} finally {
  for (const [key, value] of Object.entries(previousEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await rm(temporaryDirectory, { recursive: true, force: true });
}
