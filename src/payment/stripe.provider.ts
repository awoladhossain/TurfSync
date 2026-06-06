import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { STRIPE_CLIENT } from './payment.constant';
import { Provider } from '@nestjs/common';

export const stripeProvider: Provider = {
  provide: STRIPE_CLIENT,
  useFactory: (configService: ConfigService) => {
    return new Stripe(configService.getOrThrow<string>('STRIPE_SECRET_KEY'), {
      apiVersion: '2026-04-22.dahlia' as never,
      typescript: true,
    });
  },
  inject: [ConfigService],
};
