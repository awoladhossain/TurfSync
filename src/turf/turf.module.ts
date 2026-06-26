import { SlotModule } from '@/slot/slot.module';
import { Module } from '@nestjs/common';
import { TurfController } from './turf.controller';
import { TurfService } from './turf.service';

@Module({
  imports: [SlotModule],
  controllers: [TurfController],
  providers: [TurfService],
  exports: [TurfService],
})
export class TurfModule {}
