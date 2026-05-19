import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

import { QueueService } from './queue.service';

// Create mock queue for testing
const createMockQueue = (name: string) => ({
  name,
  add: jest.fn().mockResolvedValue({ id: 'job-id', data: {} }),
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
});
