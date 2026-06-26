import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { SlotService } from './slot/slot.service';

@Injectable()
export class AppService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AppService.name);
  constructor(private slotService: SlotService) {}

  // app will start
  async onApplicationBootstrap() {
    this.logger.log('🏟️ Generating initial slots...');
    await this.slotService.generateSlotsForNextDays(30);
    this.logger.log('✅ Initial slot generation done');
  }
}
