import { Module } from '@nestjs/common';
import { BotsController } from './bots.controller.js';
import { BotsService } from './bots.service.js';
import { TrustModule } from '../trust/trust.module.js';

@Module({
  imports: [TrustModule],
  controllers: [BotsController],
  providers: [BotsService],
  exports: [BotsService]
})
export class BotsModule {}
