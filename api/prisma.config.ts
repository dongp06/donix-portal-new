import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma source-of-truth for the Fastify data workspace.
 * The HTTP runtime lives in apps/api-fastify; this file is only for
 * schema/migration tooling.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    path: 'prisma/migrations',
  },
});
