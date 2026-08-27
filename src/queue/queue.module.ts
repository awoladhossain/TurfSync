import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NOTIFICATION_QUEUE } from './queue.constant';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const rawPassword = configService.get<string>('REDIS_PASSWORD');
        const password =
          rawPassword &&
          rawPassword !== 'your-redis-password-here' &&
          rawPassword.trim() !== ''
            ? rawPassword
            : undefined;
        return {
          redis: {
            host: configService.get<string>('REDIS_HOST', 'localhost'),
            port: parseInt(configService.get<string>('REDIS_PORT', '6379'), 10),
            password,
          },
        };
      },
    }),
    BullModule.registerQueue({
      name: NOTIFICATION_QUEUE,
    }),
  ],
  exports: [
    BullModule.registerQueue({
      name: NOTIFICATION_QUEUE,
    }),
  ],
})
export class QueueModule { }
