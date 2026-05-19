import {
  HttpException,
  HttpStatus,
  ArgumentsHost,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
  ConflictException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FastifyReply, FastifyRequest } from 'fastify';

import type { SentryService } from '@core/monitoring/sentry.service';
import { PrismaClientKnownRequestError } from '@db';

import { GlobalExceptionFilter, ErrorResponse } from '../global-exception.filter';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockSentryService: jest.Mocked<SentryService>;
  let mockResponse: Partial<FastifyReply>;
  let mockRequest: Partial<FastifyRequest>;
  let mockHost: ArgumentsHost;

  beforeEach(async () => {
    mockSentryService = {
      setUser: jest.fn(),
      setContext: jest.fn(),
      setTags: jest.fn(),
      captureException: jest.fn(),
      captureMessage: jest.fn(),
    } as any;

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      url: '/test/endpoint',
      method: 'POST',
      headers: {
        'user-agent': 'test-agent',
        authorization: 'Bearer secret-token',
        cookie: 'session=secret',
        'x-api-key': 'api-key',
        'x-request-id': 'req-123',
      },
      ip: '127.0.0.1',
      query: { param: 'value' },
      params: { id: '123' },
    };

    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;

    const module: TestingModule = await Test.createTestingModule({
      providers: [GlobalExceptionFilter, { provide: 'SentryService', useValue: mockSentryService }],
    }).compile();

    filter = module.get<GlobalExceptionFilter>(GlobalExceptionFilter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('HttpException handling', () => {
    it('should handle BadRequestException (400)', () => {
      const exception = new BadRequestException('Invalid input');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'BAD_REQUEST',
            message: 'Invalid input',
          }),
        })
      );
    });

    it('should handle UnauthorizedException (401)', () => {
      const exception = new UnauthorizedException('Invalid token');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'UNAUTHORIZED',
          }),
        })
      );
    });

    it('should handle ForbiddenException (403)', () => {
      const exception = new ForbiddenException('Access denied');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'FORBIDDEN',
          }),
        })
      );
    });

    it('should handle NotFoundException (404)', () => {
      const exception = new NotFoundException('Resource not found');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'NOT_FOUND',
          }),
        })
      );
    });

    it('should handle ConflictException (409)', () => {
      const exception = new ConflictException('Resource already exists');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'CONFLICT',
          }),
        })
      );
    });

    it('should handle InternalServerErrorException (500)', () => {
      const exception = new InternalServerErrorException('Server error');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INTERNAL_SERVER_ERROR',
          }),
        })
      );
    });

    it('should handle HttpException with string response', () => {
      const exception = new HttpException('Simple error message', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Simple error message',
          }),
        })
      );
    });

    it('should handle HttpException with object response containing custom code', () => {
      const exception = new HttpException(
        { message: 'Custom error', code: 'CUSTOM_ERROR', details: { field: 'email' } },
        HttpStatus.BAD_REQUEST
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'CUSTOM_ERROR',
            message: 'Custom error',
            details: { field: 'email' },
          }),
        })
      );
    });
  });

  describe('PrismaClientKnownRequestError handling', () => {
    it('should handle P2002 (unique constraint violation)', () => {
      const exception = new PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['email'] },
      });

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'V005',
            message: expect.stringContaining('Duplicate entry'),
            details: expect.objectContaining({
              prismaCode: 'P2002',
              target: ['email'],
            }),
          }),
        })
      );
    });

    it('should handle P2025 (record not found)', () => {
      const exception = new PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });

      filter.catch(exception, mockHost);

      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Record not found',
          }),
        })
      );
    });

    it('should handle P2003 (foreign key constraint)', () => {
      const exception = new PrismaClientKnownRequestError('Foreign key constraint', {
        code: 'P2003',
        clientVersion: '5.0.0',
      });

      filter.catch(exception, mockHost);

      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'V004',
            message: 'Related record not found',
          }),
        })
      );
    });

    it('should handle P2014 (relation constraint violation)', () => {
      const exception = new PrismaClientKnownRequestError('Relation constraint failed', {
        code: 'P2014',
        clientVersion: '5.0.0',
      });

      filter.catch(exception, mockHost);

      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'V004',
            message: 'Required relation constraint violated',
          }),
        })
      );
    });

    it('should handle P2016 (query interpretation error)', () => {
      const exception = new PrismaClientKnownRequestError('Query interpretation error', {
        code: 'P2016',
        clientVersion: '5.0.0',
      });

      filter.catch(exception, mockHost);

      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Query interpretation error',
          }),
        })
      );
    });

    it('should handle P2017 (relation not connected)', () => {
      const exception = new PrismaClientKnownRequestError('Relation not connected', {
        code: 'P2017',
        clientVersion: '5.0.0',
      });

      filter.catch(exception, mockHost);

      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Records for relation not connected',
          }),
        })
      );
    });

    it('should handle P2021 (table does not exist)', () => {
      const exception = new PrismaClientKnownRequestError('Table does not exist', {
        code: 'P2021',
        clientVersion: '5.0.0',
      });

      filter.catch(exception, mockHost);

      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'I001',
            message: 'Database schema error',
          }),
        })
      );
    });

    it('should handle P2022 (column does not exist)', () => {
      const exception = new PrismaClientKnownRequestError('Column does not exist', {
        code: 'P2022',
        clientVersion: '5.0.0',
      });

      filter.catch(exception, mockHost);

      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'I001',
            message: 'Database schema error',
          }),
        })
      );
    });

    it('should handle unknown Prisma error codes', () => {
      const exception = new PrismaClientKnownRequestError('Unknown error', {
        code: 'P9999',
        clientVersion: '5.0.0',
      });

      filter.catch(exception, mockHost);

      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: expect.stringContaining('Database error'),
          }),
        })
      );
    });
  });

  describe('Generic Error handling', () => {
    it('should handle generic Error objects', () => {
      const exception = new Error('Something went wrong');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'E001',
            message: 'Something went wrong',
          }),
        })
      );
    });

    it('should map Fastify rate limit errors to 429', () => {
      const exception = Object.assign(new Error('Rate limit exceeded, retry in 1 minute'), {
        statusCode: 429,
      });

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'S008',
            retryable: true,
          }),
        })
      );
    });

    it('should handle non-Error exceptions', () => {
      const exception = { arbitrary: 'object' };

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred',
          }),
        })
      );
    });

    it('should handle string exceptions', () => {
      const exception = 'String error';

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('Response metadata', () => {
    it('should include timestamp in response', () => {
      const exception = new BadRequestException('Test');

      filter.catch(exception, mockHost);

      const response = (mockResponse.send as jest.Mock).mock.calls[0][0];
      expect(response.meta.timestamp).toBeDefined();
      expect(new Date(response.meta.timestamp)).toBeInstanceOf(Date);
    });

    it('should include path and method in response', () => {
      const exception = new BadRequestException('Test');

      filter.catch(exception, mockHost);

      const response = (mockResponse.send as jest.Mock).mock.calls[0][0];
      expect(response.meta.path).toBe('/test/endpoint');
      expect(response.meta.method).toBe('POST');
    });

    it('should include requestId from headers', () => {
      const exception = new BadRequestException('Test');

      filter.catch(exception, mockHost);

      const response = (mockResponse.send as jest.Mock).mock.calls[0][0];
      expect(response.meta.requestId).toBe('req-123');
    });
  });

  describe('Header sanitization', () => {
    it('should remove authorization header before sending to Sentry', () => {
      const exception = new InternalServerErrorException('Server error');

      filter.catch(exception, mockHost);

      const setContextCall = mockSentryService.setContext.mock.calls[0];
      const headers = setContextCall[1].headers;

      expect(headers.authorization).toBeUndefined();
      expect(headers['user-agent']).toBe('test-agent');
    });

    it('should remove cookie header before sending to Sentry', () => {
      const exception = new InternalServerErrorException('Server error');

      filter.catch(exception, mockHost);

      const setContextCall = mockSentryService.setContext.mock.calls[0];
      const headers = setContextCall[1].headers;

      expect(headers.cookie).toBeUndefined();
    });

    it('should remove x-api-key header before sending to Sentry', () => {
      const exception = new InternalServerErrorException('Server error');

      filter.catch(exception, mockHost);

      const setContextCall = mockSentryService.setContext.mock.calls[0];
      const headers = setContextCall[1].headers;

      expect(headers['x-api-key']).toBeUndefined();
    });
  });

  describe('Sentry capture', () => {
    it('should capture exception in Sentry for 5xx errors', () => {
      const exception = new InternalServerErrorException('Server error');

      filter.catch(exception, mockHost);

      expect(mockSentryService.captureException).toHaveBeenCalledWith(exception);
    });

    it('should NOT capture exception in Sentry for 4xx errors', () => {
      const exception = new BadRequestException('Client error');

      filter.catch(exception, mockHost);

      expect(mockSentryService.captureException).not.toHaveBeenCalled();
    });

    it('should set user context in Sentry when user is present', () => {
      (mockRequest as any).user = { id: 'user-123', email: 'test@example.com' };
      const exception = new InternalServerErrorException('Server error');

      filter.catch(exception, mockHost);

      expect(mockSentryService.setUser).toHaveBeenCalledWith({
        id: 'user-123',
        email: 'test@example.com',
      });
    });

    it('should set request context in Sentry', () => {
      const exception = new InternalServerErrorException('Server error');

      filter.catch(exception, mockHost);

      expect(mockSentryService.setContext).toHaveBeenCalledWith(
        'request',
        expect.objectContaining({
          url: '/test/endpoint',
          method: 'POST',
          query: { param: 'value' },
          params: { id: '123' },
        })
      );
    });

    it('should set tags in Sentry', () => {
      const exception = new InternalServerErrorException('Server error');

      filter.catch(exception, mockHost);

      expect(mockSentryService.setTags).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: '500',
          path: '/test/endpoint',
          method: 'POST',
        })
      );
    });

    it('should capture message for non-Error exceptions', () => {
      const exception = { custom: 'error' };

      filter.catch(exception, mockHost);

      expect(mockSentryService.captureMessage).toHaveBeenCalledWith(
        expect.stringContaining('Non-Error exception'),
        'error'
      );
    });
  });

  describe('Status code to error code mapping', () => {
    const testCases = [
      { status: HttpStatus.BAD_REQUEST, expectedCode: 'BAD_REQUEST' },
      { status: HttpStatus.UNAUTHORIZED, expectedCode: 'UNAUTHORIZED' },
      { status: HttpStatus.FORBIDDEN, expectedCode: 'FORBIDDEN' },
      { status: HttpStatus.NOT_FOUND, expectedCode: 'NOT_FOUND' },
      { status: HttpStatus.CONFLICT, expectedCode: 'CONFLICT' },
      { status: HttpStatus.UNPROCESSABLE_ENTITY, expectedCode: 'VALIDATION_ERROR' },
      { status: HttpStatus.TOO_MANY_REQUESTS, expectedCode: 'RATE_LIMITED' },
      { status: HttpStatus.INTERNAL_SERVER_ERROR, expectedCode: 'INTERNAL_SERVER_ERROR' },
      { status: HttpStatus.BAD_GATEWAY, expectedCode: 'BAD_GATEWAY' },
      { status: HttpStatus.SERVICE_UNAVAILABLE, expectedCode: 'SERVICE_UNAVAILABLE' },
      { status: HttpStatus.GATEWAY_TIMEOUT, expectedCode: 'GATEWAY_TIMEOUT' },
    ];

    testCases.forEach(({ status, expectedCode }) => {
      it(`should map status ${status} to code ${expectedCode}`, () => {
        const exception = new HttpException('Test', status);

        filter.catch(exception, mockHost);

        const response = (mockResponse.send as jest.Mock).mock.calls[0][0];
        expect(response.error.code).toBe(expectedCode);
      });
    });

    it('should map unknown status codes to UNKNOWN_ERROR', () => {
      const exception = new HttpException('Test', 418); // I'm a teapot

      filter.catch(exception, mockHost);

      const response = (mockResponse.send as jest.Mock).mock.calls[0][0];
      expect(response.error.code).toBe('UNKNOWN_ERROR');
    });
  });

  describe('Filter without Sentry', () => {
    it('should work without SentryService', async () => {
      const moduleWithoutSentry: TestingModule = await Test.createTestingModule({
        providers: [GlobalExceptionFilter],
      }).compile();

      const filterWithoutSentry =
        moduleWithoutSentry.get<GlobalExceptionFilter>(GlobalExceptionFilter);

      const exception = new InternalServerErrorException('Server error');

      expect(() => filterWithoutSentry.catch(exception, mockHost)).not.toThrow();
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });
});
