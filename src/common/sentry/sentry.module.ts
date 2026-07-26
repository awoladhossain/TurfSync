import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';

@Global()
@Module({
  providers: [
    {
      provide: 'SENTRY',
      useFactory: (configService: ConfigService) => {
        // data source name
        const dsn = configService.get<string>('SENTRY_DSN');

        if (!dsn || dsn === 'yourapp' || !dsn.startsWith('http')) {
          console.warn(
            'SENTRY_DSN not set or invalid — error tracking disabled',
          );
          return null;
        }
        Sentry.init({
          dsn,
          environment: configService.get('NODE_ENV', 'development'),

          tracesSampleRate:
            configService.get('NODE_ENV') === 'production' ? 0.1 : 1.0,

          beforeSend(event) {
            if (event.request?.data) {
              const data = event.request.data as Record<string, unknown> & {
                password?: string;
                cardNumber?: string;
              };
              if (data.password) {
                data.password = '[FILTERED]';
              }
              if (data.cardNumber) {
                data.cardNumber = '[FILTERED]';
              }
            }
            return event;
          },
        });
        return Sentry;
      },
      inject: [ConfigService],
    },
  ],
  exports: ['SENTRY'],
})
export class SentryModule {}
