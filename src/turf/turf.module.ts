import { Module } from '@nestjs/common';
import { TurfController } from './turf.controller';
import { TurfService } from './turf.service';

@Module({
  controllers: [TurfController],
  providers: [TurfService],
  exports: [TurfService],
})
export class TurfModule {}
