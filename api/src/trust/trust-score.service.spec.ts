import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { TrustScoreService } from './trust-score.service.js';

describe('TrustScoreService', () => {
  let service: TrustScoreService;
  const mockPrisma = {
    user: { findUnique: jest.fn<any>(), update: jest.fn<any>() },
    bot: { aggregate: jest.fn<any>(), count: jest.fn<any>() },
    botReview: { aggregate: jest.fn<any>() },
    sellerProfile: { findUnique: jest.fn<any>() },
  };

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        TrustScoreService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = mod.get(TrustScoreService);
  });

  it('tính score từ breakdown components, cap 100', async () => {
    mockPrisma.botReview.aggregate.mockResolvedValue({
      _avg: { rating: 4.8 },
      _count: 10,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      joinedDate: new Date(Date.now() - 200 * 86400000).toISOString(),
    });
    mockPrisma.bot.aggregate.mockResolvedValue({ _count: 2 });
    mockPrisma.bot.count.mockResolvedValue(2);
    mockPrisma.sellerProfile.findUnique.mockResolvedValue({
      profileCompleteness: 90,
    });
    const info = await service.computeAll('u1');
    expect(info.score).toBeGreaterThan(0);
    expect(info.score).toBeLessThanOrEqual(100);
    expect(info.breakdown.length).toBe(4);
    expect(info.breakdown.map((b) => b.key)).toEqual([
      'reviews',
      'account_age',
      'profile',
      'active_bots',
    ]);
  });
});
