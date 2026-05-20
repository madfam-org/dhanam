import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

import { QueueService } from './queue.service';

// Create mock queue for testing
const createMockQueue = (name: string) => ({
  name,
  add: jest.fn().mockResolvedValue({ id: 'job-id', data: {} }),
  getWaiting: jest.fn().mockResolvedValue([]),
  getActive: jest.fn().mockResolvedValue([]),
  getCompleted: jest.fn().mockResolvedValue([]),
  getFailed: jest.fn().mockResolvedValue([]),
  getDelayed: jest.fn().mockResolvedValue([]),
  pause: jest.fn().mockResolvedValue(undefined),
  resume: jest.fn().mockResolvedValue(undefined),
  obliterate: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
});

// Mock BullMQ
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation((name: string) => createMockQueue(name)),
  Worker: jest.fn().mockImplementation((name: string) => ({
    name,
    close: jest.fn().mockResolvedValue(undefined),
  })),
  QueueEvents: jest.fn().mockImplementation((name: string) => ({
    name,
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock ioredis
jest.mock('ioredis', () => {
  return {
    Redis: jest.fn().mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      quit: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

describe('QueueService', () => {
  let service: QueueService;
  let configService: DeepMockProxy<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: ConfigService,
          useValue: mockDeep<ConfigService>(),
        },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
    configService = module.get(ConfigService);

    // Mock Redis URL
    configService.get.mockReturnValue('redis://localhost:6379');

    // Manually initialize the queues for testing (simulating onModuleInit)
    const queues = (service as any).queues as Map<string, any>;
    queues.set('sync-transactions', createMockQueue('sync-transactions'));
    queues.set('categorize-transactions', createMockQueue('categorize-transactions'));
    queues.set('esg-updates', createMockQueue('esg-updates'));
    queues.set('valuation-snapshots', createMockQueue('valuation-snapshots'));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addSyncTransactionsJob', () => {
    it('should add a sync job to queue', async () => {
      const jobData = {
        provider: 'belvo' as const,
        userId: 'user1',
        connectionId: 'conn1',
        fullSync: false,
      };

      const result = await service.addSyncTransactionsJob(jobData);

      expect(result).toBeDefined();
      expect(result.id).toBe('job-id');
    });
  });

  describe('addCategorizeTransactionsJob', () => {
    it('should add a categorization job to queue', async () => {
      const jobData = {
        spaceId: 'space1',
        transactionIds: ['tx1', 'tx2'],
      };

      const result = await service.addCategorizeTransactionsJob(jobData);

      expect(result).toBeDefined();
      expect(result.id).toBe('job-id');
    });
  });

  describe('addESGUpdateJob', () => {
    it('should add an ESG update job to queue', async () => {
      const jobData = {
        symbols: ['BTC', 'ETH'],
        forceRefresh: false,
      };

      const result = await service.addESGUpdateJob(jobData);

      expect(result).toBeDefined();
      expect(result.id).toBe('job-id');
    });
  });

  describe('addValuationSnapshotJob', () => {
    it('should add a valuation snapshot job to queue', async () => {
      const jobData = {
        spaceId: 'space1',
        date: new Date().toISOString(),
      };

      const result = await service.addValuationSnapshotJob(jobData);

      expect(result).toBeDefined();
      expect(result.id).toBe('job-id');
    });
  });

  describe('queue management', () => {
    it('should return queue stats from BullMQ', async () => {
      const queues = (service as any).queues as Map<string, any>;
      const queue = queues.get('sync-transactions');
      queue.getWaiting.mockResolvedValue([{}]);
      queue.getActive.mockResolvedValue([{}, {}]);
      queue.getCompleted.mockResolvedValue([{}, {}, {}]);
      queue.getFailed.mockResolvedValue([{}]);
      queue.getDelayed.mockResolvedValue([{}, {}]);

      const result = await service.getQueueStats('sync-transactions');

      expect(result).toEqual({
        name: 'sync-transactions',
        waiting: 1,
        active: 2,
        completed: 3,
        failed: 1,
        delayed: 2,
      });
    });

    it('should retry failed jobs and return the retried count', async () => {
      const queues = (service as any).queues as Map<string, any>;
      const retry = jest.fn().mockResolvedValue(undefined);
      const queue = queues.get('categorize-transactions');
      queue.getFailed.mockResolvedValue([{ retry }, { retry }]);

      const result = await service.retryFailedJobs('categorize-transactions');

      expect(result).toBe(2);
      expect(retry).toHaveBeenCalledTimes(2);
    });

    it('should list failed jobs with redacted data and normalized limit', async () => {
      const queues = (service as any).queues as Map<string, any>;
      const queue = queues.get('sync-transactions');
      queue.getFailed.mockResolvedValue([
        {
          id: 'job-1',
          name: 'sync-transactions',
          data: {
            payload: {
              connectionId: 'conn1',
              accessToken: 'sensitive-token',
              nested: { apiKey: 'sensitive-key', safe: 'visible' },
            },
          },
          failedReason: 'Provider timeout',
          attemptsMade: 3,
          timestamp: 1779257000000,
          processedOn: 1779257001000,
          finishedOn: 1779257002000,
        },
      ]);

      const result = await service.getFailedJobs('sync-transactions', 500);

      expect(queue.getFailed).toHaveBeenCalledWith(0, 99);
      expect(result).toEqual([
        {
          id: 'job-1',
          name: 'sync-transactions',
          data: {
            payload: {
              connectionId: 'conn1',
              accessToken: '[REDACTED]',
              nested: { apiKey: '[REDACTED]', safe: 'visible' },
            },
          },
          failedReason: 'Provider timeout',
          attemptsMade: 3,
          timestamp: '2026-05-20T06:03:20.000Z',
          processedOn: '2026-05-20T06:03:21.000Z',
          finishedOn: '2026-05-20T06:03:22.000Z',
        },
      ]);
    });

    it('should remove only failed jobs and return the removed count', async () => {
      const queues = (service as any).queues as Map<string, any>;
      const remove = jest.fn().mockResolvedValue(undefined);
      const queue = queues.get('sync-transactions');
      queue.getFailed.mockResolvedValue([{ remove }, { remove }]);

      const result = await service.clearFailedJobs('sync-transactions');

      expect(result).toBe(2);
      expect(remove).toHaveBeenCalledTimes(2);
      expect(queue.obliterate).not.toHaveBeenCalled();
    });

    it('should clear a queue and return the number of removed jobs', async () => {
      const queues = (service as any).queues as Map<string, any>;
      const queue = queues.get('sync-transactions');
      queue.getWaiting.mockResolvedValue([{}]);
      queue.getActive.mockResolvedValue([{}]);
      queue.getCompleted.mockResolvedValue([{}, {}]);
      queue.getFailed.mockResolvedValue([{}]);
      queue.getDelayed.mockResolvedValue([{}, {}]);

      const result = await service.clearQueue('sync-transactions');

      expect(result).toBe(7);
      expect(queue.obliterate).toHaveBeenCalledWith({ force: true });
    });
  });
});
