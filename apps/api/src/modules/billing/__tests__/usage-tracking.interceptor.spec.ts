import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';

import { UsageMetricType } from '@db';

import { BillingService } from '../billing.service';
import { USAGE_METRIC_KEY } from '../decorators';
import { UsageTrackingInterceptor } from '../interceptors/usage-tracking.interceptor';

describe('UsageTrackingInterceptor', () => {
  let interceptor: UsageTrackingInterceptor;
  let reflector: jest.Mocked<Reflector>;
  let billingService: jest.Mocked<BillingService>;

  const mockExecutionContext = (user?: any, metricType?: UsageMetricType): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
  };

  const mockCallHandler = (result: any = { success: true }): CallHandler => {
    return {
      handle: jest.fn(() => of(result)),
    } as unknown as CallHandler;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsageTrackingInterceptor,
        {
          provide: Reflector,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: BillingService,
          useValue: {
            recordUsage: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    interceptor = module.get<UsageTrackingInterceptor>(UsageTrackingInterceptor);
    reflector = module.get(Reflector) as jest.Mocked<Reflector>;
    billingService = module.get(BillingService) as jest.Mocked<BillingService>;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('intercept', () => {
    it('should proceed without tracking when no metric type is configured', async () => {
      const context = mockExecutionContext({ id: 'user-123' });
      const next = mockCallHandler();
      reflector.get.mockReturnValue(null);

      const result = await interceptor.intercept(context, next).toPromise();

      expect(result).toEqual({ success: true });
      expect(billingService.recordUsage).not.toHaveBeenCalled();
    });

    it('should proceed without tracking when no user is in request', async () => {
      const context = mockExecutionContext(undefined);
      const next = mockCallHandler();
      reflector.get.mockReturnValue('esg_calculation' as UsageMetricType);

      const result = await interceptor.intercept(context, next).toPromise();

      expect(result).toEqual({ success: true });
      expect(billingService.recordUsage).not.toHaveBeenCalled();
    });

    it('should record usage after successful request', async () => {
      const context = mockExecutionContext({ id: 'user-123' });
      const next = mockCallHandler({ data: 'test result' });
      reflector.get.mockReturnValue('esg_calculation' as UsageMetricType);

      const result = await interceptor.intercept(context, next).toPromise();

      expect(result).toEqual({ data: 'test result' });

      // Wait for async tap operation to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(billingService.recordUsage).toHaveBeenCalledWith('user-123', 'esg_calculation');
    });

    it('should not record usage when request fails', async () => {
      const context = mockExecutionContext({ id: 'user-123' });
      const next = {
        handle: jest.fn(() => throwError(() => new Error('Request failed'))),
      } as unknown as CallHandler;
      reflector.get.mockReturnValue('monte_carlo_simulation' as UsageMetricType);

      try {
        await interceptor.intercept(context, next).toPromise();
      } catch (error) {
        expect(error.message).toBe('Request failed');
      }

      // Wait a bit to ensure recordUsage is not called
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(billingService.recordUsage).not.toHaveBeenCalled();
    });

    it('should not fail request even if usage recording fails', async () => {
      const context = mockExecutionContext({ id: 'user-123' });
      const next = mockCallHandler({ data: 'test result' });
      reflector.get.mockReturnValue('goal_probability' as UsageMetricType);

      billingService.recordUsage.mockRejectedValue(new Error('Database error'));

      const result = await interceptor.intercept(context, next).toPromise();

      expect(result).toEqual({ data: 'test result' });

      // Wait for async tap operation to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(billingService.recordUsage).toHaveBeenCalled();
    });

    it('should track different metric types correctly', async () => {
      const metricTypes: UsageMetricType[] = [
        'esg_calculation',
        'monte_carlo_simulation',
        'goal_probability',
        'scenario_analysis',
        'portfolio_rebalance',
        'api_request',
      ];

      for (const metricType of metricTypes) {
        const context = mockExecutionContext({ id: 'user-123' });
        const next = mockCallHandler();
        reflector.get.mockReturnValue(metricType);

        await interceptor.intercept(context, next).toPromise();

        // Wait for async tap operation
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(billingService.recordUsage).toHaveBeenCalledWith('user-123', metricType);

        jest.clearAllMocks();
      }
    });

    it('should retrieve metric type from handler metadata', async () => {
      const context = mockExecutionContext({ id: 'user-123' });
      const next = mockCallHandler();
      reflector.get.mockReturnValue('api_request' as UsageMetricType);

      await interceptor.intercept(context, next).toPromise();

      expect(reflector.get).toHaveBeenCalledWith(USAGE_METRIC_KEY, context.getHandler());
    });

    it('should work with multiple concurrent requests', async () => {
      const users = ['user-1', 'user-2', 'user-3'];
      const promises = users.map((userId) => {
        const context = mockExecutionContext({ id: userId });
        const next = mockCallHandler({ userId });
        reflector.get.mockReturnValue('esg_calculation' as UsageMetricType);

        return interceptor.intercept(context, next).toPromise();
      });

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);

      // Wait for all async tap operations
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(billingService.recordUsage).toHaveBeenCalledTimes(3);
      users.forEach((userId) => {
        expect(billingService.recordUsage).toHaveBeenCalledWith(userId, 'esg_calculation');
      });
    });

    it('should handle requests with complex return values', async () => {
      const complexResult = {
        data: { nested: { deeply: { value: 123 } } },
        metadata: { timestamp: new Date() },
        array: [1, 2, 3],
      };

      const context = mockExecutionContext({ id: 'user-123' });
      const next = mockCallHandler(complexResult);
      reflector.get.mockReturnValue('scenario_analysis' as UsageMetricType);

      const result = await interceptor.intercept(context, next).toPromise();

      expect(result).toEqual(complexResult);

      // Wait for async tap operation
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(billingService.recordUsage).toHaveBeenCalledWith('user-123', 'scenario_analysis');
    });
  });
});
