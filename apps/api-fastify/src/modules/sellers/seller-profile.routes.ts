import type { FastifyInstance } from 'fastify';
import { sessionTokenFromRequest } from '../../core/crypto.js';
import { AppError } from '../../core/errors.js';
import { ok } from '../../core/response.js';
import { AuthService } from '../../core/auth.js';
import { SellerProfileService } from './seller-profile.service.js';
import { sellerProfileSchema, successWithSchema } from '../../core/route-schemas.js';

const successSchema = successWithSchema(sellerProfileSchema);

export async function registerSellerProfileRoutes(app: FastifyInstance, services: { auth: AuthService; profiles: SellerProfileService }): Promise<void> {
  app.get('/sellers/me/profile', { schema: { response: { 200: successSchema } } }, async (request) => {
    const token = sessionTokenFromRequest(request);
    const resolved = token ? await services.auth.resolveSessionUser(token) : null;
    if (!resolved) throw new AppError('SESSION_INVALID', 'Login session is invalid.', 401);
    return ok(await services.profiles.getProfile(resolved.session.userId));
  });
}
