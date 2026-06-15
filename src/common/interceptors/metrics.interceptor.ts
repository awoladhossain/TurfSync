import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { catchError, Observable, tap, throwError } from 'rxjs';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const startTime = process.hrtime.bigint();

    const method = req.method; // Get, Post, Put, Delete, etc
    const route = (req.route as { path?: string } | undefined)?.path || req.url;

    return next.handle().pipe(
      tap(() => {
        const duration = Number(process.hrtime.bigint() - startTime) / 1e9; // convert nanoseconds to seconds
        const statusCode = res.statusCode; // ex: 200, 404, 500, etc

        this.metricsService.incrementHttpRequest(method, route, statusCode);
        this.metricsService.observeHttpRequestDuration(
          method,
          route,
          statusCode,
          duration,
        );
      }),

      catchError((error: unknown) => {
        const duration = Number(process.hrtime.bigint() - startTime) / 1e9;
        const statusCode = res.statusCode;

        this.metricsService.incrementHttpRequest(method, route, statusCode);
        this.metricsService.observeHttpRequestDuration(
          method,
          route,
          statusCode,
          duration,
        );
        return throwError(() => error);
      }),
    );
  }
}
