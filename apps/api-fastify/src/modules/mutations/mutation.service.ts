import { randomUUID } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { AuthService, type AuthUser } from '../../core/auth.js';
import { mergeContacts } from '../../core/contact.js';
import type { Database } from '../../core/database.js';
import { AppError } from '../../core/errors.js';
import { botOut, postOut, PublicReadService } from '../public/public-read.service.js';
import { MediaService } from '../media/media.service.js';
import { MEDIA_MAX_IMAGE_SIZE } from '../media/media-storage.service.js';
import { ResourcesService, parseResourceInput } from '../resources/resources.service.js';
import { readFile } from 'node:fs/promises';
import { SellerProfileService } from '../sellers/seller-profile.service.js';
import { TrustService } from '../trust/trust.service.js';
import { AdminWriteService } from '../admin/admin-write.service.js';
import type { StaffRole } from '../admin/admin-context.js';
import { AdminContentService } from '../admin/admin-content.service.js';
import { SecurityService } from '../../core/security.js';
import { E2eeService } from '../e2ee/e2ee.service.js';

const PUBLIC_BOT_STATUSES = ['online', 'maintenance', 'offline'];
const POST_TYPES = ['share', 'question', 'bot_update', 'warning', 'discussion', 'announcement', 'resource'];
const POST_STATUSES = ['draft', 'scheduled', 'pending', 'published', 'hidden', 'removed'];
const POST_REACTIONS = ['\u{1F44D}', '\u2764\uFE0F'];
const COMMENT_REACTIONS = ['\u{1F44D}', '\u2764\uFE0F', '\u{1F602}', '\u{1F62E}', '\u{1F622}', '\u{1F621}'];
const CONTACT_KEYS = ['zalo', 'telegram', 'phone', 'messenger', 'facebook', 'website'] as const;
const BOT_MUTATION_KEYS = ['title', 'tagline', 'description', 'coverImage', 'gallery', 'features', 'pricing', 'status', 'tags', 'targetAudience', 'categorySlug', 'categoryName', 'version', 'systemReqs'];
const POST_MUTATION_KEYS = ['title', 'content', 'type', 'category', 'tags', 'coverImage', 'linkedBotId', 'status', 'excerpt', 'scheduledAt', 'official', 'isPinned', 'isFeatured', 'commentsLocked', 'resource'];
const POST_CATEGORIES = ['automation', 'telegram', 'discord', 'ecommerce', 'ai', 'development', 'guides', 'qa', 'warning', 'discussion'];

type JsonObject = Record<string, unknown>;

function now(): string {
  return new Date().toISOString();
}

function object(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError('BODY_INVALID', 'Request body must be an object.', 400);
  }
  return value as JsonObject;
}

function assertKeys(value: JsonObject, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed);
  const unexpected = Object.keys(value).find((key) => !allowedSet.has(key));
  if (unexpected) throw new AppError('BODY_FIELD_UNEXPECTED', `Unexpected field '${unexpected}'.`, 400);
}

function text(value: unknown, label: string, min = 0, max = 100_000): string {
  if (typeof value !== 'string') throw new AppError('FIELD_INVALID', `${label} must be a string.`, 400);
  const result = value.trim();
  if (result.length < min || result.length > max) throw new AppError('FIELD_INVALID', `${label} has an invalid length.`, 400);
  return result;
}

function optionalText(value: unknown, label: string, max = 100_000): string | undefined {
  return value === undefined ? undefined : text(value, label, 0, max);
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function imageReference(value: unknown): string {
  const result = text(value, 'Image reference', 1, 2_000);
  if (!/^(?:attachment:\/\/[A-Za-z0-9_-]+|\/api\/media\/[A-Za-z0-9_-]+|https?:\/\/[^\s"'<>]+)$/i.test(result)) {
    throw new AppError('IMAGE_REFERENCE_INVALID', 'Image reference is invalid.', 400);
  }
  return result;
}

function imageArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) throw new AppError('IMAGES_INVALID', 'Images must be an array.', 400);
  const result = [...new Set(value.map(imageReference))];
  if (result.length > max) throw new AppError('IMAGES_INVALID', `A maximum of ${max} images is allowed.`, 400);
  return result;
}

function stringArray(value: unknown, label: string, max: number, itemMax: number, min = 0): string[] {
  if (!Array.isArray(value)) throw new AppError('FIELD_INVALID', `${label} must be an array.`, 400);
  const result = [...new Set(value.map((item) => text(item, label, 1, itemMax)).filter(Boolean))].slice(0, max);
  if (result.length < min) throw new AppError('FIELD_INVALID', `${label} has too few items.`, 400);
  return result;
}

function botStatus(value: unknown, fallback = 'online'): string {
  const status = value === undefined ? fallback : text(value, 'Status', 1, 20).toLowerCase();
  if (!['online', 'maintenance', 'offline', 'pending', 'hidden', 'suspended', 'deleted'].includes(status)) {
    throw new AppError('BOT_STATUS_INVALID', 'Bot status is invalid.', 400);
  }
  return status;
}

function isPublicBotStatus(status: string): boolean {
  return PUBLIC_BOT_STATUSES.includes(status);
}

function monthlyPrice(value: unknown): number {
  const result = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(result) || result <= 0 || result > 2_147_483_647) throw new AppError('BOT_PRICE_INVALID', 'Monthly price is invalid.', 400);
  return result;
}

function postType(value: unknown): string {
  const result = text(value, 'Post type', 1, 40);
  if (!POST_TYPES.includes(result)) throw new AppError('POST_TYPE_INVALID', 'Post type is invalid.', 400);
  return result;
}

function postStatus(value: unknown, fallback = 'published'): string {
  const result = value === undefined ? fallback : text(value, 'Post status', 1, 40);
  if (!POST_STATUSES.includes(result) || result === 'scheduled') throw new AppError('POST_STATUS_INVALID', 'Post status is invalid for this flow.', 400);
  return result === 'hidden' || result === 'removed' ? 'published' : result;
}

function adminPostStatus(value: unknown): string {
  const result = value === undefined ? 'draft' : text(value, 'Post status', 1, 40);
  if (!['draft', 'scheduled', 'published'].includes(result)) throw new AppError('POST_STATUS_INVALID', 'Admin post status is invalid.', 400);
  return result;
}

function scheduledPostTime(value: unknown): string {
  const result = text(value, 'Scheduled time', 1, 80);
  const timestamp = Date.parse(result);
  if (!Number.isFinite(timestamp) || timestamp <= Date.now()) throw new AppError('POST_SCHEDULE_INVALID', 'Scheduled time must be a valid future date.', 400);
  return new Date(timestamp).toISOString();
}

function postCategory(value: unknown): string {
  const result = value === undefined ? 'automation' : text(value, 'Category', 1, 120).toLowerCase();
  return POST_CATEGORIES.includes(result) ? result : result.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'automation';
}

function postTags(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new AppError('POST_TAGS_INVALID', 'Tags must be an array.', 400);
  return [...new Set(value.map((item) => text(item, 'Tag', 1, 40).replace(/^#/, '')).filter(Boolean))].slice(0, 8);
}

function safeContact(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError('CONTACT_INVALID', 'Contact must be an object.', 400);
  const result: Record<string, string> = {};
  for (const key of CONTACT_KEYS) {
    if (!(key in value)) continue;
    const item = (value as JsonObject)[key];
    if (typeof item !== 'string' || item.length > 200) throw new AppError('CONTACT_INVALID', `Contact '${key}' is invalid.`, 400);
    result[key] = item.trim();
  }
  return result;
}

function sellerSlugBase(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'seller';
}

function reviewOut(row: { id: string; userId: string; rating: number; comment: string; images: string; createdAt: string; user?: { name: string; avatar: string } | null }, viewerId: string | null) {
  return {
    id: row.id,
    userId: row.userId,
    userName: row.user?.name ?? 'User',
    userAvatar: row.user?.avatar ?? '',
    rating: row.rating,
    date: row.createdAt,
    comment: row.comment,
    images: parseJson<string[]>(row.images, []),
    isOwn: row.userId === viewerId,
  };
}

export class MutationService {
  private readonly reads: PublicReadService;

  constructor(
    private readonly db: Database,
    private readonly auth: AuthService,
    private readonly media: MediaService,
    private readonly resources: ResourcesService,
    private readonly sellerProfiles: SellerProfileService,
    private readonly trust: TrustService,
    private readonly adminWrites: AdminWriteService,
    private readonly adminContent: AdminContentService,
    private readonly securityService: SecurityService,
    private readonly e2ee: E2eeService,
  ) {
    this.reads = new PublicReadService(db, auth, trust);
  }

  async dispatch(request: FastifyRequest): Promise<unknown> {
    const security = request.security;
    if (!security) throw new AppError('AUTH_REQUIRED', 'Authenticated device proof is required.', 401);
    const user = await this.auth.publicUser(security.userId);
    if (!user) throw new AppError('SESSION_INVALID', 'Login session is invalid.', 401);
    const path = request.internalPath ?? request.url.split('?', 1)[0] ?? '/';
    const method = (request.internalMethod ?? request.method).toUpperCase();
    const parts = path.split('/').filter(Boolean);

    if (method === 'DELETE' && parts[1] === 'security' && parts[2] === 'devices' && parts.length === 4) {
      return this.securityService.revokeDevice(request, parts[3]!);
    }

    if (method === 'POST' && path === '/api/e2ee/devices') return this.e2ee.publishDeviceKeys(request, request.body);
    if (method === 'POST' && path === '/api/e2ee/conversations') return this.e2ee.createConversation(request, request.body);
    if (method === 'POST' && parts[1] === 'e2ee' && parts[2] === 'conversations' && parts[4] === 'messages' && parts.length === 5) {
      return this.e2ee.sendMessage(request, parts[3]!, request.body);
    }
    if (method === 'POST' && parts[1] === 'e2ee' && parts[2] === 'conversations' && parts[4] === 'attachments' && parts.length === 5) {
      const upload = request.multipartUpload;
      if (!upload?.file) throw new AppError('E2EE_ATTACHMENT_REQUIRED', 'Encrypted attachment is required.', 400);
      return this.e2ee.uploadAttachment(request, parts[3]!, upload.fields, upload.file.tempPath);
    }

    if (method === 'PATCH' && path === '/api/users/me') return this.updateProfile(user, request.body);
    if (method === 'PUT' && path === '/api/sellers/me/profile') return this.sellerProfiles.updateProfile(user.id, request.body);
    if (method === 'POST' && path === '/api/sellers/me/verification') return this.trust.submitVerification(user.id, request.body);
    if (method === 'DELETE' && path === '/api/sellers/me/verification') return this.trust.cancelVerification(user.id);
    if (method === 'POST' && parts[1] === 'sellers' && parts[2] === 'me' && parts[3] === 'verification' && parts[4] === 'checks' && parts.length === 6) return this.trust.requestCheck(user.id, parts[5]!);
    if (method === 'PATCH' && parts[1] === 'admin' && parts[2] === 'verifications' && parts.length === 4) {
      const role = user.staffRole;
      if (role !== 'owner' && role !== 'admin' && role !== 'moderator') {
        throw new AppError('NOT_FOUND', 'Not found.', 404);
      }
      return this.trust.reviewApplication(parts[3]!, request.body, { userId: user.id, role });
    }
    if (method === 'PATCH' && parts[1] === 'admin' && parts[2] === 'verifications' && parts[4] === 'checks' && parts.length === 6) {
      const role = user.staffRole;
      if (role !== 'owner' && role !== 'admin' && role !== 'moderator') {
        throw new AppError('NOT_FOUND', 'Not found.', 404);
      }
      const body = object(request.body);
      assertKeys(body, ['status', 'value', 'method', 'note']);
      return this.trust.setCheckStatus(parts[3]!, { ...body, kind: parts[5] }, user.id, role);
    }
    if (parts[1] === 'admin' && parts[2] === 'cases') {
      const role = user.staffRole;
      if (role !== 'owner' && role !== 'admin' && role !== 'moderator') throw new AppError('NOT_FOUND', 'Not found.', 404);
      const actor = { userId: user.id, role: role as StaffRole };
      if (method === 'POST' && parts.length === 3) return this.adminWrites.createCase(object(request.body), actor);
      if (method === 'POST' && parts.length === 5 && parts[4] === 'assign') return this.adminWrites.assignCase(parts[3]!, object(request.body).assignee, actor);
      if (method === 'PATCH' && parts.length === 4) return this.adminWrites.updateCase(parts[3]!, object(request.body), actor);
    }
    if (parts[1] === 'admin' && parts[2] === 'staff') {
      const role = user.staffRole;
      if (role !== 'owner' && role !== 'admin') throw new AppError('NOT_FOUND', 'Not found.', 404);
      const actor = { userId: user.id, role: role as StaffRole };
      if (method === 'POST' && parts.length === 3) return this.adminWrites.appointStaff(object(request.body), actor);
      if (method === 'PATCH' && parts.length === 4) return this.adminWrites.updateStaff(parts[3]!, object(request.body), actor);
      if (method === 'DELETE' && parts.length === 4) return this.adminWrites.deactivateStaff(parts[3]!, object(request.body).reason, actor);
    }
    if (parts[1] === 'admin' && parts[2] === 'posts') {
      const role = user.staffRole;
      if (role !== 'owner' && role !== 'admin' && role !== 'moderator') throw new AppError('NOT_FOUND', 'Not found.', 404);
      const actor = { userId: user.id, role: role as StaffRole };
      if (method === 'POST' && parts.length === 3) return this.createPost(user, request.body, true);
      if (method === 'PATCH' && parts.length === 5 && parts[3] === 'reports') return this.adminContent.resolveReport(parts[4]!, object(request.body).status, actor, object(request.body).resolution);
      if (method === 'PATCH' && parts.length === 5 && parts[4] === 'status') return this.adminContent.setStatus(parts[3]!, object(request.body).status, actor, object(request.body).reason);
      if (method === 'PATCH' && parts.length === 5 && parts[4] === 'comments') return this.adminContent.setCommentsLocked(parts[3]!, object(request.body).locked, actor);
      if (method === 'PATCH' && parts.length === 5 && parts[4] === 'distribution') return this.adminContent.setDistribution(parts[3]!, object(request.body), actor);
    }
    if (method === 'POST' && path === '/api/uploads/images') {
      const upload = request.multipartUpload;
      if (!upload?.file || upload.file.sizeBytes <= 0) throw new AppError('MEDIA_FILE_REQUIRED', 'An image file is required.', 400);
      if (upload.file.sizeBytes > MEDIA_MAX_IMAGE_SIZE) throw new AppError('MEDIA_FILE_TOO_LARGE', 'An image may not exceed 10 MB.', 413);
      return this.media.uploadImage({ userId: user.id, staffRole: user.staffRole }, {
        originalname: upload.file.filename,
        mimetype: upload.file.mimetype,
        buffer: await readFile(upload.file.tempPath),
      }, upload.fields.usage);
    }
    if (method === 'POST' && path === '/api/admin/resources/upload') {
      const upload = request.multipartUpload;
      if (!upload?.file || upload.file.sizeBytes <= 0) throw new AppError('RESOURCE_FILE_REQUIRED', 'A resource file is required.', 400);
      return this.resources.stageUpload({ userId: user.id, staffRole: user.staffRole }, {
        originalname: upload.file.filename,
        mimetype: upload.file.mimetype,
        tempPath: upload.file.tempPath,
      });
    }
    if (method === 'DELETE' && parts[1] === 'admin' && parts[2] === 'resources' && parts[3] === 'files' && parts.length === 5) {
      await this.resources.removeStagedFile(parts[4]!, { userId: user.id, staffRole: user.staffRole });
      return true;
    }
    if ((method === 'PATCH' || method === 'DELETE') && parts[1] === 'uploads' && parts.length === 3) {
      const attachmentId = parts[2]!;
      if (method === 'PATCH') return this.media.updateMetadata(attachmentId, { userId: user.id, staffRole: user.staffRole }, request.body);
      await this.media.remove(attachmentId, { userId: user.id, staffRole: user.staffRole });
      return true;
    }
    if (method === 'POST' && path === '/api/bots') return this.createBot(user, request.body);
    if ((method === 'PUT' || method === 'PATCH') && parts[1] === 'bots' && parts.length === 3) return this.updateBot(parts[2]!, user, request.body);
    if (method === 'DELETE' && parts[1] === 'bots' && parts.length === 3) return this.deleteBot(parts[2]!, user.id);
    if (method === 'POST' && path === '/api/posts') return this.createPost(user, request.body);
    if (method === 'PATCH' && parts[1] === 'posts' && parts.length === 3) return this.updatePost(parts[2]!, user, request.body);
    if (method === 'DELETE' && parts[1] === 'posts' && parts.length === 3) return this.deletePost(parts[2]!, user.id);
    if (parts[1] === 'bots' && parts[3] === 'reviews' && parts.length === 4 && method === 'POST') return this.createReview(parts[2]!, user, request.body);
    if (parts[1] === 'bots' && parts[3] === 'reviews' && parts.length === 5 && method === 'PATCH') return this.updateReview(parts[2]!, parts[4]!, user, request.body);
    if (parts[1] === 'bots' && parts[3] === 'reviews' && parts.length === 5 && method === 'DELETE') return this.deleteReview(parts[2]!, parts[4]!, user);
    if (parts[1] === 'posts' && parts.length === 4 && method === 'POST' && parts[3] === 'reactions') return this.togglePostReaction(parts[2]!, user, request.body);
    if (parts[1] === 'posts' && parts.length === 4 && method === 'POST' && parts[3] === 'upvote') return this.upvotePost(parts[2]!, user.id);
    if (parts[1] === 'posts' && parts.length === 4 && method === 'PUT' && parts[3] === 'bookmark') return this.toggleBookmark(parts[2]!, user.id);
    if (parts[1] === 'posts' && parts.length === 4 && method === 'POST' && parts[3] === 'report') return this.createReport(parts[2]!, user.id, request.body);
    if (parts[1] === 'comments' && parts.length === 2 && method === 'POST') return this.createComment(user, request.body);
    if (parts[1] === 'comments' && parts.length === 3 && method === 'PATCH') return this.updateComment(parts[2]!, user.id, request.body);
    if (parts[1] === 'comments' && parts.length === 3 && method === 'DELETE') return this.deleteComment(parts[2]!, user.id);
    if (parts[1] === 'comments' && parts.length === 4 && parts[3] === 'react' && method === 'POST') return this.toggleCommentReaction(parts[2]!, user.id, request.body);
    if (parts[1] === 'sellers' && parts.length === 4 && parts[3] === 'follow') {
      if (method === 'PUT') return this.followSeller(parts[2]!, user.id);
      if (method === 'DELETE') return this.unfollowSeller(parts[2]!, user.id);
    }

    throw new AppError('UNSUPPORTED_MUTATION', 'This mutation is not available on the Fastify API.', 404);
  }

  private async findSeller(identifier: string) {
    const value = text(identifier, 'Seller identifier', 1, 160);
    const byId = await this.db.user.findUnique({
      where: { id: value },
      select: { id: true, role: true },
    });
    if (byId?.role === 'seller') return byId;

    const profile = await this.db.sellerProfile.findUnique({
      where: { slug: value },
      select: { userId: true },
    });
    if (profile) {
      const seller = await this.db.user.findUnique({
        where: { id: profile.userId },
        select: { id: true, role: true },
      });
      if (seller?.role === 'seller') return seller;
    }

    throw new AppError('SELLER_NOT_FOUND', 'Seller not found.', 404);
  }

  private async followSeller(identifier: string, followerId: string) {
    const seller = await this.findSeller(identifier);
    if (seller.id === followerId) {
      throw new AppError('SELLER_FOLLOW_SELF', 'You cannot follow yourself.', 403);
    }
    await this.db.sellerFollow.upsert({
      where: { sellerId_followerId: { sellerId: seller.id, followerId } },
      create: {
        id: `sf-${Date.now()}-${randomUUID().slice(0, 8)}`,
        sellerId: seller.id,
        followerId,
        createdAt: now(),
      },
      update: {},
    });
    return this.reads.sellerFollowState(seller.id, followerId);
  }

  private async unfollowSeller(identifier: string, followerId: string) {
    const seller = await this.findSeller(identifier);
    await this.db.sellerFollow.deleteMany({
      where: { sellerId: seller.id, followerId },
    });
    return this.reads.sellerFollowState(seller.id, followerId);
  }

  async updateProfile(user: AuthUser, rawBody: unknown) {
    const body = object(rawBody);
    const data: JsonObject = {};
    let sellerContact: Record<string, string> | undefined;
    if (body.bio !== undefined) {
      const bio = text(body.bio, 'Bio', 0, 500);
      data.bio = bio || null;
    }
    if (body.contact !== undefined) {
      const incoming = safeContact(body.contact);
      const existing = mergeContacts(user.contact);
      for (const key of CONTACT_KEYS) {
        if (!(key in incoming)) continue;
        if (incoming[key]) existing[key] = incoming[key]!;
        else delete existing[key];
      }
      if (user.role === 'seller') sellerContact = existing;
      else data.contact = JSON.stringify(existing);
    }
    const updated = await this.db.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({ where: { id: user.id }, data: sellerContact ? { ...data, contact: '{}' } : data });
      if (sellerContact) {
        const profile = await tx.sellerProfile.findUnique({ where: { userId: user.id } });
        if (profile) {
          await tx.sellerProfile.update({ where: { userId: user.id }, data: { contact: JSON.stringify(sellerContact), updatedAt: now() } });
        } else {
          const base = sellerSlugBase(updatedUser.name);
          const collision = await tx.sellerProfile.findFirst({ where: { slug: { startsWith: base } }, orderBy: { slug: 'desc' }, select: { slug: true } });
          await tx.sellerProfile.create({
            data: {
              id: `sp-${Date.now()}-${randomUUID().slice(0, 8)}`,
              userId: user.id,
              shopName: updatedUser.name,
              slug: collision ? `${base}-${Date.now().toString(36).slice(-4)}` : base,
              contact: JSON.stringify(sellerContact),
              updatedAt: now(),
            },
          });
        }
      }
      return updatedUser;
    });
    await this.db.bot.updateMany({ where: { sellerId: user.id }, data: { sellerName: updated.name, sellerAvatar: updated.avatar } });
    return this.auth.publicUser(updated.id);
  }

  private async createBot(user: AuthUser, rawBody: unknown) {
    if (user.role !== 'seller') throw new AppError('SELLER_REQUIRED', 'Only sellers can publish bots.', 403);
    const body = object(rawBody);
    assertKeys(body, BOT_MUTATION_KEYS);
    const title = text(body.title, 'Title', 3, 160);
    const tagline = text(body.tagline, 'Tagline', 1, 160);
    const description = body.description === undefined ? '' : text(body.description, 'Description', 0, 100_000);
    const coverImage = imageReference(body.coverImage);
    const gallery = imageArray(body.gallery, 8);
    if (gallery.length < 2) throw new AppError('BOT_GALLERY_INVALID', 'At least two gallery images are required.', 400);
    const features = stringArray(body.features, 'Features', 12, 200, 3);
    const pricing = object(body.pricing);
    assertKeys(pricing, ['monthlyPrice', 'pricingDescription', 'pricingImages']);
    const price = monthlyPrice(pricing.monthlyPrice);
    const pricingDescription = pricing.pricingDescription === undefined ? '' : text(pricing.pricingDescription, 'Pricing description', 0, 20_000);
    const pricingImages = pricing.pricingImages === undefined ? [] : imageArray(pricing.pricingImages, 5);
    const status = botStatus(body.status);
    if (isPublicBotStatus(status) && !Object.values(user.contact).some((value) => value.trim())) throw new AppError('SELLER_CONTACT_REQUIRED', 'Add at least one seller contact before publishing a bot.', 400);
    const tags = body.tags === undefined ? [] : stringArray(body.tags, 'Tags', 12, 80);
    const targetAudience = body.targetAudience === undefined ? [] : stringArray(body.targetAudience, 'Target audience', 12, 80);
    const categorySlug = body.categorySlug === undefined ? 'messenger' : text(body.categorySlug, 'Category', 1, 80);
    const categoryName = body.categoryName === undefined ? 'Bot Facebook Messenger' : text(body.categoryName, 'Category name', 1, 160);
    const version = body.version === undefined ? 'v1.0.0' : text(body.version, 'Version', 1, 80);
    const systemReqs = body.systemReqs === undefined ? 'Windows 10/11 64-bit' : text(body.systemReqs, 'System requirements', 0, 2_000);
    const references = [coverImage, ...gallery, description, pricingDescription, ...pricingImages];
    const attachmentIds = await this.validateAttachments(references, user.id);
    const profile = await this.db.sellerProfile.findUnique({ where: { userId: user.id }, select: { slug: true } });
    const timestamp = now();
    const created = await this.db.bot.create({
      data: {
        id: `bot-${Date.now()}-${randomUUID().slice(0, 8)}`,
        slug: await this.uniqueBotSlug(title),
        title,
        tagline,
        description,
        categorySlug,
        categoryName,
        sellerId: user.id,
        sellerName: user.name,
        sellerAvatar: user.avatar,
        sellerRating: 5,
        sellerSales: 0,
        sellerVerificationState: user.isTrusted ? 'trusted' : 'unverified',
        sellerTrustedUntil: user.trustedUntil,
        sellerJoinedDate: user.joinedDate,
        coverImage,
        gallery: JSON.stringify(gallery),
        features: JSON.stringify(features),
        monthlyPrice: price,
        pricingDescription,
        pricingImages: JSON.stringify(pricingImages),
        pricingUpdatedAt: timestamp,
        targetAudience: JSON.stringify(targetAudience),
        status,
        rating: 5,
        reviewCount: 0,
        views: 0,
        tags: JSON.stringify(tags),
        version,
        systemReqs,
        updatedAt: timestamp,
        sellerSlug: profile?.slug ?? '',
      },
    });
    try {
      if (isPublicBotStatus(status)) await this.publishAttachments(attachmentIds, user.id);
    } catch (error) {
      await this.db.bot.delete({ where: { id: created.id } }).catch(() => undefined);
      await this.rollbackAttachments(attachmentIds, user.id);
      throw error;
    }
    return botOut(created as unknown as JsonObject, user.contact);
  }

  private async updateBot(id: string, user: AuthUser, rawBody: unknown) {
    const existing = await this.db.bot.findUnique({ where: { id } });
    if (!existing) throw new AppError('BOT_NOT_FOUND', 'Bot not found.', 404);
    if (existing.sellerId !== user.id) throw new AppError('BOT_FORBIDDEN', 'You can only edit your own bot.', 403);
    const body = object(rawBody);
    assertKeys(body, BOT_MUTATION_KEYS);
    const title = body.title === undefined ? existing.title : text(body.title, 'Title', 3, 160);
    const tagline = body.tagline === undefined ? existing.tagline : text(body.tagline, 'Tagline', 1, 160);
    const description = body.description === undefined ? existing.description : text(body.description, 'Description', 0, 100_000);
    const coverImage = body.coverImage === undefined ? existing.coverImage : imageReference(body.coverImage);
    const gallery = body.gallery === undefined ? parseJson<string[]>(existing.gallery, []) : imageArray(body.gallery, 8);
    if (gallery.length < 2) throw new AppError('BOT_GALLERY_INVALID', 'At least two gallery images are required.', 400);
    const features = body.features === undefined ? parseJson<string[]>(existing.features, []) : stringArray(body.features, 'Features', 12, 200, 3);
    const currentPricing = { monthlyPrice: existing.monthlyPrice, pricingDescription: existing.pricingDescription, pricingImages: parseJson<string[]>(existing.pricingImages, []) };
    const pricing = body.pricing === undefined ? currentPricing : object(body.pricing);
    if (body.pricing !== undefined) assertKeys(pricing, ['monthlyPrice', 'pricingDescription', 'pricingImages']);
    const price = monthlyPrice(pricing.monthlyPrice ?? currentPricing.monthlyPrice);
    const pricingDescription = body.pricing === undefined ? currentPricing.pricingDescription : (pricing.pricingDescription === undefined ? '' : text(pricing.pricingDescription, 'Pricing description', 0, 20_000));
    const pricingImages = body.pricing === undefined ? currentPricing.pricingImages : (pricing.pricingImages === undefined ? [] : imageArray(pricing.pricingImages, 5));
    const status = botStatus(body.status, existing.status);
    if (isPublicBotStatus(status) && !Object.values(user.contact).some((value) => value.trim())) throw new AppError('SELLER_CONTACT_REQUIRED', 'Add at least one seller contact before publishing a bot.', 400);
    const tags = body.tags === undefined ? parseJson<string[]>(existing.tags, []) : stringArray(body.tags, 'Tags', 12, 80);
    const targetAudience = body.targetAudience === undefined ? parseJson<string[]>(existing.targetAudience, []) : stringArray(body.targetAudience, 'Target audience', 12, 80);
    const references = [coverImage, ...gallery, description, pricingDescription, ...pricingImages];
    const attachmentIds = await this.validateAttachments(references, user.id);
    const data: JsonObject = {
      title,
      tagline,
      description,
      coverImage,
      gallery: JSON.stringify(gallery),
      features: JSON.stringify(features),
      monthlyPrice: price,
      pricingDescription,
      pricingImages: JSON.stringify(pricingImages),
      pricingUpdatedAt: body.pricing === undefined ? existing.pricingUpdatedAt : now(),
      status,
      tags: JSON.stringify(tags),
      targetAudience: JSON.stringify(targetAudience),
      updatedAt: now(),
    };
    if (body.categorySlug !== undefined) data.categorySlug = text(body.categorySlug, 'Category', 1, 80);
    if (body.categoryName !== undefined) data.categoryName = text(body.categoryName, 'Category name', 1, 160);
    if (body.version !== undefined) data.version = text(body.version, 'Version', 1, 80);
    if (body.systemReqs !== undefined) data.systemReqs = text(body.systemReqs, 'System requirements', 0, 2_000);
    const updated = await this.db.bot.update({ where: { id }, data });
    try {
      if (isPublicBotStatus(status)) await this.publishAttachments(attachmentIds, user.id);
    } catch (error) {
      await this.db.bot.update({ where: { id }, data: {
        title: existing.title,
        tagline: existing.tagline,
        description: existing.description,
        coverImage: existing.coverImage,
        gallery: existing.gallery,
        features: existing.features,
        monthlyPrice: existing.monthlyPrice,
        pricingDescription: existing.pricingDescription,
        pricingImages: existing.pricingImages,
        pricingUpdatedAt: existing.pricingUpdatedAt,
        status: existing.status,
        tags: existing.tags,
        targetAudience: existing.targetAudience,
        categorySlug: existing.categorySlug,
        categoryName: existing.categoryName,
        version: existing.version,
        systemReqs: existing.systemReqs,
        updatedAt: existing.updatedAt,
      } }).catch(() => undefined);
      await this.rollbackAttachments(attachmentIds, user.id);
      throw error;
    }
    return botOut(updated as unknown as JsonObject, user.contact);
  }

  private async deleteBot(id: string, userId: string): Promise<boolean> {
    const existing = await this.db.bot.findUnique({ where: { id }, select: { sellerId: true } });
    if (!existing) throw new AppError('BOT_NOT_FOUND', 'Bot not found.', 404);
    if (existing.sellerId !== userId) throw new AppError('BOT_FORBIDDEN', 'You can only delete your own bot.', 403);
    await this.db.bot.update({ where: { id }, data: { status: 'deleted', updatedAt: now() } });
    return true;
  }

  private postAuthor(user: AuthUser): JsonObject {
    return {
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      role: user.role,
      verificationState: user.verificationState,
      trustedAt: user.trustedAt,
      trustedUntil: user.trustedUntil,
      tier: undefined,
      trustScore: undefined,
    };
  }

  private postCategoryName(category: string): string {
    const names: Record<string, string> = {
      automation: 'Bot & Automation',
      telegram: 'Telegram',
      discord: 'Discord',
      ecommerce: 'E-commerce',
      ai: 'AI',
      development: 'Development',
      guides: 'Hướng dẫn',
      qa: 'Hỏi đáp',
      warning: 'Cảnh báo',
      discussion: 'Thảo luận',
    };
    return names[category] ?? category.replace(/-/g, ' ');
  }

  private postExcerpt(content: string): string {
    const plain = content.replace(/```[\s\S]*?```/g, ' ').replace(/[#*_`>()\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
    return plain.length > 180 ? `${plain.slice(0, 177)}...` : plain;
  }

  private async uniquePostSlug(title: string): Promise<string> {
    const base = title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'bai-viet';
    let slug = base;
    let index = 2;
    while (await this.db.post.findUnique({ where: { slug }, select: { id: true } })) slug = `${base}-${index++}`;
    return slug;
  }

  private async validateLinkedBot(linkedBotId: string | null, user: AuthUser): Promise<void> {
    if (!linkedBotId) return;
    const bot = await this.db.bot.findUnique({ where: { id: linkedBotId }, select: { id: true, sellerId: true } });
    if (!bot) throw new AppError('BOT_NOT_FOUND', 'Linked bot not found.', 404);
    if (user.role === 'seller' && bot.sellerId !== user.id) throw new AppError('BOT_FORBIDDEN', 'You can only link your own bot.', 403);
  }

  private async createPost(user: AuthUser, rawBody: unknown, admin = false) {
    const body = object(rawBody);
    assertKeys(body, POST_MUTATION_KEYS);
    const title = text(body.title, 'Title', 5, 200);
    const content = text(body.content, 'Content', 20, 100_000);
    const type = body.type === undefined ? 'share' : postType(body.type);
    const resourceInput = body.resource === undefined ? undefined : parseResourceInput(body.resource);
    if (body.resource !== undefined && !resourceInput) throw new AppError('RESOURCE_INPUT_INVALID', 'Resource input is invalid.', 400);
    if (type === 'resource' && user.staffRole !== 'owner') throw new AppError('RESOURCE_OWNER_REQUIRED', 'Only the owner can publish resource posts.', 403);
    if (type === 'resource' && !resourceInput) throw new AppError('RESOURCE_INPUT_REQUIRED', 'A resource post must include staged files.', 400);
    if (type !== 'resource' && resourceInput) throw new AppError('POST_TYPE_FORBIDDEN', 'Only resource posts may include resource files.', 403);
    const category = postCategory(body.category);
    const tags = postTags(body.tags);
    const status = admin ? adminPostStatus(body.status) : postStatus(body.status);
    const coverImage = body.coverImage === undefined || body.coverImage === null ? null : imageReference(body.coverImage);
    const linkedBotId = body.linkedBotId === undefined || body.linkedBotId === null ? null : text(body.linkedBotId, 'Linked bot ID', 1, 160);
    await this.validateLinkedBot(linkedBotId, user);
    const attachmentIds = await this.validateAttachments([coverImage, content].filter((value): value is string => Boolean(value)), user.id);
    const excerpt = body.excerpt === undefined ? this.postExcerpt(content) : text(body.excerpt, 'Excerpt', 0, 280) || this.postExcerpt(content);
    const isOfficial = user.staffRole === 'owner' && (body.official === true || type === 'resource');
    for (const [key, value] of [['official', body.official], ['isPinned', body.isPinned], ['isFeatured', body.isFeatured], ['commentsLocked', body.commentsLocked]] as const) {
      if (value !== undefined && typeof value !== 'boolean') throw new AppError('FIELD_INVALID', `${key} must be a boolean.`, 400);
    }
    const scheduledAt = admin
      ? (status === 'scheduled' ? scheduledPostTime(body.scheduledAt) : null)
      : (body.scheduledAt === undefined || body.scheduledAt === null ? null : text(body.scheduledAt, 'Scheduled time', 1, 80));
    const timestamp = now();
    const created = await this.db.post.create({
      data: {
        id: `cpost-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`,
        slug: await this.uniquePostSlug(title),
        title,
        excerpt,
        content,
        authorId: isOfficial ? null : user.id,
        authorName: isOfficial ? 'thuebot.org' : user.name,
        authorAvatar: isOfficial ? '' : user.avatar,
        authorRole: isOfficial ? 'system' : user.role,
        type,
        status,
        isOfficial,
        officialRole: isOfficial ? 'owner' : null,
        scheduledAt,
        category,
        categoryName: this.postCategoryName(category),
        coverImage,
        linkedBotId,
        createdAt: timestamp,
        updatedAt: timestamp,
        publishedAt: status === 'published' ? timestamp : null,
        tags: JSON.stringify(tags),
        readTimeMinutes: Math.max(1, Math.min(30, Math.ceil((title.length + content.length) / 900))),
        isPinned: body.isPinned === true,
        isFeatured: body.isFeatured === true,
        commentsLocked: body.commentsLocked === true,
      },
    });
    let createdResource: { storageKeys: string[] } | null = null;
    try {
      if (resourceInput) {
        createdResource = await this.resources.createForPost(
          created.id,
          status,
          title,
          excerpt,
          resourceInput,
          { userId: user.id, staffRole: user.staffRole },
        );
      }
      if (status === 'published') await this.publishAttachments(attachmentIds, user.id);
    } catch (error) {
      if (createdResource) this.resources.removeStorageKeys(createdResource.storageKeys);
      await this.db.post.delete({ where: { id: created.id } }).catch(() => undefined);
      await this.rollbackAttachments(attachmentIds, user.id);
      throw error;
    }
    return postOut(created as unknown as JsonObject, isOfficial ? null : this.postAuthor(user), user.id);
  }

  private async updatePost(id: string, user: AuthUser, rawBody: unknown) {
    const existing = await this.db.post.findUnique({ where: { id } });
    if (!existing) throw new AppError('POST_NOT_FOUND', 'Post not found.', 404);
    if (existing.authorId !== user.id) throw new AppError('POST_FORBIDDEN', 'You can only edit your own post.', 403);
    const body = object(rawBody);
    assertKeys(body, POST_MUTATION_KEYS);
    const existingResource = await this.db.resource.findFirst({ where: { postId: id, status: 'active' }, select: { id: true } });
    const resourceInput = body.resource === undefined ? undefined : parseResourceInput(body.resource);
    if (body.resource !== undefined && !resourceInput) throw new AppError('RESOURCE_INPUT_INVALID', 'Resource input is invalid.', 400);
    const title = body.title === undefined ? existing.title : text(body.title, 'Title', 5, 200);
    const content = body.content === undefined ? existing.content : text(body.content, 'Content', 20, 100_000);
    const type = body.type === undefined ? existing.type : postType(body.type);
    const category = body.category === undefined ? existing.category : postCategory(body.category);
    const tags = body.tags === undefined ? parseJson<string[]>(existing.tags, []) : postTags(body.tags);
    const status = postStatus(body.status, existing.status);
    const coverImage = body.coverImage === undefined ? existing.coverImage : (body.coverImage === null ? null : imageReference(body.coverImage));
    const linkedBotId = body.linkedBotId === undefined ? existing.linkedBotId : (body.linkedBotId === null ? null : text(body.linkedBotId, 'Linked bot ID', 1, 160));
    if (type === 'resource' && user.staffRole !== 'owner') throw new AppError('RESOURCE_OWNER_REQUIRED', 'Only the owner can publish resource posts.', 403);
    if (type === 'resource' && !existingResource) throw new AppError('RESOURCE_UPDATE_UNSUPPORTED', 'Create a resource post through the resource flow.', 400);
    if (type !== 'resource' && existingResource) throw new AppError('POST_TYPE_FORBIDDEN', 'A resource post cannot be changed to another post type.', 400);
    if (resourceInput) throw new AppError('RESOURCE_UPDATE_UNSUPPORTED', 'Resource files cannot be replaced during a post edit.', 400);
    await this.validateLinkedBot(linkedBotId, user);
    const attachmentIds = await this.validateAttachments([coverImage, content].filter((value): value is string => Boolean(value)), user.id);
    const version = existing.editVersion + 1;
    await this.db.postVersion.create({ data: { id: `pver-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`, postId: id, version, editorId: user.id, title: existing.title, content: existing.content, slug: existing.slug, createdAt: now() } });
    const updated = await this.db.post.update({
      where: { id },
      data: {
        title,
        excerpt: this.postExcerpt(content),
        content,
        type,
        category,
        categoryName: this.postCategoryName(category),
        coverImage,
        linkedBotId,
        status,
        publishedAt: status === 'published' ? existing.publishedAt ?? now() : existing.publishedAt,
        tags: JSON.stringify(tags),
        readTimeMinutes: Math.max(1, Math.min(30, Math.ceil((title.length + content.length) / 900))),
        updatedAt: now(),
        editVersion: version,
      },
    });
    try {
      if (status === 'published') await this.publishAttachments(attachmentIds, user.id);
    } catch (error) {
      await this.db.post.update({ where: { id }, data: { title: existing.title, excerpt: existing.excerpt, content: existing.content, type: existing.type, category: existing.category, categoryName: existing.categoryName, coverImage: existing.coverImage, linkedBotId: existing.linkedBotId, status: existing.status, publishedAt: existing.publishedAt, tags: existing.tags, readTimeMinutes: existing.readTimeMinutes, updatedAt: existing.updatedAt, editVersion: existing.editVersion } }).catch(() => undefined);
      await this.db.postVersion.delete({ where: { postId_version: { postId: id, version } } }).catch(() => undefined);
      await this.rollbackAttachments(attachmentIds, user.id);
      throw error;
    }
    return postOut(updated as unknown as JsonObject, this.postAuthor(user), user.id);
  }

  private async deletePost(id: string, userId: string): Promise<boolean> {
    const existing = await this.db.post.findUnique({ where: { id }, select: { authorId: true } });
    if (!existing) throw new AppError('POST_NOT_FOUND', 'Post not found.', 404);
    if (existing.authorId !== userId) throw new AppError('POST_FORBIDDEN', 'You can only delete your own post.', 403);
    await this.db.post.update({ where: { id }, data: { status: 'removed', deletedAt: now(), updatedAt: now() } });
    return true;
  }

  private async uniqueBotSlug(title: string): Promise<string> {
    const base = title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'bot';
    let slug = base;
    let index = 2;
    while (await this.db.bot.findUnique({ where: { slug }, select: { id: true } })) slug = `${base}-${index++}`;
    return slug;
  }

  private extractAttachmentIds(values: string[]): string[] {
    const source = values.join('\n');
    const ids = [...source.matchAll(/attachment:\/\/([A-Za-z0-9_-]+)/g), ...source.matchAll(/\/api\/media\/([A-Za-z0-9_-]+)/g)].map((match) => match[1]).filter((id): id is string => Boolean(id));
    return [...new Set(ids)];
  }

  private async validateAttachments(values: string[], userId: string): Promise<string[]> {
    const ids = this.extractAttachmentIds(values);
    if (!ids.length) return [];
    const attachments = await this.db.attachment.findMany({ where: { id: { in: ids } } });
    if (attachments.length !== ids.length) throw new AppError('ATTACHMENT_NOT_FOUND', 'One or more attachments do not exist.', 400);
    const invalid = attachments.find((attachment) => attachment.type !== 'image' || !['draft', 'published'].includes(attachment.status) || (attachment.status === 'draft' && attachment.ownerUserId !== userId));
    if (invalid) throw new AppError('ATTACHMENT_FORBIDDEN', 'You cannot use one of the attachments.', 403);
    return ids;
  }

  private async publishAttachments(ids: string[], userId: string): Promise<void> {
    if (!ids.length) return;
    await this.db.attachment.updateMany({ where: { id: { in: ids }, ownerUserId: userId, status: 'draft' }, data: { status: 'published', publishedAt: now(), updatedAt: now() } });
  }

  private async rollbackAttachments(ids: string[], userId: string): Promise<void> {
    if (!ids.length) return;
    await this.db.attachment.updateMany({ where: { id: { in: ids }, ownerUserId: userId, status: 'published' }, data: { status: 'draft', publishedAt: null, updatedAt: now() } });
  }

  private async createReview(identifier: string, user: AuthUser, rawBody: unknown) {
    const body = object(rawBody);
    const bot = await this.db.bot.findFirst({ where: { OR: [{ id: identifier }, { slug: identifier }], status: { in: PUBLIC_BOT_STATUSES } }, select: { id: true, sellerId: true } });
    if (!bot) throw new AppError('BOT_NOT_FOUND', 'Bot not found.', 404);
    if (bot.sellerId === user.id) throw new AppError('REVIEW_FORBIDDEN', 'A seller cannot review their own bot.', 403);
    const duplicate = await this.db.botReview.findUnique({ where: { botId_userId: { botId: bot.id, userId: user.id } } });
    if (duplicate) throw new AppError('REVIEW_DUPLICATE', 'You have already reviewed this bot.', 409);
    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new AppError('REVIEW_INVALID', 'Rating must be between 1 and 5.', 400);
    const comment = body.comment === undefined || body.comment === null ? '' : text(body.comment, 'Comment', 0, 1_000);
    const images = body.images === undefined ? [] : imageArray(body.images, 5);
    const created = await this.db.botReview.create({
      data: { id: `rv-${Date.now()}-${randomUUID().slice(0, 8)}`, botId: bot.id, userId: user.id, rating, comment, images: JSON.stringify(images), createdAt: now() },
      include: { user: { select: { name: true, avatar: true } } },
    });
    await this.recalcBotRating(bot.id);
    return reviewOut(created, user.id);
  }

  private async updateReview(identifier: string, reviewId: string, user: AuthUser, rawBody: unknown) {
    const body = object(rawBody);
    const bot = await this.db.bot.findFirst({ where: { OR: [{ id: identifier }, { slug: identifier }], status: { in: PUBLIC_BOT_STATUSES } }, select: { id: true } });
    if (!bot) throw new AppError('BOT_NOT_FOUND', 'Bot not found.', 404);
    const existing = await this.db.botReview.findFirst({ where: { id: reviewId, botId: bot.id } });
    if (!existing) throw new AppError('REVIEW_NOT_FOUND', 'Review not found.', 404);
    if (existing.userId !== user.id) throw new AppError('REVIEW_FORBIDDEN', 'You can only edit your own review.', 403);
    const data: JsonObject = {};
    if (body.rating !== undefined) {
      const rating = Number(body.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new AppError('REVIEW_INVALID', 'Rating must be between 1 and 5.', 400);
      data.rating = rating;
    }
    if (body.comment !== undefined) data.comment = body.comment === null ? '' : text(body.comment, 'Comment', 0, 1_000);
    if (body.images !== undefined) data.images = JSON.stringify(imageArray(body.images, 5));
    const updated = await this.db.botReview.update({ where: { id: existing.id }, data, include: { user: { select: { name: true, avatar: true } } } });
    await this.recalcBotRating(bot.id);
    return reviewOut(updated, user.id);
  }

  private async deleteReview(identifier: string, reviewId: string, user: AuthUser) {
    const bot = await this.db.bot.findFirst({ where: { OR: [{ id: identifier }, { slug: identifier }], status: { in: PUBLIC_BOT_STATUSES } }, select: { id: true } });
    if (!bot) throw new AppError('BOT_NOT_FOUND', 'Bot not found.', 404);
    const review = await this.db.botReview.findFirst({ where: { id: reviewId, botId: bot.id } });
    if (!review) throw new AppError('REVIEW_NOT_FOUND', 'Review not found.', 404);
    if (review.userId !== user.id) throw new AppError('REVIEW_FORBIDDEN', 'You can only delete your own review.', 403);
    await this.db.botReview.delete({ where: { id: review.id } });
    await this.recalcBotRating(bot.id);
    return true;
  }

  private async recalcBotRating(botId: string): Promise<void> {
    const aggregate = await this.db.botReview.aggregate({ where: { botId }, _avg: { rating: true }, _count: true });
    await this.db.bot.update({ where: { id: botId }, data: { rating: aggregate._avg.rating ?? 0, reviewCount: aggregate._count } });
  }

  private async ensurePublishedPost(id: string) {
    const post = await this.db.post.findUnique({ where: { id } });
    if (!post || post.status !== 'published' || post.deletedAt) throw new AppError('POST_NOT_FOUND', 'Post not found.', 404);
    return post;
  }

  private async reactionsForPost(id: string, userId: string): Promise<Array<{ emoji: string; count: number; reactedByMe: boolean }>> {
    const rows = await this.db.reaction.groupBy({ by: ['emoji'], where: { targetType: 'post', targetId: id }, _count: { emoji: true } });
    const mine = await this.db.reaction.findMany({ where: { targetType: 'post', targetId: id, userId }, select: { emoji: true } });
    const mineSet = new Set(mine.map((item) => item.emoji));
    return rows.sort((a, b) => b._count.emoji - a._count.emoji).map((row) => ({ emoji: row.emoji, count: row._count.emoji, reactedByMe: mineSet.has(row.emoji) }));
  }

  private async togglePostReaction(id: string, user: AuthUser, rawBody: unknown) {
    const body = object(rawBody);
    const emoji = text(body.emoji, 'Reaction', 1, 20);
    if (!POST_REACTIONS.includes(emoji)) throw new AppError('REACTION_INVALID', 'Only supported reactions are allowed.', 400);
    await this.ensurePublishedPost(id);
    const found = await this.db.reaction.findUnique({ where: { targetType_targetId_userId_emoji: { targetType: 'post', targetId: id, userId: user.id, emoji } } });
    if (found) await this.db.reaction.delete({ where: { id: found.id } });
    else await this.db.reaction.create({ data: { id: `rct-${Date.now()}-${randomUUID().slice(0, 8)}`, targetType: 'post', targetId: id, userId: user.id, emoji, createdAt: now() } });
    const count = await this.db.reaction.count({ where: { targetType: 'post', targetId: id } });
    await this.db.post.update({ where: { id }, data: { reactionCount: count } });
    return this.reactionsForPost(id, user.id);
  }

  private async upvotePost(id: string, userId: string) {
    await this.ensurePublishedPost(id);
    const where = { targetType_targetId_userId_emoji: { targetType: 'post', targetId: id, userId, emoji: 'upvote' } };
    const existing = await this.db.reaction.findUnique({ where });
    if (existing) await this.db.reaction.delete({ where: { id: existing.id } });
    else await this.db.reaction.create({ data: { id: `upvote-${Date.now()}-${randomUUID().slice(0, 8)}`, targetType: 'post', targetId: id, userId, emoji: 'upvote', createdAt: now() } });
    const [upvotes, reactionCount] = await Promise.all([
      this.db.reaction.count({ where: { targetType: 'post', targetId: id, emoji: 'upvote' } }),
      this.db.reaction.count({ where: { targetType: 'post', targetId: id } }),
    ]);
    await this.db.post.update({ where: { id }, data: { upvotes, reactionCount } });
    const post = await this.reads.getPostById(id, userId);
    return { ...(post ?? {}), upvotes };
  }

  private async toggleBookmark(id: string, userId: string) {
    await this.ensurePublishedPost(id);
    const found = await this.db.postBookmark.findUnique({ where: { postId_userId: { postId: id, userId } } });
    let bookmarked = false;
    if (found) await this.db.postBookmark.delete({ where: { id: found.id } });
    else {
      bookmarked = true;
      await this.db.postBookmark.create({ data: { id: `bookmark-${Date.now()}-${randomUUID().slice(0, 8)}`, postId: id, userId, createdAt: now() } });
    }
    const bookmarkCount = await this.db.postBookmark.count({ where: { postId: id } });
    await this.db.post.update({ where: { id }, data: { bookmarkCount } });
    return { bookmarked, bookmarkCount };
  }

  private async createReport(id: string, userId: string, rawBody: unknown) {
    const body = object(rawBody);
    await this.ensurePublishedPost(id);
    const category = text(body.category ?? 'other', 'Report category', 1, 40);
    if (!['spam', 'scam', 'promotion', 'misinformation', 'harassment', 'copyright', 'other'].includes(category)) throw new AppError('REPORT_INVALID', 'Report category is invalid.', 400);
    const duplicate = await this.db.postReport.findFirst({ where: { postId: id, reporterId: userId, category, status: 'open' } });
    if (duplicate) throw new AppError('REPORT_DUPLICATE', 'This report was already submitted.', 409);
    const details = body.details === undefined ? null : text(body.details, 'Report details', 0, 2_000) || null;
    const report = await this.db.postReport.create({ data: { id: `report-${Date.now()}-${randomUUID().slice(0, 8)}`, postId: id, reporterId: userId, category, details, createdAt: now() } });
    await this.db.post.update({ where: { id }, data: { reportCount: { increment: 1 } } });
    return report;
  }

  private validateTarget(type: unknown): 'post' | 'bot' {
    if (type !== 'post' && type !== 'bot') throw new AppError('COMMENT_TARGET_INVALID', 'Comment target type is invalid.', 400);
    return type;
  }

  private async ensureCommentTarget(type: 'post' | 'bot', id: string): Promise<void> {
    const exists = type === 'post'
      ? await this.db.post.findFirst({ where: { id, status: 'published', deletedAt: null }, select: { id: true } })
      : await this.db.bot.findFirst({ where: { id, status: { in: PUBLIC_BOT_STATUSES } }, select: { id: true } });
    if (!exists) throw new AppError('COMMENT_TARGET_NOT_FOUND', 'Comment target not found.', 404);
  }

  private async createComment(user: AuthUser, rawBody: unknown) {
    const body = object(rawBody);
    const targetType = this.validateTarget(body.targetType);
    const targetId = text(body.targetId, 'Target ID', 1, 160);
    const content = text(body.content, 'Comment', 1, 2_000);
    await this.ensureCommentTarget(targetType, targetId);
    if (targetType === 'post') {
      const post = await this.db.post.findUnique({ where: { id: targetId }, select: { commentsLocked: true } });
      if (post?.commentsLocked) throw new AppError('COMMENTS_LOCKED', 'Comments are locked for this post.', 400);
    }
    let parentId: string | null = null;
    if (body.parentId !== undefined) {
      const parent = await this.db.comment.findUnique({ where: { id: text(body.parentId, 'Parent ID', 1, 160) }, select: { id: true, parentId: true, targetType: true, targetId: true } });
      if (!parent || parent.targetType !== targetType || parent.targetId !== targetId || parent.parentId) throw new AppError('COMMENT_PARENT_INVALID', 'Parent comment is invalid.', 400);
      parentId = parent.id;
    }
    const created = await this.db.comment.create({ data: { id: `cmt-${Date.now()}-${randomUUID().slice(0, 8)}`, targetType, targetId, parentId, authorId: user.id, authorName: user.name, authorAvatar: user.avatar, content, reactions: '[]', createdAt: now() } });
    await this.syncCommentsCount(targetType, targetId);
    return { ...created, reactions: [], reactionCount: 0, isOwn: true, replies: [] };
  }

  private async updateComment(id: string, userId: string, rawBody: unknown) {
    const body = object(rawBody);
    const existing = await this.db.comment.findUnique({ where: { id } });
    if (!existing) throw new AppError('COMMENT_NOT_FOUND', 'Comment not found.', 404);
    if (existing.authorId !== userId) throw new AppError('COMMENT_FORBIDDEN', 'You can only edit your own comment.', 403);
    const content = text(body.content, 'Comment', 1, 2_000);
    return this.db.comment.update({ where: { id }, data: { content } });
  }

  private async deleteComment(id: string, userId: string) {
    const existing = await this.db.comment.findUnique({ where: { id } });
    if (!existing) throw new AppError('COMMENT_NOT_FOUND', 'Comment not found.', 404);
    if (existing.authorId !== userId) throw new AppError('COMMENT_FORBIDDEN', 'You can only delete your own comment.', 403);
    await this.db.comment.delete({ where: { id } });
    await this.syncCommentsCount(existing.targetType as 'post' | 'bot', existing.targetId);
    return true;
  }

  private async toggleCommentReaction(id: string, userId: string, rawBody: unknown) {
    const body = object(rawBody);
    const emoji = text(body.emoji, 'Reaction', 1, 20);
    if (!COMMENT_REACTIONS.includes(emoji)) throw new AppError('REACTION_INVALID', 'Reaction is invalid.', 400);
    const comment = await this.db.comment.findUnique({ where: { id } });
    if (!comment) throw new AppError('COMMENT_NOT_FOUND', 'Comment not found.', 404);
    const found = await this.db.reaction.findUnique({ where: { targetType_targetId_userId_emoji: { targetType: 'comment', targetId: id, userId, emoji } } });
    if (found) await this.db.reaction.delete({ where: { id: found.id } });
    else await this.db.reaction.create({ data: { id: `rct-${Date.now()}-${randomUUID().slice(0, 8)}`, targetType: 'comment', targetId: id, userId, emoji, createdAt: now() } });
    const rows = await this.db.reaction.groupBy({ by: ['emoji'], where: { targetType: 'comment', targetId: id }, _count: { emoji: true } });
    const mine = await this.db.reaction.findMany({ where: { targetType: 'comment', targetId: id, userId }, select: { emoji: true } });
    const mineSet = new Set(mine.map((item) => item.emoji));
    const reactions = rows.map((row) => ({ emoji: row.emoji, count: row._count.emoji, reactedByMe: mineSet.has(row.emoji) }));
    await this.db.comment.update({ where: { id }, data: { reactions: JSON.stringify(reactions) } });
    return reactions;
  }

  private async syncCommentsCount(type: 'post' | 'bot', targetId: string): Promise<void> {
    if (type !== 'post') return;
    const count = await this.db.comment.count({ where: { targetType: 'post', targetId } });
    await this.db.post.update({ where: { id: targetId }, data: { commentsCount: count } });
  }
}
