import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SlotController } from './slot.controller';
import { SlotService } from './slot.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [SlotService],
  controllers: [SlotController],
  exports: [SlotService],
})
export class SlotModule {}
