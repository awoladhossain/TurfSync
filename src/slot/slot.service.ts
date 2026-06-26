import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, Turf } from '@prisma/client';

@Injectable()
export class SlotService {
  private readonly logger = new Logger(SlotService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async generateDailySlots() {
    this.logger.log('🕛 Daily slot generation started...');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    await this.generateSlotsForDate(tomorrow);
    this.logger.log('✅ Daily slot generation complete');
  }

  async generateSlotsForNextDays(days = 7) {
    this.logger.log(`Generating slots for next ${days} days...`);
    for (let i = 0; i <= days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      date.setHours(0, 0, 0, 0);
      await this.generateSlotsForDate(date);
    }

    this.logger.log('✅ Bulk slot generation complete');
  }

  async generateSlotsForDate(date: Date) {
    const turfs = await this.prisma.turf.findMany({
      where: {
        isActive: true,
      },
    });
    if (!turfs.length) {
      this.logger.log('No active turfs found');
      return;
    }
    for (const turf of turfs) {
      await this.generateTurfSlots(turf, date);
    }
  }

  async generateTurfSlots(turf: Turf, date: Date) {
    const openHour = parseInt(turf.openTime.split(':')[0]);
    const closeHour = parseInt(turf.closeTime.split(':')[0]);

    const slotsToCreate: Prisma.SlotCreateManyInput[] = [];

    for (let hour = openHour; hour < closeHour; hour++) {
      const startTime = `${hour.toString().padStart(2, '0')}:00`;
      const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;

      // TODO : upsert the slots

      slotsToCreate.push({
        turfId: turf.id,
        date,
        startTime,
        endTime,
        isBooked: false,
      });
    }
    // createMany + skipDuplicate = already existing slots will be skipped
    await this.prisma.slot.createMany({
      data: slotsToCreate,
      skipDuplicates: true,
    });
  }

  // Admin: specific turf - for manual slot creation
  async generateForTurf(turfId: string, days = 7) {
    const turf = await this.prisma.turf.findUnique({
      where: {
        id: turfId,
      },
    });
    if (!turf) return;

    for (let i = 0; i <= days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      date.setHours(0, 0, 0, 0);
      await this.generateTurfSlots(turf, date);
    }
    return {
      message: `${days} slots generated for turf ${turfId} successfully`,
    };
  }

  //  expired slots cleanup - for 30 days
  @Cron(CronExpression.EVERY_WEEK)
  async cleanupOldSlots() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { count } = await this.prisma.slot.deleteMany({
      where: {
        date: {
          lt: thirtyDaysAgo,
        },
        isBooked: false,
      },
    });
    this.logger.log(`🗑️ Cleaned up ${count} old slots`);
  }
}
