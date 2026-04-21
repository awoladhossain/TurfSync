import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import {
  BOOKING_CANCELLED_JOB,
  BOOKING_CONFIRMED_JOB,
  NOTIFICATION_QUEUE,
} from '../queue.constant';

interface User {
  id: string;
  phone: string;
}

interface Turf {
  id: string;
  name: string;
}

interface Booking {
  id: string;
  date?: string;
  startTime?: string;
}

interface BookingConfirmedData {
  booking: Booking;
  user: User;
  turf: Turf;
}

interface BookingCancelledData {
  booking: Booking;
  user: User;
}

@Processor(NOTIFICATION_QUEUE)
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  @Process(BOOKING_CONFIRMED_JOB)
  async handleBookingConfirmed(job: Job) {
    const data = job.data as BookingConfirmedData;
    const { booking, user, turf } = data;
    this.logger.log(
      `Sending booking confirmation notification for booking ID: ${booking?.id}, user ID: ${user?.id}, turf ID: ${turf?.id}`,
    );

    await this.simulateSMS(
      user.phone,
      `TurfSync: Your booking is confirmed!` +
        `${turf?.name}-${booking?.date} at ${booking?.startTime}` +
        `Booking ID: ${booking?.id}`,
    );
    this.logger.log(`SMS sent to ${user.phone}`);
  }

  @Process(BOOKING_CANCELLED_JOB)
  async handleBookingCancelled(job: Job) {
    const data = job.data as BookingCancelledData;
    const { booking, user } = data;
    this.logger.log(`Sending cancellation SMS for booking ${booking.id}`);
    await this.simulateSMS(
      user.phone,
      `TurfSync: Your booking with ID ${booking.id} has been cancelled. If you have any questions, please contact support.`,
    );
    this.logger.log(`Cancellation SMS sent to ${user.phone}`);
  }
  private async simulateSMS(phone: string, message: string): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.logger.log(`[SMS] To: ${phone} | Message: ${message}`);
        resolve();
      }, 1000);
    });
  }
}
