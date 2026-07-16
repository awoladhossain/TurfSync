import { MetricsService } from '@/common/metrics/metrics.service';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisLockService {
  private readonly logger = new Logger(RedisLockService.name);
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  private readonly RELEASE_LOCK_SCRIPT = `
  if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('del', KEYS[1])
  else
    return 0
  end
  `;

  private readonly EXTEND_LOCK_SCRIPT = `
  if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('expire', KEYS[1], ARGV[2])
  else
    return 0
  end
  `;

  async acquireLock(key: string, ttlSeconds = 30): Promise<string | null> {
    // unique value - for per lock its unique, so that only the owner can release it
    const lockValue = uuidv4();

    const result = await this.redis.set(
      `lock:${key}`,
      lockValue,
      'EX',
      ttlSeconds,
      'NX',
    );

    return result === 'OK' ? lockValue : null;
  }

  // Optimistic Locking -
  async releaseLock(key: string, lockValue: string): Promise<boolean> {
    const result = (await this.redis.eval(
      this.RELEASE_LOCK_SCRIPT,
      1, // number of keys
      `lock:${key}`, // KEYS[1]
      lockValue, // ARGV[1]
    )) as number;

    return result === 1;
  }

  async extendLock(
    key: string,
    lockValue: string,
    ttlSeconds = 30,
  ): Promise<boolean> {
    const result = (await this.redis.eval(
      this.EXTEND_LOCK_SCRIPT,
      1,
      `lock:${key}`,
      lockValue,
      ttlSeconds,
    )) as number;

    return result === 1;
  }

  // ─── Cache methods
  /**
   * Sets a cache value. Errors are caught and logged but NOT re-thrown.
   * This is intentional — cache writes are best-effort and should not
   * fail a user-facing request. The application degrades gracefully by
   * reading from the database on the next request.
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);

      if (ttlSeconds) {
        // SETEX = SET with EXpire
        await this.redis.setex(key, ttlSeconds, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
    } catch (error) {
      this.logger.error(`Failed to set cache key ${key}:`, error);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key);
      if (data) {
        this.metrics?.incrementRedisCacheHits(key.split(':')[0]);
      } else {
        this.metrics?.incrementRedisCacheMisses(key.split(':')[0]);
      }
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (error) {
      this.logger.error(`Error parsing JSON for key: ${key}`, error);
      return null;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.error(`Failed to delete cache key ${key}:`, error);
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    try {
      let cursor = '0';

      do {
        // database scan - to find keys matching the pattern
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = nextCursor;

        if (keys.length > 0) {
          const pipeline = this.redis.pipeline();
          pipeline.del(...keys);
          await pipeline.exec();
          this.logger.log(
            `Deleted ${keys.length} keys matching pattern: ${pattern}`,
          );
        }
      } while (cursor !== '0');
    } catch (error) {
      this.logger.error(`Failed to delete keys by pattern ${pattern}:`, error);
    }
  }
}
