import { randomBytes } from 'node:crypto';
import type { Database } from '../../core/database.js';
import { canonicalJson, hash } from '../../core/crypto.js';
import { AppError } from '../../core/errors.js';
import { postOut } from '../public/public-read.service.js';
import type { StaffContext } from './admin-context.js';

const POST_STATUSES = ['draft', 'scheduled', 'pending', 'published', 'hidden', 'removed'] as const;
const POST_TYPES = ['share', 'question', 'bot_update', 'warning', 'discussion', 'announcement', 'resource'] as const;
const POST_CATEGORIES = [
  { slug: 'automation', name: 'Bot & Automation' },
  { slug: 'telegram', name: 'Telegram' },
  { slug: 'discord', name: 'Discord' },
  { slug: 'ecommerce', name: 'E-commerce' },
  { slug: 'ai', name: 'AI' },
  { slug: 'development', name: 'Development' },
  { slug: 'guides', name: 'Hướng dẫn' },
  { slug: 'qa', name: 'Hỏi đáp' },
  { slug: 'warning', name: 'Cảnh báo' },
  { slug: 'discussion', name: 'Thảo luận' },
] as const;
type PostStatus = (typeof POST_STATUSES)[number];
type AuditDatabase = Pick<Database, 'user' | 'adminAuditLog'>;

function now(): string {
  return new Date().toISOString();
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function cleanQuery(value: unknown, max = 120): string {
  if (typeof value !== 'string') return '';
  const result = value.trim();
  if (result.length > max || /[\u0000-\u001f\u007f]/.test(result)) throw new AppError('ADMIN_QUERY_INVALID', 'Admin query is invalid.', 400);
  return result;
}

function cleanText(value: unknown, label: string, max: number, required = false): string | null {
  const result = typeof value === 'string' ? value.trim() : '';
  if (required && !result) throw new AppError('ADMIN_INPUT_REQUIRED', `${label} is required.`, 400);
  if (result.length > max || /[\u0000-\u001f\u007f]/.test(result)) throw new AppError('ADMIN_INPUT_INVALID', `${label} is invalid.`, 400);
  return result || null;
}

function categoryName(slug: string): string {
  return POST_CATEGORIES.find((item) => item.slug === slug)?.name ?? slug;
}

export class AdminContentService {
  constructor(private readonly db: Database) {}

  async getStats() {
    const [all, published, pending, scheduled, reported, hidden, drafts, comments] = await Promise.all([
      this.db.post.count({ where: { deletedAt: null } }),
      this.db.post.count({ where: { status: 'published', deletedAt: null } }),
      this.db.post.count({ where: { status: 'pending', deletedAt: null } }),
      this.db.post.count({ where: { status: 'scheduled', deletedAt: null } }),
      this.db.postReport.count({ where: { status: 'open' } }),
      this.db.post.count({ where: { status: 'hidden', deletedAt: null } }),
      this.db.post.count({ where: { status: 'draft', deletedAt: null } }),
      this.db.comment.count({ where: { targetType: 'post' } }),
    ]);
    return { all, published, pending, scheduled, reported, hidden, drafts, comments };
  }

  async getCategories() {
    const rows = await this.db.post.groupBy({ by: ['category'], where: { status: 'published', deletedAt: null }, _count: { _all: true } });
    const counts = new Map(rows.map((row) => [row.category, row._count._all]));
    return POST_CATEGORIES.map((item) => ({ ...item, count: counts.get(item.slug) ?? 0 }));
  }

  async getTags() {
    const rows = await this.db.post.findMany({ where: { status: 'published', deletedAt: null }, select: { tags: true }, take: 1_000 });
    const counts = new Map<string, number>();
    for (const row of rows) {
      for (const value of parseJson<unknown[]>(row.tags, [])) {
        if (typeof value !== 'string' || !value.trim()) continue;
        const tag = value.trim().replace(/^#/, '').slice(0, 40);
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((left, right) => right[1] - left[1]).map(([tag, count]) => ({ tag, count }));
  }

  async listReports(rawStatus?: string) {
    const status = cleanQuery(rawStatus, 30);
    const rows = await this.db.postReport.findMany({ where: status && ['open', 'resolved', 'dismissed'].includes(status) ? { status } : undefined, orderBy: { createdAt: 'desc' }, take: 200 });
    const posts = rows.length ? await this.db.post.findMany({ where: { id: { in: [...new Set(rows.map((row) => row.postId))] } }, select: { id: true, title: true } }) : [];
    const titles = new Map(posts.map((post) => [post.id, post.title]));
    return rows.map((row) => ({ ...row, postTitle: titles.get(row.postId) ?? 'Post no longer exists' }));
  }

  async listPosts(query: { q?: string; status?: string; category?: string; type?: string }) {
    const status = cleanQuery(query.status, 30);
    const category = cleanQuery(query.category, 60);
    const type = cleanQuery(query.type, 40);
    const q = cleanQuery(query.q);
    const rows = await this.db.post.findMany({
      where: {
        ...(status && POST_STATUSES.includes(status as PostStatus) ? { status } : {}),
        ...(category && category !== 'all' ? { category } : {}),
        ...(type && type !== 'all' && POST_TYPES.includes(type as (typeof POST_TYPES)[number]) ? { type } : {}),
        ...(q ? { OR: [{ title: { contains: q } }, { authorName: { contains: q } }] } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { author: { select: { id: true, name: true, avatar: true, role: true, verificationState: true, trustedAt: true, trustedUntil: true, tier: true, trustScore: true, sellerProfile: { select: { slug: true } } } } },
    });
    return rows.map((row) => this.postOutput(row));
  }

  async getPost(idInput: unknown) {
    const id = cleanQuery(idInput, 160);
    const row = await this.db.post.findUnique({ where: { id }, include: { author: { select: { id: true, name: true, avatar: true, role: true, verificationState: true, trustedAt: true, trustedUntil: true, tier: true, trustScore: true, sellerProfile: { select: { slug: true } } } } } });
    if (!row) throw new AppError('ADMIN_POST_NOT_FOUND', 'Post was not found.', 404);
    return this.postOutput(row);
  }

  async getVersions(idInput: unknown) {
    const id = cleanQuery(idInput, 160);
    const post = await this.db.post.findUnique({ where: { id }, select: { id: true } });
    if (!post) throw new AppError('ADMIN_POST_NOT_FOUND', 'Post was not found.', 404);
    return this.db.postVersion.findMany({ where: { postId: id }, orderBy: { version: 'desc' }, select: { id: true, postId: true, version: true, editorId: true, title: true, content: true, slug: true, createdAt: true } });
  }

  async setStatus(idInput: unknown, rawStatus: unknown, actor: StaffContext, rawReason?: unknown) {
    const id = cleanQuery(idInput, 160);
    const status = cleanText(rawStatus, 'Status', 30, true)!;
    if (!POST_STATUSES.includes(status as PostStatus)) throw new AppError('ADMIN_POST_STATUS_INVALID', 'Post status is invalid.', 400);
    const existing = await this.db.post.findUnique({ where: { id } });
    if (!existing) throw new AppError('ADMIN_POST_NOT_FOUND', 'Post was not found.', 404);
    if (status === 'scheduled' && (!existing.scheduledAt || Date.parse(existing.scheduledAt) <= Date.now())) throw new AppError('ADMIN_POST_SCHEDULE_INVALID', 'Scheduled posts must have a future time.', 400);
    const timestamp = now();
    const updated = await this.db.post.update({ where: { id }, data: { status, updatedAt: timestamp, publishedAt: status === 'published' ? existing.publishedAt || timestamp : existing.publishedAt, scheduledAt: status === 'scheduled' ? existing.scheduledAt : null, deletedAt: status === 'removed' ? existing.deletedAt || timestamp : status === 'published' ? null : existing.deletedAt } });
    await this.db.resourceVersion.updateMany({ where: { resource: { postId: id }, status: { in: ['draft', 'scheduled', 'pending', 'hidden'] } }, data: { status: status === 'published' ? 'published' : status, publishedAt: status === 'published' ? timestamp : null } });
    await this.recordAudit(actor, `post.status.${status}`, 'post', id, { before: existing, after: updated, reason: cleanText(rawReason, 'Reason', 1_000) ?? undefined });
    return this.postOutput(updated);
  }

  async setCommentsLocked(idInput: unknown, rawLocked: unknown, actor: StaffContext) {
    if (typeof rawLocked !== 'boolean') throw new AppError('ADMIN_POST_LOCK_INVALID', 'locked must be boolean.', 400);
    const id = cleanQuery(idInput, 160);
    const existing = await this.db.post.findUnique({ where: { id } });
    if (!existing) throw new AppError('ADMIN_POST_NOT_FOUND', 'Post was not found.', 404);
    const updated = await this.db.post.update({ where: { id }, data: { commentsLocked: rawLocked, updatedAt: now() } });
    await this.recordAudit(actor, 'post.comments_lock.updated', 'post', id, { before: existing, after: updated });
    return this.postOutput(updated);
  }

  async setDistribution(idInput: unknown, input: Record<string, unknown>, actor: StaffContext) {
    const id = cleanQuery(idInput, 160);
    const existing = await this.db.post.findUnique({ where: { id } });
    if (!existing) throw new AppError('ADMIN_POST_NOT_FOUND', 'Post was not found.', 404);
    for (const key of ['isPinned', 'isFeatured', 'commentsLocked']) {
      if (input[key] !== undefined && typeof input[key] !== 'boolean') throw new AppError('ADMIN_POST_DISTRIBUTION_INVALID', `${key} must be boolean.`, 400);
    }
    const updated = await this.db.post.update({ where: { id }, data: { ...(input.isPinned === undefined ? {} : { isPinned: input.isPinned as boolean }), ...(input.isFeatured === undefined ? {} : { isFeatured: input.isFeatured as boolean }), ...(input.commentsLocked === undefined ? {} : { commentsLocked: input.commentsLocked as boolean }), updatedAt: now() } });
    await this.recordAudit(actor, 'post.distribution.updated', 'post', id, { before: existing, after: updated });
    return this.postOutput(updated);
  }

  async resolveReport(idInput: unknown, rawStatus: unknown, actor: StaffContext, rawResolution?: unknown) {
    const id = cleanQuery(idInput, 160);
    const status = cleanText(rawStatus, 'Report status', 30, true)!;
    if (status !== 'resolved' && status !== 'dismissed') throw new AppError('ADMIN_REPORT_STATUS_INVALID', 'Report status is invalid.', 400);
    const existing = await this.db.postReport.findUnique({ where: { id } });
    if (!existing) throw new AppError('ADMIN_REPORT_NOT_FOUND', 'Report was not found.', 404);
    const updated = await this.db.postReport.update({ where: { id }, data: { status, reviewedBy: actor.userId, reviewedAt: now(), resolution: cleanText(rawResolution, 'Resolution', 1_000) } });
    await this.recordAudit(actor, `post.report.${status}`, 'post_report', id, { before: existing, after: updated });
    return updated;
  }

  private postOutput(row: Record<string, unknown> & { author?: unknown }) {
    const author = row.author && typeof row.author === 'object' ? row.author as Record<string, unknown> : null;
    const sellerProfile = author?.sellerProfile;
    return postOut(row, author ? { ...author, sellerProfileSlug: sellerProfile && typeof sellerProfile === 'object' ? (sellerProfile as { slug?: string }).slug : undefined } : null);
  }

  private async recordAudit(actor: StaffContext, action: string, targetType: string, targetId: string, payload: { before?: unknown; after?: unknown; reason?: string } = {}, db: AuditDatabase = this.db) {
    const user = await db.user.findUnique({ where: { id: actor.userId }, select: { name: true } });
    const previous = await db.adminAuditLog.findFirst({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { eventHash: true } });
    const createdAt = now();
    const beforeData = payload.before === undefined ? null : JSON.stringify(payload.before);
    const afterData = payload.after === undefined ? null : JSON.stringify(payload.after);
    const previousHash = previous?.eventHash ?? '';
    const eventHash = hash(canonicalJson({ previousHash, actorId: actor.userId, actorRole: actor.role, action, targetType, targetId, caseId: null, reason: payload.reason ?? null, beforeData, afterData, createdAt }));
    await db.adminAuditLog.create({ data: { id: `audit-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`, actorId: actor.userId, actorName: user?.name ?? 'Staff', actorRole: actor.role, action, targetType, targetId, caseId: null, reason: payload.reason ?? null, beforeData, afterData, createdAt, previousHash, eventHash } });
  }
}
