import { PrismaService } from '@/prisma/prisma.service';
import { RedisLockService } from '@/redis/redis-lock.service';
import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateTurfDto } from './dto/create-turf.dto';
import { QueryTurfDto } from './dto/query-turf.dto';

@Injectable()
export class TurfService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisLockService,
  ) {}

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
    await this.redis.delByPattern(`turf:list:*`);
    return turf;
  }

  // find all
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

  // find one by id
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
}
