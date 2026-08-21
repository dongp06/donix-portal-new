import { mergeContacts } from '../../core/contact.js';
import type { Database } from '../../core/database.js';
import { AppError } from '../../core/errors.js';
import type { StaffContext } from './admin-context.js';

const CASE_STATUSES = ['open', 'investigating', 'resolved', 'dismissed'] as const;

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

function mediaDeliveryUrl(value: string | null | undefined): string {
  const source = typeof value === 'string' ? value.trim() : '';
  const attachment = /^attachment:\/\/([a-zA-Z0-9_-]+)$/i.exec(source);
  if (attachment) return `/api/media/${encodeURIComponent(attachment[1] ?? '')}`;
  const mediaRoute = /^\/api\/media\/([a-zA-Z0-9_-]+)$/i.exec(source);
  if (mediaRoute) return `/api/media/${encodeURIComponent(mediaRoute[1] ?? '')}`;
  return source;
}

function queryText(value: unknown, max = 120): string {
  if (typeof value !== 'string') return '';
  const result = value.trim();
  if (result.length > max || /[\u0000-\u001f\u007f]/.test(result)) {
    throw new AppError('ADMIN_QUERY_INVALID', 'Admin query is invalid.', 400);
  }
  return result;
}

function reportPriority(category: string): 'critical' | 'high' | 'medium' | 'low' {
  if (['scam', 'fraud', 'payment'].includes(category)) return 'critical';
  if (['harassment', 'copyright', 'misinformation'].includes(category)) return 'high';
  if (category === 'spam') return 'low';
  return 'medium';
}

export class AdminReadService {
  constructor(private readonly db: Database) {}

  async getOverview() {
    const today = new Date().toISOString().slice(0, 10);
    const [
      botCount,
      onlineBotCount,
      pendingBotCount,
      sellerCount,
      trustedSellerCount,
      pendingTrustCount,
      openReportCount,
      riskyReviewCount,
      todayBotCount,
      todaySellerCount,
      todayReportCount,
      postCount,
      pendingPostCount,
      commentCount,
      staffCount,
    ] = await Promise.all([
      this.db.bot.count(),
      this.db.bot.count({ where: { status: 'online' } }),
      this.db.bot.count({ where: { status: 'pending' } }),
      this.db.user.count({ where: { role: 'seller' } }),
      this.db.user.count({ where: { role: 'seller', verificationState: 'trusted' } }),
      this.db.trustVerification.count({ where: { status: { in: ['pending', 'under_review'] } } }),
      this.db.postReport.count({ where: { status: 'open' } }),
      this.db.botReview.count({ where: { rating: { lte: 2 } } }),
      this.db.bot.count({ where: { updatedAt: { startsWith: today } } }),
      this.db.user.count({ where: { role: 'seller', joinedDate: { startsWith: today } } }),
      this.db.postReport.count({ where: { createdAt: { startsWith: today } } }),
      this.db.post.count({ where: { deletedAt: null } }),
      this.db.post.count({ where: { status: 'pending', deletedAt: null } }),
      this.db.comment.count(),
      this.db.staffMember.count(),
    ]);
    const queue = await this.getModeration({ limit: 8 });
    return {
      needsAttention: { botApprovals: pendingBotCount, trustRequests: pendingTrustCount, reports: openReportCount, riskyReviews: riskyReviewCount },
      highPriority: queue.filter((item) => item.priority === 'critical' || item.priority === 'high').slice(0, 5),
      activityToday: { botsUpdated: todayBotCount, sellersJoined: todaySellerCount, reportsCreated: todayReportCount, postsPending: pendingPostCount },
      marketplace: { bots: botCount, activeBots: onlineBotCount, sellers: sellerCount, trustedSellers: trustedSellerCount, posts: postCount, comments: commentCount },
      staff: { total: staffCount },
      generatedAt: now(),
    };
  }

  async getModeration(query: { type?: string; priority?: string; assigned?: string; limit?: number } = {}, actor?: StaffContext) {
    const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 100);
    const [reports, verifications, cases] = await Promise.all([
      this.db.postReport.findMany({ where: { status: 'open' }, orderBy: { createdAt: 'desc' }, take: limit }),
      this.db.trustVerification.findMany({ where: { status: { in: ['pending', 'under_review'] } }, orderBy: { submittedAt: 'desc' }, take: limit, include: { user: { select: { id: true, name: true, email: true, avatar: true } } } }),
      this.db.adminCase.findMany({ where: query.assigned === 'unassigned' ? { status: { in: ['open', 'investigating'] }, assignedTo: null } : { status: { in: ['open', 'investigating'] } }, orderBy: { createdAt: 'desc' }, take: limit }),
    ]);
    const postIds = [...new Set(reports.map((report) => report.postId))];
    const posts = postIds.length ? await this.db.post.findMany({ where: { id: { in: postIds } }, select: { id: true, title: true } }) : [];
    const postById = new Map(posts.map((post) => [post.id, post]));
    const items = [
      ...reports.map((report) => ({ id: `report:${report.id}`, sourceId: report.id, type: 'report', targetType: 'post', targetId: report.postId, targetName: postById.get(report.postId)?.title ?? 'Post no longer exists', reason: report.category, details: report.details, priority: reportPriority(report.category), status: report.status, assignedTo: report.reviewedBy, createdAt: report.createdAt })),
      ...verifications.map((verification) => ({ id: `trust:${verification.id}`, sourceId: verification.id, type: 'trust_request', targetType: 'seller', targetId: verification.userId, targetName: verification.user.name, reason: 'Trusted Seller request', details: verification.note, priority: 'medium' as const, status: verification.status, assignedTo: verification.reviewedBy, createdAt: verification.submittedAt })),
      ...cases.map((item) => ({ id: item.id, sourceId: item.id, type: item.type, targetType: 'case', targetId: item.targetId, targetName: item.targetName, reason: item.reason, details: item.details, priority: item.priority, status: item.status, assignedTo: item.assignedTo, createdAt: item.createdAt, reference: item.reference })),
    ];
    return items
      .filter((item) => !query.type || item.type === query.type)
      .filter((item) => !query.priority || item.priority === query.priority)
      .filter((item) => query.assigned !== 'me' || item.assignedTo === actor?.userId)
      .filter((item) => query.assigned !== 'unassigned' || !item.assignedTo)
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, limit);
  }

  async listCases(rawStatus?: string) {
    const status = rawStatus ? queryText(rawStatus, 30) : '';
    return this.db.adminCase.findMany({
      where: status && CASE_STATUSES.includes(status as (typeof CASE_STATUSES)[number]) ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async getCase(id: string) {
    const value = queryText(id, 160);
    const item = await this.db.adminCase.findUnique({ where: { id: value } });
    if (!item) throw new AppError('ADMIN_CASE_NOT_FOUND', 'Admin case was not found.', 404);
    return { ...item, evidence: parseJson<unknown[]>(item.evidence, []), notes: parseJson<unknown[]>(item.notes, []) };
  }

  async search(rawQuery?: string) {
    const q = queryText(rawQuery, 120);
    if (!q) return [];
    const [users, bots, cases, posts] = await Promise.all([
      this.db.user.findMany({ where: { OR: [{ id: { contains: q } }, { name: { contains: q } }, { email: { contains: q } }] }, take: 6, orderBy: { joinedDate: 'desc' }, select: { id: true, name: true, email: true, role: true } }),
      this.db.bot.findMany({ where: { OR: [{ id: { contains: q } }, { slug: { contains: q } }, { title: { contains: q } }, { sellerName: { contains: q } }] }, take: 6, orderBy: { updatedAt: 'desc' }, select: { id: true, title: true, slug: true, sellerName: true } }),
      this.db.adminCase.findMany({ where: { OR: [{ id: { contains: q } }, { reference: { contains: q } }, { targetName: { contains: q } }, { reason: { contains: q } }] }, take: 6, orderBy: { createdAt: 'desc' }, select: { id: true, reference: true, targetName: true, reason: true, status: true } }),
      this.db.post.findMany({ where: { OR: [{ id: { contains: q } }, { slug: { contains: q } }, { title: { contains: q } }, { authorName: { contains: q } }] }, take: 6, orderBy: { updatedAt: 'desc' }, select: { id: true, slug: true, title: true, authorName: true, status: true } }),
    ]);
    return [
      ...users.map((user) => ({ type: user.role === 'seller' ? 'seller' : 'user', id: user.id, label: user.name, description: user.email, role: user.role })),
      ...bots.map((bot) => ({ type: 'bot', id: bot.id, label: bot.title, description: `${bot.sellerName} · ${bot.slug}`, role: null })),
      ...cases.map((item) => ({ type: 'case', id: item.id, label: item.reference, description: `${item.targetName} · ${item.status}`, role: null })),
      ...posts.map((post) => ({ type: 'post', id: post.id, label: post.title, description: `${post.authorName} · ${post.status}`, role: null })),
    ].slice(0, 20);
  }

  async listSellers(rawSearch?: string) {
    const q = queryText(rawSearch);
    const users = await this.db.user.findMany({ where: { role: 'seller', ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }, { id: { contains: q } }] } : {}) }, orderBy: { joinedDate: 'desc' }, take: 200, include: { sellerProfile: true, staffMember: { select: { role: true } } } });
    const ids = users.map((user) => user.id);
    const bots = ids.length ? await this.db.bot.findMany({ where: { sellerId: { in: ids } }, select: { id: true, sellerId: true, title: true, status: true, views: true, rating: true, reviewCount: true } }) : [];
    const bySeller = new Map<string, typeof bots>();
    for (const bot of bots) bySeller.set(bot.sellerId, [...(bySeller.get(bot.sellerId) ?? []), bot]);
    return users.map((user) => {
      const sellerBots = bySeller.get(user.id) ?? [];
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: mediaDeliveryUrl(user.avatar),
        joinedDate: user.joinedDate,
        verificationState: user.verificationState,
        trustScore: user.trustScore,
        trustScoreReady: Boolean(user.trustScoreUpdatedAt && (sellerBots.length > 0 || (user.sellerProfile?.profileCompleteness ?? 0) > 0)),
        trustedUntil: user.trustedUntil,
        staffRole: user.staffMember?.role ?? null,
        shop: user.sellerProfile ? { name: user.sellerProfile.shopName, slug: user.sellerProfile.slug, completeness: user.sellerProfile.profileCompleteness } : null,
        botCount: sellerBots.length,
        activeBotCount: sellerBots.filter((bot) => bot.status === 'online').length,
        views: sellerBots.reduce((sum, bot) => sum + bot.views, 0),
        reviewCount: sellerBots.reduce((sum, bot) => sum + bot.reviewCount, 0),
        averageRating: sellerBots.length ? Number((sellerBots.reduce((sum, bot) => sum + bot.rating, 0) / sellerBots.length).toFixed(1)) : 0,
      };
    });
  }

  async getSeller(rawId: string) {
    const id = queryText(rawId, 160);
    const user = await this.db.user.findFirst({ where: { OR: [{ id }, { sellerProfile: { slug: id } }] }, include: { sellerProfile: true, verifications: { orderBy: { submittedAt: 'desc' }, take: 10 }, verificationChecks: { orderBy: { updatedAt: 'desc' } }, trustEvents: { orderBy: { createdAt: 'desc' }, take: 20 }, staffMember: { select: { role: true } } } });
    if (!user || user.role !== 'seller') throw new AppError('ADMIN_SELLER_NOT_FOUND', 'Seller was not found.', 404);
    const bots = await this.db.bot.findMany({ where: { sellerId: user.id }, orderBy: { updatedAt: 'desc' } });
    const reviews = bots.length ? await this.db.botReview.findMany({ where: { botId: { in: bots.map((bot) => bot.id) } }, orderBy: { createdAt: 'desc' }, take: 100, include: { user: { select: { id: true, name: true, avatar: true } }, bot: { select: { id: true, title: true } } } }) : [];
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: mediaDeliveryUrl(user.avatar),
      joinedDate: user.joinedDate,
      bio: user.bio,
      contact: mergeContacts(user.contact, user.sellerProfile?.contact),
      verificationState: user.verificationState,
      trustScore: user.trustScore,
      trustScoreReady: Boolean(user.trustScoreUpdatedAt && (bots.length > 0 || (user.sellerProfile?.profileCompleteness ?? 0) > 0)),
      trustedAt: user.trustedAt,
      trustedUntil: user.trustedUntil,
      staffRole: user.staffMember?.role ?? null,
      shop: user.sellerProfile ? { ...user.sellerProfile, avatar: mediaDeliveryUrl(user.sellerProfile.avatar), banner: mediaDeliveryUrl(user.sellerProfile.banner), contact: mergeContacts(user.sellerProfile.contact) } : null,
      bots: bots.map((bot) => this.toAdminBot(bot)),
      reviews: reviews.map((review) => ({ ...review, user: review.user ? { ...review.user, avatar: mediaDeliveryUrl(review.user.avatar) } : review.user })),
      verifications: user.verifications,
      verificationChecks: user.verificationChecks,
      trustEvents: user.trustEvents.map((event) => ({ ...event, detail: parseJson<Record<string, unknown>>(event.detail, {}) })),
    };
  }

  async listBots(rawSearch?: string, rawStatus?: string) {
    const q = queryText(rawSearch);
    const status = queryText(rawStatus, 40);
    const rows = await this.db.bot.findMany({ where: { ...(status && status !== 'all' ? { status } : {}), ...(q ? { OR: [{ title: { contains: q } }, { sellerName: { contains: q } }, { categoryName: { contains: q } }, { tags: { contains: q } }] } : {}) }, orderBy: { updatedAt: 'desc' }, take: 300 });
    return rows.map((bot) => this.toAdminBot(bot));
  }

  async getBot(rawId: string) {
    const id = queryText(rawId, 160);
    const bot = await this.db.bot.findFirst({ where: { OR: [{ id }, { slug: id }] } });
    if (!bot) throw new AppError('ADMIN_BOT_NOT_FOUND', 'Bot was not found.', 404);
    const [seller, reviews] = await Promise.all([
      this.db.user.findUnique({ where: { id: bot.sellerId }, select: { id: true, name: true, email: true, avatar: true, verificationState: true, trustScore: true, joinedDate: true, trustedUntil: true, sellerProfile: { select: { slug: true, shopName: true } } } }),
      this.db.botReview.findMany({ where: { botId: bot.id }, orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, name: true, avatar: true } } } }),
    ]);
    return { ...this.toAdminBot(bot), seller: seller ? { ...seller, avatar: mediaDeliveryUrl(seller.avatar) } : seller, reviews: reviews.map((review) => ({ ...review, user: review.user ? { ...review.user, avatar: mediaDeliveryUrl(review.user.avatar) } : review.user })) };
  }

  async listUsers(rawSearch?: string, rawRole?: string) {
    const q = queryText(rawSearch);
    const role = queryText(rawRole, 40);
    const users = await this.db.user.findMany({ where: { ...(role && role !== 'all' ? { role } : {}), ...(q ? { OR: [{ id: { contains: q } }, { name: { contains: q } }, { email: { contains: q } }] } : {}) }, orderBy: { joinedDate: 'desc' }, take: 200, select: { id: true, name: true, email: true, avatar: true, role: true, joinedDate: true, verificationState: true, trustScore: true, trustedUntil: true, staffMember: { select: { role: true } } } });
    const ids = users.map((user) => user.id);
    if (!ids.length) return [];
    const [bots, posts, comments, reviews] = await Promise.all([
      this.db.bot.findMany({ where: { sellerId: { in: ids } }, select: { sellerId: true } }),
      this.db.post.findMany({ where: { authorId: { in: ids } }, select: { authorId: true } }),
      this.db.comment.findMany({ where: { authorId: { in: ids } }, select: { authorId: true } }),
      this.db.botReview.findMany({ where: { userId: { in: ids } }, select: { userId: true } }),
    ]);
    const counts = <T extends object>(rows: T[], key: keyof T) => {
      const values = new Map<string, number>();
      for (const row of rows) {
        const value = row[key];
        if (typeof value === 'string') values.set(value, (values.get(value) ?? 0) + 1);
      }
      return values;
    };
    const botCounts = counts(bots, 'sellerId');
    const postCounts = counts(posts, 'authorId');
    const commentCounts = counts(comments, 'authorId');
    const reviewCounts = counts(reviews, 'userId');
    return users.map((user) => ({ ...user, avatar: mediaDeliveryUrl(user.avatar), staffRole: user.staffMember?.role ?? null, staffMember: undefined, botCount: botCounts.get(user.id) ?? 0, postCount: postCounts.get(user.id) ?? 0, commentCount: commentCounts.get(user.id) ?? 0, reviewCount: reviewCounts.get(user.id) ?? 0 }));
  }

  async listStaff() {
    const rows = await this.db.staffMember.findMany({
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, name: true, email: true, avatar: true, joinedDate: true } } },
    });
    const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase() || null;
    return rows.map(({ user, ...row }) => {
      const isRootOwner = Boolean(ownerEmail && user.email.trim().toLowerCase() === ownerEmail);
      return { ...row, role: isRootOwner ? 'owner' : row.role, isRootOwner, user };
    });
  }

  async listComments(rawSearch?: string) {
    const q = queryText(rawSearch);
    const comments = await this.db.comment.findMany({ where: q ? { OR: [{ content: { contains: q } }, { authorName: { contains: q } }] } : undefined, orderBy: { createdAt: 'desc' }, take: 200, select: { id: true, targetType: true, targetId: true, authorId: true, authorName: true, authorAvatar: true, content: true, createdAt: true } });
    const postIds = comments.filter((comment) => comment.targetType === 'post').map((comment) => comment.targetId);
    const botIds = comments.filter((comment) => comment.targetType === 'bot').map((comment) => comment.targetId);
    const [posts, bots] = await Promise.all([
      postIds.length ? this.db.post.findMany({ where: { id: { in: postIds } }, select: { id: true, title: true } }) : [],
      botIds.length ? this.db.bot.findMany({ where: { id: { in: botIds } }, select: { id: true, title: true } }) : [],
    ]);
    const targetNames = new Map([...posts, ...bots].map((item) => [item.id, item.title]));
    return comments.map((comment) => ({ ...comment, authorAvatar: mediaDeliveryUrl(comment.authorAvatar), targetName: targetNames.get(comment.targetId) ?? 'Content no longer exists' }));
  }

  async getAnalytics() {
    const [overview, bots, posts, reports, users, reviews] = await Promise.all([
      this.getOverview(),
      this.db.bot.findMany({ select: { id: true, title: true, sellerName: true, views: true, status: true } }),
      this.db.post.findMany({ select: { views: true, status: true, deletedAt: true } }),
      this.db.postReport.findMany({ select: { category: true, status: true } }),
      this.db.user.findMany({ where: { role: 'seller' }, select: { verificationState: true } }),
      this.db.botReview.findMany({ select: { rating: true } }),
    ]);
    const countValues = (values: string[]) => Object.entries(values.reduce<Record<string, number>>((counts, value) => { counts[value] = (counts[value] ?? 0) + 1; return counts; }, {})).sort((left, right) => right[1] - left[1]).map(([label, count]) => ({ label, count }));
    const averageRating = reviews.length ? Number((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(2)) : 0;
    return {
      generatedAt: now(),
      marketplace: { ...overview.marketplace, botViews: bots.reduce((sum, bot) => sum + bot.views, 0), postViews: posts.reduce((sum, post) => sum + post.views, 0) },
      moderation: { ...overview.needsAttention, reportsByCategory: countValues(reports.map((report) => report.category)) },
      trust: { sellersByState: countValues(users.map((user) => user.verificationState)) },
      reviews: { total: reviews.length, averageRating, ratings: countValues(reviews.map((review) => String(review.rating))) },
      bots: { byStatus: countValues(bots.map((bot) => bot.status)), topByViews: [...bots].sort((left, right) => right.views - left.views).slice(0, 8) },
      posts: { byStatus: countValues(posts.filter((post) => !post.deletedAt).map((post) => post.status)) },
      tracking: { contactClicks: null, note: 'Contact click tracking is not available in the current data model.' },
    };
  }

  async listAudit(rawLimit?: number) {
    const limit = Math.min(Math.max(Number(rawLimit) || 100, 1), 200);
    return this.db.adminAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
  }

  async listRiskyReviews() {
    const rows = await this.db.botReview.findMany({ where: { rating: { lte: 2 } }, orderBy: { createdAt: 'desc' }, take: 200, include: { user: { select: { id: true, name: true, email: true, avatar: true, joinedDate: true } }, bot: { select: { id: true, title: true, sellerName: true, sellerId: true } } } });
    return rows.map((row) => ({ ...row, user: row.user ? { ...row.user, avatar: mediaDeliveryUrl(row.user.avatar) } : row.user }));
  }

  private toAdminBot(bot: {
    id: string; slug: string; title: string; tagline: string; description: string; categorySlug: string; categoryName: string; sellerId: string; sellerName: string; sellerAvatar: string; sellerVerificationState: string; sellerTrustedUntil: string | null; sellerJoinedDate: string; coverImage: string; gallery: string; features: string; monthlyPrice: number; pricingDescription: string; pricingImages: string; targetAudience: string; status: string; rating: number; reviewCount: number; views: number; tags: string; version: string; systemReqs: string; pricingUpdatedAt: string; updatedAt: string;
  }) {
    const gallery = parseJson<string[]>(bot.gallery, []).map(mediaDeliveryUrl);
    const pricingImages = parseJson<string[]>(bot.pricingImages, []).map(mediaDeliveryUrl);
    return {
      ...bot,
      sellerAvatar: mediaDeliveryUrl(bot.sellerAvatar),
      coverImage: mediaDeliveryUrl(bot.coverImage),
      gallery,
      features: parseJson<string[]>(bot.features, []),
      pricingImages,
      targetAudience: parseJson<string[]>(bot.targetAudience, []),
      tags: parseJson<string[]>(bot.tags, []),
      pricing: { monthlyPrice: bot.monthlyPrice, description: bot.pricingDescription, images: pricingImages },
    };
  }
}
