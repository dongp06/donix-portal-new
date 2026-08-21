import type { ActionPermitRecord } from '../core/security.js';
import type { SecurityContext } from '../core/security.js';
import type { TransportContext } from '../core/transport.js';
import type { Database } from '../core/database.js';

declare module 'fastify' {
  interface FastifyRequest {
    transport?: TransportContext;
    multipartUpload?: {
      file: { tempPath: string; filename: string; mimetype: string; sizeBytes: number; sha256: string } | null;
      fields: Record<string, string>;
    };
    security?: SecurityContext;
    capability?: ActionPermitRecord;
    signedPath?: string;
    signedMethod?: string;
    internalPath?: string;
    internalMethod?: string;
  }

  interface FastifyInstance {
    db: Database;
    auth: import('../core/auth.js').AuthService;
    security: import('../core/security.js').SecurityService;
    transport: import('../core/transport.js').TransportService;
  }
}
