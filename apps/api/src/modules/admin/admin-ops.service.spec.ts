import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AuditService } from '@core/audit/audit.service';
import { LoggerService } from '@core/logger/logger.service';
import { PrismaService } from '@core/prisma/prisma.service';
import { RedisService } from '@core/redis/redis.service';
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
    retryFailedJobs: jest.fn(),
    clearQueue: jest.fn(),
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
});
