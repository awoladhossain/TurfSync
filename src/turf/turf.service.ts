import { PrismaService } from '@/prisma/prisma.service';
import { RedisLockService } from '@/redis/redis-lock.service';
import { Injectable } from '@nestjs/common';
import { CreateTurfDto } from './dto/create-turf.dto';
import { QueryTurfDto } from './dto/query-turf.dto';

@Injectable()
export class TurfService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisLockService,
  ) {}

  async create(dto: CreateTurfDto) {
    const turf = await this.prisma.turf.create({
      data: dto,
    });
    // Invalidate cache for turf list after creating a new turf to ensure fresh data on next fetch
    await this.redis.delByPattern('turfs:list:*');
    return turf;
  }

  async findAll(query: QueryTurfDto){
    const {city, sportType, search, page=1, limit=10} = query;

    // cache key based on query params
    const cacheKey = `turfs:list:${JSON.stringify(query)}`;
  }
}
