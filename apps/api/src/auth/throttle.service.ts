import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';

/** Fixed-window failure counters in Redis (login brute-force guard). */
@Injectable()
export class ThrottleService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async isBlocked(key: string, limit: number): Promise<boolean> {
    return Number((await this.redis.get(key)) ?? 0) >= limit;
  }

  async hit(key: string, windowSec: number): Promise<void> {
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, windowSec);
  }

  async clear(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
