import { Injectable } from '@nestjs/common';
import { MOCK_WALLET } from '../data/mock-data';
import { WalletInfo, WalletTransaction } from '../data/types';

@Injectable()
export class WalletService {
  private wallet: WalletInfo = { ...MOCK_WALLET };

  getWallet(): WalletInfo {
    return this.wallet;
  }

  deposit(amount: number, method: string): WalletInfo {
    const newTx: WalletTransaction = {
      id: `tx-${Date.now()}`,
      type: 'deposit',
      amount,
      description: `Nạp tiền qua phương thức ${method}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      status: 'completed'
    };

    this.wallet.balance += amount;
    this.wallet.transactions.unshift(newTx);
    return this.wallet;
  }
}
