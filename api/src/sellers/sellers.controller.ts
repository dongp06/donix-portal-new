import { Controller, Get, Param } from '@nestjs/common';
import { SellersService } from './sellers.service.js';

@Controller('sellers')
export class SellersController {
  constructor(private readonly sellersService: SellersService) {}

  @Get(':id')
  async getProfile(@Param('id') id: string) {
    return {
      success: true,
      data: await this.sellersService.getProfile(id),
    };
  }
}
