import { PrismaService } from '@/prisma/prisma.service';
import { NOTIFICATION_QUEUE } from '@/queue/queue.constant';
import { InjectQueue } from '@nestjs/bull';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus } from '@prisma/client';
import type { Queue } from 'bull';
import Stripe from 'stripe';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { STRIPE_CLIENT } from './payment.constant';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    @Inject(STRIPE_CLIENT) private stripe: Stripe.Stripe,
    @InjectQueue(NOTIFICATION_QUEUE) private notificationQueue: Queue,
  ) {}

  //  create payment Intent
  async createPaymentIntent(dto: CreatePaymentDto, userId: string) {
    // checking if booking is exist
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      include: {
        turf: { select: { name: true } },
        slot: true,
        payment: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.userId !== userId) {
      throw new BadRequestException(
        'You are not authorized to make payment for this booking',
      );
    }
    if (booking.payment?.status === PaymentStatus.PAID) {
      throw new ConflictException('This booking payment already completed');
    }
    if (
      booking.payment?.status === PaymentStatus.INITIATED &&
      booking.payment?.stripeClientSecret
    ) {
      return {
        clientSecret: booking.payment.stripeClientSecret,
        paymentId: booking.payment.id,
        amount: booking.totalAmount,
      };
    }

    // amount in cents
    const amountInCents = Math.round(Number(booking.totalAmount) * 100);

    // stripe payment intent
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: amountInCents,
      currency: this.configService.get('STRIPE_CURRENCY', 'usd'),
    });
  }
}
