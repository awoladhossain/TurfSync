import { PrismaService } from '@/prisma/prisma.service';
import { RedisLockService } from '@/redis/redis-lock.service';
import { SlotService } from '@/slot/slot.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateTurfDto } from './dto/create-turf.dto';
import { QueryTurfDto } from './dto/query-turf.dto';

@Injectable()
export class TurfService {
  private readonly logger = new Logger(TurfService.name);
  constructor(
    private prisma: PrismaService,
    private redis: RedisLockService,
    private slotService: SlotService,
  ) {}

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
    await this.slotService.generateForTurf(turf.id, 6);
    await this.redis.delByPattern(`turf:list:*`);
    return turf;
  }

  // find all - Cache-Aside Pattern
  async findAll(query: QueryTurfDto) {
    const {
      city,
      sportType,
      search,
      minPrice,
      maxPrice,
      availableDate,
      page = 1,
      limit = 10,
    } = query;
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

    // price range filter
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.pricePerHour = {};
      if (minPrice !== undefined) {
        where.pricePerHour.gte = minPrice;
      }
      if (maxPrice !== undefined) {
        where.pricePerHour.lte = maxPrice;
      }
    }

    // available date filter
    if (availableDate) {
      where.slots = {
        some: {
          date: new Date(availableDate),
          isBooked: false,
        },
      };
    }

    const [turfs, total] = await Promise.all([
      this.prisma.turf.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: availableDate
          ? {
              slots: {
                where: {
                  date: new Date(availableDate),
                  isBooked: false,
                },
                select: { id: true, startTime: true, endTime: true },
              },
            }
          : undefined,
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
      throw new NotFoundException(`Turf with id "${id}" not found.`);
    }
    await this.redis.set(cacheKey, turf, 300); // cache for 5 minutes
    return turf;
  }

  async update(id: string, dto: Partial<CreateTurfDto>) {
    const existingTurf = await this.prisma.turf.findUnique({
      where: { id },
    });
    if (!existingTurf) {
      throw new NotFoundException(`Turf with id "${id}" not found.`);
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
      throw new NotFoundException(`Turf with id "${id}" not found.`);
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
      const localToday = new Date();
      searchDate = new Date(
        Date.UTC(
          localToday.getFullYear(),
          localToday.getMonth(),
          localToday.getDate(),
          0,
          0,
          0,
          0,
        ),
      );
    } else {
      searchDate = new Date(date);
      if (isNaN(searchDate.getTime())) {
        throw new BadRequestException(
          'Invalid date format. Expected YYYY-MM-DD.',
        );
      }
      searchDate.setUTCHours(0, 0, 0, 0);
    }
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
      throw new NotFoundException(`Turf with id "${turfId}" not found.`);
    }
    const currentHour = parseInt(turf.openTime.split(':')[0]);
    let endHour = parseInt(turf.closeTime.split(':')[0]);
    if (endHour <= currentHour) {
      endHour += 24;
    }
    const expectedSlotsCount = endHour - currentHour;

    let slots = await this.prisma.slot.findMany({
      where: {
        turfId,
        date: searchDate,
      },
      orderBy: { startTime: 'asc' },
    });

    if (slots.length < expectedSlotsCount) {
      await this.slotService.generateTurfSlots(turf, searchDate);
      slots = await this.prisma.slot.findMany({
        where: {
          turfId,
          date: searchDate,
        },
        orderBy: { startTime: 'asc' },
      });
    }

    const result = { turf, slots, date: dateStr };
    await this.redis.set(cacheKey, result, 60); // cache for 1 minute
    return result;
  }
}
