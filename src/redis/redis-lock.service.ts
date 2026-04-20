import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisLockService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   *
   * @param key
   * @param ttlSeconds
   * @returns
   * Attempts to acquire a lock for the given key with a specified TTL (time-to-live) in seconds.
   * It uses the Redis SET command with NX (set if not exists) and EX (expire) options to ensure that the lock is only acquired if it doesn't already exist and that it expires after the specified time.
   * The method returns true if the lock was successfully acquired, and false otherwise.
   */
  async acquireLock(key: string, ttlSeconds = 30): Promise<boolean> {
    const result = await this.redis.set(
      `lock: ${key}`,
      '1',
      'EX',
      ttlSeconds,
      'NX',
    );
    return result === 'OK';
  }

  /**
   * Releases a lock for the given key.
   * It uses the Redis DEL command to remove the lock from the Redis database.
   * The method returns true if the lock was successfully released, and false otherwise.
   */

  async releaseLock(key: string): Promise<void> {
    await this.redis.del(`lock: ${key}`);
  }

  /**
   * Sets a value in Redis with an optional TTL.
   * @param key
   * @param value
   * @param ttlSeconds
   * @returns
   * The method takes a key, a value, and an optional TTL (time-to-live) in seconds. It serializes the value to a JSON string and stores it in Redis using the SET command. If a TTL is provided, it uses the SETEX command to set the value with an expiration time. If no TTL is provided, it simply sets the value without an expiration.
   * The method returns a Promise that resolves when the value is set in Redis.
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds !== undefined) {
      await this.redis.setex(key, ttlSeconds, serialized);
    } else {
      await this.redis.set(key, serialized);
    }
  }

  /**
   *
   * @param key
   * @returns
   * read a value from Redis for the given key. It retrieves the value using the GET command and parses it from a JSON string back to its original form. If the key does not exist in Redis, it returns null.
   */

  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    if (!data) {
      return null;
    }
    return JSON.parse(data) as T;
  }
  /**
   *
   * @param key
   */
  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  /**
   *
   * @param pattern
   *
   */
  async delByPattern(pattern: string): Promise<void> {
    const key = await this.redis.keys(pattern);
    if (key.length > 0) {
      await this.redis.del(...key);
    }
  }
}
