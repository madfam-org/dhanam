import { HttpStatus } from '@nestjs/common';

import {
  PrismaClientKnownRequestError,
  PrismaClientRustPanicError,
  PrismaClientInitializationError,
} from '@db';

import { GlobalExceptionFilter } from '../../core/filters/global-exception.filter';
import { TimeoutError } from '../../core/utils/timeout.util';

function createMockHost(url = '/test', method = 'GET') {
  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
  };
  const mockRequest = {
    url,
    method,
    headers: {},
    ip: '127.0.0.1',
    query: {},
    params: {},
  };
  return {
    switchToHttp: () => ({
      getResponse: () => mockResponse,
      getRequest: () => mockRequest,
    }),
    response: mockResponse,
    request: mockRequest,
  };
}

describe('Database Failure Chaos Tests', () => {
  let filter: GlobalExceptionFilter;
  let mockSentry: any;

  beforeEach(() => {
    mockSentry = {
      setUser: jest.fn(),
      setContext: jest.fn(),
      setTags: jest.fn(),
      captureException: jest.fn(),
      captureMessage: jest.fn(),
    };
    filter = new GlobalExceptionFilter(mockSentry);
  });

  describe('Prisma error mapping', () => {
    it('P2028 pool exhaustion → 503, retryable', () => {
      const error = new PrismaClientKnownRequestError('Pool exhausted', {
        code: 'P2028',
        clientVersion: '6.1.0',
      });

      const host = createMockHost();
      filter.catch(error, host as any);

      expect(host.response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      const body = host.response.send.mock.calls[0][0];
      expect(body.error.retryable).toBe(true);
    });

    it('P2024 transaction timeout → 504, retryable', () => {
      const error = new PrismaClientKnownRequestError('Transaction timeout', {
        code: 'P2024',
        clientVersion: '6.1.0',
      });

      const host = createMockHost();
      filter.catch(error, host as any);

      expect(host.response.status).toHaveBeenCalledWith(HttpStatus.GATEWAY_TIMEOUT);
      const body = host.response.send.mock.calls[0][0];
      expect(body.error.retryable).toBe(true);
    });

    it('P2034 write conflict → 409, retryable', () => {
      const error = new PrismaClientKnownRequestError('Write conflict', {
        code: 'P2034',
        clientVersion: '6.1.0',
      });

      const host = createMockHost();
      filter.catch(error, host as any);

      expect(host.response.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      const body = host.response.send.mock.calls[0][0];
      expect(body.error.retryable).toBe(true);
    });

    it('P2002 unique constraint → 409, non-retryable', () => {
      const error = new PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '6.1.0',
        meta: { target: ['email'] },
      });

      const host = createMockHost();
      filter.catch(error, host as any);

      expect(host.response.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      const body = host.response.send.mock.calls[0][0];
      expect(body.error.retryable).toBeUndefined(); // false gets filtered to undefined
    });
  });

  describe('Prisma engine errors', () => {
    it('engine panic → 500, retryable', () => {
      const error = new PrismaClientRustPanicError('Engine panic', '6.1.0');

      const host = createMockHost();
      filter.catch(error, host as any);

      expect(host.response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      const body = host.response.send.mock.calls[0][0];
      expect(body.error.retryable).toBe(true);
    });

    it('initialization error → 503, retryable', () => {
      const error = new PrismaClientInitializationError('Connection refused', '6.1.0');

      const host = createMockHost();
      filter.catch(error, host as any);

      expect(host.response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      const body = host.response.send.mock.calls[0][0];
      expect(body.error.retryable).toBe(true);
    });
  });

  describe('Sentry integration', () => {
    it('captures 5xx errors in Sentry', () => {
      const error = new PrismaClientRustPanicError('Panic', '6.1.0');
      const host = createMockHost();
      filter.catch(error, host as any);

      expect(mockSentry.captureException).toHaveBeenCalledWith(error);
    });

    it('does NOT capture 4xx errors in Sentry', () => {
      const error = new PrismaClientKnownRequestError('Not found', {
        code: 'P2025',
        clientVersion: '6.1.0',
      });
      const host = createMockHost();
      filter.catch(error, host as any);

      expect(mockSentry.captureException).not.toHaveBeenCalled();
    });
  });

  describe('Error sanitization', () => {
    it('sanitizes sensitive data in error messages', () => {
      const error = new Error('Failed with password="secret123" and api_key="abc"');
      const host = createMockHost();
      filter.catch(error, host as any);

      const body = host.response.send.mock.calls[0][0];
      expect(body.error.message).not.toContain('secret123');
      expect(body.error.message).not.toContain('abc');
      expect(body.error.message).toContain('[REDACTED]');
    });
  });

  describe('Network error classification', () => {
    it('ECONNRESET → 502 BAD_GATEWAY', () => {
      const error = new Error('ECONNRESET');
      (error as any).code = 'ECONNRESET';
      const host = createMockHost();
      filter.catch(error, host as any);

      expect(host.response.status).toHaveBeenCalledWith(HttpStatus.BAD_GATEWAY);
    });

    it('TimeoutError → 504', () => {
      const error = new TimeoutError('Timed out', 'test', 5000);
      const host = createMockHost();
      filter.catch(error, host as any);

      expect(host.response.status).toHaveBeenCalledWith(HttpStatus.GATEWAY_TIMEOUT);
      const body = host.response.send.mock.calls[0][0];
      expect(body.error.retryable).toBe(true);
    });
  });
});
