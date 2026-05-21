import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AuditService } from '@core/audit/audit.service';
import { LoggerService } from '@core/logger/logger.service';
import { PrismaService } from '@core/prisma/prisma.service';
import { RedisService } from '@core/redis/redis.service';
import { BillingService } from '@modules/billing/billing.service';
import { QueueService } from '@modules/jobs/queue.service';

import { AdminOpsService } from './admin-ops.service';

describe('AdminOpsService', () => {
  let service: AdminOpsService;

  const mockPrismaService = {};

  const mockLoggerService = {
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockRedisService = {
    ping: jest.fn().mockResolvedValue(true),
    getClient: jest.fn(),
  };

  const mockAuditService = {
    logEvent: jest.fn(),
  };

  const mockQueueService = {
    getAllQueueStats: jest.fn(),
    getFailedJobs: jest.fn(),
    retryFailedJobs: jest.fn(),
    clearFailedJobs: jest.fn(),
    clearQueue: jest.fn(),
  };

  const mockBillingService = {
    createOperatorCheckout: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminOpsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: LoggerService, useValue: mockLoggerService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: QueueService, useValue: mockQueueService },
        { provide: BillingService, useValue: mockBillingService },
      ],
    }).compile();

    service = module.get<AdminOpsService>(AdminOpsService);
    jest.clearAllMocks();
  });

  describe('getQueueStats', () => {
    it('should return live BullMQ queue stats for the admin dashboard', async () => {
      mockQueueService.getAllQueueStats.mockResolvedValue([
        {
          name: 'sync-transactions',
          waiting: 0,
          active: 0,
          completed: 100,
          failed: 50,
          delayed: 0,
        },
        {
          name: 'categorize-transactions',
          waiting: 2,
          active: 1,
          completed: 20,
          failed: 0,
          delayed: 3,
        },
        {
          name: 'email-notifications',
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
        },
      ]);

      const result = await service.getQueueStats('admin1');

      expect(result.queues).toEqual([
        {
          name: 'sync-transactions',
          status: 'error',
          recentJobs: 100,
          failedJobs: 50,
        },
        {
          name: 'categorize-transactions',
          status: 'active',
          recentJobs: 26,
          failedJobs: 0,
        },
        {
          name: 'email-notifications',
          status: 'idle',
          recentJobs: 0,
          failedJobs: 0,
        },
      ]);
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin1',
          action: 'admin.view_queue_stats',
          resource: 'Queue',
        })
      );
    });
  });

  describe('retryFailedJobs', () => {
    it('should retry failed jobs through QueueService and audit the count', async () => {
      mockQueueService.retryFailedJobs.mockResolvedValue(50);

      const result = await service.retryFailedJobs('sync-transactions', 'admin1');

      expect(result).toEqual({ retriedCount: 50 });
      expect(mockQueueService.retryFailedJobs).toHaveBeenCalledWith('sync-transactions');
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin1',
          action: 'admin.queue_retry_failed',
          resourceId: 'sync-transactions',
          metadata: { retriedCount: 50 },
          severity: 'high',
        })
      );
    });
  });

  describe('getFailedJobs', () => {
    it('should list failed jobs through QueueService and audit access', async () => {
      mockQueueService.getFailedJobs.mockResolvedValue([
        {
          id: '42',
          name: 'sync-transactions',
          data: { payload: { connectionId: 'conn1' } },
          failedReason: 'Provider timeout',
          attemptsMade: 3,
        },
      ]);

      const result = await service.getFailedJobs('sync-transactions', 10, 'admin1');

      expect(result.jobs).toHaveLength(1);
      expect(mockQueueService.getFailedJobs).toHaveBeenCalledWith('sync-transactions', 10);
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin1',
          action: 'admin.queue_view_failed',
          resourceId: 'sync-transactions',
          metadata: { limit: 10, returnedCount: 1 },
          severity: 'medium',
        })
      );
    });

    it('should default and clamp failed job listing limits', async () => {
      mockQueueService.getFailedJobs.mockResolvedValue([]);

      await service.getFailedJobs('sync-transactions', Number.NaN, 'admin1');
      await service.getFailedJobs('sync-transactions', 500, 'admin1');

      expect(mockQueueService.getFailedJobs).toHaveBeenNthCalledWith(1, 'sync-transactions', 25);
      expect(mockQueueService.getFailedJobs).toHaveBeenNthCalledWith(2, 'sync-transactions', 100);
    });
  });

  describe('clearFailedJobs', () => {
    it('should clear only failed jobs through QueueService and audit the count', async () => {
      mockQueueService.clearFailedJobs.mockResolvedValue(50);

      const result = await service.clearFailedJobs('sync-transactions', true, 'admin1');

      expect(result).toEqual({ clearedCount: 50 });
      expect(mockQueueService.clearFailedJobs).toHaveBeenCalledWith('sync-transactions');
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin1',
          action: 'admin.queue_clear_failed',
          resourceId: 'sync-transactions',
          metadata: { clearedCount: 50 },
          severity: 'high',
        })
      );
    });

    it('should require explicit confirmation before clearing failed jobs', async () => {
      await expect(service.clearFailedJobs('sync-transactions', false, 'admin1')).rejects.toThrow(
        BadRequestException
      );
      expect(mockQueueService.clearFailedJobs).not.toHaveBeenCalled();
    });
  });

  describe('clearQueue', () => {
    it('should clear a queue through QueueService and audit the count', async () => {
      mockQueueService.clearQueue.mockResolvedValue(75);

      const result = await service.clearQueue('categorize-transactions', true, 'admin1');

      expect(result).toEqual({ clearedCount: 75 });
      expect(mockQueueService.clearQueue).toHaveBeenCalledWith('categorize-transactions');
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin1',
          action: 'admin.queue_clear',
          resourceId: 'categorize-transactions',
          metadata: { clearedCount: 75 },
          severity: 'high',
        })
      );
    });

    it('should require explicit server-side confirmation', async () => {
      await expect(service.clearQueue('categorize-transactions', false, 'admin1')).rejects.toThrow(
        BadRequestException
      );
      expect(mockQueueService.clearQueue).not.toHaveBeenCalled();
    });
  });

  describe('createPosCheckout', () => {
    it('creates an operator checkout link and records a high-severity audit entry', async () => {
      mockBillingService.createOperatorCheckout.mockResolvedValue({
        checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_pos',
        provider: 'stripe',
      });

      const result = await service.createPosCheckout(
        {
          userId: 'user_123',
          product: 'karafiel',
          plan: 'pro',
          orgId: 'org_123',
          countryCode: 'mx',
          successUrl: 'https://admin.dhan.am/pos/success',
          cancelUrl: 'https://admin.dhan.am/pos/cancel',
        },
        'admin1'
      );

      expect(mockBillingService.createOperatorCheckout).toHaveBeenCalledWith('user_123', {
        plan: 'pro',
        product: 'karafiel',
        orgId: 'org_123',
        countryCode: 'MX',
        successUrl: 'https://admin.dhan.am/pos/success',
        cancelUrl: 'https://admin.dhan.am/pos/cancel',
        operatorId: 'admin1',
        source: 'internal_pos',
      });
      expect(result).toEqual({
        checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_pos',
        provider: 'stripe',
        userId: 'user_123',
        product: 'karafiel',
        plan: 'pro',
        countryCode: 'MX',
      });
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin1',
          action: 'admin.billing_pos_checkout_created',
          resource: 'Billing',
          resourceId: 'user_123',
          severity: 'high',
          metadata: expect.objectContaining({
            provider: 'stripe',
            product: 'karafiel',
            plan: 'pro',
            orgId: 'org_123',
            countryCode: 'MX',
          }),
        })
      );
    });

    it('defaults POS checkout product to dhanam', async () => {
      mockBillingService.createOperatorCheckout.mockResolvedValue({
        checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_pos',
        provider: 'stripe',
      });

      await service.createPosCheckout({ userId: 'user_123', plan: 'pro' }, 'admin1');

      expect(mockBillingService.createOperatorCheckout).toHaveBeenCalledWith(
        'user_123',
        expect.objectContaining({ product: 'dhanam' })
      );
    });
  });
});
