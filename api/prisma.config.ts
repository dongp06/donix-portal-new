import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 config — thay thế url trong schema.prisma.
 * DATABASE_URL dạng file: được resolve tương đối theo file này (thư mục api/).
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
});
