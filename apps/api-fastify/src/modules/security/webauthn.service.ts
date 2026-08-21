import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { randomUUID } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { AuthService, type AuthSessionContext } from '../../core/auth.js';
import { sessionTokenFromRequest } from '../../core/crypto.js';
import type { Database } from '../../core/database.js';
import { AppError, isUniqueConstraintError } from '../../core/errors.js';
import { SecurityService } from '../../core/security.js';

const CHALLENGE_TTL_MS = 5 * 60_000;

function now(): string {
  return new Date().toISOString();
}

function transports(value: string): AuthenticatorTransportFuture[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is AuthenticatorTransportFuture => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

export class WebAuthnService {
  constructor(
    private readonly db: Database,
    private readonly auth: AuthService,
    private readonly security: SecurityService,
  ) {}

  private async session(request: FastifyRequest): Promise<AuthSessionContext> {
    const token = sessionTokenFromRequest(request);
    const session = token ? await this.auth.resolveSession(token) : null;
    if (!session) throw new AppError('AUTH_REQUIRED', 'Authentication is required.', 401);
    return session;
  }

  private rpId(): string {
    const configured = process.env.WEBAUTHN_RP_ID?.trim();
    if (configured) return configured;
    return new URL(this.expectedOrigin().split(',')[0]!).hostname;
  }

  private expectedOrigin(): string {
    const configured = process.env.WEBAUTHN_ORIGIN?.trim();
    if (configured) return configured;
    return process.env.NODE_ENV === 'production' ? 'https://thuebot.org' : 'http://localhost:3000';
  }

  async registrationOptions(request: FastifyRequest) {
    // Registering a new credential changes the account's future step-up
    // authority. A session cookie alone must not be enough to attach an
    // attacker-controlled passkey after cookie theft.
    await this.security.verifyRequest(request);
    const session = await this.session(request);
    const user = await this.db.user.findUnique({ where: { id: session.userId } });
    if (!user) throw new AppError('USER_NOT_FOUND', 'User not found.', 404);
    const credentials = await this.db.webAuthnCredential.findMany({ where: { userId: session.userId, revokedAt: null } });
    const options = await generateRegistrationOptions({
      rpName: process.env.WEBAUTHN_RP_NAME?.trim() || 'thuebot.org',
      rpID: this.rpId(),
      userName: user.email,
      userID: new TextEncoder().encode(user.id),
      userDisplayName: user.name,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required',
      },
      excludeCredentials: credentials.map((credential) => ({
        id: credential.id,
        transports: transports(credential.transports),
      })),
    });
    await this.db.webAuthnChallenge.create({
      data: {
        id: `webauthn-challenge-${randomUUID()}`,
        userId: session.userId,
        sessionId: session.id,
        action: 'register',
        challenge: options.challenge,
        createdAt: now(),
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
      },
    });
    return options;
  }

  async verifyRegistration(request: FastifyRequest, response: unknown) {
    await this.security.verifyRequest(request);
    const session = await this.session(request);
    if (!response || typeof response !== 'object' || Array.isArray(response)) {
      throw new AppError('WEBAUTHN_REGISTRATION_INVALID', 'WebAuthn registration response is invalid.', 400);
    }
    const challenge = await this.db.webAuthnChallenge.findFirst({
      where: { userId: session.userId, sessionId: session.id, action: 'register', consumedAt: null, expiresAt: { gt: now() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!challenge) throw new AppError('WEBAUTHN_CHALLENGE_EXPIRED', 'WebAuthn registration challenge expired.', 409);

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: response as RegistrationResponseJSON,
        expectedChallenge: challenge.challenge,
        expectedOrigin: this.expectedOrigin().split(',').map((value) => value.trim()),
        expectedRPID: this.rpId(),
        requireUserVerification: true,
      });
    } catch {
      throw new AppError('WEBAUTHN_REGISTRATION_INVALID', 'WebAuthn registration could not be verified.', 400);
    }
    if (!verification.verified) throw new AppError('WEBAUTHN_REGISTRATION_INVALID', 'WebAuthn registration could not be verified.', 400);
    const consumed = await this.db.webAuthnChallenge.updateMany({ where: { id: challenge.id, consumedAt: null }, data: { consumedAt: now() } });
    if (consumed.count !== 1) throw new AppError('WEBAUTHN_CHALLENGE_REPLAYED', 'WebAuthn challenge was already used.', 409);

    const credential = verification.registrationInfo.credential;
    try {
      await this.db.webAuthnCredential.create({
        data: {
          id: credential.id,
          userId: session.userId,
          publicKey: Buffer.from(credential.publicKey).toString('base64url'),
          counter: credential.counter,
          transports: JSON.stringify((response as RegistrationResponseJSON).response.transports ?? []),
          credentialDeviceType: verification.registrationInfo.credentialDeviceType,
          credentialBackedUp: verification.registrationInfo.credentialBackedUp,
          createdAt: now(),
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) throw new AppError('WEBAUTHN_CREDENTIAL_EXISTS', 'This passkey is already registered.', 409);
      throw error;
    }
    return { verified: true, credentialId: credential.id };
  }

  async authenticationOptions(request: FastifyRequest, actionInput?: string) {
    const session = await this.session(request);
    const action = actionInput?.trim() || 'step-up';
    if (action.length > 120 || /[^a-zA-Z0-9._:-]/.test(action)) throw new AppError('WEBAUTHN_ACTION_INVALID', 'WebAuthn action is invalid.', 400);
    const credentials = await this.db.webAuthnCredential.findMany({ where: { userId: session.userId, revokedAt: null } });
    if (!credentials.length) throw new AppError('WEBAUTHN_NOT_REGISTERED', 'Register a passkey before a security step-up.', 404);
    const options = await generateAuthenticationOptions({
      rpID: this.rpId(),
      userVerification: 'required',
      allowCredentials: credentials.map((credential) => ({ id: credential.id, transports: transports(credential.transports) })),
    });
    await this.db.webAuthnChallenge.create({
      data: {
        id: `webauthn-challenge-${randomUUID()}`,
        userId: session.userId,
        sessionId: session.id,
        action,
        challenge: options.challenge,
        createdAt: now(),
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
      },
    });
    return { action, options };
  }

  async verifyAuthentication(request: FastifyRequest, actionInput: string | undefined, response: unknown) {
    const session = await this.session(request);
    const action = actionInput?.trim() || 'step-up';
    if (!response || typeof response !== 'object' || Array.isArray(response) || typeof (response as { id?: unknown }).id !== 'string') {
      throw new AppError('WEBAUTHN_AUTHENTICATION_INVALID', 'WebAuthn assertion is invalid.', 400);
    }
    const challenge = await this.db.webAuthnChallenge.findFirst({
      where: { userId: session.userId, sessionId: session.id, action, consumedAt: null, expiresAt: { gt: now() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!challenge) throw new AppError('WEBAUTHN_CHALLENGE_EXPIRED', 'WebAuthn challenge expired.', 409);
    const credentialId = (response as { id: string }).id;
    const credential = await this.db.webAuthnCredential.findFirst({ where: { id: credentialId, userId: session.userId, revokedAt: null } });
    if (!credential) throw new AppError('WEBAUTHN_CREDENTIAL_INVALID', 'Unknown WebAuthn credential.', 401);

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: response as AuthenticationResponseJSON,
        expectedChallenge: challenge.challenge,
        expectedOrigin: this.expectedOrigin().split(',').map((value) => value.trim()),
        expectedRPID: this.rpId(),
        credential: {
          id: credential.id,
          publicKey: new Uint8Array(Buffer.from(credential.publicKey, 'base64url')),
          counter: credential.counter,
          transports: transports(credential.transports),
        },
        requireUserVerification: true,
      });
    } catch {
      throw new AppError('WEBAUTHN_AUTHENTICATION_INVALID', 'WebAuthn assertion could not be verified.', 400);
    }
    if (!verification.verified) throw new AppError('WEBAUTHN_AUTHENTICATION_INVALID', 'WebAuthn assertion could not be verified.', 401);
    const timestamp = now();
    const consumed = await this.db.webAuthnChallenge.updateMany({ where: { id: challenge.id, consumedAt: null }, data: { consumedAt: timestamp } });
    if (consumed.count !== 1) throw new AppError('WEBAUTHN_CHALLENGE_REPLAYED', 'WebAuthn challenge was already used.', 409);
    const updated = await this.db.webAuthnCredential.updateMany({ where: { id: credential.id, userId: session.userId, revokedAt: null, counter: credential.counter }, data: { counter: verification.authenticationInfo.newCounter, lastUsedAt: timestamp } });
    if (updated.count !== 1) throw new AppError('WEBAUTHN_COUNTER_REPLAYED', 'WebAuthn authenticator counter is stale.', 409);
    return { verified: true, action, credentialId, verifiedAt: timestamp };
  }

  async actionForServerHandle(request: FastifyRequest, token: string): Promise<string> {
    return this.security.actionForServerHandle(request, token);
  }
}
