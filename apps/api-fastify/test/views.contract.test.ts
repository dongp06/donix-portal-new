import { strict as assert } from 'node:assert';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../../../api/prisma/generated/prisma/client.js';
import { buildApp } from '../src/app/build-app.js';

const workspaceRoot = resolve(process.cwd(), '..', '..');

function jsonBody(response: { body: string }): Record<string, unknown> {
  return JSON.parse(response.body) as Record<string, unknown>;
}

test('public bot and post detail views persist atomically and deduplicate per viewer/hour', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'thuebot-fastify-views-'));
  const databaseFile = join(directory, 'dev.db');
  await copyFile(join(workspaceRoot, 'api', 'prisma', 'dev.db'), databaseFile);
  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseFile }) });
  await db.$connect();
  const app = await buildApp({ db, enforceTransport: false, logger: false });
  const timestamp = new Date().toISOString();
  const postId = `view-post-${randomUUID()}`;
  const postSlug = `view-post-${randomUUID()}`;

  try {
    const bot = await db.bot.findFirst({ where: { status: { in: ['online', 'maintenance', 'offline'] } }, select: { id: true, slug: true, views: true } });
    assert.ok(bot, 'the fixture database must contain a public bot');

    await db.post.create({
      data: {
        id: postId,
        slug: postSlug,
        title: 'View counter contract post',
        excerpt: 'View counter contract excerpt',
        content: 'View counter contract content',
        authorId: null,
        authorName: 'View Contract',
        authorAvatar: '',
        authorRole: 'Người mua',
        category: 'guides',
        categoryName: 'Hướng dẫn',
        type: 'share',
        status: 'published',
        createdAt: timestamp,
        updatedAt: timestamp,
        publishedAt: timestamp,
        tags: '[]',
      },
    });

    const botBefore = bot.views;
    const botFirst = await app.inject({ method: 'GET', url: `/api/bots/${bot.slug}`, headers: { 'user-agent': 'view-contract-browser-a' } });
    assert.equal(botFirst.statusCode, 200, botFirst.body);
    const botFirstViews = Number((jsonBody(botFirst).data as Record<string, unknown>).views);
    assert.equal(botFirstViews, botBefore + 1);
    assert.equal((await db.bot.findUnique({ where: { id: bot.id }, select: { views: true } }))?.views, botBefore + 1);

    const botDuplicate = await app.inject({ method: 'GET', url: `/api/bots/${bot.slug}`, headers: { 'user-agent': 'view-contract-browser-a' } });
    assert.equal(botDuplicate.statusCode, 200, botDuplicate.body);
    assert.equal(Number((jsonBody(botDuplicate).data as Record<string, unknown>).views), botBefore + 1);

    const botOtherViewer = await app.inject({ method: 'GET', url: `/api/bots/${bot.slug}`, headers: { 'user-agent': 'view-contract-browser-b' } });
    assert.equal(botOtherViewer.statusCode, 200, botOtherViewer.body);
    assert.equal(Number((jsonBody(botOtherViewer).data as Record<string, unknown>).views), botBefore + 2);

    const postFirst = await app.inject({ method: 'GET', url: `/api/posts/slug/${postSlug}`, headers: { 'user-agent': 'view-contract-browser-a' } });
    assert.equal(postFirst.statusCode, 200, postFirst.body);
    assert.equal(Number(((jsonBody(postFirst).data as Record<string, unknown>).post as Record<string, unknown>).views), 1);
    assert.equal((await db.post.findUnique({ where: { id: postId }, select: { views: true } }))?.views, 1);

    const postDuplicate = await app.inject({ method: 'GET', url: `/api/posts/slug/${postSlug}`, headers: { 'user-agent': 'view-contract-browser-a' } });
    assert.equal(postDuplicate.statusCode, 200, postDuplicate.body);
    assert.equal(Number(((jsonBody(postDuplicate).data as Record<string, unknown>).post as Record<string, unknown>).views), 1);

    const postOtherViewer = await app.inject({ method: 'GET', url: `/api/posts/slug/${postSlug}`, headers: { 'user-agent': 'view-contract-browser-b' } });
    assert.equal(postOtherViewer.statusCode, 200, postOtherViewer.body);
    assert.equal(Number(((jsonBody(postOtherViewer).data as Record<string, unknown>).post as Record<string, unknown>).views), 2);
    assert.equal((await db.post.findUnique({ where: { id: postId }, select: { views: true } }))?.views, 2);
  } finally {
    await app.close();
    await db.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});
