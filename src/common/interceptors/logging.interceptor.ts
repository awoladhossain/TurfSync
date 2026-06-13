import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { catchError, Observable, tap } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const requestId = uuidv4();
    req['requestId'] = requestId;
    res.setHeader('X-Request-Id', requestId);

    const { method, url, ip } = req;
    const userId = (req.user as { id?: string })?.id || 'anonymous';
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;

        this.logger.log({
          requestId,
          method,
          url,
          userId,
          statusCode,
          duration: `${duration}ms`,
          ip,
        });
      }),

      catchError((error: unknown) => {
        const duration = Date.now() - startTime;
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;

        this.logger.error({
          requestId,
          method,
          url,
          duration: `${duration}ms`,
          userId,
          error: errorMessage,
          stack: errorStack,
        });
        throw error;
      }),
    );
  }
}
