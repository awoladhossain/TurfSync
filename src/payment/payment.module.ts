import { NotificationProcessor } from '@/queue/processors/notification.processor';
import { NOTIFICATION_QUEUE } from '@/queue/queue.constant';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { stripeProvider } from './stripe.provider';

@Module({
  imports: [
    BullModule.registerQueue({
      name: NOTIFICATION_QUEUE,
    }),
  ],
  controllers: [PaymentController],
  providers: [PaymentService, stripeProvider, NotificationProcessor],
})
export class PaymentModule {}
