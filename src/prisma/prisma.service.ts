import { MetricsService } from '@/common/metrics/metrics.service';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly pool: Pool;
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly metrics: MetricsService) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('❌ DATABASE_URL is not defined in .env file');
    }

    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    super({ adapter });

    this.pool = pool;

    const extended = this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const startTime = Date.now();
            try {
              return await query(args);
            } finally {
              const durationSeconds = (Date.now() - startTime) / 1000;
              const queryType = model ? `${model}.${operation}` : operation;
              metrics.observeDBQueryDuration(queryType, durationSeconds);
            }
          },
        },
      },
    });

    const extendedWithLifecycle = Object.assign(extended, {
      onModuleInit: (): Promise<void> => this.onModuleInit(),
      onModuleDestroy: (): Promise<void> => this.onModuleDestroy(),
    });

    return extendedWithLifecycle as unknown as PrismaService;
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Database connected successfully via Prisma 7');
    } catch (error) {
      this.logger.error('❌ Connection error:', error);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
