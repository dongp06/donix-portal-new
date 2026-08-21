import { publicPostSchema, successWithSchema } from '../../core/route-schemas.js';

const nullableString = { type: ['string', 'null'] } as const;

export const statsResponse = successWithSchema({
  type: 'object', additionalProperties: false, required: ['all', 'published', 'pending', 'scheduled', 'reported', 'hidden', 'drafts', 'comments'], properties: { all: { type: 'integer' }, published: { type: 'integer' }, pending: { type: 'integer' }, scheduled: { type: 'integer' }, reported: { type: 'integer' }, hidden: { type: 'integer' }, drafts: { type: 'integer' }, comments: { type: 'integer' } },
});
export const categoriesResponse = successWithSchema({ type: 'array', items: { type: 'object', additionalProperties: false, required: ['slug', 'name', 'count'], properties: { slug: { type: 'string' }, name: { type: 'string' }, count: { type: 'integer' } } } });
export const tagsResponse = successWithSchema({ type: 'array', items: { type: 'object', additionalProperties: false, required: ['tag', 'count'], properties: { tag: { type: 'string' }, count: { type: 'integer' } } } });
export const reportsResponse = successWithSchema({ type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'postId', 'category', 'status', 'createdAt', 'postTitle'], properties: { id: { type: 'string' }, postId: { type: 'string' }, reporterId: nullableString, category: { type: 'string' }, details: nullableString, status: { type: 'string' }, createdAt: { type: 'string' }, reviewedAt: nullableString, reviewedBy: nullableString, resolution: nullableString, postTitle: { type: 'string' } } } });
export const postsResponse = successWithSchema({ type: 'array', items: publicPostSchema });
export const postResponse = successWithSchema(publicPostSchema);
export const versionsResponse = successWithSchema({ type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'postId', 'version', 'title', 'content', 'slug', 'createdAt'], properties: { id: { type: 'string' }, postId: { type: 'string' }, version: { type: 'integer' }, editorId: nullableString, title: { type: 'string' }, content: { type: 'string' }, slug: { type: 'string' }, createdAt: { type: 'string' } } } });
