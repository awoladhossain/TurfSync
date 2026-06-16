import { MetricsService } from '@/common/metrics/metrics.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BOOKING_CANCELLED_JOB,
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
import { BookingStatus, Prisma } from '@prisma/client';
import type { Queue } from 'bull';
import { CreateBookingDto } from './dto/create-booking.dto';

interface SlotWithTurfDetails {
  id: string;
  turfId: string;
  date: Date;
  startTime: string;
  endTime: string;
  isBooked: boolean;
  pricePerHour: number | Prisma.Decimal;
  isActive: boolean;
  turfName: string;
  turfAddress: string;
}

type BookingWithIncludes = Prisma.BookingGetPayload<{
  include: {
    user: { select: { id: true; name: true; email: true; phone: true } };
    turf: { select: { id: true; name: true; address: true } };
    slot: true;
  };
}>;
@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisLockService,
    @InjectQueue(NOTIFICATION_QUEUE) private notificationQueue: Queue,
    private metrics: MetricsService,
  ) {}

  async create(
    dto: CreateBookingDto,
    userId: string,
  ): Promise<BookingWithIncludes> {
    // validation : past date check
    const bookingDate = new Date(dto.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (bookingDate < today) {
      throw new BadRequestException(`Cannot book for past dates`);
    }

    // validation: max 30 days advance
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);

    if (bookingDate > maxDate) {
      throw new BadRequestException(`Cannot book more than 30 days in advance`);
    }

    // redis lock - (lua-backed)
    const lockKey = `slot:${dto.slotId}`;
    const lockValue = await this.redis.acquireLock(lockKey, 30);
    if (!lockValue) {
      throw new BadRequestException(
        `Slot is currently being booked by another user. Please try again.`,
      );
    }

    // 🛠️ FIX 1: variable type had been declared as BookingWithIncludes | null
    let confirmedBooking: BookingWithIncludes | null = null;

    try {
      // db transaction with pessimistic locking
      confirmedBooking = await this.prisma.$transaction(
        async (tx) => {
          const slots = await tx.$queryRaw<SlotWithTurfDetails[]>`
            SELECT s.*, t."pricePerHour", t."isActive", t.name as "turfName", t.address as "turfAddress"
            FROM slots s
            JOIN turfs t ON s."turfId" = t.id
            WHERE s.id = ${dto.slotId}
            AND s."turfId" = ${dto.turfId}
            FOR UPDATE
          `;

          if (slots.length === 0) {
            throw new NotFoundException(`Slot not found for the given turf`);
          }

          const slot = slots[0];

          if (!slot.isActive) {
            throw new BadRequestException(`Turf is not active for booking`);
          }

          if (slot.isBooked) {
            throw new BadRequestException(`Slot is already booked`);
          }

          const existingBooking = await tx.booking.findFirst({
            where: {
              userId,
              slotId: dto.slotId,
              status: { not: BookingStatus.CANCELLED },
            },
          });

          if (existingBooking) {
            throw new ConflictException(`You have already booked this slot`);
          }

          await tx.slot.update({
            where: { id: dto.slotId },
            data: { isBooked: true },
          });

          return await tx.booking.create({
            data: {
              userId,
              turfId: dto.turfId,
              slotId: dto.slotId,
              totalAmount: slot.pricePerHour,
              notes: dto.notes,
              status: BookingStatus.PENDING,
            },
            include: {
              user: {
                select: { id: true, name: true, email: true, phone: true },
              },
              turf: { select: { id: true, name: true, address: true } },
              slot: true,
            },
          });
        },
        { timeout: 8000 },
      );

      // cache invalidate
      await this.redis.delByPattern(`slots:available:${dto.turfId}:*`);

      // 🛠️ FIX 2: type guard/safety check—ensure confirmedBooking actually has data
      if (!confirmedBooking) {
        throw new BadRequestException('Booking could not be finalized.');
      }

      // notification queue
      try {
        await this.notificationQueue.add(
          BOOKING_CONFIRMED_JOB,
          {
            booking: {
              id: confirmedBooking.id,
              date: dto.date,
              startTime: confirmedBooking.slot.startTime,
            },
            user: confirmedBooking.user,
            turf: confirmedBooking.turf,
          },
          {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: true,
            removeOnFail: false,
          },
        );
      } catch (notifError) {
        this.logger.error(
          `Notification queue failed for booking creation`,
          notifError,
        );
      }

      this.logger.log(
        `Booking created: ${confirmedBooking.id} by user: ${userId}`,
      );
      this.metrics.incrementBookings('created');
      return confirmedBooking;
    } finally {
      await this.redis.releaseLock(lockKey, lockValue);
    }
  }

  // find my bookings
  async findMyBookings(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where: { userId },
        include: {
          turf: { select: { id: true, name: true, address: true, city: true } },
          slot: true,
          payment: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.booking.count({ where: { userId } }),
    ]);
    return {
      data: bookings,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // find one
  async findOne(id: string, userId: string, userRole: string) {
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
    if (userRole !== 'ADMIN' && booking.userId !== userId) {
      throw new ForbiddenException(
        `You are not authorized to view this booking`,
      );
    }
    return booking;
  }

  // cancel booking

  async cancel(id: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { slot: true, user: true },
    });
    if (!booking) {
      throw new NotFoundException(`No booking found`);
    }
    if (booking.userId !== userId) {
      throw new ForbiddenException(
        `You are not authorized to cancel this booking`,
      );
    }
    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException(`Booking is already cancelled`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id },
        data: { status: BookingStatus.CANCELLED },
      });

      await tx.slot.update({
        where: { id: booking.slotId },
        data: { isBooked: false },
      });
    });

    //  cache clear
    await this.redis.delByPattern(`slots:available:${booking.turfId}:*`);

    // cancellation notification job
    try {
      await this.notificationQueue.add(
        BOOKING_CANCELLED_JOB,
        { booking, user: booking.user },
        { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
      );
    } catch (notifError) {
      this.logger.error(
        `Cancel notification failed for booking ${id}`,
        notifError,
      );
    }

    this.metrics.incrementBookings('cancelled');
    return { message: 'Booking cancelled successfully' };
  }

  // admin - find all bookings
  async findAll(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, phone: true } },
          turf: { select: { id: true, name: true, address: true } },
          slot: true,
          payment: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.booking.count(),
    ]);
    return {
      data: bookings,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
