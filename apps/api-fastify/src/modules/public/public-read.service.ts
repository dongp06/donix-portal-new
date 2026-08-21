import type { FastifyRequest } from 'fastify';
import { createHash, randomUUID } from 'node:crypto';
import type { Database } from '../../core/database.js';
import { AppError, isDatabaseSchemaError, isUniqueConstraintError } from '../../core/errors.js';
import { sessionTokenFromRequest } from '../../core/crypto.js';
import { AuthService } from '../../core/auth.js';
import { resourceToPostOut, type PostResourceOutput } from '../resources/resources.service.js';
import type { TrustService } from '../trust/trust.service.js';

const PUBLIC_BOT_STATUSES = ['online', 'maintenance', 'offline'];
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
const BOT_CATEGORIES = [
  { id: 'cat-1', slug: 'messenger', name: 'Bot Facebook Messenger', icon: 'MessageCircle', description: 'Bot Messenger cho inbox và chăm sóc khách hàng.', count: 0 },
  { id: 'cat-2', slug: 'telegram', name: 'Bot Telegram', icon: 'Send', description: 'Bot Telegram cho group, channel và thông báo.', count: 0 },
  { id: 'cat-3', slug: 'discord', name: 'Bot Discord', icon: 'MessageSquare', description: 'Bot quản trị và tự động hóa cộng đồng Discord.', count: 0 },
  { id: 'cat-4', slug: 'zalo', name: 'Bot Zalo', icon: 'PhoneCall', description: 'Bot Zalo OA và automation chăm sóc khách hàng.', count: 0 },
  { id: 'cat-5', slug: 'instagram', name: 'Bot Instagram', icon: 'Instagram', description: 'Bot Instagram cho inbox và nội dung social.', count: 0 },
];
const POST_TYPES = ['share', 'question', 'bot_update', 'warning', 'discussion', 'announcement', 'resource'] as const;
const POST_STATUSES = ['draft', 'scheduled', 'pending', 'published', 'hidden', 'removed'] as const;

const LOOKUP_CONTACT_KEYS = ['telegram', 'website', 'zalo', 'phone', 'messenger', 'facebook'] as const;
const VERIFICATION_CHECK_LABELS = [
  { kind: 'email', label: 'Email / Google account' },
  { kind: 'phone', label: 'Phone number' },
  { kind: 'telegram', label: 'Telegram' },
  { kind: 'website', label: 'Website / domain' },
  { kind: 'identity', label: 'Identity' },
] as const;

type LookupMatchType = (typeof LOOKUP_CONTACT_KEYS)[number] | 'contact' | 'slug' | 'name' | 'id';

function foldLookupText(value: string): string {
  return value.normalize('NFKC').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function compactLookupText(value: string): string {
  return foldLookupText(value).replace(/[^a-z0-9]+/g, '');
}

function lookupForms(value: string): Set<string> {
  const forms = new Set<string>();
  const add = (candidate: string) => {
    const folded = foldLookupText(candidate).replace(/[?#].*$/, '').replace(/\/+$/, '');
    if (!folded) return;
    forms.add(folded);
    const compact = compactLookupText(folded);
    if (compact) forms.add(compact);
  };
  const raw = value.trim();
  add(raw);
  add(raw.replace(/^@/, ''));
  const withoutScheme = foldLookupText(raw).replace(/^(?:https?:\/\/)?(?:www\.)?/, '').replace(/^@/, '');
  add(withoutScheme);
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${withoutScheme}`);
    const host = url.hostname.replace(/^www\./, '');
    const path = url.pathname.split('/').filter(Boolean);
    add(host);
    if (path.length) {
      add(`${host}/${path[0]}`);
      add(path[0]!);
    }
  } catch {
    // Username/domain input can be non-URL data; the forms above still apply.
  }
  return forms;
}

function intersects(left: Set<string>, right: Set<string>): boolean {
  for (const value of left) if (right.has(value)) return true;
  return false;
}

function lookupRisk(state: string, trusted: boolean): { status: 'clear' | 'limited' | 'caution'; message: string } {
  if (['under_review', 'suspended', 'revoked', 'rejected'].includes(state)) {
    return { status: 'caution', message: 'The seller verification state needs additional review.' };
  }
  if (trusted) return { status: 'clear', message: 'No warning signal was found in the current verification state.' };
  return { status: 'limited', message: 'There is not enough public data to assess warning signals.' };
}

function lookupTier(value: string | null | undefined): 'new' | 'active' | 'trusted' | 'top' {
  return value === 'active' || value === 'trusted' || value === 'top' ? value : 'new';
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mergeContacts(...values: Array<string | null | undefined>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const value of values) {
    const parsed = parseJson<Record<string, unknown>>(value, {});
    for (const [key, item] of Object.entries(parsed)) {
      if (typeof item === 'string' && item.trim()) result[key] = item.trim();
    }
  }
  return result;
}

function viewWindowKey(now = new Date()): string {
  // UTC makes the hourly de-duplication deterministic across processes.
  return now.toISOString().slice(0, 13);
}

function viewKeyHash(value: string): string {
  // Do not persist a raw IP/user-agent pair in the view table.
  return createHash('sha256').update(value.slice(0, 1_024), 'utf8').digest('hex');
}

export function botOut(row: Record<string, unknown>, contact: Record<string, string> = {}): Record<string, unknown> {
  const trusted = row.sellerVerificationState === 'trusted' && (!row.sellerTrustedUntil || Date.parse(String(row.sellerTrustedUntil)) >= Date.now());
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    tagline: row.tagline,
    description: row.description,
    categorySlug: row.categorySlug,
    categoryName: row.categoryName,
    seller: {
      id: row.sellerId,
      name: row.sellerName,
      avatar: row.sellerAvatar,
      rating: row.sellerRating,
      reputation: Math.round(Number(row.sellerRating ?? 0) * 20),
      totalSales: row.sellerSales,
      isTrusted: trusted,
      verificationState: row.sellerVerificationState,
      ...(row.sellerTrustedUntil ? { trustedUntil: row.sellerTrustedUntil } : {}),
      joinedDate: row.sellerJoinedDate,
      ...(row.sellerSlug ? { slug: row.sellerSlug } : {}),
      ...(Object.keys(contact).length ? { contact } : {}),
    },
    coverImage: row.coverImage,
    gallery: parseJson<string[]>(String(row.gallery ?? ''), []),
    features: parseJson<string[]>(String(row.features ?? ''), []),
    pricing: {
      monthlyPrice: row.monthlyPrice,
      ...(row.pricingDescription ? { pricingDescription: row.pricingDescription } : {}),
      pricingImages: parseJson<string[]>(String(row.pricingImages ?? ''), []),
    },
    status: row.status,
    rating: row.rating,
    reviewCount: row.reviewCount,
    views: row.views,
    tags: parseJson<string[]>(String(row.tags ?? ''), []),
    targetAudience: parseJson<string[]>(String(row.targetAudience ?? ''), []),
    version: row.version,
    systemReqs: row.systemReqs,
    ...(row.pricingUpdatedAt ? { pricingUpdatedAt: row.pricingUpdatedAt } : {}),
    updatedAt: row.updatedAt,
  };
}

export function postOut(
  row: Record<string, unknown>,
  author?: Record<string, unknown> | null,
  viewerId?: string | null,
  options: { includeContent?: boolean; isBookmarked?: boolean } = {},
): Record<string, unknown> {
  const tags = parseJson<unknown[]>(String(row.tags ?? ''), []).filter((item): item is string => typeof item === 'string');
  const content = String(row.content ?? '');
  const excerpt = String(row.excerpt ?? '') || content.replace(/[#*_`>\[\]()]/g, '').replace(/\s+/g, ' ').trim().slice(0, 177);
  const trusted = author?.verificationState === 'trusted' && (!author.trustedUntil || Date.parse(String(author.trustedUntil)) >= Date.now());
  const output: Record<string, unknown> = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt,
    type: row.type,
    status: row.status,
    category: row.category,
    categoryName: row.categoryName || row.category,
    coverImage: row.coverImage,
    linkedBotId: row.linkedBotId,
    author: {
      id: author?.id ?? row.authorId,
      name: author?.name ?? row.authorName,
      avatar: author?.avatar ?? row.authorAvatar,
      role: author?.role ?? row.authorRole,
      slug: author?.sellerProfileSlug,
      tier: author?.tier,
      trustScore: author?.trustScore,
      isTrusted: trusted,
      isOfficial: Boolean(row.isOfficial),
      officialRole: row.officialRole,
      verificationState: author?.verificationState ?? 'unverified',
      trustedAt: author?.trustedAt,
      trustedUntil: author?.trustedUntil,
    },
    tags,
    views: row.views,
    commentsCount: row.commentsCount,
    reactionCount: row.reactionCount,
    bookmarkCount: row.bookmarkCount,
    reportCount: row.reportCount,
    isPinned: row.isPinned,
    isFeatured: row.isFeatured,
    commentsLocked: row.commentsLocked,
    answerCommentId: row.answerCommentId,
    readTimeMinutes: row.readTimeMinutes ?? Math.max(1, Math.ceil(content.split(/\s+/).filter(Boolean).length / 200)),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt || row.createdAt,
    publishedAt: row.publishedAt,
    scheduledAt: row.scheduledAt,
    isOwn: Boolean(viewerId && row.authorId === viewerId),
    reactions: [],
  };
  if (options.includeContent !== false) output.content = content;
  if (options.isBookmarked !== undefined) output.isBookmarked = options.isBookmarked;
  return output;
}

export class PublicReadService {
  constructor(
    private readonly db: Database,
    private readonly auth: AuthService,
    private readonly trust: TrustService,
  ) {}

  async viewerId(request: FastifyRequest): Promise<string | null> {
    const token = sessionTokenFromRequest(request);
    if (!token) return null;
    const resolved = await this.auth.resolveSessionUser(token);
    return resolved?.user.id ?? null;
  }

  async requireViewerId(request: FastifyRequest): Promise<string> {
    const userId = await this.viewerId(request);
    if (!userId) throw new AppError('AUTH_REQUIRED', 'Bạn cần đăng nhập để xem nội dung này.', 401);
    return userId;
  }

  getBotCategories() {
    return BOT_CATEGORIES;
  }

  async listBots(query: { category?: string; search?: string; status?: string; sort?: string }) {
    const requestedStatus = query.status?.trim().toLowerCase();
    const where: Record<string, unknown> = { status: requestedStatus && PUBLIC_BOT_STATUSES.includes(requestedStatus) ? requestedStatus : { in: PUBLIC_BOT_STATUSES } };
    if (query.category && query.category !== 'all') where.categorySlug = query.category;
    if (query.search?.trim()) {
      const search = query.search.trim().toLowerCase();
      where.OR = [{ title: { contains: search } }, { description: { contains: search } }, { tags: { contains: search } }];
    }
    const rows = await this.db.bot.findMany({ where, orderBy: { updatedAt: 'desc' } });
    const sellerIds = [...new Set(rows.map((row) => row.sellerId))];
    const [users, profiles] = await Promise.all([
      this.db.user.findMany({ where: { id: { in: sellerIds } }, select: { id: true, contact: true } }),
      this.db.sellerProfile.findMany({ where: { userId: { in: sellerIds } }, select: { userId: true, contact: true, slug: true } }),
    ]);
    const profileById = new Map(profiles.map((item) => [item.userId, item]));
    const userById = new Map(users.map((item) => [item.id, item]));
    const result = rows.map((row) => botOut(row as unknown as Record<string, unknown>, mergeContacts(userById.get(row.sellerId)?.contact, profileById.get(row.sellerId)?.contact)));
    if (query.sort === 'rating') result.sort((a, b) => Number((b as { rating: number }).rating) - Number((a as { rating: number }).rating));
    if (query.sort === 'price_asc') result.sort((a, b) => Number((a as { pricing: { monthlyPrice: number } }).pricing.monthlyPrice) - Number((b as { pricing: { monthlyPrice: number } }).pricing.monthlyPrice));
    if (query.sort === 'price_desc') result.sort((a, b) => Number((b as { pricing: { monthlyPrice: number } }).pricing.monthlyPrice) - Number((a as { pricing: { monthlyPrice: number } }).pricing.monthlyPrice));
    return result;
  }

  async getBot(identifier: string, viewerKey?: string) {
    const row = await this.db.bot.findFirst({ where: { OR: [{ id: identifier }, { slug: identifier }], status: { in: PUBLIC_BOT_STATUSES } } });
    if (!row) throw new AppError('BOT_NOT_FOUND', 'Bot không tồn tại.', 404);
    const view = await this.recordBotView(row.id, viewerKey);
    const viewedRow = { ...row, views: view.views };
    const [user, profile] = await Promise.all([
      this.db.user.findUnique({ where: { id: row.sellerId }, select: { contact: true } }),
      this.db.sellerProfile.findUnique({ where: { userId: row.sellerId }, select: { contact: true, slug: true } }),
    ]);
    return botOut(viewedRow as unknown as Record<string, unknown>, mergeContacts(user?.contact, profile?.contact));
  }

  /**
   * Count a bot detail view once per viewer and UTC hour. The aggregate update
   * uses an atomic increment, so concurrent requests cannot overwrite one
   * another. Older local databases without BotView still get a safe counter
   * increment until the schema migration is applied.
   */
  private async recordBotView(botId: string, viewerKey?: string): Promise<{ counted: boolean; views: number }> {
    if (!viewerKey) {
      const updated = await this.db.bot.update({ where: { id: botId }, data: { views: { increment: 1 } }, select: { views: true } });
      return { counted: true, views: updated.views };
    }
    const key = viewKeyHash(viewerKey);
    const windowKey = viewWindowKey();
    try {
      await this.db.botView.create({
        data: { id: `bview-${randomUUID()}`, botId, viewerKey: key, windowKey, viewedAt: new Date().toISOString() },
      });
      const updated = await this.db.bot.update({ where: { id: botId }, data: { views: { increment: 1 } }, select: { views: true } });
      return { counted: true, views: updated.views };
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const current = await this.db.bot.findUnique({ where: { id: botId }, select: { views: true } });
        return { counted: false, views: current?.views ?? 0 };
      }
      if (isDatabaseSchemaError(error)) {
        const updated = await this.db.bot.update({ where: { id: botId }, data: { views: { increment: 1 } }, select: { views: true } });
        return { counted: true, views: updated.views };
      }
      throw error;
    }
  }

  async getBotReviews(identifier: string, viewerId: string | null) {
    const bot = await this.db.bot.findFirst({ where: { OR: [{ id: identifier }, { slug: identifier }], status: { in: PUBLIC_BOT_STATUSES } }, select: { id: true } });
    if (!bot) throw new AppError('BOT_NOT_FOUND', 'Bot không tồn tại.', 404);
    const rows = await this.db.botReview.findMany({ where: { botId: bot.id }, include: { user: { select: { id: true, name: true, avatar: true } } }, orderBy: { createdAt: 'desc' } });
    return rows.map((row) => ({ id: row.id, userId: row.userId, userName: row.user.name, userAvatar: row.user.avatar, rating: row.rating, comment: row.comment, images: parseJson<string[]>(row.images, []), createdAt: row.createdAt, isOwn: row.userId === viewerId }));
  }

  async getPostCategories() {
    return POST_CATEGORIES;
  }

  async getPostTags() {
    const rows = await this.db.post.findMany({ where: { status: 'published', deletedAt: null }, select: { tags: true } });
    return [...new Set(rows.flatMap((row) => parseJson<unknown[]>(row.tags, []).filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim())))].sort((a, b) => a.localeCompare(b));
  }

  private async postAuthors(rows: Array<{ authorId: string | null }>) {
    const ids = [...new Set(rows.map((row) => row.authorId).filter((id): id is string => Boolean(id)))];
    const [users, profiles, staff] = await Promise.all([
      this.db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, avatar: true, role: true, verificationState: true, trustedAt: true, trustedUntil: true, tier: true, trustScore: true } }),
      this.db.sellerProfile.findMany({ where: { userId: { in: ids } }, select: { userId: true, slug: true } }),
      this.db.staffMember.findMany({ where: { userId: { in: ids }, isActive: true }, select: { userId: true, role: true } }),
    ]);
    const profileById = new Map(profiles.map((item) => [item.userId, item.slug]));
    const staffById = new Map(staff.map((item) => [item.userId, item.role]));
    return new Map(users.map((user) => [user.id, { ...user, sellerProfileSlug: profileById.get(user.id), staffRole: staffById.get(user.id) }]));
  }

  private async bookmarkedPostIds(userId: string | null, postIds: string[]): Promise<Set<string>> {
    if (!userId || !postIds.length) return new Set();
    const rows = await this.db.postBookmark.findMany({
      where: { userId, postId: { in: postIds } },
      select: { postId: true },
    });
    return new Set(rows.map((row) => row.postId));
  }

  private async mapPosts(
    rows: Array<Record<string, unknown> & { id: string; authorId: string | null }>,
    viewerId: string | null,
    includeContent: boolean,
  ): Promise<Record<string, unknown>[]> {
    if (!rows.length) return [];
    const [authors, resources, bookmarked] = await Promise.all([
      this.postAuthors(rows),
      this.resourcesForPosts(rows.map((row) => row.id)),
      this.bookmarkedPostIds(viewerId, rows.map((row) => row.id)),
    ]);
    return rows.map((row) => {
      const output = postOut(
        row,
        (row.authorId ? authors.get(row.authorId) : null) as Record<string, unknown> | null,
        viewerId,
        { includeContent, isBookmarked: viewerId ? bookmarked.has(row.id) : undefined },
      );
      const resource = resources.get(row.id);
      if (resource) output.resource = resource;
      return output;
    });
  }

  async listPosts(query: { q?: string; category?: string; type?: string; tab?: string; sort?: string; page?: string; limit?: string }, viewerId: string | null = null) {
    const where: Record<string, unknown> = { status: 'published', deletedAt: null };
    if (query.category && query.category !== 'all') where.category = query.category;
    const requestedType = query.type || (query.tab === 'questions' ? 'question' : undefined);
    if (requestedType && requestedType !== 'all' && POST_TYPES.includes(requestedType as typeof POST_TYPES[number])) where.type = requestedType;
    if (query.q?.trim()) {
      const q = query.q.trim().toLowerCase();
      where.OR = [{ title: { contains: q } }, { excerpt: { contains: q } }, { content: { contains: q } }, { tags: { contains: q } }];
    }
    const pageValue = Number(query.page);
    const limitValue = Number(query.limit);
    const page = Number.isFinite(pageValue) && pageValue > 0 ? Math.floor(pageValue) : 1;
    const limit = Number.isFinite(limitValue) && limitValue > 0 ? Math.min(40, Math.floor(limitValue)) : 12;
    const sort = query.sort === 'popular' || query.sort === 'trending' || query.tab === 'featured'
      ? [{ isPinned: 'desc' }, { isFeatured: 'desc' }, { reactionCount: 'desc' }, { views: 'desc' }]
      : query.sort === 'discussed'
        ? [{ commentsCount: 'desc' }, { updatedAt: 'desc' }]
        : [{ isPinned: 'desc' }, { createdAt: 'desc' }];
    const [total, rows, categoryRows, tagRows] = await Promise.all([
      this.db.post.count({ where }),
      this.db.post.findMany({ where, orderBy: sort as never, take: limit, skip: (page - 1) * limit }),
      this.db.post.groupBy({ by: ['category'], where: { status: 'published', deletedAt: null }, _count: { _all: true } }),
      this.db.post.findMany({ where: { status: 'published', deletedAt: null }, select: { tags: true }, take: 500 }),
    ]);
    let items = await this.mapPosts(rows as unknown as Array<Record<string, unknown> & { id: string; authorId: string | null }>, viewerId, false);
    if (query.sort === 'trending' || query.tab === 'featured') {
      items = items.sort((left, right) => {
        const score = (item: Record<string, unknown>) => Number(item.reactionCount ?? 0) * 4 + Number(item.commentsCount ?? 0) * 5 + Number(item.bookmarkCount ?? 0) * 3 + Number(item.views ?? 0);
        return score(right) - score(left);
      });
    }
    const categoryCounts = new Map(categoryRows.map((row) => [row.category, row._count._all]));
    const categories = POST_CATEGORIES.map((item) => ({ slug: item.slug, name: item.name, count: categoryCounts.get(item.slug) ?? 0 }));
    const tagCounts = new Map<string, number>();
    for (const row of tagRows) {
      for (const tag of parseJson<unknown[]>(row.tags, [])) {
        if (typeof tag !== 'string' || !tag.trim()) continue;
        const normalized = tag.trim();
        tagCounts.set(normalized, (tagCounts.get(normalized) ?? 0) + 1);
      }
    }
    const trendingTags = [...tagCounts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 12)
      .map(([tag, count]) => ({ tag, count }));
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return {
      items,
      pagination: { page, limit, total, totalPages, hasMore: page < totalPages },
      categories,
      trendingTags,
    };
  }

  async getPostBySlug(slug: string, viewerId: string | null, viewerKey?: string) {
    const row = await this.db.post.findFirst({ where: { slug, status: 'published', deletedAt: null } });
    if (!row) throw new AppError('POST_NOT_FOUND', 'Bài viết không tồn tại.', 404);
    const view = await this.recordPostView(row.id, viewerKey);
    const viewedRow = { ...row, views: view.views };
    const [post, relatedRows] = await Promise.all([
      this.mapPosts([viewedRow as unknown as Record<string, unknown> & { id: string; authorId: string | null }], viewerId, true),
      this.db.post.findMany({
        where: { status: 'published', deletedAt: null, category: row.category, id: { not: row.id } },
        orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
        take: 4,
      }),
    ]);
    return { post: post[0], related: await this.mapPosts(relatedRows as unknown as Array<Record<string, unknown> & { id: string; authorId: string | null }>, viewerId, false) };
  }

  /** Persist the post aggregate together with its hourly de-duplication row. */
  private async recordPostView(postId: string, viewerKey?: string): Promise<{ counted: boolean; views: number }> {
    if (!viewerKey) {
      const updated = await this.db.post.update({ where: { id: postId }, data: { views: { increment: 1 } }, select: { views: true } });
      return { counted: true, views: updated.views };
    }
    const key = viewKeyHash(viewerKey);
    const windowKey = viewWindowKey();
    try {
      await this.db.postView.create({
        data: { id: `pview-${randomUUID()}`, postId, viewerKey: key, windowKey, viewedAt: new Date().toISOString() },
      });
      const updated = await this.db.post.update({ where: { id: postId }, data: { views: { increment: 1 } }, select: { views: true } });
      return { counted: true, views: updated.views };
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const current = await this.db.post.findUnique({ where: { id: postId }, select: { views: true } });
        return { counted: false, views: current?.views ?? 0 };
      }
      if (isDatabaseSchemaError(error)) {
        const updated = await this.db.post.update({ where: { id: postId }, data: { views: { increment: 1 } }, select: { views: true } });
        return { counted: true, views: updated.views };
      }
      throw error;
    }
  }

  async getPostById(id: string, viewerId: string | null) {
    const row = await this.db.post.findUnique({ where: { id } });
    if (!row) return null;
    const publicPost = row.status === 'published' && row.deletedAt === null;
    const authorPreview = Boolean(viewerId && row.authorId === viewerId && row.deletedAt === null && row.status !== 'removed');
    if (!publicPost && !authorPreview) return null;
    const mapped = await this.mapPosts([row as unknown as Record<string, unknown> & { id: string; authorId: string | null }], viewerId, true);
    return mapped[0] ?? null;
  }

  async getMyPosts(userId: string, status?: string) {
    const where: Record<string, unknown> = { authorId: userId };
    where.status = status && POST_STATUSES.includes(status as typeof POST_STATUSES[number]) ? status : { not: 'removed' };
    const rows = await this.db.post.findMany({ where, orderBy: [{ updatedAt: 'desc' }] });
    return this.mapPosts(rows as unknown as Array<Record<string, unknown> & { id: string; authorId: string | null }>, userId, false);
  }

  async getSavedPosts(userId: string) {
    const bookmarks = await this.db.postBookmark.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { postId: true } });
    if (!bookmarks.length) return [];
    const rows = await this.db.post.findMany({
      where: { id: { in: bookmarks.map((item) => item.postId) }, status: 'published', deletedAt: null },
      orderBy: [{ createdAt: 'desc' }],
    });
    return this.mapPosts(rows as unknown as Array<Record<string, unknown> & { id: string; authorId: string | null }>, userId, false);
  }

  private async resourceForPost(postId: string): Promise<PostResourceOutput | null> {
    const resources = await this.resourcesForPosts([postId]);
    return resources.get(postId) ?? null;
  }

  private async resourcesForPosts(postIds: string[]): Promise<Map<string, PostResourceOutput>> {
    if (!postIds.length) return new Map();
    const rows = await this.db.resource.findMany({
      where: { postId: { in: postIds }, status: 'active', post: { status: 'published', deletedAt: null } },
      include: {
        versions: { where: { status: 'published' }, orderBy: { createdAt: 'desc' }, take: 1, include: { files: { where: { status: 'active' }, orderBy: { createdAt: 'asc' } } } },
      },
    });
    const result = new Map<string, PostResourceOutput>();
    for (const row of rows) {
      if (!row.versions[0]) continue;
      result.set(row.postId, resourceToPostOut(row, row.versions));
    }
    return result;
  }

  private async seller(identifier: string) {
    const byId = await this.db.user.findUnique({ where: { id: identifier } });
    if (byId) return byId;
    const profile = await this.db.sellerProfile.findUnique({ where: { slug: identifier } });
    if (profile) {
      const user = await this.db.user.findUnique({ where: { id: profile.userId } });
      if (user) return user;
    }
    throw new AppError('SELLER_NOT_FOUND', 'Hồ sơ người bán không tồn tại.', 404);
  }

  async sellerFollowState(identifier: string, viewerId: string | null) {
    const seller = await this.seller(identifier);
    if (seller.role !== 'seller') throw new AppError('SELLER_NOT_FOUND', 'Seller không tồn tại.', 404);
    const [followerCount, following] = await Promise.all([
      this.db.sellerFollow.count({ where: { sellerId: seller.id } }),
      viewerId ? this.db.sellerFollow.findFirst({ where: { sellerId: seller.id, followerId: viewerId }, select: { id: true } }) : null,
    ]);
    return { followerCount, isFollowing: Boolean(following) };
  }

  async sellerProfile(identifier: string, viewerId: string | null) {
    const seller = await this.seller(identifier);
    if (seller.role !== 'seller') throw new AppError('SELLER_NOT_FOUND', 'Seller không tồn tại.', 404);
    const summary = await this.trust.getSummary(seller.id);
    const [profile, bots, posts, follow, timeline, reviewRows] = await Promise.all([
      this.db.sellerProfile.findUnique({ where: { userId: seller.id } }),
      this.db.bot.findMany({ where: { sellerId: seller.id, status: { in: PUBLIC_BOT_STATUSES } }, orderBy: { updatedAt: 'desc' } }),
      this.db.post.findMany({ where: { authorId: seller.id, status: 'published', deletedAt: null }, orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }], take: 50 }),
      this.sellerFollowState(identifier, viewerId),
      this.trust.getTimeline(seller.id),
      this.db.botReview.findMany({
        where: { bot: { sellerId: seller.id, status: { in: PUBLIC_BOT_STATUSES } } },
        include: { user: { select: { name: true, avatar: true } }, bot: { select: { id: true, title: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);
    const contact = mergeContacts(seller.contact, profile?.contact);
    const botRows = bots.map((row) => botOut(row as unknown as Record<string, unknown>, contact));
    const authors = await this.postAuthors(posts);
    const distribution: [number, number, number, number, number] = [0, 0, 0, 0, 0];
    let ratingTotal = 0;
    const reviews = reviewRows.map((row) => {
      if (row.rating >= 1 && row.rating <= 5) {
        const bucket = row.rating - 1;
        distribution[bucket] = (distribution[bucket] ?? 0) + 1;
        ratingTotal += row.rating;
      }
      return {
        id: row.id,
        userName: row.user?.name ?? 'User',
        userAvatar: row.user?.avatar ?? '',
        rating: row.rating,
        date: row.createdAt,
        comment: row.comment,
        images: parseJson<string[]>(row.images, []),
        botId: row.bot.id,
        botTitle: row.bot.title,
      };
    });
    return {
      user: {
        id: seller.id,
        name: profile?.shopName?.trim() || seller.name,
        avatar: profile?.avatar?.trim() || seller.avatar,
        role: seller.role,
        bio: profile?.bio ?? seller.bio,
        joinedDate: seller.joinedDate,
        contact,
        trustScore: summary.score.score,
        tier: summary.tier,
        slug: profile?.slug ?? '',
        verifiedAt: summary.trustedAt,
        verificationState: summary.state,
        trustedAt: summary.trustedAt,
        trustedUntil: summary.trustedUntil,
        isTrusted: summary.isTrusted,
        basicVerifiedCount: summary.basicVerifiedCount,
        basicVerifiedTotal: summary.basicVerifiedTotal,
        ...follow,
      },
      bots: botRows,
      posts: posts.map((row) => postOut(row as unknown as Record<string, unknown>, (row.authorId ? authors.get(row.authorId) : null) as Record<string, unknown> | null, viewerId)),
      // Trust history is useful on the public profile, but internal event
      // detail can contain actor ids, notes, verification ids, and risk
      // metadata. Publish only the small status transition subset.
      trustEvents: timeline.map((event) => {
        const detail = event.detail && typeof event.detail === 'object' && !Array.isArray(event.detail)
          ? event.detail as Record<string, unknown>
          : {};
        const publicDetail = Object.fromEntries(
          ['from', 'to', 'status', 'trustedUntil'].flatMap((key) => {
            const value = detail[key];
            return value === undefined || (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean' && value !== null)
              ? []
              : [[key, value]];
          }),
        );
        return { id: event.id, type: event.type, ...(Object.keys(publicDetail).length ? { detail: publicDetail } : {}), createdAt: event.createdAt };
      }),
      reviews,
      reviewSummary: {
        total: reviews.length,
        average: reviews.length ? Math.round((ratingTotal / reviews.length) * 10) / 10 : 0,
        distribution,
      },
    };
  }

  private async sellerLookupComplete(query: string | undefined) {
    const raw = query?.trim() ?? '';
    if (!raw || raw.length > 120) throw new AppError('LOOKUP_INVALID', 'Please enter a valid seller lookup value.', 400);
    const users = await this.db.user.findMany({
      where: { role: 'seller' },
      select: { id: true, name: true, avatar: true, joinedDate: true, trustScore: true, tier: true, googleId: true, verificationState: true, trustedAt: true, trustedUntil: true, contact: true },
    });
    if (!users.length) return { query: raw, matches: [] };
    const ids = users.map((user) => user.id);
    const [profiles, bots, verifications, verificationChecks] = await Promise.all([
      this.db.sellerProfile.findMany({ where: { userId: { in: ids } }, select: { userId: true, shopName: true, slug: true, avatar: true, contact: true } }),
      this.db.bot.findMany({ where: { sellerId: { in: ids } }, select: { id: true, sellerId: true } }),
      this.db.trustVerification.findMany({ where: { userId: { in: ids } }, orderBy: { submittedAt: 'desc' }, select: { userId: true, status: true, reviewedAt: true, trustedAt: true, trustedUntil: true, expiresAt: true } }),
      this.db.verificationCheck.findMany({ where: { userId: { in: ids } }, select: { userId: true, kind: true, status: true } }),
    ]);
    const botById = new Map(bots.map((bot) => [bot.id, bot.sellerId]));
    const reviews = bots.length
      ? await this.db.botReview.findMany({ where: { botId: { in: bots.map((bot) => bot.id) } }, select: { botId: true, rating: true } })
      : [];
    const profileByUser = new Map(profiles.map((profile) => [profile.userId, profile]));
    const stats = new Map<string, { botCount: number; reviewCount: number; ratingTotal: number }>();
    for (const bot of bots) {
      const current = stats.get(bot.sellerId) ?? { botCount: 0, reviewCount: 0, ratingTotal: 0 };
      current.botCount += 1;
      stats.set(bot.sellerId, current);
    }
    for (const review of reviews) {
      const sellerId = botById.get(review.botId);
      if (!sellerId) continue;
      const current = stats.get(sellerId) ?? { botCount: 0, reviewCount: 0, ratingTotal: 0 };
      current.reviewCount += 1;
      current.ratingTotal += review.rating;
      stats.set(sellerId, current);
    }
    const latest = new Map<string, (typeof verifications)[number]>();
    for (const verification of verifications) if (!latest.has(verification.userId)) latest.set(verification.userId, verification);
    const checksByUser = new Map<string, Map<string, string>>();
    for (const check of verificationChecks) {
      const values = checksByUser.get(check.userId) ?? new Map<string, string>();
      values.set(check.kind, check.status);
      checksByUser.set(check.userId, values);
    }
    const queryForms = lookupForms(raw);
    const nowMs = Date.now();
    const ranked: Array<{ exact: boolean; result: Record<string, unknown> }> = [];
    for (const user of users) {
      const profile = profileByUser.get(user.id);
      const contact = mergeContacts(user.contact, profile?.contact);
      const fields: Array<{ type: LookupMatchType; value: string; partial: boolean }> = [
        ...Object.entries(contact).map(([key, value]) => ({
          type: (LOOKUP_CONTACT_KEYS as readonly string[]).includes(key) ? key as LookupMatchType : 'contact' as const,
          value,
          partial: false,
        })),
        ...(profile?.slug ? [{ type: 'slug' as const, value: profile.slug, partial: true }] : []),
        { type: 'id', value: user.id, partial: false },
        { type: 'name', value: profile?.shopName || user.name, partial: true },
        { type: 'name', value: user.name, partial: true },
      ];
      let match: { type: LookupMatchType; exact: boolean } | undefined;
      for (const field of fields) {
        if (intersects(lookupForms(field.value), queryForms)) {
          match = { type: field.type, exact: true };
          break;
        }
      }
      if (!match && !/[/:]/.test(raw)) {
        const queryText = foldLookupText(raw).replace(/^@/, '');
        const queryCompact = compactLookupText(queryText);
        if (queryText.length >= 2) {
          for (const field of fields) {
            if (!field.partial) continue;
            if (foldLookupText(field.value).includes(queryText) || (queryCompact.length >= 2 && compactLookupText(field.value).includes(queryCompact))) {
              match = { type: field.type, exact: false };
              break;
            }
          }
        }
      }
      if (!match) continue;
      const currentStats = stats.get(user.id) ?? { botCount: 0, reviewCount: 0, ratingTotal: 0 };
      const verification = latest.get(user.id);
      const state = verification?.status || user.verificationState || 'unverified';
      const trustedUntil = verification?.trustedUntil || verification?.expiresAt || user.trustedUntil || undefined;
      const trusted = state === 'trusted' && (!trustedUntil || Date.parse(trustedUntil) >= nowMs);
      const verificationStatus = state === 'trusted' && !trusted ? 'revoked' : state;
      const checkStatuses = checksByUser.get(user.id) ?? new Map<string, string>();
      const publicChecks = VERIFICATION_CHECK_LABELS.map((definition) => ({
        kind: definition.kind,
        label: definition.label,
        status: definition.kind === 'email' && user.googleId ? 'verified' : checkStatuses.get(definition.kind) ?? 'unverified',
      }));
      const basicVerifiedCount = publicChecks.filter((check) => check.status === 'verified').length;
      const risk = lookupRisk(state, trusted);
      const result: Record<string, unknown> = {
        id: user.id,
        name: user.name,
        shopName: profile?.shopName || user.name,
        avatar: profile?.avatar || user.avatar,
        ...(profile?.slug ? { slug: profile.slug } : {}),
        profilePath: `/sellers/${encodeURIComponent(profile?.slug || user.id)}`,
        trustScore: Math.max(0, Math.min(100, Number(user.trustScore ?? 0))),
        tier: lookupTier(user.tier),
        rating: currentStats.reviewCount ? Math.round((currentStats.ratingTotal / currentStats.reviewCount) * 10) / 10 : null,
        reviewCount: currentStats.reviewCount,
        botCount: currentStats.botCount,
        joinedDate: user.joinedDate,
        verified: trusted,
        isTrusted: trusted,
        verificationStatus,
        ...(trusted ? { verifiedAt: verification?.trustedAt || verification?.reviewedAt || user.trustedAt || undefined, trustedUntil } : {}),
        basicVerifiedCount,
        basicVerifiedTotal: VERIFICATION_CHECK_LABELS.length,
        matchType: match.type,
        exactMatch: match.exact,
        verificationChecks: publicChecks,
        riskStatus: risk.status,
        riskMessage: risk.message,
      };
      ranked.push({ exact: match.exact, result });
    }
    ranked.sort((left, right) => Number(right.exact) - Number(left.exact) || Number(right.result.isTrusted) - Number(left.result.isTrusted) || Number(right.result.trustScore) - Number(left.result.trustScore) || Number(right.result.reviewCount) - Number(left.result.reviewCount));
    return { query: raw, matches: ranked.slice(0, 20).map((item) => item.result) };
  }

  async sellerLookup(query: string | undefined) {
    return this.sellerLookupComplete(query);
    /*
    const raw = query?.trim() ?? '';
    if (!raw || raw.length > 120) throw new AppError('LOOKUP_INVALID', 'Vui lòng nhập từ khóa tra cứu hợp lệ.', 400);
    const users = await this.db.user.findMany({ where: { role: 'seller' }, select: { id: true, name: true, avatar: true, joinedDate: true, trustScore: true, tier: true, verificationState: true, trustedAt: true, trustedUntil: true, contact: true } });
    const profiles = await this.db.sellerProfile.findMany({ where: { userId: { in: users.map((user) => user.id) } }, select: { userId: true, shopName: true, slug: true, avatar: true, contact: true } });
    const profileById = new Map(profiles.map((profile) => [profile.userId, profile]));
    const q = raw.toLowerCase().replace(/^@/, '');
    const matches = users.filter((user) => {
      const profile = profileById.get(user.id);
      const haystack = [user.id, user.name, profile?.shopName, profile?.slug, ...Object.values(mergeContacts(user.contact, profile?.contact))].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    }).slice(0, 20).map((user) => {
      const profile = profileById.get(user.id);
      const trusted = user.verificationState === 'trusted' && (!user.trustedUntil || Date.parse(user.trustedUntil) >= Date.now());
      return { id: user.id, name: user.name, shopName: profile?.shopName || user.name, avatar: profile?.avatar || user.avatar, slug: profile?.slug, profilePath: `/sellers/${encodeURIComponent(profile?.slug || user.id)}`, trustScore: user.trustScore, tier: user.tier, joinedDate: user.joinedDate, verified: trusted, isTrusted: trusted, verificationStatus: trusted ? 'trusted' : user.verificationState, matchType: 'name', exactMatch: haystackEquals(user, profile, q) };
    });
    return { query: raw, matches };
    */
  }

  async getComments(targetType: string, targetId: string, viewerId: string | null) {
    if (targetType !== 'post' && targetType !== 'bot') throw new AppError('COMMENT_TARGET_INVALID', 'Comment target type is invalid.', 400);
    const target = targetType === 'post'
      ? await this.db.post.findFirst({ where: { id: targetId, status: 'published', deletedAt: null }, select: { id: true } })
      : await this.db.bot.findFirst({ where: { id: targetId, status: { in: PUBLIC_BOT_STATUSES } }, select: { id: true } });
    if (!target) throw new AppError('COMMENT_TARGET_NOT_FOUND', 'Comment target not found.', 404);
    const rows = await this.db.comment.findMany({ where: { targetType, targetId }, orderBy: { createdAt: 'asc' } });
    const reactionRows = rows.length
      ? await this.db.reaction.findMany({
        where: { targetType: 'comment', targetId: { in: rows.map((row) => row.id) } },
        select: { targetId: true, emoji: true, userId: true },
      })
      : [];
    const reactionsByComment = new Map<string, Map<string, { count: number; reactedByMe: boolean }>>();
    for (const reaction of reactionRows) {
      const byEmoji = reactionsByComment.get(reaction.targetId) ?? new Map<string, { count: number; reactedByMe: boolean }>();
      const current = byEmoji.get(reaction.emoji) ?? { count: 0, reactedByMe: false };
      current.count += 1;
      current.reactedByMe ||= Boolean(viewerId && reaction.userId === viewerId);
      byEmoji.set(reaction.emoji, current);
      reactionsByComment.set(reaction.targetId, byEmoji);
    }
    const flat = await Promise.all(rows.map(async (row) => {
      const reactions = [...(reactionsByComment.get(row.id)?.entries() ?? [])]
        .sort((left, right) => right[1].count - left[1].count)
        .map(([emoji, value]) => ({ emoji, ...value }));
      return {
        id: row.id,
        targetType,
        targetId: row.targetId,
        parentId: row.parentId,
        authorId: row.authorId,
        authorName: row.authorName,
        authorAvatar: row.authorAvatar,
        content: row.content,
        reactions,
        reactionCount: reactions.reduce((sum, item) => sum + item.count, 0),
        isOwn: Boolean(viewerId && row.authorId === viewerId),
        createdAt: row.createdAt,
        replies: [] as unknown[],
      };
    }));
    const byId = new Map(flat.map((row) => [row.id, row]));
    const roots: typeof flat = [];
    for (const row of flat) {
      if (row.parentId && byId.has(row.parentId)) byId.get(row.parentId)!.replies.push(row);
      else roots.push(row);
    }
    return roots;
  }
}
