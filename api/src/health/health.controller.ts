import { Controller, Get } from '@nestjs/common';
import { ArticleCacheService } from '../cache/article-cache.service.js';
import { ok } from '../common/api-response.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly articleCache: ArticleCacheService,
  ) {}

  @Get()
  async check() {
    let database = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = true;
    } catch {
      database = false;
    }
    const redis = await this.articleCache.redisStatus();
    return ok({
      status: database ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      database,
      redis,
    });
  }
}
