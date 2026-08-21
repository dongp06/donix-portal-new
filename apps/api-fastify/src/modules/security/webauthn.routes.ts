import type { FastifyInstance } from 'fastify';
import { ok } from '../../core/response.js';
import { SecurityService } from '../../core/security.js';
import { AuthService } from '../../core/auth.js';
import { WebAuthnService } from './webauthn.service.js';
import { successWithSchema, webauthnOptionsSchema, webauthnResponseSchema } from '../../core/route-schemas.js';

const registrationOptionsResponse = successWithSchema(webauthnOptionsSchema);
const authenticationOptionsResponse = successWithSchema({
  type: 'object', additionalProperties: false,
  required: ['options'],
  properties: { action: { type: 'string' }, options: webauthnOptionsSchema },
});
const registrationVerifyResponse = successWithSchema({
  type: 'object', additionalProperties: false, required: ['verified', 'credentialId'], properties: { verified: { type: 'boolean' }, credentialId: { type: 'string' } },
});
const authenticationVerifyResponse = successWithSchema({
  type: 'object', additionalProperties: false, required: ['verified', 'credentialId', 'verifiedAt'], properties: { verified: { type: 'boolean' }, action: { type: 'string' }, credentialId: { type: 'string' }, verifiedAt: { type: 'string' } },
});

const verificationBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['response'],
  properties: {
    handle: { type: 'string', minLength: 40, maxLength: 180 },
    action: { type: 'string', minLength: 1, maxLength: 120 },
    response: webauthnResponseSchema,
  },
} as const;

const optionsQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    action: { type: 'string', maxLength: 120 },
    handle: { type: 'string', minLength: 40, maxLength: 180 },
  },
} as const;

export async function registerWebAuthnRoutes(
  app: FastifyInstance,
  services: { auth: AuthService; security: SecurityService },
): Promise<void> {
  const webauthn = new WebAuthnService(app.db, services.auth, services.security);

  await app.register(async (security) => {
    security.get('/webauthn/registration/options', { schema: { response: { 200: registrationOptionsResponse } } }, async (request) => {
      return ok(await webauthn.registrationOptions(request));
    });

    security.post('/webauthn/registration/verify', { schema: { body: verificationBodySchema, response: { 200: registrationVerifyResponse } } }, async (request) => {
      const body = request.body as { response?: unknown };
      return ok(await webauthn.verifyRegistration(request, body.response));
    });

    security.get<{ Querystring: { action?: string; handle?: string } }>(
      '/webauthn/authentication/options',
      { schema: { querystring: optionsQuerySchema, response: { 200: authenticationOptionsResponse } } },
      async (request) => {
        const action = request.query.handle
          ? await webauthn.actionForServerHandle(request, request.query.handle)
          : request.query.action;
        const result = await webauthn.authenticationOptions(request, action);
        return ok(request.query.handle ? { options: result.options } : result);
      },
    );

    security.post('/webauthn/authentication/verify', { schema: { body: verificationBodySchema, response: { 200: authenticationVerifyResponse } } }, async (request) => {
      const body = request.body as { handle?: string; action?: string; response?: unknown };
      const action = body.handle
        ? await webauthn.actionForServerHandle(request, body.handle)
        : body.action;
      const result = await webauthn.verifyAuthentication(request, action, body.response);
      await services.security.markWebAuthnStepUp(request, result.action);
      return ok(body.handle ? { verified: result.verified, credentialId: result.credentialId, verifiedAt: result.verifiedAt } : result);
    });
  }, { prefix: '/security' });
}
