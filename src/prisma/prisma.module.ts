import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { MetricsModule } from '@/common/metrics/metrics.module';

@Global()
@Module({
  imports: [MetricsModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
