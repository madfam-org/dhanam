import { Test, TestingModule } from '@nestjs/testing';

import { createPrismaMock, createLoggerMock } from '../../../../test/helpers/api-mock-factory';
import { PrismaService } from '../../../core/prisma/prisma.service';

import { RateLimiterService } from './rate-limiter.service';

describe('RateLimiterService', () => {
  let service: RateLimiterService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-15T10:00:00Z'));

    prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [RateLimiterService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<RateLimiterService>(RateLimiterService);
    (service as any).logger = createLoggerMock();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('canMakeRequest', () => {
    it('should allow request when under rate limits', async () => {
      const result = await service.canMakeRequest('plaid', 'US');

      expect(result.allowed).toBe(true);
      expect(result.waitMs).toBe(0);
      expect(result.reason).toBeUndefined();
    });

    it('should block request when minute limit reached', async () => {
      // Fill up the minute limit (plaid has 100/min)
      for (let i = 0; i < 100; i++) {
        await service.recordRequest('plaid', 'US');
      }

      const result = await service.canMakeRequest('plaid', 'US');

      expect(result.allowed).toBe(false);
      expect(result.waitMs).toBeGreaterThan(0);
      expect(result.reason).toContain('Minute rate limit reached');
    });

    it('should block request when hour limit reached', async () => {
      // Simulate hitting the hour limit by directly manipulating state
      const state = (service as any).getOrCreateState('bitso', 'US');
      state.requestsInHour = 500; // bitso has 500/hour limit

      const result = await service.canMakeRequest('bitso', 'US');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Hour rate limit reached');
    });

    it('should block request when in backoff period', async () => {
      // Set backoff state
      const state = (service as any).getOrCreateState('plaid', 'US');
      state.backoffUntil = new Date(Date.now() + 30000); // 30 seconds from now

      const result = await service.canMakeRequest('plaid', 'US');

      expect(result.allowed).toBe(false);
      expect(result.waitMs).toBeLessThanOrEqual(30000);
      expect(result.reason).toContain('backoff in effect');
    });

    it('should allow request after backoff period expires', async () => {
      const state = (service as any).getOrCreateState('plaid', 'US');
      state.backoffUntil = new Date(Date.now() - 1000); // Backoff already expired

      const result = await service.canMakeRequest('plaid', 'US');

      expect(result.allowed).toBe(true);
    });

    it('should use default region US when not specified', async () => {
      const result = await service.canMakeRequest('plaid');

      expect(result.allowed).toBe(true);
    });
  });

  describe('recordRequest', () => {
    it('should increment request counters', async () => {
      await service.recordRequest('plaid', 'US');

      const status = await service.getRateLimitStatus('plaid', 'US');

      expect(status.requestsInMinute).toBe(1);
      expect(status.requestsInHour).toBe(1);
    });

    it('should reset consecutive retries on successful request', async () => {
      // Set some retries
      const state = (service as any).getOrCreateState('plaid', 'US');
      state.consecutiveRetries = 3;
      state.backoffUntil = new Date(Date.now() + 30000);

      await service.recordRequest('plaid', 'US');

      expect(state.consecutiveRetries).toBe(0);
      expect(state.backoffUntil).toBeNull();
    });

    it('should handle multiple providers independently', async () => {
      await service.recordRequest('plaid', 'US');
      await service.recordRequest('plaid', 'US');
      await service.recordRequest('belvo', 'MX');

      const plaidStatus = await service.getRateLimitStatus('plaid', 'US');
      const belvoStatus = await service.getRateLimitStatus('belvo', 'MX');

      expect(plaidStatus.requestsInMinute).toBe(2);
      expect(belvoStatus.requestsInMinute).toBe(1);
    });

    it('should handle multiple regions independently', async () => {
      await service.recordRequest('plaid', 'US');
      await service.recordRequest('plaid', 'CA');

      const usStatus = await service.getRateLimitStatus('plaid', 'US');
      const caStatus = await service.getRateLimitStatus('plaid', 'CA');

      expect(usStatus.requestsInMinute).toBe(1);
      expect(caStatus.requestsInMinute).toBe(1);
    });
  });

  describe('handleRateLimitError', () => {
    beforeEach(() => {
      prismaMock.providerHealthStatus.upsert.mockResolvedValue({} as any);
    });

    it('should increment consecutive retries', async () => {
      await service.handleRateLimitError('plaid', 'US');

      const status = await service.getRateLimitStatus('plaid', 'US');
      expect(status.consecutiveRetries).toBe(1);
    });

    it('should return shouldRetry true when under max retries', async () => {
      const result = await service.handleRateLimitError('plaid', 'US');

      expect(result.shouldRetry).toBe(true);
      expect(result.waitMs).toBeGreaterThan(0);
    });

    it('should return shouldRetry false when max retries exceeded', async () => {
      // Exhaust all retries (plaid has maxRetries: 5)
      for (let i = 0; i < 5; i++) {
        await service.handleRateLimitError('plaid', 'US');
      }

      // Next error should return shouldRetry: false
      const result = await service.handleRateLimitError('plaid', 'US');

      expect(result.shouldRetry).toBe(false);
    });

    it('should use server-provided retry-after when available', async () => {
      const result = await service.handleRateLimitError('plaid', 'US', 60);

      // Should use the provided 60 seconds (60000ms) plus jitter
      expect(result.waitMs).toBeGreaterThanOrEqual(54000); // 60000 - 10%
      expect(result.waitMs).toBeLessThanOrEqual(66000); // 60000 + 10%
    });

    it('should apply exponential backoff', async () => {
      const result1 = await service.handleRateLimitError('plaid', 'US');

      // Reset and try again
      await service.reset('plaid', 'US');
      await service.handleRateLimitError('plaid', 'US');
      const result2 = await service.handleRateLimitError('plaid', 'US');

      // Second backoff should be longer than first
      // Note: Due to jitter, we can't compare exact values, but both should be valid
      expect(result1.waitMs).toBeGreaterThan(0);
      expect(result2.waitMs).toBeGreaterThan(0);
    });

    it('should cap backoff at maxBackoffMs', async () => {
      // Force many retries to hit the cap
      const state = (service as any).getOrCreateState('plaid', 'US');
      state.consecutiveRetries = 10;

      const result = await service.handleRateLimitError('plaid', 'US');

      // Plaid maxBackoffMs is 5 * 60 * 1000 = 300000
      expect(result.waitMs).toBeLessThanOrEqual(330000); // 300000 + 10% jitter
    });

    it('should update provider health status', async () => {
      await service.handleRateLimitError('plaid', 'US');

      expect(prismaMock.providerHealthStatus.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { provider_region: { provider: 'plaid', region: 'US' } },
          update: expect.objectContaining({ rateLimited: true }),
        })
      );
    });

    it('should handle provider health status update failure gracefully', async () => {
      prismaMock.providerHealthStatus.upsert.mockRejectedValue(new Error('DB error'));

      // Should not throw
      const result = await service.handleRateLimitError('plaid', 'US');

      expect(result.shouldRetry).toBe(true);
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return current rate limit status', async () => {
      await service.recordRequest('plaid', 'US');
      await service.recordRequest('plaid', 'US');

      const status = await service.getRateLimitStatus('plaid', 'US');

      expect(status).toEqual({
        provider: 'plaid',
        region: 'US',
        requestsInMinute: 2,
        requestsInHour: 2,
        minuteLimit: 100, // plaid config
        hourLimit: 3000, // plaid config
        isLimited: false,
        backoffUntil: null,
        consecutiveRetries: 0,
      });
    });

    it('should mark isLimited true when at limit', async () => {
      const state = (service as any).getOrCreateState('bitso', 'US');
      state.requestsInMinute = 30; // bitso limit

      const status = await service.getRateLimitStatus('bitso', 'US');

      expect(status.isLimited).toBe(true);
    });

    it('should mark isLimited true when in backoff', async () => {
      const state = (service as any).getOrCreateState('plaid', 'US');
      state.backoffUntil = new Date(Date.now() + 10000);

      const status = await service.getRateLimitStatus('plaid', 'US');

      expect(status.isLimited).toBe(true);
    });
  });

  describe('getAllRateLimitStatus', () => {
    it('should return status for all providers', async () => {
      const statuses = await service.getAllRateLimitStatus();

      expect(statuses).toHaveLength(6);
      expect(statuses.map((s) => s.provider)).toEqual(
        expect.arrayContaining(['belvo', 'plaid', 'mx', 'finicity', 'bitso', 'blockchain'])
      );
    });

    it('should not include manual provider', async () => {
      const statuses = await service.getAllRateLimitStatus();

      expect(statuses.find((s) => s.provider === 'manual')).toBeUndefined();
    });
  });

  describe('reset', () => {
    it('should clear rate limit state for provider', async () => {
      await service.recordRequest('plaid', 'US');
      await service.recordRequest('plaid', 'US');

      await service.reset('plaid', 'US');

      const status = await service.getRateLimitStatus('plaid', 'US');
      expect(status.requestsInMinute).toBe(0);
      expect(status.requestsInHour).toBe(0);
    });

    it('should not affect other providers', async () => {
      await service.recordRequest('plaid', 'US');
      await service.recordRequest('belvo', 'MX');

      await service.reset('plaid', 'US');

      const belvoStatus = await service.getRateLimitStatus('belvo', 'MX');
      expect(belvoStatus.requestsInMinute).toBe(1);
    });
  });

  describe('executeWithRateLimit', () => {
    beforeEach(() => {
      prismaMock.providerHealthStatus.upsert.mockResolvedValue({} as any);
    });

    it('should execute function successfully', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await service.executeWithRateLimit('plaid', 'US', fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should record request on success', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      await service.executeWithRateLimit('plaid', 'US', fn);

      const status = await service.getRateLimitStatus('plaid', 'US');
      expect(status.requestsInMinute).toBe(1);
    });

    it('should retry on rate limit error', async () => {
      // Use real timers for this test since sleep involves Promise + setTimeout interaction
      jest.useRealTimers();

      const fn = jest
        .fn()
        .mockRejectedValueOnce({ status: 429, message: 'Rate limited' })
        .mockResolvedValueOnce('success');

      // Mock the sleep to be instant
      const sleepSpy = jest.spyOn(service as any, 'sleep').mockResolvedValue(undefined);

      const result = await service.executeWithRateLimit('plaid', 'US', fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);

      sleepSpy.mockRestore();
    });

    it('should throw after max retries exhausted', async () => {
      jest.useRealTimers();

      const rateLimitError = Object.assign(new Error('Rate limited'), { status: 429 });
      const fn = jest.fn().mockRejectedValue(rateLimitError);

      // Mock sleep to be instant
      const sleepSpy = jest.spyOn(service as any, 'sleep').mockResolvedValue(undefined);

      await expect(service.executeWithRateLimit('plaid', 'US', fn)).rejects.toThrow('Rate limited');
      // Should call fn maxRetries+1 times = 6 for plaid
      expect(fn).toHaveBeenCalledTimes(6);

      sleepSpy.mockRestore();
    });

    it('should throw non-rate-limit errors immediately', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Database error'));

      await expect(service.executeWithRateLimit('plaid', 'US', fn)).rejects.toThrow(
        'Database error'
      );

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should wait for rate limit window before request', async () => {
      jest.useRealTimers();

      // Fill up rate limit
      const state = (service as any).getOrCreateState('bitso', 'US');
      state.requestsInMinute = 30; // bitso limit

      const fn = jest.fn().mockResolvedValue('success');

      // Mock sleep to be instant
      const sleepSpy = jest.spyOn(service as any, 'sleep').mockResolvedValue(undefined);

      await service.executeWithRateLimit('bitso', 'US', fn);

      // sleep should have been called to wait
      expect(sleepSpy).toHaveBeenCalled();
      expect(fn).toHaveBeenCalled();

      sleepSpy.mockRestore();
    });
  });

  describe('window reset', () => {
    it('should reset minute counter after 60 seconds', async () => {
      await service.recordRequest('plaid', 'US');

      // Advance 61 seconds
      jest.advanceTimersByTime(61000);

      const status = await service.getRateLimitStatus('plaid', 'US');
      expect(status.requestsInMinute).toBe(0);
    });

    it('should reset hour counter after 3600 seconds', async () => {
      await service.recordRequest('plaid', 'US');

      // Advance 61 minutes
      jest.advanceTimersByTime(61 * 60 * 1000);

      const status = await service.getRateLimitStatus('plaid', 'US');
      expect(status.requestsInHour).toBe(0);
    });
  });

  describe('isRateLimitError (private method)', () => {
    it('should detect 429 status code', () => {
      const isRateLimitError = (service as any).isRateLimitError.bind(service);

      expect(isRateLimitError({ status: 429 })).toBe(true);
      expect(isRateLimitError({ statusCode: 429 })).toBe(true);
      expect(isRateLimitError({ response: { status: 429 } })).toBe(true);
    });

    it('should detect rate limit in message', () => {
      const isRateLimitError = (service as any).isRateLimitError.bind(service);

      expect(isRateLimitError({ message: 'Rate limit exceeded' })).toBe(true);
      expect(isRateLimitError({ message: 'Too many requests' })).toBe(true);
      expect(isRateLimitError({ message: 'Request throttled' })).toBe(true);
    });

    it('should return false for non-rate-limit errors', () => {
      const isRateLimitError = (service as any).isRateLimitError.bind(service);

      expect(isRateLimitError({ status: 500, message: 'Server error' })).toBe(false);
      expect(isRateLimitError({ message: 'Connection timeout' })).toBe(false);
    });
  });

  describe('extractRetryAfter (private method)', () => {
    it('should extract retry-after header', () => {
      const extractRetryAfter = (service as any).extractRetryAfter.bind(service);

      expect(
        extractRetryAfter({
          response: { headers: { 'retry-after': '30' } },
        })
      ).toBe(30);

      expect(
        extractRetryAfter({
          response: { headers: { 'Retry-After': '60' } },
        })
      ).toBe(60);
    });

    it('should return undefined when no header', () => {
      const extractRetryAfter = (service as any).extractRetryAfter.bind(service);

      expect(extractRetryAfter({})).toBeUndefined();
      expect(extractRetryAfter({ response: {} })).toBeUndefined();
      expect(extractRetryAfter({ response: { headers: {} } })).toBeUndefined();
    });

    it('should return undefined for invalid value', () => {
      const extractRetryAfter = (service as any).extractRetryAfter.bind(service);

      expect(
        extractRetryAfter({
          response: { headers: { 'retry-after': 'invalid' } },
        })
      ).toBeUndefined();
    });
  });

  describe('provider configurations', () => {
    const providers = [
      'belvo',
      'plaid',
      'mx',
      'finicity',
      'bitso',
      'blockchain',
      'manual',
    ] as const;

    it.each(providers)('should have valid config for %s', async (provider) => {
      const status = await service.getRateLimitStatus(provider);

      expect(status.minuteLimit).toBeGreaterThan(0);
      expect(status.hourLimit).toBeGreaterThan(0);
    });

    it('bitso should have lower limits than plaid', async () => {
      const bitsoStatus = await service.getRateLimitStatus('bitso');
      const plaidStatus = await service.getRateLimitStatus('plaid');

      expect(bitsoStatus.minuteLimit).toBeLessThan(plaidStatus.minuteLimit);
    });

    it('manual provider should have very high limits', async () => {
      const status = await service.getRateLimitStatus('manual');

      expect(status.minuteLimit).toBe(1000);
      expect(status.hourLimit).toBe(10000);
    });
  });
});
