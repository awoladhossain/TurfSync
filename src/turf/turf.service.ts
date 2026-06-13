import { PrismaService } from '@/prisma/prisma.service';
import { RedisLockService } from '@/redis/redis-lock.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { CreateTurfDto } from './dto/create-turf.dto';
import { QueryTurfDto } from './dto/query-turf.dto';

@Injectable()
export class TurfService {
  private readonly logger = new Logger(TurfService.name);
  constructor(
    private prisma: PrismaService,
    private redis: RedisLockService,
  ) {}

  // cron job to generate slots for next 7 days everyday at midnight and delete old slots older than 30 days
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailySlotGeneration() {
    this.logger.log('Starting daily slot generation task');

    // 1. active turfs find out from the db
    const activeTurfs = await this.prisma.turf.findMany({
      where: { isActive: true },
    });

    const today = new Date(); // today date example: 2024-06-01
    today.setUTCHours(0, 0, 0, 0); // set time to 00:00:00 for accurate date comparison

    for (const turf of activeTurfs) {
      // 2. loop over active turfs and generate slots for next 7 days
      for (let i = 0; i < 7; i++) {
        const targetDate = new Date(today); // create a copy of today's date for each iteration example: 2024-06-01
        targetDate.setDate(today.getDate() + i); // add i days to today's date example: 2024-06-01 + 1 => 2024-06-02, 2024-06-01 + 2 => 2024-06-03
        targetDate.setUTCHours(0, 0, 0, 0); // set time to 00:00:00 for accurate date comparison and UTC consistency example: 2024-06-02 00:00:00

        // 3. generate slots for that turf and date
        await this.generateSlotsForDate(turf.id, targetDate);
      }
    }

    // 4. delete slots older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    await this.prisma.slot.deleteMany({
      where: {
        date: {
          lt: thirtyDaysAgo,
        },
      },
    });
    this.logger.log('slot generation and cleanup completed');
  }

  async generateSlotsForDate(turfId: string, date: Date) {
    // 1. find out the turf from the db
    const turf = await this.prisma.turf.findUnique({ where: { id: turfId } });
    if (!turf) return; // turf not found, skip

    // 2. open and close time, get the hours and generate slots for that date
    // example: '09:00' => ['09', '00'] -> parseInt('09') => 9
    let currentHour = parseInt(turf.openTime.split(':')[0]); // cyrrent hour = 9
    const endHour = parseInt(turf.closeTime.split(':')[0]); //end hour = 12

    // 3. create slots by looping from open hour to close hour
    while (currentHour < endHour) {
      // 4. startTime and endtime wise slot creation (padstart with 0 if single digit)
      // example: 9 => '09:00', 10 => '10:00'
      const startTime = `${currentHour.toString().padStart(2, '0')}:00`; // '09:00'
      const endTime = `${(currentHour + 1).toString().padStart(2, '0')}:00`; // '10:00'

      // 5. check if slot already exists for that turf, date and startTime, if not create it (upsert)
      await this.prisma.slot.upsert({
        where: {
          turfId_date_startTime: {
            turfId,
            date,
            startTime,
          },
        }, // unique constraint on turfId + date + startTime
        update: {}, // if exists do nothing
        create: {
          turfId,
          date,
          startTime,
          endTime,
        }, // if not exists create new slot
      });
      currentHour++; // move to next hour example: 9 => 10 => 11
    }
  }

  // create - with duplicate check and cache invalidation
  async create(dto: CreateTurfDto) {
    const existingTurf = await this.prisma.turf.findFirst({
      where: {
        name: dto.name,
        city: dto.city,
      },
    });
    if (existingTurf) {
      throw new ConflictException(
        `A turf with the name "${dto.name}" already exists in ${dto.city}.`,
      );
    }
    const turf = await this.prisma.turf.create({
      data: dto,
    });

    // generate slots for next 7 days for the newly created turf
    const today = new Date(); // get today's date
    today.setUTCHours(0, 0, 0, 0); // set time to 00:00:00 for accurate date comparison and UTC consistency
    for (let i = 0; i < 7; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + i);
      // for this turf generate slots
      await this.generateSlotsForDate(turf.id, targetDate);
    }
    await this.redis.delByPattern(`turf:list:*`);
    return turf;
  }

  // find all - Cache-Aside Pattern
  async findAll(query: QueryTurfDto) {
    const { city, sportType, search, page = 1, limit = 10 } = query;
    // cache key
    const cacheKey = `turf:list:${JSON.stringify(query)}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return cached;
    }
    const skip = (page - 1) * limit;
    const where: Prisma.TurfWhereInput = { isActive: true };

    if (city) {
      where.city = { contains: city, mode: 'insensitive' };
    }
    if (sportType) {
      where.sportType = sportType;
    }
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [turfs, total] = await Promise.all([
      this.prisma.turf.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.turf.count({ where }),
    ]);

    const result = {
      data: turfs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
    await this.redis.set(cacheKey, result, 300); // cache for 5 minutes
    return result;
  }

  // find one by id - Cache-Aside Pattern
  async findOne(id: string) {
    const cacheKey = `turf:${id}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return cached;
    }
    const turf = await this.prisma.turf.findUnique({
      where: { id },
    });
    if (!turf) {
      throw new ConflictException(`Turf with id "${id}" not found.`);
    }
    await this.redis.set(cacheKey, turf, 300); // cache for 5 minutes
    return turf;
  }

  async update(id: string, dto: Partial<CreateTurfDto>) {
    const existingTurf = await this.prisma.turf.findUnique({
      where: { id },
    });
    if (!existingTurf) {
      throw new ConflictException(`Turf with id "${id}" not found.`);
    }
    const turf = await this.prisma.turf.update({
      where: { id },
      data: dto,
    });
    await this.redis.del(`turf:${id}`);
    await this.redis.delByPattern(`turf:list:*`);
    return turf;
  }

  async remove(id: string) {
    const existingTurf = await this.prisma.turf.findUnique({
      where: { id },
    });
    if (!existingTurf) {
      throw new ConflictException(`Turf with id "${id}" not found.`);
    }
    await this.prisma.turf.update({
      where: { id },
      data: { isActive: false },
    });
    await this.redis.del(`turf:${id}`);
    await this.redis.delByPattern(`turf:list:*`);
    return { message: `Turf with id "${id}" has been removed.` };
  }

  // available turfs for a given time range - Cache-Aside Pattern
  async getAvailableSlots(turfId: string, date?: string) {
    let searchDate: Date;
    if (!date) {
      searchDate = new Date();
    } else {
      searchDate = new Date(date);
      if (isNaN(searchDate.getTime())) {
        throw new BadRequestException(
          'Invalid date format. Expected YYYY-MM-DD.',
        );
      }
    }
    searchDate.setUTCHours(0, 0, 0, 0);
    const dateStr = searchDate.toISOString().split('T')[0];
    const cacheKey = `slots:available:${turfId}:${dateStr}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return cached;
    }

    const turf = await this.prisma.turf.findUnique({
      where: { id: turfId },
    });
    if (!turf) {
      throw new ConflictException(`Turf with id "${turfId}" not found.`);
    }
    const slots = await this.prisma.slot.findMany({
      where: {
        turfId,
        date: searchDate,
      },
      orderBy: { startTime: 'asc' },
    });
    const result = { turf, slots, date: dateStr };
    await this.redis.set(cacheKey, result, 60); // cache for 1 minute
    return result;
  }
}
