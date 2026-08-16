import { Module } from '@nestjs/common';
import { TrustScoreService } from './trust-score.service.js';
import { TrustService } from './trust.service.js';
import { TrustCron } from './trust.cron.js';
import { TrustController } from './trust.controller.js';
import { AdminVerificationsController } from './admin-verifications.controller.js';

@Module({
  controllers: [TrustController, AdminVerificationsController],
  providers: [TrustScoreService, TrustService, TrustCron],
  exports: [TrustScoreService, TrustService],
})
export class TrustModule {}
