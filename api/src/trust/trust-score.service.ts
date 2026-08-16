import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ActiveBotsComponent,
  AccountAgeComponent,
  ProfileComponent,
  ReviewsComponent,
  ScoreComponent,
} from './score-components.js';

export interface ScoreBreakdownItem {
  key: string;
  label: string;
  weight: number;
  value: number;
  score: number;
}

export interface TrustScoreInfo {
  score: number;
  breakdown: ScoreBreakdownItem[];
  updatedAt?: string;
}

@Injectable()
export class TrustScoreService {
  private readonly components: ScoreComponent[];

  constructor(private readonly prisma: PrismaService) {
    this.components = [
      new ReviewsComponent(prisma),
      new AccountAgeComponent(prisma),
      new ProfileComponent(prisma),
      new ActiveBotsComponent(prisma),
    ];
  }

  /** Đăng ký thêm component (sub-project C/D) */
  addComponent(component: ScoreComponent) {
    this.components.push(component);
  }

  async computeAll(userId: string): Promise<TrustScoreInfo> {
    const items = await Promise.all(
      this.components.map(async (c) => {
        const value = await c.compute(userId);
        return {
          key: c.key,
          label: c.label,
          weight: c.weight,
          value,
          score: Math.round(c.weight * value),
        };
      }),
    );
    const totalWeight = items.reduce((s, i) => s + i.weight, 0) || 1;
    const score = Math.min(
      100,
      Math.round((items.reduce((s, i) => s + i.score, 0) / totalWeight) * 100),
    );
    return { score, breakdown: items };
  }

  /** Tính + lưu cache vào User.trustScore */
  async computeForUser(userId: string): Promise<number> {
    const info = await this.computeAll(userId);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        trustScore: info.score,
        trustScoreUpdatedAt: new Date().toISOString(),
      },
    });
    return info.score;
  }
}
