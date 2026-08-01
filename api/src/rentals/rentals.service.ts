import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { MOCK_RENTALS, MOCK_BOTS } from '../data/mock-data';
import { BotRental, RentalPlan } from '../data/types';

@Injectable()
export class RentalsService {
  private rentals: BotRental[] = [...MOCK_RENTALS];

  getUserRentals(renterId: string = 'usr-999'): BotRental[] {
    return this.rentals.filter((r) => r.renterId === renterId);
  }

  getRentalById(id: string): BotRental {
    const rental = this.rentals.find((r) => r.id === id);
    if (!rental) throw new NotFoundException('Không tìm thấy giao dịch thuê bot này.');
    return rental;
  }

  rentBot(params: {
    botId: string;
    plan: RentalPlan;
    duration: number;
    renterId?: string;
    renterName?: string;
  }): BotRental {
    const bot = MOCK_BOTS.find((b) => b.id === params.botId);
    if (!bot) throw new NotFoundException('Bot không tồn tại.');

    const pricePerUnit = bot.pricing[params.plan] || bot.pricing.daily;
    const totalCost = pricePerUnit * params.duration;

    const now = new Date();
    const endDate = new Date(now);
    if (params.plan === 'hourly') {
      endDate.setHours(endDate.getHours() + params.duration);
    } else if (params.plan === 'daily') {
      endDate.setDate(endDate.getDate() + params.duration);
    } else if (params.plan === 'monthly') {
      endDate.setMonth(endDate.getMonth() + params.duration);
    }

    const keyChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let randKey = '';
    for (let i = 0; i < 12; i++) {
      if (i > 0 && i % 4 === 0) randKey += '-';
      randKey += keyChars.charAt(Math.floor(Math.random() * keyChars.length));
    }
    const licenseKey = `DNX-${bot.categorySlug.toUpperCase()}-${randKey}`;

    const newRental: BotRental = {
      id: `rent-${Date.now()}`,
      botId: bot.id,
      botTitle: bot.title,
      botCover: bot.coverImage,
      botCategory: bot.categoryName,
      renterId: params.renterId || 'usr-999',
      renterName: params.renterName || 'Trần Minh Tuấn',
      plan: params.plan,
      duration: params.duration,
      totalCost,
      licenseKey,
      accessUrl: bot.licenseType === 'web_portal' ? `https://portal.donix.vn/instance/${bot.id}` : undefined,
      startDate: now.toISOString().replace('T', ' ').slice(0, 16),
      endDate: endDate.toISOString().replace('T', ' ').slice(0, 16),
      status: 'active',
      autoRenew: false,
      providerId: bot.provider.id,
      providerName: bot.provider.name
    };

    bot.totalRentals += 1;
    bot.activeRentals += 1;
    this.rentals.unshift(newRental);

    return newRental;
  }

  renewRental(id: string, extensionDuration: number): BotRental {
    const rental = this.getRentalById(id);
    const end = new Date(rental.endDate);
    if (rental.plan === 'hourly') {
      end.setHours(end.getHours() + extensionDuration);
    } else if (rental.plan === 'daily') {
      end.setDate(end.getDate() + extensionDuration);
    } else if (rental.plan === 'monthly') {
      end.setMonth(end.getMonth() + extensionDuration);
    }

    rental.endDate = end.toISOString().replace('T', ' ').slice(0, 16);
    rental.status = 'active';
    return rental;
  }
}
