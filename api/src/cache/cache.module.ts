import { Global, Module } from '@nestjs/common';
import { ArticleCacheService } from './article-cache.service.js';

@Global()
@Module({
  providers: [ArticleCacheService],
  exports: [ArticleCacheService],
})
export class CacheModule {}
