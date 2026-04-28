import { PrismaService } from '@/prisma/prisma.service';
import { NOTIFICATION_QUEUE } from '@/queue/queue.constant';
import { RedisLockService } from '@/redis/redis-lock.service';
import { InjectQueue } from '@nestjs/bull';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
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
          },
        });
      });
    } finally {
      await this.redis.releaseLock(lockKey);
    }
  }
}
