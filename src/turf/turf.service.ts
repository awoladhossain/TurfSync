import { PrismaService } from '@/prisma/prisma.service';
import { RedisLockService } from '@/redis/redis-lock.service';
import { ConflictException, Injectable } from '@nestjs/common';
import { CreateTurfDto } from './dto/create-turf.dto';

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
}
