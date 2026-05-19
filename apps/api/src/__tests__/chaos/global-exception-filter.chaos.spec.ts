import { HttpStatus, HttpException } from '@nestjs/common';

import { PrismaClientKnownRequestError, PrismaClientValidationError } from '@db';

import { ProviderException, SecurityException } from '../../core/exceptions/domain-exceptions';
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
    headers: {} as Record<string, any>,
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

describe('Global Exception Filter Chaos Tests', () => {
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

  describe('TimeoutError handling', () => {
    it('maps TimeoutError to 504 GATEWAY_TIMEOUT', () => {
      const error = new TimeoutError('Operation timed out', 'provider_sync', 30000);
      const host = createMockHost();
      filter.catch(error, host as any);

      expect(host.response.status).toHaveBeenCalledWith(HttpStatus.GATEWAY_TIMEOUT);
      const body = host.response.send.mock.calls[0][0];
      expect(body.error.retryable).toBe(true);
      expect(body.error.details?.operationName).toBe('provider_sync');
      expect(body.error.details?.timeoutMs).toBe(30000);
    });
  });

  describe('Network error handling', () => {
    it.each([
      ['ECONNRESET', HttpStatus.BAD_GATEWAY],
      ['ECONNREFUSED', HttpStatus.BAD_GATEWAY],
      ['ETIMEDOUT', HttpStatus.BAD_GATEWAY],
    ])('%s → %i', (code, expectedStatus) => {
      const error = new Error(`connect ${code}`);
      (error as any).code = code;
      const host = createMockHost();
      filter.catch(error, host as any);

      expect(host.response.status).toHaveBeenCalledWith(expectedStatus);
    });
  });

  describe('Sensitive data sanitization', () => {
    it('redacts passwords from error messages', () => {
      const error = new Error('Connection failed password="s3cret" at host');
      const host = createMockHost();
      filter.catch(error, host as any);

      const body = host.response.send.mock.calls[0][0];
      expect(body.error.message).not.toContain('s3cret');
      expect(body.error.message).toContain('[REDACTED]');
    });

    it('redacts bearer tokens', () => {
      const error = new Error('Failed with bearer eyJhbGciOiJIUzI1NiJ9.test');
      const host = createMockHost();
      filter.catch(error, host as any);

      const body = host.response.send.mock.calls[0][0];
      expect(body.error.message).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    });

    it('redacts api keys', () => {
      const error = new Error('Request with api_key="sk-1234abcd" failed');
      const host = createMockHost();
      filter.catch(error, host as any);

      const body = host.response.send.mock.calls[0][0];
      expect(body.error.message).not.toContain('sk-1234abcd');
    });

    it('sanitizes authorization headers', () => {
      const host = createMockHost();
      host.request.headers = {
        authorization: 'Bearer secret-token',
        cookie: 'session=abc123',
        'x-api-key': 'key-456',
        'content-type': 'application/json',
      };

      const error = new Error('Server error');
      filter.catch(error, host as any);

      // Sentry context should not contain sensitive headers
      const requestContext = mockSentry.setContext.mock.calls.find((c: any) => c[0] === 'request');
      if (requestContext) {
        const headers = requestContext[1].headers;
        expect(headers.authorization).toBeUndefined();
        expect(headers.cookie).toBeUndefined();
        expect(headers['x-api-key']).toBeUndefined();
        expect(headers['content-type']).toBe('application/json');
      }
    });
  });

  describe('Sentry capture rules', () => {
    it('captures 5xx errors in Sentry', () => {
      const error = new Error('Internal failure');
      const host = createMockHost();
      filter.catch(error, host as any);

      expect(mockSentry.captureException).toHaveBeenCalled();
    });

    it('does NOT capture 4xx errors', () => {
      const error = new HttpException('Not found', HttpStatus.NOT_FOUND);
      const host = createMockHost();
      filter.catch(error, host as any);

      expect(mockSentry.captureException).not.toHaveBeenCalled();
    });

    it('captures domain exceptions with context', () => {
      const error = ProviderException.unavailable('plaid');
      const host = createMockHost();
      filter.catch(error, host as any);

      expect(mockSentry.setContext).toHaveBeenCalledWith(
        'domainException',
        expect.objectContaining({
          exceptionType: 'ProviderException',
          retryable: true,
        })
      );
    });
  });

  describe('Domain exception handling', () => {
    it('maps ProviderException with correct status', () => {
      const error = ProviderException.timeout('plaid', 'syncTransactions');
      const host = createMockHost();
      filter.catch(error, host as any);

      expect(host.response.status).toHaveBeenCalledWith(HttpStatus.GATEWAY_TIMEOUT);
      const body = host.response.send.mock.calls[0][0];
      expect(body.error.retryable).toBe(true);
    });

    it('maps SecurityException correctly', () => {
      const error = SecurityException.tokenExpired();
      const host = createMockHost();
      filter.catch(error, host as any);

      expect(host.response.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    });
  });

  describe('Response format consistency', () => {
    it('always includes required meta fields', () => {
      const error = new Error('Any error');
      const host = createMockHost('/api/test', 'POST');
      filter.catch(error, host as any);

      const body = host.response.send.mock.calls[0][0];
      expect(body.success).toBe(false);
      expect(body.error.code).toBeDefined();
      expect(body.error.message).toBeDefined();
      expect(body.meta.timestamp).toBeDefined();
      expect(body.meta.path).toBe('/api/test');
      expect(body.meta.method).toBe('POST');
    });

    it('handles non-Error exceptions', () => {
      const host = createMockHost();
      filter.catch('string error', host as any);

      expect(host.response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      const body = host.response.send.mock.calls[0][0];
      expect(body.success).toBe(false);
    });
  });
});
