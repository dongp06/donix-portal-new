import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { CodeChallengeMethod, OAuth2Client, type TokenPayload } from 'google-auth-library';
import {
  accessTokenTtlMs,
  OAUTH_STATE_TTL_MS,
  sessionAbsoluteTtlMs,
  sessionGraceTtlMs,
  sessionIdleTtlMs,
} from './config.js';
import { AppError, isDatabaseAvailabilityError } from './errors.js';
import { hash, isOpaqueCredential, randomOpaqueCredential } from './crypto.js';
import { mergeContacts } from './contact.js';
import { withDatabaseRetry, type Database } from './database.js';

export type AuthSessionContext = {
  id: string;
  userId: string;
  deviceId: string | null;
  familyId: string;
  generation: number;
  createdAt: string;
  expiresAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  lastSeenAt: string;
  rotatedFrom: string | null;
  replacedById: string | null;
  rotatedAt: string | null;
  graceUntil: string | null;
  reuseDetectedAt: string | null;
};

export type SessionRenewalResolution = {
  status: 'current' | 'grace' | 'reused' | 'invalid';
  session: AuthSessionContext | null;
  currentSession: AuthSessionContext | null;
};

export type SessionRotationResult = {
  status: 'rotated' | 'grace' | 'reused' | 'invalid';
  token: string | null;
  session: AuthSessionContext | null;
  previousSessionId: string | null;
};

export type AuthAccessTokenContext = {
  id: string;
  userId: string;
  sessionId: string;
  deviceId: string;
  keyThumbprint: string;
  audience: string;
  scopes: string[];
  issuedAt: string;
  expiresAt: string;
};

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: 'buyer' | 'seller';
  verificationState: string;
  trustedAt: string | null;
  trustedUntil: string | null;
  bio: string | null;
  joinedDate: string;
  onboardingCompleted: boolean;
  isTrusted: boolean;
  contact?: Record<string, string>;
  isNewUser?: boolean;
  staffRole?: string;
  staff?: { role: string };
};

export type AuthUser = PublicUser & {
  contact: Record<string, string>;
  isNewUser: boolean;
};

export type OAuthStateContext = {
  id: string;
  tokenHash: string;
  provider: string;
  returnTo: string;
  codeVerifier: string;
  nonce: string;
  createdAt: string;
  expiresAt: string;
};

type DbSessionRow = {
  id: string;
  tokenHash: string;
  userId: string;
  deviceId: string | null;
  familyId: string;
  generation: number;
  rotatedFrom: string | null;
  replacedById: string | null;
  createdAt: string;
  expiresAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
  rotatedAt: string | null;
  graceUntil: string | null;
  reuseDetectedAt: string | null;
};

function now(): string {
  return new Date().toISOString();
}

function tokenHash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function constantTimeTextEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, 'utf8');
  const rightBytes = Buffer.from(right, 'utf8');
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function isExpired(value: string): boolean {
  return Date.parse(value) <= Date.now();
}

function context(row: DbSessionRow): AuthSessionContext {
  const idleExpiresAt = row.idleExpiresAt || row.expiresAt;
  const absoluteExpiresAt = row.absoluteExpiresAt || row.expiresAt;
  return {
    id: row.id,
    userId: row.userId,
    deviceId: row.deviceId,
    familyId: row.familyId || `sf-${row.id}`,
    generation: Number.isSafeInteger(row.generation) ? row.generation : 0,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    idleExpiresAt,
    absoluteExpiresAt,
    lastSeenAt: row.lastSeenAt,
    rotatedFrom: row.rotatedFrom,
    replacedById: row.replacedById,
    rotatedAt: row.rotatedAt,
    graceUntil: row.graceUntil,
    reuseDetectedAt: row.reuseDetectedAt,
  };
}

export class AuthService {
  private readonly googleClient: OAuth2Client;

  constructor(private readonly db: Database) {
    this.googleClient = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID?.trim() || undefined,
      process.env.GOOGLE_CLIENT_SECRET?.trim() || undefined,
      this.googleRedirectUri(),
    );
  }

  private googleRedirectUri(): string {
    const configured = process.env.GOOGLE_REDIRECT_URI?.trim();
    if (configured) return configured;
    const origin = process.env.PUBLIC_ORIGIN?.trim() || 'http://localhost:3000';
    return `${origin.replace(/\/$/, '')}/api/auth/google/callback`;
  }

  constantTimeOAuthStateMatches(cookieState: string, queryState: string): boolean {
    return constantTimeTextEqual(cookieState, queryState);
  }

  async createGoogleAuthorization(returnTo: string): Promise<{ state: string; authorizationUrl: string }> {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!clientId) throw new AppError('GOOGLE_OAUTH_NOT_CONFIGURED', 'Google OAuth is not configured.', 503);
    const createdAt = new Date();
    const state = randomOpaqueCredential();
    const codeVerifier = randomBytes(48).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier, 'utf8').digest('base64url');
    const nonce = randomBytes(32).toString('base64url');
    const expiresAt = new Date(createdAt.getTime() + OAUTH_STATE_TTL_MS).toISOString();
    await withDatabaseRetry(() => this.db.oAuthState.create({
      data: {
        id: `oauth-${randomUUID()}`,
        tokenHash: tokenHash(state),
        provider: 'google',
        returnTo,
        codeVerifier,
        nonce,
        createdAt: createdAt.toISOString(),
        expiresAt,
        consumedAt: null,
      },
    }), 3);
    const url = new URL(this.googleClient.generateAuthUrl({
      access_type: 'online',
      client_id: clientId,
      redirect_uri: this.googleRedirectUri(),
      response_type: 'code',
      scope: ['openid', 'email', 'profile'],
      state,
      code_challenge: codeChallenge,
      code_challenge_method: CodeChallengeMethod.S256,
      prompt: 'select_account',
    }));
    // google-auth-library does not type the OIDC nonce option, but Google
    // accepts it as a standard authorization parameter.
    url.searchParams.set('nonce', nonce);
    return { state, authorizationUrl: url.toString() };
  }

  async consumeGoogleAuthorizationState(value: string): Promise<OAuthStateContext> {
    if (!isOpaqueCredential(value)) {
      throw new AppError('OAUTH_STATE_INVALID', 'OAuth state is invalid or expired.', 400);
    }
    const row = await withDatabaseRetry(() => this.db.oAuthState.findUnique({ where: { tokenHash: tokenHash(value) } }), 3);
    if (!row || row.provider !== 'google' || row.consumedAt || Date.parse(row.expiresAt) <= Date.now()) {
      throw new AppError('OAUTH_STATE_INVALID', 'OAuth state is invalid or expired.', 400);
    }
    const consumedAt = new Date().toISOString();
    const consumed = await withDatabaseRetry(() => this.db.oAuthState.updateMany({
      where: { id: row.id, consumedAt: null, expiresAt: { gt: consumedAt } },
      data: { consumedAt },
    }), 3);
    if (consumed.count !== 1) throw new AppError('OAUTH_STATE_INVALID', 'OAuth state is invalid or expired.', 400);
    return {
      id: row.id,
      tokenHash: row.tokenHash,
      provider: row.provider,
      returnTo: row.returnTo,
      codeVerifier: row.codeVerifier,
      nonce: row.nonce,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    };
  }

  async authenticateGoogleAuthorizationCode(code: string, state: OAuthStateContext): Promise<AuthUser> {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!clientId || !code.trim()) throw new AppError('GOOGLE_AUTH_INVALID', 'Google authorization code is invalid.', 401);
    try {
      const tokenResponse = await this.googleClient.getToken({
        code: code.trim(),
        codeVerifier: state.codeVerifier,
        redirect_uri: this.googleRedirectUri(),
      });
      const idToken = tokenResponse.tokens.id_token;
      if (!idToken) throw new Error('Google did not return an OpenID Connect identity token.');
      const ticket = await this.googleClient.verifyIdToken({ idToken, audience: clientId });
      const payload = ticket.getPayload();
      if (!payload?.email || payload.email_verified !== true || payload.nonce !== state.nonce) {
        throw new Error('Google identity or nonce verification failed.');
      }
      return this.authenticateGooglePayload(payload);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('GOOGLE_AUTH_INVALID', 'Google authorization code is invalid.', 401);
    }
  }

  private async authenticateGooglePayload(payload: TokenPayload): Promise<AuthUser> {
    const email = payload.email?.trim().toLowerCase();
    if (!email) throw new AppError('GOOGLE_AUTH_INVALID', 'Google token does not contain a valid email.', 401);
    const name = payload.name?.trim() || email.split('@')[0] || 'Thuebot user';
    const avatar = payload.picture ?? '';
    let user = await withDatabaseRetry(() => this.db.user.findUnique({ where: { email } }), 3);
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      try {
        user = await withDatabaseRetry(() => this.db.user.create({
          data: {
            id: `usr-${randomUUID()}`,
            googleId: payload.sub,
            name,
            email,
            avatar,
            role: 'buyer',
            onboardingCompleted: false,
            bio: null,
            joinedDate: new Date().toISOString().slice(0, 10),
          },
        }), 3);
      } catch {
        user = await withDatabaseRetry(() => this.db.user.findUnique({ where: { email } }), 3);
        if (!user) throw new AppError('GOOGLE_ACCOUNT_CREATE_FAILED', 'Unable to create the account.', 500);
        isNewUser = false;
      }
    } else {
      user = await withDatabaseRetry(() => this.db.user.update({ where: { id: user!.id }, data: { name, avatar } }), 3);
    }
    if (!user) throw new AppError('GOOGLE_ACCOUNT_CREATE_FAILED', 'Unable to create the account.', 500);
    return this.toAuthUser(user, isNewUser);
  }

  async completeOnboarding(userId: string, role: 'buyer' | 'seller', expectedEmail?: string): Promise<AuthUser> {
    const existing = await withDatabaseRetry(() => this.db.user.findUnique({ where: { id: userId } }), 3);
    if (!existing) throw new AppError('SESSION_INVALID', 'Login session is invalid.', 401);
    if (expectedEmail && existing.email.trim().toLowerCase() !== expectedEmail.trim().toLowerCase()) {
      throw new AppError('SESSION_INVALID', 'Login session is invalid.', 401);
    }
    if (existing.onboardingCompleted) return this.toAuthUser(existing, false);
    const updated = await withDatabaseRetry(() => this.db.user.update({
      where: { id: userId },
      data: {
        role,
        onboardingCompleted: true,
        bio: existing.bio ?? (role === 'seller' ? 'Người bán bot tại thuebot.org' : 'Người mua bot tại thuebot.org'),
      },
    }), 3);
    return this.toAuthUser(updated, false);
  }

  async promoteToSeller(userId: string, expectedEmail?: string): Promise<AuthUser> {
    const existing = await withDatabaseRetry(() => this.db.user.findUnique({ where: { id: userId } }), 3);
    if (!existing) throw new AppError('SESSION_INVALID', 'Login session is invalid.', 401);
    if (expectedEmail && existing.email.trim().toLowerCase() !== expectedEmail.trim().toLowerCase()) {
      throw new AppError('SESSION_INVALID', 'Login session is invalid.', 401);
    }
    if (existing.role === 'seller') return this.toAuthUser(existing, false);
    const updated = await withDatabaseRetry(() => this.db.user.update({ where: { id: userId }, data: { role: 'seller' } }), 3);
    return this.toAuthUser(updated, false);
  }

  async createSession(userId: string, deviceId: string | null = null) {
    const createdAt = new Date();
    const absoluteExpiresAt = new Date(createdAt.getTime() + sessionAbsoluteTtlMs()).toISOString();
    const idleExpiresAt = new Date(
      Math.min(createdAt.getTime() + sessionIdleTtlMs(), Date.parse(absoluteExpiresAt)),
    ).toISOString();
    const token = randomOpaqueCredential();
    const row = {
      id: `ses-${randomUUID()}`,
      tokenHash: tokenHash(token),
      userId,
      deviceId,
      familyId: `sf-${randomUUID()}`,
      generation: 0,
      rotatedFrom: null,
      replacedById: null,
      createdAt: createdAt.toISOString(),
      expiresAt: idleExpiresAt,
      idleExpiresAt,
      absoluteExpiresAt,
      lastSeenAt: createdAt.toISOString(),
      revokedAt: null,
      rotatedAt: null,
      graceUntil: null,
      reuseDetectedAt: null,
    };
    await withDatabaseRetry(() => this.db.authSession.create({ data: row }), 3);
    return { token, session: context(row) };
  }

  async createAccessToken(input: {
    sessionId: string;
    userId: string;
    deviceId: string;
    keyThumbprint: string;
    scopes?: string[];
  }) {
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + accessTokenTtlMs()).toISOString();
    const token = randomBytes(48).toString('base64url');
    const tokenId = `at-${randomUUID()}`;
    const scopes = [...new Set(input.scopes ?? ['api'])].slice(0, 20);
    // Expired-token cleanup belongs to maintenance. Doing a table-wide
    // delete on every silent renewal creates needless SQLite writer pressure.
    await withDatabaseRetry(() => this.db.authAccessToken.create({
      data: {
        id: tokenId,
        tokenHash: tokenHash(token),
        sessionId: input.sessionId,
        userId: input.userId,
        deviceId: input.deviceId,
        keyThumbprint: input.keyThumbprint,
        audience: 'thuebot-api',
        scopes: JSON.stringify(scopes),
        issuedAt: issuedAt.toISOString(),
        expiresAt,
      },
    }), 3);
    return { token, tokenId, expiresAt, expiresInMs: accessTokenTtlMs(), scopes };
  }

  async resolveAccessToken(value: string): Promise<AuthAccessTokenContext | null> {
    if (!isOpaqueCredential(value)) return null;
    const row = await this.db.authAccessToken.findUnique({ where: { tokenHash: tokenHash(value) } });
    if (!row || row.revokedAt || isExpired(row.expiresAt)) return null;
    let scopes: string[] = [];
    try {
      const parsed: unknown = JSON.parse(row.scopes);
      if (Array.isArray(parsed)) scopes = parsed.filter((item): item is string => typeof item === 'string');
    } catch {
      scopes = [];
    }
    return {
      id: row.id,
      userId: row.userId,
      sessionId: row.sessionId,
      deviceId: row.deviceId,
      keyThumbprint: row.keyThumbprint,
      audience: row.audience,
      scopes,
      issuedAt: row.issuedAt,
      expiresAt: row.expiresAt,
    };
  }

  async resolveSession(value: string): Promise<AuthSessionContext | null> {
    if (!isOpaqueCredential(value)) return null;
    const row = (await this.db.authSession.findUnique({ where: { tokenHash: tokenHash(value) } })) as DbSessionRow | null;
    if (
      !row ||
      row.revokedAt ||
      row.rotatedAt ||
      isExpired(row.expiresAt) ||
      isExpired(row.absoluteExpiresAt || row.expiresAt)
    ) return null;
    // Sliding expiry is a best-effort projection. A temporary writer lock
    // must not turn a valid cookie lookup into an authentication outage.
    void this.touchSession(row).catch(() => undefined);
    return context(row);
  }

  async resolveSessionForRenewal(value: string): Promise<SessionRenewalResolution> {
    if (!isOpaqueCredential(value)) return { status: 'invalid', session: null, currentSession: null };
    const row = (await this.db.authSession.findUnique({ where: { tokenHash: tokenHash(value) } })) as DbSessionRow | null;
    if (!row) return { status: 'invalid', session: null, currentSession: null };
    const session = context(row);
    if (row.reuseDetectedAt) return { status: 'reused', session, currentSession: null };
    if (row.rotatedAt || row.revokedAt) {
      const graceUntil = row.graceUntil ? Date.parse(row.graceUntil) : 0;
      if (!row.rotatedAt || !graceUntil || graceUntil <= Date.now()) {
        return { status: 'reused', session, currentSession: null };
      }
      const replacement = row.replacedById
        ? ((await this.db.authSession.findUnique({ where: { id: row.replacedById } })) as DbSessionRow | null)
        : ((await this.db.authSession.findFirst({
            where: { familyId: row.familyId, revokedAt: null, reuseDetectedAt: null },
            orderBy: { generation: 'desc' },
          })) as DbSessionRow | null);
      if (!replacement || replacement.revokedAt || replacement.reuseDetectedAt || isExpired(replacement.expiresAt)) {
        return { status: 'invalid', session: null, currentSession: null };
      }
      return { status: 'grace', session, currentSession: context(replacement) };
    }
    if (isExpired(row.expiresAt) || isExpired(row.absoluteExpiresAt || row.expiresAt)) {
      return { status: 'invalid', session: null, currentSession: null };
    }
    void this.touchSession(row).catch(() => undefined);
    return { status: 'current', session: context(row), currentSession: context(row) };
  }

  async rotateSession(value: string, expectedDeviceId?: string | null): Promise<SessionRotationResult> {
    const resolution = await this.resolveSessionForRenewal(value);
    if (
      resolution.status === 'invalid' ||
      !resolution.session ||
      (expectedDeviceId && resolution.session.deviceId !== expectedDeviceId)
    ) return { status: 'invalid', token: null, session: null, previousSessionId: null };
    if (resolution.status === 'reused') {
      await this.revokeSessionFamily(resolution.session.familyId);
      return { status: 'reused', token: null, session: null, previousSessionId: resolution.session.id };
    }
    if (resolution.status === 'grace') {
      return { status: 'grace', token: null, session: resolution.currentSession, previousSessionId: resolution.session.id };
    }

    const previous = resolution.session;
    const startedAt = new Date();
    const absoluteExpiresAt = previous.absoluteExpiresAt;
    const idleExpiresAt = new Date(
      Math.min(startedAt.getTime() + sessionIdleTtlMs(), Date.parse(absoluteExpiresAt)),
    ).toISOString();
    const nextToken = randomOpaqueCredential();
    const nextId = `ses-${randomUUID()}`;
    const nextRow = {
      id: nextId,
      tokenHash: tokenHash(nextToken),
      userId: previous.userId,
      deviceId: previous.deviceId,
      familyId: previous.familyId || `sf-${previous.id}`,
      generation: previous.generation + 1,
      rotatedFrom: previous.id,
      replacedById: null,
      createdAt: startedAt.toISOString(),
      expiresAt: idleExpiresAt,
      idleExpiresAt,
      absoluteExpiresAt,
      lastSeenAt: startedAt.toISOString(),
      revokedAt: null,
      rotatedAt: null,
      graceUntil: null,
      reuseDetectedAt: null,
    };
    let created = false;
    try {
      await this.db.$transaction(async (tx) => {
        const current = (await tx.authSession.findUnique({ where: { id: previous.id } })) as DbSessionRow | null;
        if (!current || current.revokedAt || current.rotatedAt || current.generation !== previous.generation) return;
        const updated = await tx.authSession.updateMany({
          where: { id: previous.id, generation: previous.generation, revokedAt: null, rotatedAt: null },
          data: {
            revokedAt: startedAt.toISOString(),
            rotatedAt: startedAt.toISOString(),
            graceUntil: new Date(startedAt.getTime() + sessionGraceTtlMs()).toISOString(),
            replacedById: nextId,
          },
        });
        if (updated.count !== 1) return;
        await tx.authSession.create({ data: nextRow });
        created = true;
      });
    } catch (error) {
      if (isDatabaseAvailabilityError(error)) throw error;
      return { status: 'invalid', token: null, session: null, previousSessionId: previous.id };
    }
    if (!created) {
      const raced = await this.resolveSessionForRenewal(value);
      return raced.status === 'grace'
        ? { status: 'grace', token: null, session: raced.currentSession, previousSessionId: previous.id }
        : { status: 'invalid', token: null, session: null, previousSessionId: previous.id };
    }
    await this.revokeAccessTokensForSession(previous.id);
    return { status: 'rotated', token: nextToken, session: context(nextRow), previousSessionId: previous.id };
  }

  async revokeSessionFamily(familyId: string): Promise<void> {
    if (!familyId) return;
    const revokedAt = now();
    await this.db.authSession.updateMany({ where: { familyId }, data: { revokedAt, reuseDetectedAt: revokedAt } });
    const sessions = await this.db.authSession.findMany({ where: { familyId }, select: { id: true } });
    const ids = sessions.map((item) => item.id);
    if (ids.length) await this.db.authAccessToken.updateMany({ where: { sessionId: { in: ids }, revokedAt: null }, data: { revokedAt } });
  }

  async revokeAccessTokensForSession(sessionId: string): Promise<void> {
    await this.db.authAccessToken.updateMany({ where: { sessionId, revokedAt: null }, data: { revokedAt: now() } });
  }

  async revokeAccessTokensForDevice(deviceId: string): Promise<void> {
    await this.db.authAccessToken.updateMany({ where: { deviceId, revokedAt: null }, data: { revokedAt: now() } });
  }

  async revokeSession(value: string): Promise<void> {
    if (!isOpaqueCredential(value)) return;
    const row = await this.db.authSession.findUnique({
      where: { tokenHash: tokenHash(value) },
      select: { id: true, familyId: true },
    });
    if (!row) return;
    // Normal logout is scoped to the credential presented by this browser.
    // Family-wide revocation is reserved for explicit logout-all/security
    // events and session reuse detection.
    const revokedAt = now();
    await this.db.authSession.update({ where: { id: row.id }, data: { revokedAt } });
    await this.revokeAccessTokensForSession(row.id);
  }

  async resolveSessionUser(value: string): Promise<{ session: AuthSessionContext; user: AuthUser } | null> {
    const session = await this.resolveSession(value);
    if (!session) return null;
    const user = await this.publicUser(session.userId);
    return user ? { session, user } : null;
  }

  async publicUser(userId: string): Promise<AuthUser | null> {
    const row = await this.db.user.findUnique({ where: { id: userId } });
    if (!row) return null;
    return this.toAuthUser(row, false);
  }

  private async toAuthUser(
    user: {
      id: string;
      name: string;
      email: string;
      avatar: string;
      role: string;
      verificationState: string;
      trustedAt: string | null;
      trustedUntil: string | null;
      bio: string | null;
      joinedDate: string;
      contact: string | null;
      onboardingCompleted: boolean;
    },
    isNewUser: boolean,
  ): Promise<AuthUser> {
    const staffRole = await this.resolveStaffRole(user.id, user.email);
    const sellerProfile = user.role === 'seller'
      ? await this.db.sellerProfile.findUnique({ where: { userId: user.id }, select: { contact: true } })
      : null;
    const contact = mergeContacts(user.contact, sellerProfile?.contact);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role === 'seller' ? 'seller' : 'buyer',
      verificationState: user.verificationState,
      trustedAt: user.trustedAt,
      trustedUntil: user.trustedUntil,
      bio: user.bio,
      joinedDate: user.joinedDate,
      onboardingCompleted: user.onboardingCompleted,
      isTrusted: user.verificationState === 'trusted' && (!user.trustedUntil || Date.parse(user.trustedUntil) >= Date.now()),
      contact,
      isNewUser,
      ...(staffRole ? { staffRole, staff: { role: staffRole } } : {}),
    };
  }

  private async resolveStaffRole(userId: string, email: string): Promise<string | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
    const row = await this.db.staffMember.findUnique({ where: { userId } });
    if (ownerEmail && normalizedEmail === ownerEmail) {
      // Avoid an update/upsert on every /auth/me, bootstrap, and access-token
      // lookup. The owner projection is already authoritative when it is
      // active; only repair it when it is missing or stale.
      if (row?.role?.trim().toLowerCase() === 'owner' && row.isActive) return 'owner';
      const timestamp = now();
      await this.db.staffMember.updateMany({
        where: { role: 'owner', userId: { not: userId } },
        data: { role: 'admin', isActive: false, updatedAt: timestamp },
      });
      await this.db.staffMember.upsert({
        where: { userId },
        create: {
          id: `staff-${userId}`,
          userId,
          role: 'owner',
          isActive: true,
          createdAt: timestamp,
          updatedAt: timestamp,
          appointedBy: null,
        },
        update: { role: 'owner', isActive: true, updatedAt: timestamp },
      });
      return 'owner';
    }
    const role = row?.role?.trim().toLowerCase();
    if (!row?.isActive || !role || !['admin', 'moderator'].includes(role)) return null;
    return role;
  }

  private async touchSession(row: DbSessionRow): Promise<void> {
    const current = Date.now();
    const absolute = Date.parse(row.absoluteExpiresAt || row.expiresAt);
    const nextIdle = new Date(Math.min(current + sessionIdleTtlMs(), absolute)).toISOString();
    if (Date.parse(row.lastSeenAt) + 5 * 60_000 > current && Date.parse(row.idleExpiresAt || row.expiresAt) >= Date.parse(nextIdle)) return;
    await withDatabaseRetry(() => this.db.authSession.update({
      where: { id: row.id },
      data: { lastSeenAt: new Date(current).toISOString(), idleExpiresAt: nextIdle, expiresAt: nextIdle },
    }), 2);
    row.lastSeenAt = new Date(current).toISOString();
    row.idleExpiresAt = nextIdle;
    row.expiresAt = nextIdle;
  }
}

export { hash };
