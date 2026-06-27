import { BullModule } from '@nestjs/bull';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BookingModule } from './booking/booking.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { MetricsModule } from './common/metrics/metrics.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { SentryModule } from './common/sentry/sentry.module';
import { CouponModule } from './coupon/coupon.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { PaymentModule } from './payment/payment.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { RedisModule } from './redis/redis.module';
import { ReviewModule } from './review/review.module';
import { SlotModule } from './slot/slot.module';
import { SmsModule } from './sms/sms.module';
import { TurfModule } from './turf/turf.module';
import { UploadModule } from './upload/upload.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // rate limiter module
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100,
      },
    ]),
    BullModule.forRootAsync({
      useFactory: () => ({
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        },
      }),
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    RedisModule,
    QueueModule,
    TurfModule,
    SlotModule,
    BookingModule,
    HealthModule,
    PaymentModule,
    ReviewModule,
    MetricsModule,
    SentryModule,
    UploadModule,
    MailModule,
    AdminModule,
    CouponModule,
    SmsModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    AppService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
