import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { RentalsService } from './rentals.service';

@Controller('rentals')
export class RentalsController {
  constructor(private readonly rentalsService: RentalsService) {}

  @Get()
  getUserRentals() {
    return {
      success: true,
      data: this.rentalsService.getUserRentals()
    };
  }

  @Post('rent')
  rentBot(
    @Body()
    body: {
      botId: string;
      plan: 'hourly' | 'daily' | 'monthly';
      duration: number;
    }
  ) {
    const rental = this.rentalsService.rentBot(body);
    return {
      success: true,
      data: rental
    };
  }

  @Post(':id/renew')
  renewRental(@Param('id') id: string, @Body() body: { duration: number }) {
    const updated = this.rentalsService.renewRental(id, body.duration || 1);
    return {
      success: true,
      data: updated
    };
  }
}
