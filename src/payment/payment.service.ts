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
import { BookingStatus, PaymentStatus } from '@prisma/client';
import type { Queue } from 'bull';
import Stripe from 'stripe';
import { CreatePaymentDto } from './dto/create-payment.dto';
import {
  PAYMENT_FAILED_JOB,
  PAYMENT_SUCCESS_JOB,
  STRIPE_CLIENT,
} from './payment.constant';

type StripePaymentIntent = Awaited<
  ReturnType<Stripe.Stripe['paymentIntents']['retrieve']>
>;

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

    // amount in cents - stripe accepts amount in cents
    const amountInCents = Math.round(Number(booking.totalAmount) * 100);

    // stripe payment intent
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: amountInCents,
      currency: this.configService.get('STRIPE_CURRENCY', 'usd'),
      metadata: {
        bookingId: booking.id,
        userId,
        turfName: booking.turf.name,
        slotTime: `${booking.slot.startTime} - ${booking.slot.endTime}`,
      },
      // automatic payment methods - card, bank transfer, etc
      automatic_payment_methods: {
        enabled: true,
      },
    });
    //  stripe payment save in database
    const payment = await this.prisma.payment.upsert({
      where: { bookingId: dto.bookingId },
      create: {
        bookingId: dto.bookingId,
        amount: booking.totalAmount,
        currency: this.configService.get('STRIPE_CURRENCY', 'usd'),
        stripePaymentIntentId: paymentIntent.id,
        stripeClientSecret: paymentIntent.client_secret,
        status: PaymentStatus.INITIATED,
      },
      update: {
        stripePaymentIntentId: paymentIntent.id,
        stripeClientSecret: paymentIntent.client_secret,
        status: PaymentStatus.INITIATED,
      },
    });

    this.logger.log(
      `PaymentIntent created: ${paymentIntent.id} for booking: ${dto.bookingId}`,
    );
    return {
      clientSecret: paymentIntent.client_secret,
      paymentId: payment.id,
      amount: booking.totalAmount,
    };
  }

  // webhook handler

  async handleWebhook(signature: string, rawBody: Buffer) {
    // Implementation for handling webhook

    let event: ReturnType<Stripe.Stripe['webhooks']['constructEvent']>;

    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.configService.getOrThrow<string>('STRIPE_WEBHOOK_SECRET'),
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(
        `Webhook signature verification failed: ${errorMessage}`,
      );
      throw new BadRequestException('Invalid webhook signature');
    }
    this.logger.log(`Stripe webhook received: ${event.type}`);

    // event type handler
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(
          event.data.object as StripePaymentIntent,
        );
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(
          event.data.object as StripePaymentIntent,
        );
        break;
      case 'payment_intent.processing':
        await this.handlePaymentProcessing(
          event.data.object as StripePaymentIntent,
        );
        break;
      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }
    return { success: true };
  }

  private async handlePaymentSuccess(paymentIntent: StripePaymentIntent) {
    const payment = await this.prisma.payment.findUnique({
      where: {
        stripePaymentIntentId: paymentIntent.id,
      },
      include: {
        booking: {
          include: {
            user: {
              select: { id: true, name: true, email: true, phone: true },
            },
            turf: { select: { name: true, address: true } },
            slot: true,
          },
        },
      },
    });

    if (!payment) {
      this.logger.error(
        `Payment not found for PaymentIntent: ${paymentIntent.id}`,
      );
      return;
    }
    // Idempotency check — already processed
    if (payment.status === PaymentStatus.PAID) {
      this.logger.warn(
        `Duplicate webhook for PaymentIntent: ${paymentIntent.id} — already PAID`,
      );
      return;
    }
    // DB transaction - payment + booking update
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.PAID,
          stripeChargeId: paymentIntent.latest_charge as string,
          paidAt: new Date(),
        },
      });
      await tx.booking.update({
        where: { id: payment.bookingId },
        data: { status: BookingStatus.CONFIRMED },
      });
      this.logger.log(
        `Payment PAID: ${payment.id} | Booking CONFIRMED: ${payment.bookingId}`,
      );

      // background job - sending notification
      try {
        await this.notificationQueue.add(
          PAYMENT_SUCCESS_JOB,
          {
            payment: { id: payment.id, amount: payment.amount },
            booking: payment.booking,
            user: payment.booking.user,
          },
          {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: true,
          },
        );
      } catch (error) {
        this.logger.error(
          `Notification failed for payment ${payment.id}`,
          error,
        );
      }
    });
  }

  // ─── Payment Failed ─────────────────────────────────
  private async handlePaymentFailed(paymentIntent: StripePaymentIntent) {
    const payment = await this.prisma.payment.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (!payment) return;

    const failureReason =
      paymentIntent.last_payment_error?.message || 'Payment failed';

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.FAILED,
        failureReason,
      },
    });

    this.logger.warn(
      `Payment FAILED: ${payment.id} | Reason: ${failureReason}`,
    );

    // User notification
    try {
      await this.notificationQueue.add(
        PAYMENT_FAILED_JOB,
        { paymentId: payment.id, reason: failureReason },
        { attempts: 2 },
      );
    } catch (err) {
      this.logger.error(
        `Failed notification error for payment ${payment.id}`,
        err,
      );
    }
  }

  // ─── Payment Processing ─────────────────────────────
  private async handlePaymentProcessing(paymentIntent: StripePaymentIntent) {
    await this.prisma.payment.updateMany({
      where: { stripePaymentIntentId: paymentIntent.id },
      data: { status: PaymentStatus.PROCESSING },
    });
  }

  // Get Payment Status

  async getPaymentStatus(bookingId: string, userId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: {
        bookingId,
      },
      include: {
        booking: { select: { userId: true } },
      },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.booking.userId !== userId) {
      throw new BadRequestException(
        'You are not authorized to access this payment',
      );
    }
    return {
      status: payment.status,
      amount: payment.amount,
      paidAt: payment.paidAt,
      failureReason: payment.failureReason,
    };
  }
}
