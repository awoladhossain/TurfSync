import { NOTIFICATION_QUEUE } from '@/queue/queue.constant';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: NOTIFICATION_QUEUE,
    }),
  ],
  controllers: [BookingController],
  providers: [BookingService],
})
export class BookingModule {}
