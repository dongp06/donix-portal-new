import type { BotItem, BotPricing } from '@shared/types';

export function formatMonthlyPrice(value: number): string {
  return `${value.toLocaleString('vi-VN')}đ / tháng`;
}

/** Giá chuẩn dùng trên card, search, sort và compare. */
export function getBotPriceDisplay(pricing: BotPricing): string {
  return pricing.monthlyPrice > 0 ? `Từ ${formatMonthlyPrice(pricing.monthlyPrice)}` : 'Chưa cập nhật giá';
}

export function getBotPriceValue(bot: Pick<BotItem, 'pricing'>): number {
  return bot.pricing.monthlyPrice;
}

export function isPricingStale(pricingUpdatedAt?: string): boolean {
  if (!pricingUpdatedAt) return false;
  const updated = new Date(pricingUpdatedAt).getTime();
  if (!Number.isFinite(updated)) return false;
  return Date.now() - updated > 90 * 86_400_000;
}
