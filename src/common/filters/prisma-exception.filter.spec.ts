import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { PrismaExceptionFilter } from './prisma-exception.filter';

interface ErrorResponse {
  success: boolean;
  statusCode: number;
  message: string;
  timestamp: string;
  path: string;
  reason: string;
}

describe('PrismaExceptionFilter', () => {
  let filter: PrismaExceptionFilter;
  let mockArgumentsHost: Partial<ArgumentsHost>;
  let mockResponse: Partial<Response>;
  let mockRequest: Partial<Request>;

  beforeEach(() => {
    filter = new PrismaExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockRequest = {
      url: '/test-url',
      method: 'GET',
      ip: '127.0.0.1',
    };
    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse as Response,
        getRequest: () => mockRequest as Request,
      }),
    };
  });

  function getResponsePayload(): ErrorResponse {
    const jsonMock = mockResponse.json as jest.Mock;
    const calls = jsonMock.mock.calls as unknown[][];
    return calls[0][0] as ErrorResponse;
  }

  it('should map P2002 to HttpStatus.CONFLICT', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: '1.0',
        meta: { target: ['email'] },
      },
    );

    filter.catch(error, mockArgumentsHost as ArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockResponse.json).toHaveBeenCalled();

    const responsePayload = getResponsePayload();
    expect(responsePayload.success).toBe(false);
    expect(responsePayload.statusCode).toBe(HttpStatus.CONFLICT);
    expect(responsePayload.message).toContain(
      'Unique constraint failed on field: email',
    );
  });

  it('should map P2025 to HttpStatus.NOT_FOUND', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '1.0',
      meta: { cause: 'User not found' },
    });

    filter.catch(error, mockArgumentsHost as ArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.json).toHaveBeenCalled();

    const responsePayload = getResponsePayload();
    expect(responsePayload.success).toBe(false);
    expect(responsePayload.statusCode).toBe(HttpStatus.NOT_FOUND);
    expect(responsePayload.message).toBe('User not found');
  });

  it('should map P2003 to HttpStatus.BAD_REQUEST', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Foreign key constraint failed',
      {
        code: 'P2003',
        clientVersion: '1.0',
        meta: { field_name: 'slotId' },
      },
    );

    filter.catch(error, mockArgumentsHost as ArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalled();

    const responsePayload = getResponsePayload();
    expect(responsePayload.success).toBe(false);
    expect(responsePayload.statusCode).toBe(HttpStatus.BAD_REQUEST);
    expect(responsePayload.message).toContain(
      'Foreign key constraint failed on field: slotId',
    );
  });

  it('should fallback to 500 for other Prisma codes', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Unknown database error',
      {
        code: 'P9999',
        clientVersion: '1.0',
      },
    );

    filter.catch(error, mockArgumentsHost as ArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(mockResponse.json).toHaveBeenCalled();

    const responsePayload = getResponsePayload();
    expect(responsePayload.success).toBe(false);
    expect(responsePayload.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(responsePayload.message).toBe('Internal database server error');
  });
});
