import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.module';

@Injectable()
export class RedisLockService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  // async acquireLock(key: string, ttlSeconds=30): Promise<boolean>{
  //   const result = await this.redis.set()
  // }
}
