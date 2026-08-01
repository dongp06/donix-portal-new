import { Module } from '@nestjs/common';
import { CacheModule } from './cache/cache.module';
import { ClientErrorsModule } from './client-errors/client-errors.module';
import { FilesModule } from './files/files.module';
import { HealthModule } from './health/health.module';
import { PostsModule } from './posts/posts.module';
import { PrismaModule } from './prisma/prisma.module';
import { BotsModule } from './bots/bots.module';
import { RentalsModule } from './rentals/rentals.module';
import { ProviderModule } from './provider/provider.module';
import { CommunityModule } from './community/community.module';
import { WalletModule } from './wallet/wallet.module';
import { StatsModule } from './stats/stats.module';

@Module({
  imports: [
    PrismaModule,
    CacheModule,
    HealthModule,
    ClientErrorsModule,
    FilesModule,
    PostsModule,
    BotsModule,
    RentalsModule,
    ProviderModule,
    CommunityModule,
    WalletModule,
    StatsModule,
  ],
})
export class AppModule {}
