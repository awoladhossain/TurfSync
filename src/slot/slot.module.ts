import { Module } from '@nestjs/common';
import { SlotController } from './slot.controller';
import { SlotService } from './slot.service';

@Module({
  providers: [SlotService],
  controllers: [SlotController],
  exports: [SlotService],
})
export class SlotModule {}
