import { Injectable } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Gauge, Histogram } from 'prom-client';

@Injectable()
export class MetricsService {
  // Http request counter

  constructor(
    @InjectMetric('http_requests_total')
    private readonly httpRequestTotalCounter: Counter<string>,

    @InjectMetric('http_request_duration_seconds')
    private readonly httpRequestDurationSeconds: Histogram<string>,

    @InjectMetric('bookings_total')
    private readonly bookingTotal: Counter<string>,

    @InjectMetric('payments_total')
    private readonly paymentsTotal: Counter<string>,

    @InjectMetric('active_users_gauge')
    private readonly activeUsersGauge: Gauge<string>,

    @InjectMetric('redis_cache_hits_total')
    private readonly redisCacheHits: Counter<string>,

    @InjectMetric('redis_cache_misses_total')
    private readonly redisCacheMisses: Counter<string>,

    @InjectMetric('db_query_duration_seconds')
    private readonly dbQueryDuration: Histogram<string>,
  ) {}

  // Http tracking

  incrementHttpRequest(method: string, route: string, statusCode: number) {
    this.httpRequestTotalCounter.inc({
      method,
      route,
      status_code: statusCode.toString(),
    });
  }

  observeHttpRequestDuration(
    method: string,
    route: string,
    statusCode: number,
    durationSeconds: number,
  ) {
    this.httpRequestDurationSeconds.observe(
      { method, route, status_code: statusCode.toString() },
      durationSeconds,
    );
  }

  // Business metrics

  incrementBookings(status: 'created' | 'cancelled' | 'completed') {
    this.bookingTotal.inc({ status });
  }

  incrementPayments(status: 'success' | 'failed' | 'refunded') {
    this.paymentsTotal.inc({ status });
  }

  // user tracking
  setActiveUsers(count: number) {
    this.activeUsersGauge.set(count);
  }

  // Redis tracking
  incrementRedisCacheHits(key: string) {
    this.redisCacheHits.inc({ cache_key: key });
  }

  incrementRedisCacheMisses(key: string) {
    this.redisCacheMisses.inc({ cache_key: key });
  }

  // Database tracking
  observeDBQueryDuration(queryType: string, durationSeconds: number) {
    this.dbQueryDuration.observe({ query_type: queryType }, durationSeconds);
  }
}
