import { NotificationProcessor } from '@/queue/processors/notification.processor';
import { NOTIFICATION_QUEUE } from '@/queue/queue.constant';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { BookingCompleteJob } from './booking-complete.job';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: NOTIFICATION_QUEUE,
    }),
  ],
  controllers: [BookingController],
  providers: [BookingService, NotificationProcessor, BookingCompleteJob],
})
export class BookingModule {}
