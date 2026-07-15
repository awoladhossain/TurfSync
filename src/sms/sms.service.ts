import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

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
}
