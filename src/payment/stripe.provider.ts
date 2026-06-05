import { ConfigService } from '@nestjs/config';
import { STRIPE_CLIENT } from './payment.constant';
import Stripe from 'stripe';

export const stripeProvider = {
  provide: STRIPE_CLIENT,
  useFactory: (configService: ConfigService): Stripe.Stripe => {
    return new Stripe(configService.getOrThrow<string>('STRIPE_SECRET_KEY'), {
      apiVersion: '2026-05-27.dahlia',
      typescript: true,
    });
  },
  inject: [ConfigService],
};
