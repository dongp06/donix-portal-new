import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TrustService } from './trust.service.js';

@Injectable()
export class TrustCron {
  private readonly logger = new Logger(TrustCron.name);

  constructor(private readonly trust: TrustService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async dailyTrustMaintenance() {
    const expired = await this.trust.expireOverdue();
    const recomputed = await this.trust.recomputeAll();
    this.logger.log(
      `Trust maintenance: ${expired} expired, ${recomputed} recomputed`,
    );
  }
}
