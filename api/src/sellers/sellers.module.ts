import { Module } from '@nestjs/common';
import { SellersController } from './sellers.controller.js';
import { SellersService } from './sellers.service.js';
import { TrustModule } from '../trust/trust.module.js';

@Module({
  imports: [TrustModule],
  controllers: [SellersController],
  providers: [SellersService],
  exports: [SellersService],
})
export class SellersModule {}
