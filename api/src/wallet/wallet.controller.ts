import { Controller, Get, Post, Body } from '@nestjs/common';
import { WalletService } from './wallet.service';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  getWallet() {
    return {
      success: true,
      data: this.walletService.getWallet()
    };
  }

  @Post('deposit')
  deposit(@Body() body: { amount: number; method: string }) {
    const updatedWallet = this.walletService.deposit(body.amount || 500000, body.method || 'VietQR');
    return {
      success: true,
      data: updatedWallet
    };
  }
}
