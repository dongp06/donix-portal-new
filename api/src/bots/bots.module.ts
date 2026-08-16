import { Module } from '@nestjs/common';
import { BotsController } from './bots.controller.js';
import { BotsService } from './bots.service.js';

@Module({
  controllers: [BotsController],
  providers: [BotsService],
  exports: [BotsService]
})
export class BotsModule {}
