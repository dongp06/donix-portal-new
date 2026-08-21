import { randomUUID } from 'node:crypto';
import { mergeContacts } from '../../core/contact.js';
import type { Database } from '../../core/database.js';
import { AppError } from '../../core/errors.js';
import { MediaService } from '../media/media.service.js';

const CONTACT_KEYS = ['zalo', 'telegram', 'phone', 'messenger', 'facebook', 'website'] as const;
const PROFILE_KEYS = ['shopName', 'bio', 'avatar', 'banner', 'contact'] as const;
const SAFE_IMAGE_REFERENCE = /^(?:attachment:\/\/[A-Za-z0-9_-]+|\/api\/media\/[A-Za-z0-9_-]+|https?:\/\/[^\s"'<>]+)$/i;

type ProfileInput = Record<string, unknown>;

function now(): string {
  return new Date().toISOString();
}

function object(value: unknown): ProfileInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError('BODY_INVALID', 'Request body must be an object.', 400);
  }
  return value as ProfileInput;
}

function assertKeys(value: ProfileInput): void {
  const unexpected = Object.keys(value).find((key) => !(PROFILE_KEYS as readonly string[]).includes(key));
  if (unexpected) throw new AppError('BODY_FIELD_UNEXPECTED', `Unexpected field '${unexpected}'.`, 400);
}

function optionalText(value: unknown, label: string, maxLength: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') throw new AppError('PROFILE_FIELD_INVALID', `${label} is invalid.`, 400);
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new AppError('PROFILE_FIELD_INVALID', `${label} is too long.`, 400);
  if (/[\u0000-\u001f\u007f]/.test(normalized)) throw new AppError('PROFILE_FIELD_INVALID', `${label} contains invalid characters.`, 400);
  return normalized || null;
}

function requiredShopName(value: unknown): string {
  if (typeof value !== 'string') throw new AppError('PROFILE_SHOP_NAME_INVALID', 'Shop name is invalid.', 400);
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > 120 || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new AppError('PROFILE_SHOP_NAME_INVALID', 'Shop name must be 1 to 120 characters.', 400);
  }
  return normalized;
}

function imageReference(value: unknown, label: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new AppError('PROFILE_IMAGE_INVALID', `${label} is invalid.`, 400);
  const normalized = value.trim();
  if (normalized.length > 2_000 || !SAFE_IMAGE_REFERENCE.test(normalized)) {
    throw new AppError('PROFILE_IMAGE_INVALID', `${label} must be a safe image reference.`, 400);
  }
  return normalized;
}

function profileContact(value: unknown): Record<string, string> {
  if (value === null || value === undefined) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new AppError('PROFILE_CONTACT_INVALID', 'Contact must be an object.', 400);
  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!(CONTACT_KEYS as readonly string[]).includes(key)) throw new AppError('PROFILE_CONTACT_INVALID', `Unsupported contact field '${key}'.`, 400);
    if (typeof raw !== 'string') throw new AppError('PROFILE_CONTACT_INVALID', `Contact '${key}' is invalid.`, 400);
    const normalized = raw.trim();
    if (normalized.length > 200 || /[\u0000-\u001f\u007f]/.test(normalized)) throw new AppError('PROFILE_CONTACT_INVALID', `Contact '${key}' is invalid.`, 400);
    if (/^(?:javascript|data|vbscript):/i.test(normalized) || (normalized.includes('://') && !/^https?:\/\//i.test(normalized))) {
      throw new AppError('PROFILE_CONTACT_INVALID', `Contact '${key}' uses an unsafe protocol.`, 400);
    }
    if (normalized) result[key] = normalized;
  }
  return result;
}

function sellerSlugBase(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'seller';
}

function completeness(profile: { shopName: string | null; bio: string | null; avatar: string | null; banner: string | null; contact: Record<string, string> }): number {
  let score = 0;
  if (profile.shopName) score += 20;
  if (profile.bio) score += 15;
  if (profile.avatar) score += 15;
  if (profile.banner) score += 10;
  const contacts = Object.values(profile.contact).filter(Boolean).length;
  if (contacts >= 1) score += 20;
  if (contacts >= 2) score += 20;
  return score;
}

export class SellerProfileService {
  constructor(private readonly db: Database, private readonly media: MediaService) {}

  private async requireSeller(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, name: true, contact: true },
    });
    if (!user) throw new AppError('SESSION_INVALID', 'Login session is invalid.', 401);
    if (user.role !== 'seller') throw new AppError('SELLER_REQUIRED', 'Only sellers have a supplier profile.', 403);
    return user;
  }

  async getOrCreateProfile(userId: string) {
    const user = await this.requireSeller(userId);
    let profile = await this.db.sellerProfile.findUnique({ where: { userId } });
    if (!profile) {
      const base = sellerSlugBase(user.name);
      const collision = await this.db.sellerProfile.findFirst({ where: { slug: { startsWith: base } }, orderBy: { slug: 'desc' }, select: { slug: true } });
      const slug = collision ? `${base}-${Date.now().toString(36).slice(-4)}` : base;
      profile = await this.db.sellerProfile.create({
        data: {
          id: `sp-${Date.now()}-${randomUUID().slice(0, 8)}`,
          userId,
          shopName: user.name,
          slug,
          contact: user.contact || '{}',
          updatedAt: now(),
        },
      });
    }
    return { user, profile };
  }

  async getProfile(userId: string) {
    const { user, profile } = await this.getOrCreateProfile(userId);
    return this.toOutput(user.contact, profile);
  }

  async updateProfile(userId: string, rawBody: unknown) {
    const { user, profile: existing } = await this.getOrCreateProfile(userId);
    const body = object(rawBody);
    assertKeys(body);
    const shopName = body.shopName === undefined ? existing.shopName : requiredShopName(body.shopName);
    const bio = body.bio === undefined ? existing.bio : (optionalText(body.bio, 'Bio', 500) ?? null);
    const avatar = body.avatar === undefined ? existing.avatar : imageReference(body.avatar, 'Avatar');
    const banner = body.banner === undefined ? existing.banner : imageReference(body.banner, 'Banner');
    const contact = body.contact === undefined ? mergeContacts(user.contact, existing.contact) : profileContact(body.contact);
    await this.media.validateReferences([avatar, banner], { userId });
    const previous = existing;
    const updated = await this.db.sellerProfile.update({
      where: { userId },
      data: {
        shopName,
        bio,
        avatar,
        banner,
        contact: JSON.stringify(contact),
        profileCompleteness: completeness({ shopName, bio, avatar, banner, contact }),
        updatedAt: now(),
      },
    });
    let promoted: string[] = [];
    try {
      promoted = await this.media.publishReferences([avatar, banner], { userId });
    } catch (error) {
      await this.db.sellerProfile.update({
        where: { userId },
        data: {
          shopName: previous.shopName,
          bio: previous.bio,
          avatar: previous.avatar,
          banner: previous.banner,
          contact: previous.contact,
          profileCompleteness: previous.profileCompleteness,
          updatedAt: previous.updatedAt,
        },
      }).catch(() => undefined);
      await this.media.rollbackPublishedReferences(promoted).catch(() => undefined);
      throw error;
    }
    await this.db.bot.updateMany({ where: { sellerId: userId }, data: { sellerName: updated.shopName, sellerAvatar: updated.avatar ?? '', sellerSlug: updated.slug } });
    return this.toOutput(user.contact, updated);
  }

  private toOutput(userContact: string | null, profile: { id: string; userId: string; shopName: string; slug: string; bio: string | null; avatar: string | null; banner: string | null; contact: string; profileCompleteness: number }) {
    return {
      id: profile.id,
      userId: profile.userId,
      shopName: profile.shopName,
      slug: profile.slug,
      bio: profile.bio ?? undefined,
      avatar: profile.avatar ?? undefined,
      banner: profile.banner ?? undefined,
      contact: mergeContacts(userContact, profile.contact),
      profileCompleteness: profile.profileCompleteness,
    };
  }
}
