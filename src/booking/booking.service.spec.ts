jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}));

import { NOTIFICATION_QUEUE } from '@/queue/queue.constant';
import { getQueueToken } from '@nestjs/bull';
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { RedisLockService } from '../redis/redis-lock.service';
import { BookingService } from './booking.service';

const mockPrismaService = {
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
  booking: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  },
  slot: { update: jest.fn() },
};

const mockRedisLockService = {
  acquireLock: jest.fn(),
  releaseLock: jest.fn(),
  delByPattern: jest.fn(),
};

const mockQueue = {
  add: jest.fn(),
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
      // Lock could not be acquired
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

      // Interactive transaction mock: execute the callback with the mocked client
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
});
