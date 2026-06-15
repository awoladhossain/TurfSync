import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: string[] | null = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as { message?: string | string[] };
        if (resp.message) {
          if (Array.isArray(resp.message)) {
            errors = resp.message;
            message = 'Validation failed';
          } else {
            message = resp.message;
          }
        }
      } else if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      }
    } else {
      this.logger.error(
        `Non-HTTP Exception: ${exception instanceof Error ? exception.message : String(exception)}`,
        exception instanceof Error ? exception.stack : '',
      );
    }
    if (
      status === HttpStatus.INTERNAL_SERVER_ERROR &&
      exception instanceof HttpException
    ) {
      this.logger.error(exception);
    }

    //  500 errors - sentry should capture

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error({
        message: 'Internal Server Error',
        error: exception instanceof Error ? exception.stack : String(exception),
        stack: exception instanceof Error ? exception.stack : undefined,
        requestId: request['requestId'] as string | undefined,
        url: request.url,
        method: request.method,
        userId: (request.user as { id?: string | number })?.id,
      });
    }

    //  Sentry capture
    Sentry.withScope((scope) => {
      const requestId = request['requestId'] as string | undefined;
      if (requestId) {
        scope.setTag('requestId', requestId);
      }
      const userId = (request.user as unknown as { id?: string | number })?.id;
      if (userId) {
        scope.setUser({ id: String(userId) });
      }
      scope.setContext('request', {
        method: request.method,
        url: request.url,
        ip: request.ip,
      });
      Sentry.captureException(exception);
    });

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      errors,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
