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
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);

    await this.generateSlotsForDate(tomorrow);
    this.logger.log('✅ Daily slot generation complete');
  }

  async generateSlotsForNextDays(days = 7) {
    this.logger.log(`Generating slots for next ${days} days...`);
    const turfs = await this.prisma.turf.findMany({
      where: {
        isActive: true,
      },
    });
    if (!turfs.length) {
      this.logger.log('No active turfs found');
      return;
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setUTCDate(today.getUTCDate() + i);
      for (const turf of turfs) {
        await this.generateTurfSlots(turf, date);
      }
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
    let currentHour = parseInt(turf.openTime.split(':')[0]);
    let endHour = parseInt(turf.closeTime.split(':')[0]);

    // Adjust endHour if it is midnight or past midnight (e.g. closeTime <= openTime)
    if (endHour <= currentHour) {
      endHour += 24;
    }

    const slotsToCreate: Prisma.SlotCreateManyInput[] = [];

    while (currentHour < endHour) {
      const startHourNormalized = currentHour % 24;
      const endHourNormalized = (currentHour + 1) % 24;

      const startTime = `${startHourNormalized.toString().padStart(2, '0')}:00`;
      const endTime = `${endHourNormalized.toString().padStart(2, '0')}:00`;

      // If the hour is >= 24, the slot actually falls on the next calendar day
      const slotDate = new Date(date);
      if (currentHour >= 24) {
        slotDate.setUTCDate(slotDate.getUTCDate() + 1);
      }

      slotsToCreate.push({
        turfId: turf.id,
        date: slotDate,
        startTime,
        endTime,
        isBooked: false,
      });

      currentHour++;
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

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setUTCDate(today.getUTCDate() + i);
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
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
    thirtyDaysAgo.setUTCHours(0, 0, 0, 0);

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
