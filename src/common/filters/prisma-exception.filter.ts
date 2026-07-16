import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as Sentry from '@sentry/nestjs';
import { Request, Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Database error';
    const code = exception.code;

    switch (code) {
      case 'P2002': {
        status = HttpStatus.CONFLICT;
        const target = (exception.meta?.target as string[]) || [];
        message = `Unique constraint failed on field: ${target.join(', ')}`;
        break;
      }
      case 'P2025': {
        status = HttpStatus.NOT_FOUND;
        message = (exception.meta?.cause as string) || 'Record not found';
        break;
      }
      case 'P2003': {
        status = HttpStatus.BAD_REQUEST;
        message = `Foreign key constraint failed on field: ${(exception.meta?.field_name as string) || 'unknown'}`;
        break;
      }
      default: {
        this.logger.error(
          `Unhandled Prisma Error (${code}): ${exception.message}`,
          exception.stack,
        );
        message = 'Internal database server error';
        break;
      }
    }

    const requestId = request['requestId'] as string | undefined;

    // Log the error
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error({
        message: 'Internal Server Error (Database)',
        error: exception.message,
        stack: exception.stack,
        requestId,
        url: request.url,
        method: request.method,
      });
      // Sentry capture for 500 database errors
      Sentry.withScope((scope) => {
        if (requestId) scope.setTag('requestId', requestId);
        scope.setContext('request', {
          method: request.method,
          url: request.url,
          ip: request.ip,
        });
        Sentry.captureException(exception);
      });
    } else {
      this.logger.warn({
        message: `Prisma Error [${code}] mapped to HTTP ${status}`,
        detail: message,
        requestId,
        url: request.url,
        method: request.method,
      });
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      errors: null,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
