import { PrismaService } from '@/prisma/prisma.service';
import {
  BOOKING_CONFIRMED_JOB,
  NOTIFICATION_QUEUE,
} from '@/queue/queue.constant';
import { RedisLockService } from '@/redis/redis-lock.service';
import { InjectQueue } from '@nestjs/bull';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import type { Queue } from 'bull';
import { CreateBookingDto } from './dto/create-booking.dto';

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisLockService,
    @InjectQueue(NOTIFICATION_QUEUE) private notificationQueue: Queue,
  ) {}

  async create(dto: CreateBookingDto, userId: string) {
    const lockKey = `slot:${dto.slotId}`;

    const lockAcquired = await this.redis.acquireLock(lockKey, 30);
    if (!lockAcquired) {
      throw new ConflictException(
        `Slot ${dto.slotId} is currently being booked by another user. Please try again later.`,
      );
    }
    try {
      const slot = await this.prisma.slot.findUnique({
        where: {
          id: dto.slotId,
        },
        include: { turf: true },
      });
      if (!slot) {
        throw new NotFoundException(`Slot with id ${dto.slotId} not found`);
      }
      if (slot.turfId !== dto.turfId) {
        throw new BadRequestException(
          'Slot does not belong to the specified turf',
        );
      }

      if (slot.isBooked) {
        throw new ConflictException('Slot is already booked');
      }
      // DB transaction atomic operation
      const booking = await this.prisma.$transaction(async (tx) => {
        // slot booked mark
        await tx.slot.update({
          where: { id: dto.slotId },
          data: { isBooked: true },
        });
        // booking create
        return tx.booking.create({
          data: {
            userId,
            turfId: dto.turfId,
            slotId: dto.slotId,
            totalAmount: slot.turf.pricePerHour,
            notes: dto.notes,
            status: BookingStatus.CONFIRMED,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            turf: {
              select: {
                id: true,
                name: true,
                address: true,
              },
            },
            slot: true,
          },
        });
      });

      //  slot availability cache clear
      await this.redis.delByPattern(`slots:available:${dto.turfId}:*`);
      // background job for sending notification
      await this.notificationQueue.add(
        BOOKING_CONFIRMED_JOB,
        {
          booking: {
            id: booking.id,
            date: dto.date,
            startTime: slot.startTime,
          },
          user: booking.user,
          turf: booking.turf,
        },
        {
          attempts: 3,
          backoff: 5000,
          removeOnComplete: true,
        },
      );
      this.logger.log(
        `Booking ${booking.id} created for user ${userId} on slot ${dto.slotId}`,
      );
      return booking;
    } finally {
      await this.redis.releaseLock(lockKey);
    }
  }

  // find my bookings
  async findMyBookings(userId: string) {
    const result = await this.prisma.booking.findMany({
      where: {
        userId,
      },
      include: {
        turf: { select: { id: true, name: true, address: true, city: true } },
        slot: true,
        payment: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return result;
  }

  // find one
  async findOne(id: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        turf: true,
        slot: true,
        user: { select: { id: true, name: true, email: true, phone: true } },
        payment: true,
      },
    });
    if (!booking) {
      throw new NotFoundException(`No booking found`);
    }
    if (booking.userId !== userId) {
      throw new ForbiddenException(
        `You are not authorized to view this booking`,
      );
    }
    return booking;
  }
}
