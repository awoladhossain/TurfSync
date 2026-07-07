import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SlotService } from './slot/slot.service';

@Injectable()
export class AppService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly slotService: SlotService,
    private readonly configService: ConfigService,
  ) {}

  // app will start
  onApplicationBootstrap() {
    const days = this.configService.get<number>('SLOT_GENERATION_DAYS', 30);

    // Run asynchronously to avoid blocking the NestJS startup sequence and health checks
    setImmediate(() => {
      void (async () => {
        this.logger.log(`🏟️ Generating initial slots for next ${days} days...`);
        try {
          await this.slotService.generateSlotsForNextDays(days);
          this.logger.log('✅ Initial slot generation done');
        } catch (error) {
          this.logger.error(
            `❌ Failed to generate initial slots: ${error instanceof Error ? error.message : String(error)}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      })();
    });
  }
}
