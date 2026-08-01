import { Injectable } from '@nestjs/common';
import { MOCK_PLATFORM_STATS } from '../data/mock-data';
import { PlatformStats } from '../data/types';

@Injectable()
export class StatsService {
  getOverview(): PlatformStats {
    return MOCK_PLATFORM_STATS;
  }
}
