import { Controller, Get, Post, Body } from '@nestjs/common';
import { ProviderService } from './provider.service';

@Controller('provider')
export class ProviderController {
  constructor(private readonly providerService: ProviderService) {}

  @Get('stats')
  getStats() {
    return {
      success: true,
      data: this.providerService.getStats()
    };
  }

  @Get('bots')
  getProviderBots() {
    return {
      success: true,
      data: this.providerService.getProviderBots()
    };
  }

  @Post('payout')
  requestPayout(@Body('amount') amount: number) {
    const res = this.providerService.requestPayout(amount);
    return res;
  }
}
