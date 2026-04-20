import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { BOOKING_CONFIRMED_JOB, NOTIFICATION_QUEUE } from '../queue.constant';

@Processor(NOTIFICATION_QUEUE)
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  @Process(BOOKING_CONFIRMED_JOB)
  async handleBookingConfirmed(job: Job) {
    const { booking, user, turf } = job.data;
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
}
