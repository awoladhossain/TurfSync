import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
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
