import { Module } from '@nestjs/common';
import { CacheModule } from './cache/cache.module';
import { ClientErrorsModule } from './client-errors/client-errors.module';
import { FilesModule } from './files/files.module';
import { HealthModule } from './health/health.module';
import { PostsModule } from './posts/posts.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    CacheModule,
    HealthModule,
    ClientErrorsModule,
    FilesModule,
    PostsModule,
  ],
})
export class AppModule {}
