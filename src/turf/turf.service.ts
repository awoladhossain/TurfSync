import { PrismaService } from '@/prisma/prisma.service';
import { RedisLockService } from '@/redis/redis-lock.service';
import { Injectable } from '@nestjs/common';
import { CreateTurfDto } from './dto/create-turf.dto';

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
    await this.redis.delByPattern('turfs:list:*');
    return turf;
  }
}
