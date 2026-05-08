import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

const KEY_PREFIX = 'donix:article:';

/**
 * Cache HTML nội dung bài. Dùng Redis khi có REDIS_URL; không thì Map trong RAM (dev).
 */
@Injectable()
export class ArticleCacheService implements OnModuleDestroy {
  private readonly log = new Logger(ArticleCacheService.name);
  private readonly redis: Redis | null;
  private readonly memory = new Map<string, string>();

  constructor() {
    const url = process.env.REDIS_URL?.trim();
    if (url) {
      this.redis = new Redis(url, {
        maxRetriesPerRequest: 2,
        enableReadyCheck: true,
      });
      this.redis.on('error', (err) => {
        this.log.warn(`Redis: ${String(err.message)} — fallback memory cache`);
      });
    } else {
      this.redis = null;
      this.log.log('REDIS_URL unset — article HTML cache in memory only');
    }
  }

  async onModuleDestroy() {
    await this.redis?.quit();
  }

  private key(slug: string) {
    return `${KEY_PREFIX}${slug}`;
  }

  async getHtml(slug: string): Promise<string | null> {
    const k = this.key(slug);
    if (this.redis) {
      try {
        const v = await this.redis.get(k);
        if (v != null) return v;
      } catch {
        /* fallback */
      }
    }
    return this.memory.get(k) ?? null;
  }

  async setHtml(slug: string, html: string, ttlSec = 3600): Promise<void> {
    const k = this.key(slug);
    if (this.redis) {
      try {
        await this.redis.setex(k, ttlSec, html);
        return;
      } catch {
        /* fallback */
      }
    }
    this.memory.set(k, html);
  }

  async deleteHtml(slug: string): Promise<void> {
    const k = this.key(slug);
    this.memory.delete(k);
    if (this.redis) {
      try {
        await this.redis.del(k);
      } catch {
        /* ignore */
      }
    }
  }

  /** Cho /api/health: Redis thật hay chỉ memory. */
  async redisStatus(): Promise<{ enabled: boolean; ping: boolean }> {
    if (!this.redis) {
      return { enabled: false, ping: false };
    }
    try {
      const p = await this.redis.ping();
      return { enabled: true, ping: p === 'PONG' };
    } catch {
      return { enabled: true, ping: false };
    }
  }
}
