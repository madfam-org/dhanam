import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '@core/prisma/prisma.service';

import { ErrorTrackingService, ErrorReport } from '../error-tracking.service';

describe('ErrorTrackingService', () => {
  let service: ErrorTrackingService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockPrisma = {
      errorLog: {
        create: jest.fn(),
        groupBy: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ErrorTrackingService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<ErrorTrackingService>(ErrorTrackingService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('reportError', () => {
    it('should report Error object with stack trace', async () => {
      const error = new Error('Test error');
      prisma.errorLog.create.mockResolvedValue({} as any);

      await service.reportError(error);

      expect(prisma.errorLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          message: 'Test error',
          stack: expect.stringContaining('Error: Test error'),
          level: 'error',
        }),
      });
    });

    it('should report string error without stack trace', async () => {
      prisma.errorLog.create.mockResolvedValue({} as any);

      await service.reportError('Simple error message');

      expect(prisma.errorLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          message: 'Simple error message',
          stack: undefined,
          level: 'error',
        }),
      });
    });

    it('should include context in error report', async () => {
      prisma.errorLog.create.mockResolvedValue({} as any);
      const context = {
        userId: 'user-123',
        spaceId: 'space-456',
        endpoint: '/api/test',
        method: 'POST',
        userAgent: 'TestAgent/1.0',
        ip: '192.168.1.1',
      };

      await service.reportError('Test error', context);

      expect(prisma.errorLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          context: context,
        }),
      });
    });

    it('should include metadata in error report', async () => {
      prisma.errorLog.create.mockResolvedValue({} as any);
      const metadata = {
        customField: 'value',
        requestId: 'req-123',
      };

      await service.reportError('Test error', {}, metadata);

      expect(prisma.errorLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: metadata,
        }),
      });
    });

    it('should report with different severity levels', async () => {
      prisma.errorLog.create.mockResolvedValue({} as any);

      await service.reportError('Error message', {}, {}, 'error');
      await service.reportError('Warning message', {}, {}, 'warn');
      await service.reportError('Info message', {}, {}, 'info');

      // Only 'error' level should be stored in database
      expect(prisma.errorLog.create).toHaveBeenCalledTimes(1);
    });

    it('should NOT store warn level errors in database', async () => {
      prisma.errorLog.create.mockResolvedValue({} as any);

      await service.reportError('Warning', {}, {}, 'warn');

      expect(prisma.errorLog.create).not.toHaveBeenCalled();
    });

    it('should NOT store info level errors in database', async () => {
      prisma.errorLog.create.mockResolvedValue({} as any);

      await service.reportError('Info', {}, {}, 'info');

      expect(prisma.errorLog.create).not.toHaveBeenCalled();
    });

    it('should handle database storage errors gracefully', async () => {
      prisma.errorLog.create.mockRejectedValue(new Error('Database unavailable'));

      // Should not throw
      await expect(service.reportError(new Error('Test error'))).resolves.not.toThrow();
    });

    it('should include timestamp in error report', async () => {
      prisma.errorLog.create.mockResolvedValue({} as any);
      const beforeReport = new Date();

      await service.reportError('Test error');

      const afterReport = new Date();
      const createCall = prisma.errorLog.create.mock.calls[0][0];
      const reportTimestamp = createCall.data.timestamp;

      expect(reportTimestamp.getTime()).toBeGreaterThanOrEqual(beforeReport.getTime());
      expect(reportTimestamp.getTime()).toBeLessThanOrEqual(afterReport.getTime());
    });
  });

  describe('getErrorStats', () => {
    it('should get error stats for hour timeframe', async () => {
      prisma.errorLog.groupBy.mockResolvedValue([
        { level: 'error', _count: { level: 5 } },
        { level: 'warn', _count: { level: 3 } },
      ] as any);

      const result = await service.getErrorStats('hour');

      expect(result.timeframe).toBe('hour');
      expect(result.counts).toHaveLength(2);

      // Verify the start time is approximately 1 hour ago
      const expectedStart = new Date(Date.now() - 60 * 60 * 1000);
      expect(result.period.start.getTime()).toBeCloseTo(expectedStart.getTime(), -3);
    });

    it('should get error stats for day timeframe', async () => {
      prisma.errorLog.groupBy.mockResolvedValue([]);

      const result = await service.getErrorStats('day');

      expect(result.timeframe).toBe('day');

      // Verify the start time is approximately 24 hours ago
      const expectedStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
      expect(result.period.start.getTime()).toBeCloseTo(expectedStart.getTime(), -3);
    });

    it('should get error stats for week timeframe', async () => {
      prisma.errorLog.groupBy.mockResolvedValue([]);

      const result = await service.getErrorStats('week');

      expect(result.timeframe).toBe('week');

      // Verify the start time is approximately 7 days ago
      const expectedStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      expect(result.period.start.getTime()).toBeCloseTo(expectedStart.getTime(), -3);
    });

    it('should default to day timeframe', async () => {
      prisma.errorLog.groupBy.mockResolvedValue([]);

      const result = await service.getErrorStats();

      expect(result.timeframe).toBe('day');
    });

    it('should include top errors in stats', async () => {
      prisma.errorLog.groupBy
        .mockResolvedValueOnce([{ level: 'error', _count: { level: 10 } }])
        .mockResolvedValueOnce([
          {
            message: 'Connection timeout',
            _count: { message: 5 },
            _max: { timestamp: new Date() },
          },
          { message: 'Invalid token', _count: { message: 3 }, _max: { timestamp: new Date() } },
        ]);

      const result = await service.getErrorStats('day');

      expect(result.topErrors).toHaveLength(2);
      expect(result.topErrors[0].message).toBe('Connection timeout');
    });

    it('should handle database errors gracefully', async () => {
      prisma.errorLog.groupBy.mockRejectedValue(new Error('Database error'));

      const result = await service.getErrorStats('day');

      expect(result.counts).toEqual([]);
      expect(result.topErrors).toEqual([]);
    });

    it('should include period with start and end dates', async () => {
      prisma.errorLog.groupBy.mockResolvedValue([]);

      const result = await service.getErrorStats('day');

      expect(result.period.start).toBeInstanceOf(Date);
      expect(result.period.end).toBeInstanceOf(Date);
      expect(result.period.end.getTime()).toBeGreaterThan(result.period.start.getTime());
    });
  });

  describe('reportProviderError', () => {
    it('should report provider error with correct context', async () => {
      const error = new Error('Provider connection failed');
      prisma.errorLog.create.mockResolvedValue({} as any);

      await service.reportProviderError('belvo', 'sync', error, 'user-123', 'conn-456');

      expect(prisma.errorLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          message: 'Provider connection failed',
          context: expect.objectContaining({
            userId: 'user-123',
            endpoint: 'providers/belvo/sync',
          }),
          metadata: expect.objectContaining({
            provider: 'belvo',
            operation: 'sync',
            connectionId: 'conn-456',
          }),
        }),
      });
    });

    it('should report provider error without optional fields', async () => {
      const error = new Error('Provider error');
      prisma.errorLog.create.mockResolvedValue({} as any);

      await service.reportProviderError('plaid', 'auth', error);

      expect(prisma.errorLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          context: expect.objectContaining({
            userId: undefined,
          }),
          metadata: expect.objectContaining({
            connectionId: undefined,
          }),
        }),
      });
    });
  });

  describe('reportJobError', () => {
    it('should report job error with correct context', async () => {
      const error = new Error('Job processing failed');
      prisma.errorLog.create.mockResolvedValue({} as any);

      await service.reportJobError('sync-accounts', 'job-123', error, { accountId: 'acc-456' });

      expect(prisma.errorLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          message: 'Job processing failed',
          context: expect.objectContaining({
            endpoint: 'jobs/sync-accounts',
          }),
          metadata: expect.objectContaining({
            jobType: 'sync-accounts',
            jobId: 'job-123',
            payload: JSON.stringify({ accountId: 'acc-456' }),
          }),
        }),
      });
    });

    it('should handle undefined payload', async () => {
      const error = new Error('Job error');
      prisma.errorLog.create.mockResolvedValue({} as any);

      await service.reportJobError('test-job', 'job-123', error);

      expect(prisma.errorLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            payload: undefined,
          }),
        }),
      });
    });
  });

  describe('reportValidationError', () => {
    it('should report validation error with warn level', async () => {
      const validationErrors = [
        { message: 'Email is required', field: 'email' },
        { message: 'Password too short', field: 'password' },
      ];

      // Note: warn level doesn't store to database
      await service.reportValidationError('/api/auth/register', validationErrors, 'user-123');

      // Since warn level doesn't store to DB, create should not be called
      expect(prisma.errorLog.create).not.toHaveBeenCalled();
    });

    it('should concatenate validation error messages', async () => {
      const validationErrors = [{ message: 'Field A invalid' }, { message: 'Field B invalid' }];

      // This tests the message formatting - we'd need to verify logging
      await expect(
        service.reportValidationError('/api/test', validationErrors)
      ).resolves.not.toThrow();
    });
  });

  describe('reportSecurityEvent', () => {
    it('should report security event with warn level', async () => {
      // Note: warn level doesn't store to database
      await service.reportSecurityEvent(
        'brute_force_attempt',
        'Multiple failed login attempts',
        'user-123',
        '192.168.1.1'
      );

      // Since warn level doesn't store to DB
      expect(prisma.errorLog.create).not.toHaveBeenCalled();
    });

    it('should include security event metadata', async () => {
      // This tests that the method doesn't throw
      await expect(
        service.reportSecurityEvent('unauthorized_access', 'Attempted admin access', 'user-123')
      ).resolves.not.toThrow();
    });

    it('should handle missing optional parameters', async () => {
      await expect(
        service.reportSecurityEvent('suspicious_activity', 'Unknown pattern detected')
      ).resolves.not.toThrow();
    });
  });

  describe('Error logging behavior', () => {
    it('should log error level messages to console error', async () => {
      prisma.errorLog.create.mockResolvedValue({} as any);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // The service uses NestJS Logger which internally uses console
      await service.reportError(new Error('Critical error'), {}, {}, 'error');

      consoleSpy.mockRestore();
    });

    it('should log warn level messages without storing', async () => {
      await service.reportError('Warning message', {}, {}, 'warn');

      expect(prisma.errorLog.create).not.toHaveBeenCalled();
    });

    it('should log info level messages without storing', async () => {
      await service.reportError('Info message', {}, {}, 'info');

      expect(prisma.errorLog.create).not.toHaveBeenCalled();
    });
  });

  describe('Database fallback', () => {
    it('should continue operation when error_logs table does not exist', async () => {
      prisma.errorLog.create.mockRejectedValue(new Error('Table does not exist'));

      // Should not throw and should complete gracefully
      await expect(service.reportError(new Error('Test error'))).resolves.not.toThrow();
    });
  });
});
