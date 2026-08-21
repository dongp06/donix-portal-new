import type { FastifyInstance } from 'fastify';
import { ok } from '../../core/response.js';
import { AuthService } from '../../core/auth.js';
import type { Database } from '../../core/database.js';
import { isDatabaseAvailabilityError, isDatabaseSchemaError } from '../../core/errors.js';
import { MediaStorageService } from '../media/media-storage.service.js';
import { MediaService } from '../media/media.service.js';
import { PublicReadService } from './public-read.service.js';
import { SellerProfileService } from '../sellers/seller-profile.service.js';
import { TrustService } from '../trust/trust.service.js';
import {
  botCategorySchema,
  postCategorySchema,
  publicBotSchema,
  publicCommentSchema,
  publicPostListSchema,
  publicPostSchema,
  publicReviewSchema,
  publicSellerProfileSchema,
  sellerFollowSchema,
  sellerLookupSchema,
  successWithSchema,
} from '../../core/route-schemas.js';

const botListResponse = successWithSchema({ type: 'array', items: publicBotSchema });
const botResponse = successWithSchema(publicBotSchema);
const reviewListResponse = successWithSchema({ type: 'array', items: publicReviewSchema });
const postListResponse = successWithSchema(publicPostListSchema);
const postResponse = successWithSchema(publicPostSchema);
const postDetailResponse = successWithSchema({ type: 'object', additionalProperties: false, required: ['post', 'related'], properties: { post: publicPostSchema, related: { type: 'array', items: publicPostSchema } } });
const commentListResponse = successWithSchema({ type: 'array', items: publicCommentSchema });

const listQuery = {
  type: 'object',
  additionalProperties: false,
  properties: {
    category: { type: 'string', maxLength: 120 },
    search: { type: 'string', maxLength: 200 },
    status: { type: 'string', maxLength: 40 },
    sort: { type: 'string', maxLength: 40 },
  },
} as const;

const postQuery = {
  type: 'object',
  additionalProperties: false,
  properties: {
    q: { type: 'string', maxLength: 200 },
    category: { type: 'string', maxLength: 120 },
    type: { type: 'string', maxLength: 40 },
    tab: { type: 'string', maxLength: 40 },
    sort: { type: 'string', maxLength: 40 },
    page: { type: 'string', pattern: '^[1-9][0-9]{0,5}$' },
    limit: { type: 'string', pattern: '^[1-9][0-9]{0,2}$' },
  },
} as const;

const commentQuery = {
  type: 'object',
  additionalProperties: false,
  required: ['targetType', 'targetId'],
  properties: {
    targetType: { type: 'string', enum: ['post', 'bot'] },
    targetId: { type: 'string', minLength: 1, maxLength: 160 },
  },
} as const;

const idOrSlugParams = {
  type: 'object',
  additionalProperties: false,
  required: ['idOrSlug'],
  properties: { idOrSlug: { type: 'string', minLength: 1, maxLength: 180 } },
} as const;

const slugParams = {
  type: 'object',
  additionalProperties: false,
  required: ['slug'],
  properties: { slug: { type: 'string', minLength: 1, maxLength: 180 } },
} as const;

const idParams = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: { id: { type: 'string', minLength: 1, maxLength: 180 } },
} as const;

const sellerParams = {
  type: 'object',
  additionalProperties: false,
  required: ['identifier'],
  properties: { identifier: { type: 'string', minLength: 1, maxLength: 180 } },
} as const;

function queryValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

async function publicReadFallback<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    // Public feeds can degrade to an empty result during a short SQLite
    // writer collision. Auth, detail, and mutation paths still propagate the
    // error so a transient outage cannot be mistaken for an authenticated
    // success or a missing private record.
    if (isDatabaseAvailabilityError(error) || isDatabaseSchemaError(error)) return fallback;
    throw error;
  }
}

function emptyPostList() {
  return {
    items: [],
    pagination: { page: 1, limit: 12, total: 0, totalPages: 1, hasMore: false },
    categories: [],
    trendingTags: [],
  };
}

export async function registerPublicRoutes(app: FastifyInstance, services: { db: Database; auth: AuthService }): Promise<void> {
  const media = new MediaService(services.db, new MediaStorageService());
  const sellerProfiles = new SellerProfileService(services.db, media);
  const trust = new TrustService(services.db, sellerProfiles);
  const reads = new PublicReadService(services.db, services.auth, trust);

  app.get('/bots/categories', { schema: { response: { 200: successWithSchema({ type: 'array', items: botCategorySchema }) } } }, async () => ok(reads.getBotCategories()));
  app.get<{ Querystring: { category?: string; search?: string; status?: string; sort?: string } }>('/bots', { schema: { querystring: listQuery, response: { 200: botListResponse } } }, async (request) => ok(await reads.listBots(request.query)));
  app.get<{ Params: { idOrSlug: string } }>('/bots/:idOrSlug', { schema: { params: idOrSlugParams, response: { 200: botResponse } } }, async (request) => {
    const viewerId = await reads.viewerId(request);
    // request.ip is the trusted Fastify address; the user-agent prevents a
    // shared anonymous IP from collapsing every browser into one view.
    const viewerKey = `${viewerId ?? request.ip ?? 'unknown'}|${request.headers['user-agent'] ?? 'unknown'}`;
    return ok(await reads.getBot(request.params.idOrSlug, viewerKey));
  });
  app.get<{ Params: { idOrSlug: string } }>('/bots/:idOrSlug/reviews', { schema: { params: idOrSlugParams, response: { 200: reviewListResponse } } }, async (request) => ok(await publicReadFallback(async () => reads.getBotReviews(request.params.idOrSlug, await reads.viewerId(request)), [])));

  app.get('/posts/categories', { schema: { response: { 200: successWithSchema({ type: 'array', items: postCategorySchema }) } } }, async () => ok(await reads.getPostCategories()));
  app.get('/posts/tags', { schema: { response: { 200: successWithSchema({ type: 'array', items: { type: 'string' } }) } } }, async () => ok(await publicReadFallback(() => reads.getPostTags(), [])));
  app.get<{ Querystring: { q?: string; category?: string; type?: string; tab?: string; sort?: string; page?: string; limit?: string } }>('/posts', { schema: { querystring: postQuery, response: { 200: postListResponse } } }, async (request) => {
    return ok(await publicReadFallback(async () => reads.listPosts(request.query, await reads.viewerId(request)), emptyPostList()));
  });
  app.get<{ Params: { slug: string } }>('/posts/slug/:slug', { schema: { params: slugParams, response: { 200: postDetailResponse } } }, async (request) => {
    const viewerId = await reads.viewerId(request);
    // Fastify's request.ip is the trusted-proxy-normalized address. Never use
    // a caller-supplied x-forwarded-for value directly for view de-duplication.
    const viewerKey = `${viewerId ?? request.ip ?? 'unknown'}|${request.headers['user-agent'] ?? 'unknown'}`;
    return ok(await reads.getPostBySlug(request.params.slug, viewerId, viewerKey));
  });
  app.get<{ Querystring: { status?: string } }>('/posts/me', { schema: { querystring: { type: 'object', additionalProperties: false, properties: { status: { type: 'string', maxLength: 40 } } }, response: { 200: successWithSchema({ type: 'array', items: publicPostSchema }) } } }, async (request) => {
    return ok(await reads.getMyPosts(await reads.requireViewerId(request), request.query.status));
  });
  app.get('/posts/saved', { schema: { response: { 200: successWithSchema({ type: 'array', items: publicPostSchema }) } } }, async (request) => {
    return ok(await reads.getSavedPosts(await reads.requireViewerId(request)));
  });
  app.get<{ Params: { id: string } }>('/posts/:id', { schema: { params: idParams, response: { 200: postResponse } } }, async (request) => {
    const data = await reads.getPostById(request.params.id, await reads.viewerId(request));
    return data ? ok(data) : { success: false, error: 'Bài viết không tồn tại.' };
  });

  app.get<{ Querystring: { query?: string } }>('/sellers/lookup', { schema: { querystring: { type: 'object', additionalProperties: false, properties: { query: { type: 'string', maxLength: 120 } } }, response: { 200: successWithSchema(sellerLookupSchema) } } }, async (request) => ok(await publicReadFallback(() => reads.sellerLookup(queryValue(request.query.query)), { query: queryValue(request.query.query) ?? '', matches: [] })));
  app.get<{ Params: { identifier: string } }>('/sellers/:identifier/follow', { schema: { params: sellerParams, response: { 200: successWithSchema(sellerFollowSchema) } } }, async (request) => ok(await reads.sellerFollowState(request.params.identifier, await reads.viewerId(request))));
  app.get<{ Params: { identifier: string } }>('/sellers/:identifier', { schema: { params: sellerParams, response: { 200: successWithSchema(publicSellerProfileSchema) } } }, async (request) => ok(await reads.sellerProfile(request.params.identifier, await reads.viewerId(request))));

  app.get<{ Querystring: { targetType: string; targetId: string } }>('/comments', { schema: { querystring: commentQuery, response: { 200: commentListResponse } } }, async (request) => ok(await publicReadFallback(async () => reads.getComments(request.query.targetType, request.query.targetId, await reads.viewerId(request)), [])));
}
