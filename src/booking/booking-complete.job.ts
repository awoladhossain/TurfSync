import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BookingStatus } from '@prisma/client';

@Injectable()
export class BookingCompleteJob {
  private readonly logger = new Logger(BookingCompleteJob.name);
  constructor(private prisma: PrismaService) {}

  // Run every 5 minutes to auto-complete confirmed bookings that have ended
  @Cron('0 */5 * * * *')
  async autoCompleteBookings() {
    const now = new Date();

    // Fetch confirmed bookings whose slot date is today or in the past
    const expiredBookings = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.CONFIRMED,
        slot: {
          date: { lte: now },
        },
      },
      include: { slot: true },
    });

    if (expiredBookings.length === 0) return;
    let completedCount = 0;

    for (const booking of expiredBookings) {
      const slotDate = new Date(booking.slot.date);
      const [endHour] = booking.slot.endTime.split(':').map(Number);

      // Since slot date is stored as UTC midnight (00:00:00.000Z),
      // we must set the end hour in UTC to prevent local timezone offsets.
      slotDate.setUTCHours(endHour, 0, 0, 0);

      if (now > slotDate) {
        await this.prisma.booking.update({
          where: { id: booking.id },
          data: { status: BookingStatus.COMPLETED },
        });
        completedCount++;
        this.logger.log(`Auto-completed booking: ${booking.id}`);
      }
    }

    if (completedCount > 0) {
      this.logger.log(
        `Successfully auto-completed ${completedCount} bookings.`,
      );
    }
  }

  // NOTE: The cancelStaleBookings cron has been removed from here because BookingService
  // already contains a highly-optimized bulk 'cleanupStalePendingBookings' cron job
  // running every 5 minutes that invalidates Redis cache and cancels pending bookings
  // older than 15 minutes.
}
