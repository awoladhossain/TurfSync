import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private mailer: MailerService) {}

  async sendVerificationEmail(email: string, name: string, token: string) {
    const verifyURL = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

    await this.mailer.sendMail({
      to: email,
      subject: 'Verify Your Email',
      template: 'verify-email',
      context: {
        name,
        verifyURL,
      },
    });
    this.logger.log(`Verification email sent to ${email}`);
  }

  async sendPasswordResetEmail(email: string, name: string, token: string) {
    const resetURL = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    await this.mailer.sendMail({
      to: email,
      subject: 'Password Reset',
      template: 'reset-password',
      context: {
        name,
        resetURL,
      },
    });
    this.logger.log(`Password reset email sent to ${email}`);
  }

  async sendBookingConfirmationEmail(
    email: string,
    booking: { id: string; [key: string]: unknown },
  ) {
    await this.mailer.sendMail({
      to: email,
      subject: `TurfBook — Booking Confirmed #${booking.id}`,

      template: 'booking-confirmation',
      context: {
        booking,
      },
    });
  }
}
