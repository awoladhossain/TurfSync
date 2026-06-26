import { RequestIdMiddleware } from './request-id.middleware';
import { Request, Response } from 'express';

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      setHeader: jest.fn(),
    };
    nextFunction = jest.fn();
  });

  it('should generate a new requestId if not provided in headers', () => {
    middleware.use(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction,
    );

    const requestId = mockRequest['requestId'] as string;
    expect(requestId).toBeDefined();
    expect(typeof requestId).toBe('string');
    expect(requestId.length).toBeGreaterThan(0);
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'X-Request-Id',
      requestId,
    );
    expect(nextFunction).toHaveBeenCalled();
  });

  it('should reuse the requestId if provided in headers', () => {
    const existingId = 'test-request-id-12345';
    mockRequest.headers = {
      'x-request-id': existingId,
    };

    middleware.use(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction,
    );

    expect(mockRequest['requestId']).toBe(existingId);
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'X-Request-Id',
      existingId,
    );
    expect(nextFunction).toHaveBeenCalled();
  });
});
