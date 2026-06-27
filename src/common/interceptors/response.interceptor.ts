import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { map, Observable } from 'rxjs';

export interface StandardResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  meta?: any;
  timestamp: string;
  requestId: string;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  StandardResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<StandardResponse<T>> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    return next.handle().pipe(
      map((data: T): StandardResponse<T> => {
        let responseData: unknown = data;
        let meta: unknown = undefined;

        if (
          data &&
          typeof data === 'object' &&
          'meta' in data &&
          'data' in data
        ) {
          const obj = data as Record<string, unknown>;
          responseData = obj.data;
          meta = obj.meta;
        }

        const result: StandardResponse<T> = {
          success: true,
          statusCode: res.statusCode,
          message: 'Success',
          data: responseData as T,
          timestamp: new Date().toISOString(),
          requestId: (req['requestId'] as string | undefined) || '',
        };

        if (meta !== undefined) {
          result.meta = meta;
        }

        return result;
      }),
    );
  }
}
