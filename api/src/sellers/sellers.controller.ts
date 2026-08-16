import { Controller, Get, Param } from '@nestjs/common';
import { SellersService } from './sellers.service.js';

@Controller('sellers')
export class SellersController {
  constructor(private readonly sellersService: SellersService) {}

  @Get(':identifier')
  async getProfile(@Param('identifier') identifier: string) {
    return {
      success: true,
      data: await this.sellersService.getProfile(identifier),
    };
  }
}
