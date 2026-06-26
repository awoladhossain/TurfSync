import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { QueueModule } from '@/queue/queue.module';
import { RedisHealthIndicator } from './redis.health';
import { BullHealthIndicator } from './bull.health';

@Module({
  imports: [TerminusModule, QueueModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator, BullHealthIndicator],
})
export class HealthModule {}
