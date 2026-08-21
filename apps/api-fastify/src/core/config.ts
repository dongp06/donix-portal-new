import { randomUUID } from 'node:crypto';

export const PROTOCOL_VERSION = 3;
export const REQUEST_SKEW_MS = 90_000;
export const NONCE_TTL_MS = 2 * 60_000;
export const RENEWAL_CHALLENGE_TTL_MS = 30_000;
export const SESSION_IDLE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_ABSOLUTE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const TRANSPORT_VERSION = 4;
/** THB/4 wire algorithm registry: P-256 + HKDF-SHA256 + AES-256-GCM. */
export const TRANSPORT_ALGORITHM = 1 as const;
export const TRANSPORT_CONFIG_PATH = '/api/transport/config';
export const TRANSPORT_ENVELOPE_CONTENT_TYPE = 'application/x-thb';

export function authCookieName(): string {
  return process.env.NODE_ENV === 'production' ? '__Host-x' : 'x';
}

export function oauthStateCookieName(): string {
  return process.env.NODE_ENV === 'production' ? '__Host-y' : 'y';
}

// Kept as import-time aliases for tests and integrations that need the local
// default. Runtime cookie operations use the functions above after dotenv has
// loaded, so production cannot accidentally fall back to a development name.
export const AUTH_COOKIE = authCookieName();
export const OAUTH_STATE_COOKIE = oauthStateCookieName();
export const OAUTH_STATE_TTL_MS = 10 * 60_000;

export function configuredPort(): number {
  const value = Number(process.env.FASTIFY_PORT ?? process.env.API_FASTIFY_PORT ?? 3002);
  return Number.isInteger(value) && value > 0 && value < 65_536 ? value : 3002;
}

export function allowedOrigins(): string[] {
  const configured = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value && value !== '*');
  // Both loopback hostnames are common in local browser sessions. Production
  // must set CORS_ORIGINS explicitly; this fallback is development-only and
  // avoids a misleading Origin/CORS failure when the user opens 127.0.0.1.
  return configured.length > 0 ? configured : ['http://localhost:3000', 'http://127.0.0.1:3000'];
}

/**
 * Only trust forwarded headers from an explicitly configured hop.  The local
 * Next proxy is loopback, so development can use the safe loopback default;
 * production deployments should set TRUSTED_PROXY_IPS to the actual reverse
 * proxy/edge addresses (comma separated).
 */
export function trustedProxy(): false | string[] {
  const configured = (process.env.TRUSTED_PROXY_IPS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (configured.length > 0) return configured;
  return process.env.NODE_ENV === 'production' ? false : ['127.0.0.1', '::1'];
}

/**
 * Browser cookie mutations should carry an explicit Origin in production.
 * Local/native callers and Fastify injection tests intentionally keep the
 * compatibility default off outside production; they still pass the DPoP /
 * device-proof boundary where the route requires it.
 */
export function requireMutationOrigin(): boolean {
  const configured = process.env.TB_REQUIRE_MUTATION_ORIGIN?.trim().toLowerCase();
  if (configured === '1' || configured === 'true' || configured === 'yes') return true;
  if (configured === '0' || configured === 'false' || configured === 'no') return false;
  return process.env.NODE_ENV === 'production';
}

export function assertProductionSecurityConfig(): void {
  if (process.env.NODE_ENV !== 'production') return;
  const required = [
    'CORS_ORIGINS',
    'SECURITY_IP_SALT',
    'THB_TRANSPORT_PRIVATE_JWK',
    'WEBAUTHN_RP_ID',
    'WEBAUTHN_ORIGIN',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URI',
  ];
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Production security configuration is missing: ${missing.join(', ')}`);
  }
}

export function requestIdFrom(value: unknown): string {
  return typeof value === 'string' && /^[A-Za-z0-9._:-]{8,128}$/.test(value)
    ? value
    : randomUUID();
}

export function sessionIdleTtlMs(): number {
  const configured = Number(process.env.TB_SESSION_IDLE_TTL_MS ?? '');
  return Number.isFinite(configured) && configured > 0
    ? Math.max(5 * 60_000, configured)
    : SESSION_IDLE_TTL_MS;
}

export function sessionAbsoluteTtlMs(): number {
  const configured = Number(process.env.TB_SESSION_ABSOLUTE_TTL_MS ?? '');
  return Number.isFinite(configured) && configured > 0
    ? Math.max(60 * 60_000, configured)
    : SESSION_ABSOLUTE_TTL_MS;
}

export function sessionGraceTtlMs(): number {
  const configured = Number(process.env.TB_SESSION_ROTATION_GRACE_MS ?? '');
  return Number.isFinite(configured) && configured >= 1_000
    ? Math.min(configured, 60_000)
    : 8_000;
}

export function accessTokenTtlMs(): number {
  const configured = Number(process.env.TB_ACCESS_TOKEN_TTL_MS ?? 180_000);
  return Math.min(Math.max(Number.isFinite(configured) ? configured : 180_000, 60_000), 300_000);
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: Math.floor(sessionAbsoluteTtlMs() / 1_000),
    path: '/',
  };
}

export function oauthStateCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: Math.floor(OAUTH_STATE_TTL_MS / 1_000),
    path: '/',
  };
}
