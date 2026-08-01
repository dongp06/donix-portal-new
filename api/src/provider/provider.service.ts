import { Injectable } from '@nestjs/common';
import { MOCK_PROVIDER_STATS, MOCK_BOTS } from '../data/mock-data';
import { ProviderStats, BotItem } from '../data/types';

@Injectable()
export class ProviderService {
  getStats(): ProviderStats {
    return MOCK_PROVIDER_STATS;
  }

  getProviderBots(providerId: string = 'prov-01'): BotItem[] {
    return MOCK_BOTS.filter((b) => b.provider.id === providerId);
  }

  requestPayout(amount: number) {
    if (amount > MOCK_PROVIDER_STATS.pendingPayout) {
      return { success: false, error: 'Số tiền rút vượt quá số dư khả dụng.' };
    }
    MOCK_PROVIDER_STATS.pendingPayout -= amount;
    return {
      success: true,
      message: `Đã gửi yêu cầu rút ${amount.toLocaleString('vi-VN')} VNĐ thành công.`,
      remainingPending: MOCK_PROVIDER_STATS.pendingPayout
    };
  }
}
