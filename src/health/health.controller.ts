import { PrismaService } from '@/prisma/prisma.service';
import { REDIS_CLIENT } from '@/redis/redis.constants';
import { Controller, Get, Inject } from '@nestjs/common';
import Redis from 'ioredis';

@Controller('health')
export class HealthController {
  constructor(
    private prisma: PrismaService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  @Get()
  async check() {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
    ]);
    const db = checks[0];
    const redis = checks[1];

    const isHealthy = db.status === 'fulfilled' && redis.status === 'fulfilled';

    return {
      status: isHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: db.status === 'fulfilled' ? 'up' : 'down',
        redis: redis.status === 'fulfilled' ? 'up' : 'down',
      },
    };
  }

  private async checkDatabase() {
    await this.prisma.$queryRaw`SELECT 1`;
  }

  private async checkRedis() {
    await this.redis.ping();
  }
}
