import { Module } from '@nestjs/common';
import { CacheModule } from './cache/cache.module.js';
import { ClientErrorsModule } from './client-errors/client-errors.module.js';
import { FilesModule } from './files/files.module.js';
import { HealthModule } from './health/health.module.js';
import { PostsModule } from './posts/posts.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BotsModule } from './bots/bots.module.js';
import { CommunityModule } from './community/community.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CacheModule,
    HealthModule,
    ClientErrorsModule,
    FilesModule,
    PostsModule,
    BotsModule,
    CommunityModule,
  ],
})
export class AppModule {}
