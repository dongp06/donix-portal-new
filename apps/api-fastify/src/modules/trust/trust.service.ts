import { randomUUID } from 'node:crypto';
import { mergeContacts } from '../../core/contact.js';
import type { Database } from '../../core/database.js';
import { canonicalJson, hash } from '../../core/crypto.js';
import { AppError } from '../../core/errors.js';
import { SellerProfileService } from '../sellers/seller-profile.service.js';

const CHECK_DEFINITIONS = [
  { kind: 'email', label: 'Email / Google account' },
  { kind: 'phone', label: 'Phone number' },
  { kind: 'telegram', label: 'Telegram' },
  { kind: 'website', label: 'Website / domain' },
  { kind: 'identity', label: 'Identity' },
] as const;
const CHECK_KINDS = new Set(CHECK_DEFINITIONS.map((item) => item.kind));
const TRUSTED_DAYS = 180;
const TIER_MIN_ACCOUNT_DAYS = 30;
const TIER_MIN_REVIEWS = 5;
const TIER_MIN_RATING = 4.5;
const TIER_MIN_SCORE = 75;
const TIER_MIN_PROFILE = 80;
const TOP_MIN_REVIEWS = 25;
const TOP_MIN_RATING = 4.7;
const TOP_RANK_LIMIT = 10;

type VerificationState = 'unverified' | 'pending' | 'verified' | 'trusted' | 'under_review' | 'suspended' | 'revoked' | 'rejected';
type CheckStatus = 'unverified' | 'pending' | 'verified' | 'revoked';
export type TrustStaffRole = 'owner' | 'admin' | 'moderator';
export type TrustStaffActor = { userId: string; role: TrustStaffRole };

const ADMIN_VERIFICATION_STATES = new Set<VerificationState>([
  'pending',
  'verified',
  'trusted',
  'under_review',
  'suspended',
  'revoked',
  'rejected',
  'unverified',
]);

function mediaDeliveryUrl(value: string | null | undefined): string {
  const source = typeof value === 'string' ? value.trim() : '';
  const attachment = /^attachment:\/\/([a-zA-Z0-9_-]+)$/i.exec(source);
  if (attachment) return `/api/media/${encodeURIComponent(attachment[1] ?? '')}`;
  const mediaRoute = /^\/api\/media\/([a-zA-Z0-9_-]+)$/i.exec(source);
  if (mediaRoute) return `/api/media/${encodeURIComponent(mediaRoute[1] ?? '')}`;
  return source;
}

function now(): string {
  return new Date().toISOString();
}

function isExpired(value?: string | null): boolean {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp < Date.now();
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function optionalText(value: unknown, label: string, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') throw new AppError('VERIFICATION_FIELD_INVALID', `${label} is invalid.`, 400);
  const normalized = value.trim();
  if (normalized.length > max || /[\u0000-\u001f\u007f]/.test(normalized)) throw new AppError('VERIFICATION_FIELD_INVALID', `${label} is invalid.`, 400);
  return normalized || null;
}

function eventId(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

export type TrustScoreInfo = {
  score: number;
  breakdown: Array<{ key: string; label: string; weight: number; value: number; score: number }>;
  updatedAt?: string;
};

export class TrustService {
  constructor(private readonly db: Database, private readonly profiles: SellerProfileService) {}

  private async requireSeller(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, name: true, joinedDate: true, googleId: true, email: true, contact: true, trustScore: true, trustScoreUpdatedAt: true, trustedAt: true, trustedUntil: true },
    });
    if (!user) throw new AppError('SESSION_INVALID', 'Login session is invalid.', 401);
    if (user.role !== 'seller') throw new AppError('SELLER_REQUIRED', 'Only sellers can access Trust Center.', 403);
    return user;
  }

  private async counts(userId: string) {
    const [reviewAgg, botCount, onlineBotCount] = await Promise.all([
      this.db.botReview.aggregate({ where: { bot: { sellerId: userId } }, _avg: { rating: true }, _count: true }),
      this.db.bot.count({ where: { sellerId: userId } }),
      this.db.bot.count({ where: { sellerId: userId, status: 'online' } }),
    ]);
    return {
      reviewCount: reviewAgg._count,
      avgRating: reviewAgg._avg.rating ?? 0,
      botCount,
      onlineBotCount,
    };
  }

  private async scoreInfo(userId: string): Promise<TrustScoreInfo> {
    const [user, counts, profile] = await Promise.all([
      this.requireSeller(userId),
      this.counts(userId),
      this.profiles.getOrCreateProfile(userId),
    ]);
    const ageDays = user.joinedDate ? (Date.now() - Date.parse(user.joinedDate)) / 86_400_000 : 0;
    const items = [
      { key: 'reviews', label: 'Customer reviews', weight: 45, value: counts.reviewCount ? (counts.avgRating / 5) * Math.min(counts.reviewCount, 20) / 20 : 0 },
      { key: 'account_age', label: 'Account age', weight: 20, value: Math.min(Math.max(ageDays / 365, 0), 1) },
      { key: 'profile', label: 'Profile verification', weight: 20, value: Math.min(Math.max(profile.profile.profileCompleteness / 100, 0), 1) },
      { key: 'active_bots', label: 'Active bots', weight: 15, value: Math.min(counts.onlineBotCount, 5) / 5 },
    ].map((item) => ({ ...item, score: Math.round(item.weight * item.value) }));
    return {
      score: Math.min(100, Math.round(items.reduce((sum, item) => sum + item.score, 0))),
      breakdown: items,
      updatedAt: user.trustScoreUpdatedAt ?? undefined,
    };
  }

  private async latestApplication(userId: string) {
    return this.db.trustVerification.findFirst({ where: { userId }, orderBy: { submittedAt: 'desc' } });
  }

  private async currentState(userId: string): Promise<VerificationState> {
    const latest = await this.latestApplication(userId);
    if (latest) {
      const state = latest.status as VerificationState;
      if (state === 'trusted' && isExpired(latest.trustedUntil ?? latest.expiresAt)) return 'revoked';
      if (['unverified', 'pending', 'verified', 'trusted', 'under_review', 'suspended', 'revoked', 'rejected'].includes(state)) return state;
    }
    const checks = await this.getChecks(userId);
    return checks.some((check) => check.status === 'verified') ? 'verified' : 'unverified';
  }

  async getChecks(userId: string) {
    const [user, profile, rows] = await Promise.all([
      this.requireSeller(userId),
      this.db.sellerProfile.findUnique({ where: { userId }, select: { contact: true } }),
      this.db.verificationCheck.findMany({ where: { userId } }),
    ]);
    const contact = mergeContacts(user.contact, profile?.contact);
    const byKind = new Map(rows.map((row) => [row.kind, row]));
    return CHECK_DEFINITIONS.map((definition) => {
      const stored = byKind.get(definition.kind);
      const value = definition.kind === 'email' ? user.email : contact[definition.kind];
      const derivedEmailVerified = definition.kind === 'email' && Boolean(user.googleId);
      const status = (stored?.status ?? (derivedEmailVerified ? 'verified' : 'unverified')) as CheckStatus;
      return {
        kind: definition.kind,
        label: definition.label,
        status: ['unverified', 'pending', 'verified', 'revoked'].includes(status) ? status : 'unverified',
        provided: Boolean(value) || Boolean(stored?.value),
        ...(value || stored?.value ? { value: value ?? stored?.value ?? undefined } : {}),
        ...(stored?.method ? { method: stored.method } : derivedEmailVerified ? { method: 'Google' } : {}),
        ...(stored?.verifiedAt ? { verifiedAt: stored.verifiedAt } : {}),
        ...(stored?.expiresAt ? { expiresAt: stored.expiresAt } : {}),
      };
    });
  }

  async getChecklist(userId: string) {
    const profile = (await this.profiles.getOrCreateProfile(userId)).profile;
    const [user, counts, score, checks, state] = await Promise.all([
      this.requireSeller(userId),
      this.counts(userId),
      this.scoreInfo(userId),
      this.getChecks(userId),
      this.currentState(userId),
    ]);
    const ageDays = Math.floor(Math.max(0, (Date.now() - Date.parse(user.joinedDate)) / 86_400_000));
    const basic = checks.map((check) => ({
      key: check.kind,
      label: `${check.label} verified`,
      passed: check.status === 'verified',
      current: check.status === 'verified' ? 'Verified' : check.provided ? 'Provided - pending verification' : 'Not completed',
      required: 'Verified',
      category: 'verification',
      automated: false,
      blocking: true,
    }));
    return [
      ...basic,
      { key: 'account_age', label: 'Account active for at least 30 days', passed: ageDays >= TIER_MIN_ACCOUNT_DAYS, current: `${ageDays} days`, required: '30 days', category: 'eligibility', automated: true, blocking: true },
      { key: 'reviews', label: 'At least 5 valid reviews', passed: counts.reviewCount >= TIER_MIN_REVIEWS, current: `${counts.reviewCount} reviews`, required: '5 reviews', category: 'eligibility', automated: true, blocking: true },
      { key: 'rating', label: 'Average rating at least 4.5', passed: counts.avgRating >= TIER_MIN_RATING, current: `${counts.avgRating.toFixed(1)}/5`, required: '4.5/5', category: 'eligibility', automated: true, blocking: true },
      { key: 'profile', label: 'Profile completeness at least 80%', passed: profile.profileCompleteness >= TIER_MIN_PROFILE, current: `${profile.profileCompleteness}%`, required: '80%', category: 'eligibility', automated: true, blocking: true },
      { key: 'trust_score', label: 'Trust score at least 75', passed: score.score >= TIER_MIN_SCORE, current: `${score.score}/100`, required: '75/100', category: 'eligibility', automated: true, blocking: true },
      { key: 'manual_review', label: 'Manual review by thuebot.org staff', passed: state === 'trusted', current: state === 'trusted' ? 'Complete' : 'Not complete', required: 'Admin approval', category: 'review', automated: false, blocking: false },
    ];
  }

  async getStatus(userId: string) {
    await this.requireSeller(userId);
    const [latest, state] = await Promise.all([this.latestApplication(userId), this.currentState(userId)]);
    if (!latest) return { status: state, expiresAt: undefined, canCancel: false };
    const status = state === 'trusted' && isExpired(latest.trustedUntil ?? latest.expiresAt) ? 'revoked' : state;
    return {
      status,
      submittedAt: latest.submittedAt,
      reviewedAt: latest.reviewedAt ?? undefined,
      expiresAt: latest.trustedUntil ?? latest.expiresAt ?? undefined,
      note: latest.note ?? undefined,
      canCancel: latest.status === 'pending',
      ...(latest.recommendation === 'approve' || latest.recommendation === 'reject' ? { recommendation: latest.recommendation } : {}),
    };
  }

  async getSummary(userId: string) {
    await this.profiles.getOrCreateProfile(userId);
    const [status, checklist, checks, score, user] = await Promise.all([
      this.getStatus(userId),
      this.getChecklist(userId),
      this.getChecks(userId),
      this.scoreInfo(userId),
      this.requireSeller(userId),
    ]);
    return {
      status,
      state: status.status,
      isTrusted: status.status === 'trusted' && !isExpired(status.expiresAt),
      trustedAt: user.trustedAt ?? undefined,
      trustedUntil: user.trustedUntil ?? undefined,
      basicVerifiedCount: checks.filter((check) => check.status === 'verified').length,
      basicVerifiedTotal: CHECK_DEFINITIONS.length,
      checks,
      checklist,
      score,
      tier: await this.computeTier(userId, score.score, await this.counts(userId)),
    };
  }

  async submitVerification(userId: string, rawBody: unknown) {
    await this.requireSeller(userId);
    if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) throw new AppError('VERIFICATION_BODY_INVALID', 'Verification body is invalid.', 400);
    const body = rawBody as Record<string, unknown>;
    const unexpected = Object.keys(body).find((key) => key !== 'note');
    if (unexpected) throw new AppError('BODY_FIELD_UNEXPECTED', `Unexpected field '${unexpected}'.`, 400);
    const checklist = await this.getChecklist(userId);
    if (!checklist.filter((item) => item.blocking !== false).every((item) => item.passed)) throw new AppError('VERIFICATION_NOT_ELIGIBLE', 'Seller does not meet the Trusted Seller requirements.', 400);
    const status = await this.getStatus(userId);
    if (['pending', 'under_review', 'trusted', 'suspended'].includes(status.status)) throw new AppError('VERIFICATION_STATE_INVALID', 'A verification request is already active.', 400);
    const note = optionalText(body.note, 'Verification note', 1_000) ?? null;
    const submittedAt = now();
    await this.db.trustVerification.create({ data: { id: eventId('tv'), userId, status: 'pending', note, submittedAt, verificationVersion: 2 } });
    await this.recordEvent(userId, 'verification_submitted', { version: 2 });
    await this.recompute(userId);
    return this.getStatus(userId);
  }

  async cancelVerification(userId: string) {
    await this.requireSeller(userId);
    const latest = await this.latestApplication(userId);
    if (!latest || latest.status !== 'pending') throw new AppError('VERIFICATION_NOT_PENDING', 'There is no pending verification request to cancel.', 400);
    const timestamp = now();
    await this.db.trustVerification.update({ where: { id: latest.id }, data: { status: 'revoked', reviewedAt: timestamp, note: 'Seller cancelled the request.' } });
    await this.recordEvent(userId, 'verification_revoked', { reason: 'seller_cancelled' });
    await this.recompute(userId);
    return this.getStatus(userId);
  }

  async requestCheck(userId: string, rawKind: string) {
    await this.requireSeller(userId);
    const kind = rawKind.trim().toLowerCase();
    if (!CHECK_KINDS.has(kind as (typeof CHECK_DEFINITIONS)[number]['kind'])) throw new AppError('VERIFICATION_KIND_INVALID', 'Verification check kind is invalid.', 400);
    const timestamp = now();
    await this.db.verificationCheck.upsert({
      where: { userId_kind: { userId, kind } },
      create: { id: eventId('vcheck'), userId, kind, status: 'pending', value: null, method: 'seller_request', note: null, verifiedAt: null, verifiedBy: null, createdAt: timestamp, updatedAt: timestamp },
      update: { status: 'pending', method: 'seller_request', updatedAt: timestamp },
    });
    await this.recordEvent(userId, 'verification_check_updated', { kind, status: 'pending' });
    await this.recompute(userId);
    return this.getChecks(userId);
  }

  async setCheckStatus(
    userId: string,
    rawInput: unknown,
    actorId: string,
    actorRole: TrustStaffRole = 'admin',
  ) {
    if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
      throw new AppError('VERIFICATION_CHECK_INPUT_INVALID', 'Verification check input is invalid.', 400);
    }
    const input = rawInput as Record<string, unknown>;
    const unexpected = Object.keys(input).find(
      (key) => !['kind', 'status', 'value', 'method', 'note'].includes(key),
    );
    if (unexpected) {
      throw new AppError('BODY_FIELD_UNEXPECTED', `Unexpected field '${unexpected}'.`, 400);
    }

    const kind = typeof input.kind === 'string' ? input.kind.trim().toLowerCase() : '';
    if (!CHECK_KINDS.has(kind as (typeof CHECK_DEFINITIONS)[number]['kind'])) {
      throw new AppError('VERIFICATION_KIND_INVALID', 'Verification check kind is invalid.', 400);
    }
    const status = typeof input.status === 'string' ? input.status.trim().toLowerCase() : '';
    if (!['unverified', 'pending', 'verified', 'revoked'].includes(status)) {
      throw new AppError('VERIFICATION_STATUS_INVALID', 'Verification check status is invalid.', 400);
    }
    const value = optionalText(input.value, 'Verification value', 500);
    const method = optionalText(input.method, 'Verification method', 120);
    const note = optionalText(input.note, 'Verification note', 1_000);
    const timestamp = now();

    await this.requireSeller(userId);
    const previous = await this.db.verificationCheck.findUnique({ where: { userId_kind: { userId, kind } } });
    await this.db.verificationCheck.upsert({
      where: { userId_kind: { userId, kind } },
      create: {
        id: eventId('vcheck'),
        userId,
        kind,
        status,
        value: value ?? null,
        method: method ?? null,
        note: note ?? null,
        verifiedAt: status === 'verified' ? timestamp : null,
        verifiedBy: status === 'verified' ? actorId : null,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      update: {
        status,
        ...(value !== undefined ? { value } : {}),
        ...(method !== undefined ? { method } : {}),
        ...(note !== undefined ? { note } : {}),
        verifiedAt: status === 'verified' ? timestamp : null,
        verifiedBy: status === 'verified' ? actorId : null,
        updatedAt: timestamp,
      },
    });
    await this.recordEvent(userId, 'verification_check_updated', {
      kind,
      status,
      actorId,
    });
    const updated = await this.db.verificationCheck.findUnique({ where: { userId_kind: { userId, kind } } });
    await this.recordAdminAudit(actorId, actorRole, 'verification.check.updated', userId, {
      before: previous,
      after: updated,
      reason: note ?? undefined,
    });
    await this.recompute(userId);
    return this.getChecks(userId);
  }

  async reviewApplication(
    id: string,
    rawInput: unknown,
    actor: TrustStaffActor,
  ) {
    if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
      throw new AppError('VERIFICATION_REVIEW_INPUT_INVALID', 'Verification review input is invalid.', 400);
    }
    const input = rawInput as Record<string, unknown>;
    const unexpected = Object.keys(input).find(
      (key) => !['action', 'note', 'decision'].includes(key),
    );
    if (unexpected) {
      throw new AppError('BODY_FIELD_UNEXPECTED', `Unexpected field '${unexpected}'.`, 400);
    }
    const action = typeof input.action === 'string' ? input.action.trim().toLowerCase() : '';
    const decision = typeof input.decision === 'string' ? input.decision.trim().toLowerCase() : undefined;
    if (decision !== undefined && decision !== 'approve' && decision !== 'reject') {
      throw new AppError('VERIFICATION_DECISION_INVALID', 'Verification decision is invalid.', 400);
    }

    const application = await this.db.trustVerification.findUnique({ where: { id } });
    if (!application) throw new AppError('VERIFICATION_NOT_FOUND', 'Verification application was not found.', 404);
    const noteInput = optionalText(input.note, 'Review note', 1_000);
    const note = noteInput === undefined ? application.note : noteInput;
    const timestamp = now();
    const canApprove = actor.role === 'owner' || actor.role === 'admin';

    if (action === 'request_info') {
      await this.db.trustVerification.update({
        where: { id },
        data: { status: 'under_review', reviewedBy: actor.userId, note, reviewedAt: timestamp },
      });
    } else if (action === 'recommend') {
      if (!decision) throw new AppError('VERIFICATION_DECISION_REQUIRED', 'A verification recommendation is required.', 400);
      if (application.status !== 'pending' && application.status !== 'under_review') {
        throw new AppError('VERIFICATION_STATE_INVALID', 'The application is not in a reviewable state.', 400);
      }
      await this.db.trustVerification.update({
        where: { id },
        data: { status: 'under_review', recommendation: decision, reviewedBy: actor.userId, reviewedAt: timestamp, note },
      });
    } else if (action === 'approve') {
      if (!canApprove) throw new AppError('TRUST_APPROVAL_FORBIDDEN', 'Moderators can recommend but cannot grant Trusted Seller.', 403);
      if (application.status !== 'pending' && application.status !== 'under_review') {
        throw new AppError('VERIFICATION_STATE_INVALID', 'The application is not in a reviewable state.', 400);
      }
      if (actor.role !== 'owner' && application.recommendation !== 'approve') {
        throw new AppError('TRUST_APPROVAL_RECOMMENDATION_REQUIRED', 'An approve recommendation is required before an admin can grant Trusted Seller.', 400);
      }
      const checklist = await this.getChecklist(application.userId);
      const eligible = checklist.filter((item) => item.blocking !== false).every((item) => item.passed);
      if (!eligible && actor.role !== 'owner') {
        throw new AppError('VERIFICATION_NOT_ELIGIBLE', 'Seller no longer meets the Trusted Seller requirements.', 400);
      }
      const trustedUntil = new Date(Date.now() + TRUSTED_DAYS * 86_400_000).toISOString();
      await this.db.trustVerification.update({
        where: { id },
        data: {
          status: 'trusted',
          reviewedAt: timestamp,
          reviewedBy: actor.userId,
          approvedBy: actor.userId,
          trustedAt: timestamp,
          trustedUntil,
          expiresAt: trustedUntil,
          recommendation: 'approve',
          note,
          verificationVersion: 2,
        },
      });
    } else if (action === 'reject') {
      if (!canApprove) throw new AppError('TRUST_REJECTION_FORBIDDEN', 'Moderators can recommend but cannot reject a verification application.', 403);
      if (application.status !== 'pending' && application.status !== 'under_review') {
        throw new AppError('VERIFICATION_STATE_INVALID', 'The application is not in a reviewable state.', 400);
      }
      await this.db.trustVerification.update({
        where: { id },
        data: { status: 'revoked', reviewedAt: timestamp, reviewedBy: actor.userId, note, recommendation: 'reject', verificationVersion: 2 },
      });
    } else if (action === 'revoke' || action === 'suspend') {
      if (!canApprove) throw new AppError('TRUST_STATUS_FORBIDDEN', 'Only an admin or owner can change Trusted Seller status.', 403);
      if (application.status !== 'trusted') throw new AppError('VERIFICATION_STATE_INVALID', 'Only a trusted application can be revoked or suspended.', 400);
      await this.db.trustVerification.update({
        where: { id },
        data: { status: action === 'suspend' ? 'suspended' : 'revoked', reviewedAt: timestamp, reviewedBy: actor.userId, note },
      });
    } else if (action === 'restore') {
      if (!canApprove) throw new AppError('TRUST_STATUS_FORBIDDEN', 'Only an admin or owner can restore a verification application.', 403);
      await this.db.trustVerification.update({
        where: { id },
        data: { status: 'under_review', reviewedAt: timestamp, reviewedBy: actor.userId, note },
      });
    } else {
      throw new AppError('VERIFICATION_ACTION_INVALID', 'Verification action is invalid.', 400);
    }

    const updated = await this.db.trustVerification.findUnique({ where: { id } });
    await this.recordEvent(application.userId, 'verification_reviewed', {
      action,
      actorId: actor.userId,
      actorRole: actor.role,
      note: note ?? '',
    });
    await this.recordAdminAudit(actor.userId, actor.role, `verification.${action}`, id, {
      before: application,
      after: updated,
      reason: note ?? undefined,
    });
    await this.recompute(application.userId);
    return updated;
  }

  async listAdminApplications(rawStatus?: string) {
    const status = rawStatus?.trim().toLowerCase();
    const rows = await this.db.trustVerification.findMany({
      where: status && ADMIN_VERIFICATION_STATES.has(status as VerificationState) ? { status } : undefined,
      orderBy: { submittedAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            joinedDate: true,
            trustScore: true,
            trustScoreUpdatedAt: true,
            verificationState: true,
            trustedAt: true,
            trustedUntil: true,
          },
        },
      },
    });

    return Promise.all(rows.map(async (row) => {
      const reviewAgg = await this.db.botReview.aggregate({
        where: { bot: { sellerId: row.userId } },
        _avg: { rating: true },
        _count: true,
      });
      const checks = await this.getChecks(row.userId);
      return {
        id: row.id,
        userId: row.userId,
        status: row.status as VerificationState,
        submittedAt: row.submittedAt,
        reviewedAt: row.reviewedAt ?? undefined,
        trustedAt: row.trustedAt ?? undefined,
        trustedUntil: row.trustedUntil ?? row.expiresAt ?? undefined,
        note: row.note ?? undefined,
        recommendation: row.recommendation === 'approve' || row.recommendation === 'reject' ? row.recommendation : undefined,
        user: { ...row.user, avatar: mediaDeliveryUrl(row.user.avatar) },
        trustScore: row.user.trustScore,
        trustScoreReady: Boolean(row.user.trustScoreUpdatedAt && (reviewAgg._count > 0 || checks.some((check) => check.status === 'verified'))),
        reviewCount: reviewAgg._count,
        avgRating: reviewAgg._avg.rating ?? 0,
        checks,
        basicVerifiedCount: checks.filter((check) => check.status === 'verified').length,
        basicVerifiedTotal: CHECK_DEFINITIONS.length,
      };
    }));
  }

  async expireTrustedApplications(): Promise<number> {
    const timestamp = now();
    const expired = await this.db.trustVerification.findMany({
      where: {
        status: 'trusted',
        OR: [
          { trustedUntil: { lt: timestamp } },
          { expiresAt: { lt: timestamp } },
        ],
      },
      select: { id: true, userId: true, trustedUntil: true, expiresAt: true },
    });
    let changed = 0;
    for (const application of expired) {
      const updated = await this.db.trustVerification.updateMany({
        where: { id: application.id, status: 'trusted' },
        data: { status: 'revoked', reviewedAt: timestamp, note: 'Trusted Seller approval expired.' },
      });
      if (updated.count !== 1) continue;
      changed += 1;
      await this.recordEvent(application.userId, 'trusted_expired', { verificationId: application.id, trustedUntil: application.trustedUntil ?? application.expiresAt });
      await this.recompute(application.userId);
    }
    return changed;
  }

  private async recordEvent(userId: string, type: string, detail: unknown): Promise<void> {
    await this.db.trustEvent.create({ data: { id: eventId('te'), userId, type, detail: JSON.stringify(detail), createdAt: now() } });
  }

  private async recordAdminAudit(
    actorId: string,
    actorRole: TrustStaffRole,
    action: string,
    targetId: string,
    payload: { before?: unknown; after?: unknown; reason?: string },
  ): Promise<void> {
    const actor = await this.db.user.findUnique({ where: { id: actorId }, select: { name: true } });
    const previous = await this.db.adminAuditLog.findFirst({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { eventHash: true },
    });
    const createdAt = now();
    const beforeData = payload.before === undefined ? null : JSON.stringify(payload.before);
    const afterData = payload.after === undefined ? null : JSON.stringify(payload.after);
    const eventHash = hash(canonicalJson({
      previousHash: previous?.eventHash ?? '',
      actorId,
      actorRole,
      action,
      targetType: 'trust_verification',
      targetId,
      reason: payload.reason ?? null,
      beforeData,
      afterData,
      createdAt,
    }));
    await this.db.adminAuditLog.create({
      data: {
        id: eventId('audit'),
        actorId,
        actorName: actor?.name ?? 'Staff',
        actorRole,
        action,
        targetType: 'trust_verification',
        targetId,
        reason: payload.reason ?? null,
        beforeData,
        afterData,
        createdAt,
        previousHash: previous?.eventHash ?? '',
        eventHash,
      },
    });
  }

  private async computeTier(userId: string, score: number, counts: { reviewCount: number; avgRating: number; botCount: number }) {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { joinedDate: true } });
    if (!user) return 'new';
    const ageDays = (Date.now() - Date.parse(user.joinedDate)) / 86_400_000;
    const latest = await this.latestApplication(userId);
    const activeTrusted = latest?.status === 'trusted' && !isExpired(latest.trustedUntil ?? latest.expiresAt);
    if (!activeTrusted) return ageDays >= TIER_MIN_ACCOUNT_DAYS && counts.botCount >= 1 && counts.reviewCount >= 1 ? 'active' : 'new';
    if (counts.avgRating >= TOP_MIN_RATING && counts.reviewCount >= TOP_MIN_REVIEWS && score >= TIER_MIN_SCORE) {
      const ranked = await this.db.user.findMany({ where: { role: 'seller', verificationState: 'trusted' }, orderBy: { trustScore: 'desc' }, select: { id: true }, take: TOP_RANK_LIMIT + 1 });
      if (ranked.findIndex((item) => item.id === userId) >= 0 && ranked.findIndex((item) => item.id === userId) < TOP_RANK_LIMIT) return 'top';
    }
    return 'trusted';
  }

  async recompute(userId: string) {
    const [user, score, counts, state, latest] = await Promise.all([
      this.requireSeller(userId),
      this.scoreInfo(userId),
      this.counts(userId),
      this.currentState(userId),
      this.latestApplication(userId),
    ]);
    const tier = await this.computeTier(userId, score.score, counts);
    if (user.trustScore !== score.score) await this.recordEvent(userId, 'score_changed', { from: user.trustScore, to: score.score });
    const previous = await this.db.user.findUnique({ where: { id: userId }, select: { tier: true, verificationState: true } });
    if (previous?.tier !== tier) await this.recordEvent(userId, 'tier_changed', { from: previous?.tier, to: tier });
    if (previous?.verificationState !== state) await this.recordEvent(userId, 'verification_state_changed', { from: previous?.verificationState, to: state });
    const trustedAt = state === 'trusted' ? (latest?.trustedAt ?? latest?.reviewedAt ?? null) : null;
    const trustedUntil = state === 'trusted' ? (latest?.trustedUntil ?? latest?.expiresAt ?? null) : null;
    await this.db.user.update({ where: { id: userId }, data: { trustScore: score.score, trustScoreUpdatedAt: now(), tier, verificationState: state, trustedAt, trustedUntil, verificationVersion: 2 } });
    const profile = await this.db.sellerProfile.findUnique({ where: { userId }, select: { shopName: true, avatar: true, slug: true } });
    await this.db.bot.updateMany({ where: { sellerId: userId }, data: { sellerName: profile?.shopName ?? user.name, sellerAvatar: profile?.avatar ?? '', sellerVerificationState: state, sellerTrustedUntil: trustedUntil, sellerSlug: profile?.slug ?? '' } });
    return { score: score.score, tier, state, breakdown: score.breakdown, trustedAt: trustedAt ?? undefined, trustedUntil: trustedUntil ?? undefined };
  }

  async getTimeline(userId: string) {
    await this.requireSeller(userId);
    const rows = await this.db.trustEvent.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    return rows.map((row) => ({ id: row.id, type: row.type, detail: parseJson<Record<string, unknown> | undefined>(row.detail, undefined), createdAt: row.createdAt }));
  }
}
