import { MetricsService } from '@/common/metrics/metrics.service';
import { paginate } from '@/common/utils/pagination.util';
import { CouponService } from '@/coupon/coupon.service';
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
import { Cron, CronExpression } from '@nestjs/schedule';
import { BookingStatus, Prisma, Role } from '@prisma/client';
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

interface ValidatedCoupon {
  couponId: string;
  code: string;
  originalAmount: number;
  discount: number;
  finalAmount: number;
}
@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisLockService,
    @InjectQueue(NOTIFICATION_QUEUE) private notificationQueue: Queue,
    private metrics: MetricsService,
    private couponService: CouponService,
  ) {}

  async create(
    dto: CreateBookingDto,
    userId: string,
  ): Promise<BookingWithIncludes> {
    // validation : past date check
    const bookingDate = new Date(dto.date);
    bookingDate.setUTCHours(0, 0, 0, 0);

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    if (bookingDate < today) {
      throw new BadRequestException(`Cannot book for past dates`);
    }

    // validation: max 30 days advance
    const maxDate = new Date(today);
    maxDate.setUTCDate(today.getUTCDate() + 30);

    if (bookingDate > maxDate) {
      throw new BadRequestException(`Cannot book more than 30 days in advance`);
    }

    // coupon
    let couponData: ValidatedCoupon | null = null;
    if (dto.couponCode) {
      const turfData = await this.prisma.turf.findUnique({
        where: { id: dto.turfId },
        select: { pricePerHour: true },
      });
      couponData = await this.couponService.validateAndCalculate(
        dto.couponCode,
        userId,
        Number(turfData?.pricePerHour),
      );
    }

    // redis lock - (lua-backed)
    const lockKey = `slot:${dto.slotId}`;
    const lockValue = await this.redis.acquireLock(lockKey, 30);
    if (!lockValue) {
      this.metrics.incrementBookingConflicts('lock_failure');
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
            FOR UPDATE OF s
          `;

          if (slots.length === 0) {
            throw new NotFoundException(`Slot not found for the given turf`);
          }

          const slot = slots[0];

          if (!slot.isActive) {
            throw new BadRequestException(`Turf is not active for booking`);
          }

          if (slot.isBooked) {
            this.metrics.incrementBookingConflicts('slot_already_booked');
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
            this.metrics.incrementBookingConflicts('user_already_booked');
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
              totalAmount: couponData
                ? couponData.finalAmount
                : slot.pricePerHour,
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

      if (couponData) {
        await this.couponService.applyCoupon(
          couponData.couponId,
          userId,
          confirmedBooking.id,
          couponData.discount,
        );
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
    return paginate(
      this.prisma.booking,
      { page, limit },
      {
        where: { userId },
        include: {
          turf: { select: { id: true, name: true, address: true, city: true } },
          slot: true,
          payment: {
            select: { id: true, status: true, amount: true, paidAt: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    );
  }

  // find one
  async findOne(id: string, userId: string, userRole: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        turf: true,
        slot: true,
        user: { select: { id: true, name: true, email: true, phone: true } },
        payment: {
          select: { id: true, status: true, amount: true, paidAt: true },
        },
      },
    });
    if (!booking) {
      throw new NotFoundException(`No booking found`);
    }
    if (userRole !== Role.ADMIN && booking.userId !== userId) {
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
      const bookings = await tx.$queryRaw<
        { id: string; status: string; slotId: string }[]
      >`
        SELECT id, status, "slotId" FROM bookings WHERE id = ${id} FOR UPDATE
      `;
      const txBooking = bookings[0];
      if (!txBooking) {
        throw new NotFoundException('Booking not found');
      }
      if (txBooking.status === BookingStatus.CANCELLED) {
        throw new BadRequestException('Booking is already cancelled');
      }

      await tx.booking.update({
        where: { id },
        data: { status: BookingStatus.CANCELLED },
      });

      // Lock slot to prevent concurrent mutations
      await tx.$queryRaw`
        SELECT id FROM slots WHERE id = ${txBooking.slotId} FOR UPDATE
      `;

      // Check if there are other active bookings for the slot
      const activeBookings = await tx.booking.findMany({
        where: {
          slotId: txBooking.slotId,
          status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
          id: { not: id },
        },
      });

      if (activeBookings.length === 0) {
        await tx.slot.update({
          where: { id: txBooking.slotId },
          data: { isBooked: false },
        });
      }
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
    return paginate(
      this.prisma.booking,
      { page, limit },
      {
        include: {
          user: { select: { id: true, name: true, phone: true } },
          turf: { select: { id: true, name: true, address: true } },
          slot: true,
          payment: {
            select: { id: true, status: true, amount: true, paidAt: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    );
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async cleanupStalePendingBookings() {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const candidateBookings = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.PENDING,
        createdAt: { lt: fifteenMinutesAgo },
      },
      select: {
        id: true,
        slotId: true,
        turfId: true,
      },
    });

    if (candidateBookings.length === 0) {
      return;
    }

    const candidateIds = candidateBookings.map((b) => b.id);

    const actualCancelled = await this.prisma.$transaction(async (tx) => {
      const staleBookings = await tx.$queryRaw<
        { id: string; slotId: string; turfId: string }[]
      >`
        SELECT id, "slotId", "turfId"
        FROM bookings
        WHERE id = ANY(${candidateIds})
        AND status = 'PENDING'
        FOR UPDATE
      `;

      if (staleBookings.length === 0) {
        return [];
      }

      const staleIds = staleBookings.map((b) => b.id);

      await tx.booking.updateMany({
        where: {
          id: { in: staleIds },
          status: BookingStatus.PENDING,
        },
        data: {
          status: BookingStatus.CANCELLED,
        },
      });

      const slotIds = staleBookings.map((b) => b.slotId);

      // Lock slots to prevent concurrent updates from booking attempts
      await tx.$queryRaw`
        SELECT id FROM slots WHERE id = ANY(${slotIds}) FOR UPDATE
      `;

      // Find if there are other active bookings (PENDING or CONFIRMED) for these slots
      const activeBookings = await tx.booking.findMany({
        where: {
          slotId: { in: slotIds },
          status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
          id: { notIn: staleIds },
        },
        select: {
          slotId: true,
        },
      });

      const slotsWithActiveBookings = new Set(
        activeBookings.map((b) => b.slotId),
      );
      const slotsToRelease = slotIds.filter(
        (id) => !slotsWithActiveBookings.has(id),
      );

      if (slotsToRelease.length > 0) {
        await tx.slot.updateMany({
          where: {
            id: { in: slotsToRelease },
          },
          data: {
            isBooked: false,
          },
        });
      }

      return staleBookings;
    });

    if (actualCancelled.length > 0) {
      const turfIds = Array.from(new Set(actualCancelled.map((b) => b.turfId)));
      for (const turfId of turfIds) {
        await this.redis.delByPattern(`slots:available:${turfId}:*`);
      }

      this.logger.log(
        `🗑️ Cleaned up ${actualCancelled.length} stale PENDING bookings`,
      );
    }
  }
}
