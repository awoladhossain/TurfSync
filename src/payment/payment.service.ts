import { MetricsService } from '@/common/metrics/metrics.service';
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
import { BookingStatus, PaymentStatus, Prisma } from '@prisma/client';
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
    private metrics: MetricsService,
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
    const paymentIntent = await this.stripe.paymentIntents.create(
      {
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
      },
      {
        idempotencyKey: `payment-intent-${booking.id}`,
      },
    );
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
    this.logger.log(`Stripe webhook received: ${event.type} | ID: ${event.id}`);

    // event type handler
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(
            event.id,
            event.data.object as StripePaymentIntent,
          );
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(
            event.id,
            event.data.object as StripePaymentIntent,
          );
          break;
        case 'payment_intent.processing':
          await this.handlePaymentProcessing(
            event.id,
            event.data.object as StripePaymentIntent,
          );
          break;
        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
      }
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        this.logger.warn(
          `Stripe webhook event ${event.id} already processed or processing concurrently. Skipping.`,
        );
        return { success: true };
      }
      throw err;
    }
    return { success: true };
  }

  private async handlePaymentSuccess(
    eventId: string,
    paymentIntent: StripePaymentIntent,
  ) {
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
      // Register webhook event to guarantee database-level idempotency
      await tx.webhookEvent.create({
        data: { id: eventId },
      });

      // Lock the booking to prevent concurrent status updates (e.g. stale cleanup)
      const bookings = await tx.$queryRaw<{ id: string; status: string }[]>`
        SELECT id, status FROM bookings WHERE id = ${payment.bookingId} FOR UPDATE
      `;
      const txBooking = bookings[0];
      if (!txBooking) {
        throw new NotFoundException('Booking not found');
      }
      if (txBooking.status !== BookingStatus.PENDING) {
        this.logger.warn(
          `Booking ${payment.bookingId} is no longer PENDING (status: ${txBooking.status}). Marking payment as PAID but keeping booking CANCELLED.`,
        );
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.PAID,
            stripeChargeId: paymentIntent.latest_charge as string,
            paidAt: new Date(),
          },
        });
        return;
      }

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
    this.metrics.incrementPayments('success');
  }

  // ─── Payment Failed ─────────────────────────────────
  private async handlePaymentFailed(
    eventId: string,
    paymentIntent: StripePaymentIntent,
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
      include: {
        booking: {
          include: {
            user: {
              select: { id: true, name: true, email: true, phone: true },
            },
          },
        },
      },
    });

    if (!payment) return;

    const failureReason =
      paymentIntent.last_payment_error?.message || 'Payment failed';

    await this.prisma.$transaction(async (tx) => {
      // Register webhook event to guarantee database-level idempotency
      await tx.webhookEvent.create({
        data: { id: eventId },
      });

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          failureReason,
        },
      });
    });

    this.logger.warn(
      `Payment FAILED: ${payment.id} | Reason: ${failureReason}`,
    );

    // User notification
    try {
      await this.notificationQueue.add(
        PAYMENT_FAILED_JOB,
        {
          paymentId: payment.id,
          reason: failureReason,
          user: payment.booking.user,
          booking: payment.booking,
        },
        { attempts: 2 },
      );
    } catch (err) {
      this.logger.error(
        `Failed notification error for payment ${payment.id}`,
        err,
      );
    }
    this.metrics.incrementPayments('failed');
  }

  // ─── Payment Processing ─────────────────────────────
  private async handlePaymentProcessing(
    eventId: string,
    paymentIntent: StripePaymentIntent,
  ) {
    await this.prisma.$transaction(async (tx) => {
      // Register webhook event to guarantee database-level idempotency
      await tx.webhookEvent.create({
        data: { id: eventId },
      });

      await tx.payment.updateMany({
        where: { stripePaymentIntentId: paymentIntent.id },
        data: { status: PaymentStatus.PROCESSING },
      });
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

  // Refund Booking

  async refund(bookingId: string, userId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { bookingId },
      include: {
        booking: { select: { userId: true, status: true, slot: true } },
      },
    });

    // Validation
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.booking.userId !== userId) {
      throw new BadRequestException(
        'You are not authorized to refund this booking',
      );
    }

    if (payment.status !== PaymentStatus.PAID) {
      throw new BadRequestException('Payment must be paid to be refunded');
    }
    if (payment.booking.slot.date <= new Date()) {
      throw new BadRequestException(
        'Booking must be in the future to be refunded',
      );
    }
    // refund logic
    const refund = await this.stripe.refunds.create({
      payment_intent: payment.stripePaymentIntentId,
    });

    // update database

    // 1. payment table status changed from paid to refund
    await this.prisma.$transaction(async (tx) => {
      // Lock the booking to prevent concurrent status updates
      await tx.$queryRaw`
        SELECT id FROM bookings WHERE id = ${bookingId} FOR UPDATE
      `;

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.REFUNDED,
        },
      });

      // 2. booking table status changed from confirmed to cancelled
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CANCELLED,
        },
      });
      // 3. slot table status changed from booked to unbooked (only if no other active booking)
      const activeBookings = await tx.booking.findMany({
        where: {
          slotId: payment.booking.slot.id,
          status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
          id: { not: bookingId },
        },
      });

      if (activeBookings.length === 0) {
        await tx.slot.update({
          where: { id: payment.booking.slot.id },
          data: { isBooked: false },
        });
      }
    });

    this.logger.log(`Booking refunded: ${bookingId} | Refund ID: ${refund.id}`);
    this.metrics.incrementPayments('refunded');
    return {
      message: 'Booking refunded successfully',
      refundId: refund.id,
      amount: payment.amount,
      bookingId: bookingId,
    };
  }
}
