jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}));

import { NOTIFICATION_QUEUE } from '@/queue/queue.constant';
import { getQueueToken } from '@nestjs/bull';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { RedisLockService } from '../redis/redis-lock.service';
import { MetricsService } from '../common/metrics/metrics.service';
import { CouponService } from '@/coupon/coupon.service';
import { BookingService } from './booking.service';

const mockCouponService = {
  validateAndCalculate: jest.fn(),
  applyCoupon: jest.fn(),
};

const mockPrismaService = {
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
  booking: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  slot: { update: jest.fn(), updateMany: jest.fn() },
};

const mockRedisLockService = {
  acquireLock: jest.fn(),
  releaseLock: jest.fn(),
  delByPattern: jest.fn(),
};

const mockQueue = {
  add: jest.fn(),
};

const mockMetricsService = {
  incrementBookings: jest.fn(),
  incrementBookingConflicts: jest.fn(),
};

describe('BookingService', () => {
  let service: BookingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisLockService, useValue: mockRedisLockService },
        { provide: getQueueToken(NOTIFICATION_QUEUE), useValue: mockQueue },
        { provide: MetricsService, useValue: mockMetricsService },
        { provide: CouponService, useValue: mockCouponService },
      ],
    }).compile();

    service = module.get<BookingService>(BookingService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    const userId = 'user-1';
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const createBookingDto = {
      turfId: 'turf-1',
      slotId: 'slot-1',
      date: tomorrowStr,
    };

    it('should throw BadRequestException for past date', async () => {
      await expect(
        service.create({ ...createBookingDto, date: '2020-01-01' }, userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when lock not acquired', async () => {
      mockRedisLockService.acquireLock.mockResolvedValue(null);

      await expect(service.create(createBookingDto, userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create booking successfully', async () => {
      mockRedisLockService.acquireLock.mockResolvedValue('lock-uuid');

      const mockBooking = {
        id: 'booking-1',
        userId,
        turfId: 'turf-1',
        slotId: 'slot-1',
        totalAmount: 1500,
        status: 'CONFIRMED',
        user: { id: userId, name: 'Rahim', email: 'r@t.com', phone: '017' },
        turf: { id: 'turf-1', name: 'Green Field', address: 'Mirpur' },
        slot: { startTime: '09:00', endTime: '10:00' },
      };

      mockPrismaService.$transaction.mockImplementation(
        (callback: (client: typeof mockPrismaService) => unknown) => {
          mockPrismaService.$queryRaw.mockResolvedValue([
            {
              id: 'slot-1',
              turfId: 'turf-1',
              isBooked: false,
              isActive: true,
              pricePerHour: 1500,
            },
          ]);
          mockPrismaService.booking.findFirst.mockResolvedValue(null);
          mockPrismaService.booking.create.mockResolvedValue(mockBooking);
          return callback(mockPrismaService);
        },
      );

      mockRedisLockService.delByPattern.mockResolvedValue(undefined);
      mockQueue.add.mockResolvedValue({});

      const result = await service.create(createBookingDto, userId);

      expect(result).toHaveProperty('id', 'booking-1');
      expect(mockRedisLockService.releaseLock).toHaveBeenCalledWith(
        'slot:slot-1',
        'lock-uuid',
      );
    });
  });

  describe('cancel', () => {
    it('should throw NotFoundException if booking not found', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue(null);
      await expect(service.cancel('booking-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user is not authorized', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        userId: 'user-2',
        status: 'PENDING',
      });
      await expect(service.cancel('booking-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should cancel booking successfully and release slot if no other active bookings', async () => {
      const mockBooking = {
        id: 'booking-1',
        userId: 'user-1',
        status: 'PENDING',
        slotId: 'slot-1',
        turfId: 'turf-1',
        slot: { id: 'slot-1' },
        user: { id: 'user-1' },
      };
      mockPrismaService.booking.findUnique.mockResolvedValue(mockBooking);
      mockPrismaService.$transaction.mockImplementation(
        (cb: (client: typeof mockPrismaService) => unknown) => {
          mockPrismaService.$queryRaw
            .mockResolvedValueOnce([mockBooking]) // booking lock
            .mockResolvedValueOnce([]); // slot lock
          mockPrismaService.booking.findMany.mockResolvedValueOnce([]); // active check
          return cb(mockPrismaService);
        },
      );

      const result = await service.cancel('booking-1', 'user-1');
      expect(result).toEqual({ message: 'Booking cancelled successfully' });
      expect(mockPrismaService.slot.update).toHaveBeenCalledWith({
        where: { id: 'slot-1' },
        data: { isBooked: false },
      });
    });
  });

  describe('cleanupStalePendingBookings', () => {
    it('should do nothing if no stale bookings exist', async () => {
      mockPrismaService.booking.findMany.mockResolvedValue([]);
      await service.cleanupStalePendingBookings();
      expect(mockPrismaService.booking.findMany).toHaveBeenCalled();
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should cancel stale bookings and release slots in a transaction', async () => {
      const mockStaleBookings = [
        { id: 'booking-1', slotId: 'slot-1', turfId: 'turf-1' },
        { id: 'booking-2', slotId: 'slot-2', turfId: 'turf-2' },
      ];
      mockPrismaService.booking.findMany.mockResolvedValue(mockStaleBookings);
      mockPrismaService.$transaction.mockImplementation(
        (cb: (client: typeof mockPrismaService) => unknown) => {
          mockPrismaService.$queryRaw
            .mockResolvedValueOnce(mockStaleBookings)
            .mockResolvedValueOnce([]);
          mockPrismaService.booking.findMany.mockResolvedValueOnce([]);
          return cb(mockPrismaService);
        },
      );

      await service.cleanupStalePendingBookings();

      expect(mockPrismaService.booking.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['booking-1', 'booking-2'] }, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      expect(mockPrismaService.slot.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['slot-1', 'slot-2'] } },
        data: { isBooked: false },
      });
      expect(mockRedisLockService.delByPattern).toHaveBeenCalledWith(
        'slots:available:turf-1:*',
      );
      expect(mockRedisLockService.delByPattern).toHaveBeenCalledWith(
        'slots:available:turf-2:*',
      );
    });

    it('should cancel stale bookings but NOT release slots if they have other active bookings', async () => {
      const mockStaleBookings = [
        { id: 'booking-1', slotId: 'slot-1', turfId: 'turf-1' },
      ];
      mockPrismaService.booking.findMany.mockResolvedValueOnce(
        mockStaleBookings,
      );

      mockPrismaService.$transaction.mockImplementation(
        (cb: (client: typeof mockPrismaService) => unknown) => {
          mockPrismaService.$queryRaw
            .mockResolvedValueOnce(mockStaleBookings)
            .mockResolvedValueOnce([]);
          mockPrismaService.booking.findMany.mockResolvedValueOnce([
            { slotId: 'slot-1' },
          ]);
          return cb(mockPrismaService);
        },
      );

      await service.cleanupStalePendingBookings();

      expect(mockPrismaService.booking.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['booking-1'] }, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      expect(mockPrismaService.slot.updateMany).not.toHaveBeenCalled();
    });
  });
});
