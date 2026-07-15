import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

interface BookingSmsData {
  id: string;
  date: string;
  time: string;
  price: number | string;
  turf: {
    name: string;
  };
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private client: Twilio | null = null;
  private fromNumber: string;

  constructor(private configService: ConfigService) {
    const accountSid = configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = configService.get<string>('TWILIO_AUTH_TOKEN');
    this.fromNumber = configService.get<string>('TWILIO_FROM_NUMBER') ?? '';

    if (accountSid && authToken) {
      this.client = new Twilio(accountSid, authToken);
      this.logger.log('✅ Twilio SMS service initialized');
    } else {
      this.logger.warn('⚠️ Twilio not configured — SMS will be logged only');
    }
  }

  private formatNumber(phone: string): string {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '88' + cleaned;
    }
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }
    return cleaned;
  }

  // send message
  async send(to: string, message: string): Promise<void> {
    if (!this.client || this.configService.get('NODE_ENV') !== 'production') {
      this.logger.log(`[SMS SIMULATION] To: ${to} | Message: ${message}`);
      return;
    }
    try {
      const formattedNumber = this.formatNumber(to);
      await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: formattedNumber,
      });
      this.logger.log(`✅ SMS sent to ${to}`);
    } catch (err) {
      const error = err as Error;
      this.logger.error(`SMS failed to ${to}: ${error.message}`);
    }
  }

  async sendBookingConfirmation(phone: string, booking: BookingSmsData) {
    await this.send(
      phone,
      `Turf booking confirmed!
      Turf: ${booking.turf.name}
      Date: ${booking.date}
      Time: ${booking.time}
      Total: ${booking.price}
      Booking ID: ${booking.id}
      `,
    );
  }
  async sendPaymentConfirmation(
    phone: string,
    amount: number,
    bookingId: string,
  ) {
    await this.send(
      phone,
      `Payment confirmation!
      Amount: ${amount}
      Booking: ${bookingId.slice(0, 8).toUpperCase()}
      `,
    );
  }
  async sendCancellationSms(phone: string, bookingId: string) {
    await this.send(
      phone,
      `TurfBook: Booking ${bookingId.slice(0, 8).toUpperCase()} cancelled. Refund will be initiated within 3-4 working days.`,
    );
  }
  async sendBookingReminder(phone: string, booking: BookingSmsData) {
    await this.send(
      phone,
      `TurfBook: Your booking for ${booking.turf.name} is scheduled for ${booking.date} at ${booking.time}`,
    );
  }
}
