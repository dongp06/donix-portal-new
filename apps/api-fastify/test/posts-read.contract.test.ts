import { strict as assert } from 'node:assert';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../../../api/prisma/generated/prisma/client.js';
import { buildApp } from '../src/app/build-app.js';
import { AUTH_COOKIE } from '../src/core/config.js';
import { AuthService } from '../src/core/auth.js';

const workspaceRoot = resolve(process.cwd(), '..', '..');

function jsonBody(response: { body: string }): Record<string, unknown> {
  return JSON.parse(response.body) as Record<string, unknown>;
}

test('Fastify posts read surface matches the personal feed contract and enforces session reads', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'thuebot-fastify-posts-read-'));
  const databaseFile = join(directory, 'dev.db');
  await copyFile(join(workspaceRoot, 'api', 'prisma', 'dev.db'), databaseFile);
  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseFile }) });
  await db.$connect();
  const app = await buildApp({ db, enforceTransport: false, logger: false });
  const userId = `fastify-posts-read-${randomUUID()}`;
  const draftId = `draft-${randomUUID()}`;
  const publishedId = `published-${randomUUID()}`;
  const timestamp = new Date().toISOString();

  try {
    await db.user.create({
      data: {
        id: userId,
        name: 'Posts Read Contract User',
        email: `${userId}@example.test`,
        avatar: '',
        role: 'buyer',
        joinedDate: timestamp.slice(0, 10),
      },
    });
    await db.post.createMany({
      data: [
        {
          id: draftId,
          slug: `draft-${randomUUID()}`,
          title: 'Private draft',
          excerpt: 'Private draft excerpt',
          content: 'Private draft content',
          authorId: userId,
          authorName: 'Posts Read Contract User',
          authorAvatar: '',
          authorRole: 'Người mua',
          type: 'share',
          status: 'draft',
          category: 'guides',
          categoryName: 'Hướng dẫn',
          createdAt: timestamp,
          updatedAt: timestamp,
          tags: '[]',
        },
        {
          id: publishedId,
          slug: `published-${randomUUID()}`,
          title: 'Saved published post',
          excerpt: 'Saved published excerpt',
          content: 'Saved published content',
          authorId: userId,
          authorName: 'Posts Read Contract User',
          authorAvatar: '',
          authorRole: 'Người mua',
          type: 'share',
          status: 'published',
          category: 'guides',
          categoryName: 'Hướng dẫn',
          publishedAt: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp,
          tags: '["contract"]',
        },
      ],
    });
    await db.postBookmark.create({
      data: { id: `bookmark-${randomUUID()}`, postId: publishedId, userId, createdAt: timestamp },
    });
    const rootCommentId = `comment-${randomUUID()}`;
    await db.comment.create({
      data: {
        id: rootCommentId,
        targetType: 'post',
        targetId: publishedId,
        parentId: null,
        authorId: userId,
        authorName: 'Posts Read Contract User',
        authorAvatar: '',
        content: 'Root comment',
        reactions: '[]',
        createdAt: timestamp,
      },
    });
    await db.comment.create({
      data: {
        id: `reply-${randomUUID()}`,
        targetType: 'post',
        targetId: publishedId,
        parentId: rootCommentId,
        authorId: userId,
        authorName: 'Posts Read Contract User',
        authorAvatar: '',
        content: 'Reply comment',
        reactions: '[]',
        createdAt: new Date(Date.now() + 1).toISOString(),
      },
    });
    await db.reaction.create({
      data: { id: `reaction-${randomUUID()}`, targetType: 'comment', targetId: rootCommentId, userId, emoji: '👍', createdAt: timestamp },
    });

    const auth = new AuthService(db);
    const session = await auth.createSession(userId);
    const cookie = `${AUTH_COOKIE}=${session.token}`;

    const own = await app.inject({ method: 'GET', url: '/api/posts/me', headers: { cookie } });
    assert.equal(own.statusCode, 200);
    const ownPosts = jsonBody(own).data as Array<Record<string, unknown>>;
    assert.equal(ownPosts.length, 2);
    assert.equal(ownPosts[0]?.content, undefined);
    assert.equal(ownPosts.some((post) => post.id === draftId), true);

    const drafts = await app.inject({ method: 'GET', url: '/api/posts/me?status=draft', headers: { cookie } });
    assert.equal(drafts.statusCode, 200);
    const draftPosts = jsonBody(drafts).data as Array<Record<string, unknown>>;
    assert.deepEqual(draftPosts.map((post) => post.id), [draftId]);

    const saved = await app.inject({ method: 'GET', url: '/api/posts/saved', headers: { cookie } });
    assert.equal(saved.statusCode, 200);
    const savedPosts = jsonBody(saved).data as Array<Record<string, unknown>>;
    assert.deepEqual(savedPosts.map((post) => post.id), [publishedId]);
    assert.equal(savedPosts[0]?.isBookmarked, true);

    const comments = await app.inject({ method: 'GET', url: `/api/comments?targetType=post&targetId=${publishedId}`, headers: { cookie } });
    assert.equal(comments.statusCode, 200, comments.body);
    const commentRows = jsonBody(comments).data as Array<Record<string, unknown>>;
    assert.equal(commentRows.length, 1);
    assert.equal((commentRows[0]?.replies as Array<unknown>).length, 1);
    assert.deepEqual(commentRows[0]?.reactions, [{ emoji: '👍', count: 1, reactedByMe: true }]);

    const feed = await app.inject({ method: 'GET', url: '/api/posts?limit=1&page=1', headers: { cookie } });
    assert.equal(feed.statusCode, 200);
    const feedData = jsonBody(feed).data as { items: Array<Record<string, unknown>>; pagination: { page: number; limit: number; total: number } };
    assert.equal(feedData.pagination.page, 1);
    assert.equal(feedData.pagination.limit, 1);
    assert.equal(feedData.items.length, 1);
    assert.equal(typeof feedData.pagination.total, 'number');

    const unauthenticated = await app.inject({ method: 'GET', url: '/api/posts/me' });
    assert.equal(unauthenticated.statusCode, 401);
    assert.equal(jsonBody(unauthenticated).code, 'AUTH_REQUIRED');
  } finally {
    await app.close();
    await db.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});
