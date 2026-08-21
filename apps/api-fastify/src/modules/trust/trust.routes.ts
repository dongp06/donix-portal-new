import type { FastifyInstance, FastifyRequest } from 'fastify';
import { AuthService } from '../../core/auth.js';
import { sessionTokenFromRequest } from '../../core/crypto.js';
import { AppError } from '../../core/errors.js';
import { ok } from '../../core/response.js';
import { TrustService } from './trust.service.js';
import { successWithSchema, trustSummarySchema } from '../../core/route-schemas.js';

const summaryResponse = successWithSchema(trustSummarySchema);

export async function registerTrustRoutes(app: FastifyInstance, services: { auth: AuthService; trust: TrustService }): Promise<void> {
  const currentSeller = async (request: FastifyRequest) => {
    const token = sessionTokenFromRequest(request);
    const resolved = token ? await services.auth.resolveSessionUser(token) : null;
    if (!resolved) throw new AppError('SESSION_INVALID', 'Login session is invalid.', 401);
    return resolved.session.userId;
  };

  const read = async (request: FastifyRequest) => {
    const userId = await currentSeller(request);
    await services.trust.recompute(userId);
    return ok(await services.trust.getSummary(userId));
  };
  app.get('/sellers/me/trust-status', { schema: { response: { 200: summaryResponse } } }, read);
  app.get('/sellers/me/verification', { schema: { response: { 200: summaryResponse } } }, read);
}
