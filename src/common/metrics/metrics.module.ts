import { Global, Module } from '@nestjs/common';
import {
  makeCounterProvider,
  makeGaugeProvider,
  makeHistogramProvider,
  PrometheusModule,
} from '@willsoto/nestjs-prometheus';
import { MetricsService } from './metrics.service';

@Global()
@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultLabels: {
        enable: true,
      },
    }),
  ],
  providers: [
    MetricsService,

    // Http metrics
    makeCounterProvider({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
    }),
    makeHistogramProvider({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    }),

    // business metrics
    makeCounterProvider({
      name: 'bookings_total',
      help: 'Total bookings by status',
      labelNames: ['status'],
    }),
    makeCounterProvider({
      name: 'booking_conflicts_total',
      help: 'Total booking conflict attempts or lock failures',
      labelNames: ['reason'],
    }),
    makeCounterProvider({
      name: 'payments_total',
      help: 'Total payments by status',
      labelNames: ['status'],
    }),

    // gauge- up/down
    makeGaugeProvider({
      name: 'active_users_gauge',
      help: 'Currently active users',
    }),
    // Cache metrics
    makeCounterProvider({
      name: 'redis_cache_hits_total',
      help: 'Redis cache hits',
      labelNames: ['cache_key'],
    }),
    makeCounterProvider({
      name: 'redis_cache_misses_total',
      help: 'Redis cache misses',
      labelNames: ['cache_key'],
    }),
    // Database metrics
    makeHistogramProvider({
      name: 'db_query_duration_seconds',
      help: 'Database query duration in seconds',
      labelNames: ['query_type'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
    }),
  ],
  exports: [MetricsService],
})
export class MetricsModule {}
