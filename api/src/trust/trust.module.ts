import { Module } from '@nestjs/common';
import { TrustScoreService } from './trust-score.service.js';
import { TrustService } from './trust.service.js';

@Module({
  providers: [TrustScoreService, TrustService],
  exports: [TrustScoreService, TrustService],
})
export class TrustModule {}
