import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { stripeProvider } from './stripe.provider';
import { BullModule } from '@nestjs/bull';
import { NOTIFICATION_QUEUE } from '@/queue/queue.constant';

@Module({
  imports: [
    BullModule.registerQueue({
      name: NOTIFICATION_QUEUE,
    }),
  ],
  controllers: [PaymentController],
  providers: [PaymentService, stripeProvider],
})
export class PaymentModule {}
