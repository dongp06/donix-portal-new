import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import cookieParser from 'cookie-parser';

/**
 * CORS: chỉ nhận origin trong danh sách CORS_ORIGINS (phân tách bằng dấu phẩy).
 * Mặc định http://localhost:3000 (web chạy local qua Next.js rewrites).
 * Không dùng '*' vì auth dựa trên cookie httpOnly (cần credentials).
 */
function corsOrigin(): string[] | boolean {
  const raw = process.env.CORS_ORIGINS ?? '';
  const origins = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (origins.length === 0) return ['http://localhost:3000'];
  return origins;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3001);

  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: corsOrigin(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key'],
  });

  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`API listening on http://0.0.0.0:${port}/api`);
}
void bootstrap();
