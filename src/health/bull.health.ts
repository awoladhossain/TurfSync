import { NOTIFICATION_QUEUE } from '@/queue/queue.constant';
import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import type { Queue } from 'bull';

@Injectable()
export class BullHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @InjectQueue(NOTIFICATION_QUEUE) private readonly notificationQueue: Queue,
  ) {}

  async isHealthy(key: string) {
    const indicator = this.healthIndicatorService.check(key);
    try {
      const client = this.notificationQueue.client;
      if (client.status !== 'ready') {
        return indicator.down({
          message: `Queue client status is ${client.status}`,
        });
      }
      await client.ping();
      return indicator.up();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return indicator.down({ message });
    }
  }
}
