import type { FastifyReply, FastifyRequest } from 'fastify';
import { authCookieName, cookieOptions, oauthStateCookieName, oauthStateCookieOptions } from './config.js';
import { sessionTokenFromRequest } from './crypto.js';

export function setAuthCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(authCookieName(), token, cookieOptions());
}

export function clearAuthCookies(reply: FastifyReply): void {
  const options = { ...cookieOptions(), maxAge: 0 };
  reply.clearCookie(authCookieName(), options);
}

export function setOAuthStateCookie(reply: FastifyReply, value: string): void {
  reply.setCookie(oauthStateCookieName(), value, oauthStateCookieOptions());
}

export function clearOAuthStateCookie(reply: FastifyReply): void {
  reply.clearCookie(oauthStateCookieName(), { ...oauthStateCookieOptions(), maxAge: 0 });
}

export { sessionTokenFromRequest };

export function hasSessionCookie(request: FastifyRequest): boolean {
  return Boolean(sessionTokenFromRequest(request));
}
