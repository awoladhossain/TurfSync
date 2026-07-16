import { MetricsService } from '@/common/metrics/metrics.service';
import { PrismaService } from '@/prisma/prisma.service';
import { NOTIFICATION_QUEUE } from '@/queue/queue.constant';
import { getQueueToken } from '@nestjs/bull';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { STRIPE_CLIENT } from './payment.constant';
import { PaymentService } from './payment.service';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPrisma = {
  booking: { findUnique: jest.fn(), findMany: jest.fn() },
  payment: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  webhookEvent: { create: jest.fn() },
  slot: { update: jest.fn() },
  $transaction: jest.fn(),
};

const mockStripe = {
  paymentIntents: { create: jest.fn() },
  refunds: { create: jest.fn() },
  webhooks: { constructEvent: jest.fn() },
};

const mockNotificationQueue = { add: jest.fn() };

const mockMetrics = {
  incrementPayments: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue('usd'),
  getOrThrow: jest.fn().mockReturnValue('whsec_test'),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

const makePayment = (overrides = {}) => ({
  id: 'payment-1',
  bookingId: 'booking-1',
  amount: 100,
  status: PaymentStatus.PAID,
  stripePaymentIntentId: 'pi_test_123',
  stripeClientSecret: 'secret_123',
  booking: {
    userId: 'user-1',
    status: BookingStatus.CONFIRMED,
    slot: {
      id: 'slot-1',
      date: futureDate,
      startTime: '18:00',
    },
  },
  ...overrides,
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PaymentService', () => {
  let service: PaymentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: STRIPE_CLIENT, useValue: mockStripe },
        {
          provide: getQueueToken(NOTIFICATION_QUEUE),
          useValue: mockNotificationQueue,
        },
        { provide: MetricsService, useValue: mockMetrics },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    jest.clearAllMocks();
  });

  // ─── createPaymentIntent ──────────────────────────────────────────────────

  describe('createPaymentIntent', () => {
    it('should throw NotFoundException when booking does not exist', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(null);

      await expect(
        service.createPaymentIntent({ bookingId: 'booking-1' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when user is not the booking owner', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        userId: 'user-2', // different user
        totalAmount: 100,
        payment: null,
        turf: { name: 'Turf A' },
        slot: { startTime: '08:00', endTime: '09:00' },
      });

      await expect(
        service.createPaymentIntent({ bookingId: 'booking-1' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when payment is already PAID', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        userId: 'user-1',
        totalAmount: 100,
        payment: { status: PaymentStatus.PAID, stripeClientSecret: 'secret' },
        turf: { name: 'Turf A' },
        slot: { startTime: '08:00', endTime: '09:00' },
      });

      await expect(
        service.createPaymentIntent({ bookingId: 'booking-1' }, 'user-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should return existing client_secret when payment is already INITIATED (idempotent)', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        userId: 'user-1',
        totalAmount: 100,
        payment: {
          id: 'payment-1',
          status: PaymentStatus.INITIATED,
          stripeClientSecret: 'existing_secret',
        },
        turf: { name: 'Turf A' },
        slot: { startTime: '08:00', endTime: '09:00' },
      });

      const result = await service.createPaymentIntent(
        { bookingId: 'booking-1' },
        'user-1',
      );

      expect(result.clientSecret).toBe('existing_secret');
      expect(mockStripe.paymentIntents.create).not.toHaveBeenCalled();
    });

    it('should create a new Stripe PaymentIntent and upsert payment record', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        userId: 'user-1',
        totalAmount: 50,
        payment: null,
        turf: { name: 'Turf A' },
        slot: { startTime: '08:00', endTime: '09:00' },
      });

      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_new_123',
        client_secret: 'new_secret',
      });

      mockPrisma.payment.upsert.mockResolvedValue({
        id: 'payment-new',
        stripePaymentIntentId: 'pi_new_123',
        stripeClientSecret: 'new_secret',
      });

      const result = await service.createPaymentIntent(
        { bookingId: 'booking-1' },
        'user-1',
      );

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 5000 }), // 50 * 100 cents
        expect.objectContaining({
          idempotencyKey: 'payment-intent-booking-1',
        }),
      );
      expect(result.clientSecret).toBe('new_secret');
    });
  });

  // ─── getPaymentStatus ─────────────────────────────────────────────────────

  describe('getPaymentStatus', () => {
    it('should throw NotFoundException when payment does not exist', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      await expect(
        service.getPaymentStatus('booking-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is not the booking owner', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        ...makePayment(),
        booking: { userId: 'user-2' },
      });

      await expect(
        service.getPaymentStatus('booking-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return payment status fields for the booking owner', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        status: PaymentStatus.PAID,
        amount: 100,
        paidAt: new Date(),
        failureReason: null,
        booking: { userId: 'user-1' },
      });

      const result = await service.getPaymentStatus('booking-1', 'user-1');

      expect(result).toHaveProperty('status', PaymentStatus.PAID);
      expect(result).toHaveProperty('amount');
    });
  });

  // ─── refund ───────────────────────────────────────────────────────────────

  describe('refund', () => {
    it('should throw NotFoundException when payment does not exist', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      await expect(service.refund('booking-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when user is not the booking owner', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(
        makePayment({
          booking: {
            userId: 'user-2',
            status: BookingStatus.CONFIRMED,
            slot: { id: 'slot-1', date: futureDate, startTime: '18:00' },
          },
        }),
      );

      await expect(service.refund('booking-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException when payment is not PAID', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(
        makePayment({ status: PaymentStatus.FAILED }),
      );

      await expect(service.refund('booking-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when slot has already started or passed', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(
        makePayment({
          booking: {
            userId: 'user-1',
            status: BookingStatus.CONFIRMED,
            slot: {
              id: 'slot-1',
              date: pastDate, // yesterday
              startTime: '08:00',
            },
          },
        }),
      );

      await expect(service.refund('booking-1', 'user-1')).rejects.toThrow(
        'Cannot refund a booking whose slot has already started or passed',
      );
    });

    it('should NOT refund a slot that starts today but earlier in the day', async () => {
      const todayEarlyHour = new Date();
      todayEarlyHour.setUTCHours(0, 0, 0, 0); // today midnight (the slot "date")
      const earlyStartTime = '01:00'; // 1 AM — already passed

      mockPrisma.payment.findUnique.mockResolvedValue(
        makePayment({
          booking: {
            userId: 'user-1',
            status: BookingStatus.CONFIRMED,
            slot: {
              id: 'slot-1',
              date: todayEarlyHour,
              startTime: earlyStartTime,
            },
          },
        }),
      );

      await expect(service.refund('booking-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should initiate a Stripe refund for a valid future booking', async () => {
      const tomorrowMidnight = new Date();
      tomorrowMidnight.setUTCDate(tomorrowMidnight.getUTCDate() + 1);
      tomorrowMidnight.setUTCHours(0, 0, 0, 0);

      mockPrisma.payment.findUnique.mockResolvedValue(
        makePayment({
          booking: {
            userId: 'user-1',
            status: BookingStatus.CONFIRMED,
            slot: {
              id: 'slot-1',
              date: tomorrowMidnight,
              startTime: '10:00',
            },
          },
        }),
      );

      mockStripe.refunds.create.mockResolvedValue({ id: 'refund-123' });

      // The refund transaction calls: $queryRaw, payment.update, booking.update,
      // booking.findMany (active bookings check), slot.update
      mockPrisma.$transaction.mockImplementation(
        (fn: (tx: any) => Promise<unknown>) =>
          fn({
            $queryRaw: jest.fn().mockResolvedValue([]),
            payment: { update: jest.fn().mockResolvedValue({}) },
            booking: {
              update: jest.fn().mockResolvedValue({}),
              findMany: jest.fn().mockResolvedValue([]), // no other active bookings
            },
            slot: { update: jest.fn().mockResolvedValue({}) },
          }),
      );

      const result = await service.refund('booking-1', 'user-1');

      expect(mockStripe.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_test_123',
      });
      expect(result).toHaveProperty('refundId', 'refund-123');
    });
  });
});
