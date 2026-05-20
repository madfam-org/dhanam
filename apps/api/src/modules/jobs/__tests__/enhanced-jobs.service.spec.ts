import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../core/prisma/prisma.service';
import { EnhancedJobsService } from '../enhanced-jobs.service';
import { CategorizeTransactionsProcessor } from '../processors/categorize-transactions.processor';
import { ESGUpdateProcessor } from '../processors/esg-update.processor';
import { SyncTransactionsProcessor } from '../processors/sync-transactions.processor';
import { ValuationSnapshotProcessor } from '../processors/valuation-snapshot.processor';
import { QueueService } from '../queue.service';

describe('EnhancedJobsService', () => {
  let service: EnhancedJobsService;
  let prisma: jest.Mocked<PrismaService>;
  let queueService: jest.Mocked<QueueService>;
  let syncProcessor: jest.Mocked<SyncTransactionsProcessor>;
  let categorizeProcessor: jest.Mocked<CategorizeTransactionsProcessor>;
  let esgProcessor: jest.Mocked<ESGUpdateProcessor>;
  let snapshotProcessor: jest.Mocked<ValuationSnapshotProcessor>;

  const mockConnection = {
    id: 'conn-123',
    userId: 'user-123',
    provider: 'bitso',
  };

  const mockSpace = {
    id: 'space-123',
  };

  const mockQueueStats = [
    {
      name: 'sync-transactions',
      waiting: 5,
      active: 2,
      completed: 100,
      failed: 3,
      delayed: 0,
    },
    {
      name: 'categorize-transactions',
      waiting: 0,
      active: 1,
      completed: 50,
      failed: 1,
      delayed: 2,
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnhancedJobsService,
        {
          provide: PrismaService,
          useValue: {
            providerConnection: {
              findMany: jest.fn(),
            },
            space: {
              findMany: jest.fn(),
            },
            account: {
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: QueueService,
          useValue: {
            registerWorker: jest.fn(),
            scheduleRecurringJob: jest.fn(),
            removeRecurringJob: jest.fn(),
            addSyncTransactionsJob: jest.fn(),
            addCategorizeTransactionsJob: jest.fn(),
            addESGUpdateJob: jest.fn(),
            addValuationSnapshotJob: jest.fn(),
            getAllQueueStats: jest.fn(),
            getQueueStats: jest.fn(),
            retryFailedJobs: jest.fn(),
          },
        },
        {
          provide: SyncTransactionsProcessor,
          useValue: {
            process: jest.fn(),
          },
        },
        {
          provide: CategorizeTransactionsProcessor,
          useValue: {
            process: jest.fn(),
          },
        },
        {
          provide: ESGUpdateProcessor,
          useValue: {
            process: jest.fn(),
          },
        },
        {
          provide: ValuationSnapshotProcessor,
          useValue: {
            process: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EnhancedJobsService>(EnhancedJobsService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    queueService = module.get(QueueService) as jest.Mocked<QueueService>;
    syncProcessor = module.get(SyncTransactionsProcessor) as jest.Mocked<SyncTransactionsProcessor>;
    categorizeProcessor = module.get(
      CategorizeTransactionsProcessor
    ) as jest.Mocked<CategorizeTransactionsProcessor>;
    esgProcessor = module.get(ESGUpdateProcessor) as jest.Mocked<ESGUpdateProcessor>;
    snapshotProcessor = module.get(
      ValuationSnapshotProcessor
    ) as jest.Mocked<ValuationSnapshotProcessor>;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should register workers and remove obsolete generic recurring jobs', async () => {
      queueService.removeRecurringJob.mockResolvedValue(false);

      await service.onModuleInit();

      // Should register 4 workers
      expect(queueService.registerWorker).toHaveBeenCalledTimes(4);
      expect(queueService.registerWorker).toHaveBeenCalledWith(
        'sync-transactions',
        expect.any(Function)
      );
      expect(queueService.registerWorker).toHaveBeenCalledWith(
        'categorize-transactions',
        expect.any(Function)
      );
      expect(queueService.registerWorker).toHaveBeenCalledWith('esg-updates', expect.any(Function));
      expect(queueService.registerWorker).toHaveBeenCalledWith(
        'valuation-snapshots',
        expect.any(Function)
      );

      expect(queueService.removeRecurringJob).toHaveBeenCalledTimes(4);
      expect(queueService.removeRecurringJob).toHaveBeenCalledWith(
        'categorize-transactions',
        'hourly-categorization',
        '0 * * * *'
      );
      expect(queueService.removeRecurringJob).toHaveBeenCalledWith(
        'sync-transactions',
        'crypto-portfolio-sync',
        '0 */4 * * *'
      );
      expect(queueService.scheduleRecurringJob).not.toHaveBeenCalled();
    });

    it('should handle recurring cleanup errors gracefully', async () => {
      queueService.removeRecurringJob.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });

  describe('triggerUserSync', () => {
    it('should trigger sync jobs for all user connections', async () => {
      const connections = [
        mockConnection,
        { ...mockConnection, id: 'conn-456', provider: 'plaid' },
      ];
      prisma.providerConnection.findMany.mockResolvedValue(connections as any);
      queueService.addSyncTransactionsJob.mockResolvedValue(undefined);

      await service.triggerUserSync('user-123');

      expect(prisma.providerConnection.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
      expect(queueService.addSyncTransactionsJob).toHaveBeenCalledTimes(2);
      expect(queueService.addSyncTransactionsJob).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'bitso',
          userId: 'user-123',
          connectionId: 'conn-123',
          fullSync: false,
        }),
        80
      );
    });

    it('should filter by provider when specified', async () => {
      prisma.providerConnection.findMany.mockResolvedValue([mockConnection] as any);
      queueService.addSyncTransactionsJob.mockResolvedValue(undefined);

      await service.triggerUserSync('user-123', 'bitso');

      expect(prisma.providerConnection.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', provider: 'bitso' },
      });
    });

    it('should handle empty connections', async () => {
      prisma.providerConnection.findMany.mockResolvedValue([]);

      await service.triggerUserSync('user-123');

      expect(queueService.addSyncTransactionsJob).not.toHaveBeenCalled();
    });
  });

  describe('triggerSpaceCategorization', () => {
    it('should trigger categorization job for space', async () => {
      queueService.addCategorizeTransactionsJob.mockResolvedValue(undefined);

      await service.triggerSpaceCategorization('space-123');

      expect(queueService.addCategorizeTransactionsJob).toHaveBeenCalledWith(
        { spaceId: 'space-123' },
        70
      );
    });
  });

  describe('triggerESGRefresh', () => {
    it('should trigger ESG refresh job with normal priority', async () => {
      queueService.addESGUpdateJob.mockResolvedValue(undefined);

      await service.triggerESGRefresh(['BTC', 'ETH']);

      expect(queueService.addESGUpdateJob).toHaveBeenCalledWith(
        { symbols: ['BTC', 'ETH'], forceRefresh: false },
        30
      );
    });

    it('should trigger ESG refresh job with high priority when forced', async () => {
      queueService.addESGUpdateJob.mockResolvedValue(undefined);

      await service.triggerESGRefresh(['BTC', 'ETH'], true);

      expect(queueService.addESGUpdateJob).toHaveBeenCalledWith(
        { symbols: ['BTC', 'ETH'], forceRefresh: true },
        90
      );
    });
  });

  describe('triggerValuationSnapshot', () => {
    it('should trigger valuation snapshot job', async () => {
      queueService.addValuationSnapshotJob.mockResolvedValue(undefined);

      await service.triggerValuationSnapshot('space-123');

      expect(queueService.addValuationSnapshotJob).toHaveBeenCalledWith(
        { spaceId: 'space-123', date: undefined },
        60
      );
    });

    it('should trigger valuation snapshot job with specific date', async () => {
      queueService.addValuationSnapshotJob.mockResolvedValue(undefined);

      await service.triggerValuationSnapshot('space-123', '2025-01-01');

      expect(queueService.addValuationSnapshotJob).toHaveBeenCalledWith(
        { spaceId: 'space-123', date: '2025-01-01' },
        60
      );
    });
  });

  describe('triggerBulkSync', () => {
    it('should trigger sync for multiple users', async () => {
      prisma.providerConnection.findMany.mockResolvedValue([mockConnection] as any);
      queueService.addSyncTransactionsJob.mockResolvedValue(undefined);

      await service.triggerBulkSync(['user-1', 'user-2', 'user-3']);

      expect(prisma.providerConnection.findMany).toHaveBeenCalledTimes(3);
    });
  });

  describe('triggerBulkCategorization', () => {
    it('should trigger categorization for multiple spaces', async () => {
      queueService.addCategorizeTransactionsJob.mockResolvedValue(undefined);

      await service.triggerBulkCategorization(['space-1', 'space-2']);

      expect(queueService.addCategorizeTransactionsJob).toHaveBeenCalledTimes(2);
      expect(queueService.addCategorizeTransactionsJob).toHaveBeenCalledWith(
        { spaceId: 'space-1' },
        70
      );
      expect(queueService.addCategorizeTransactionsJob).toHaveBeenCalledWith(
        { spaceId: 'space-2' },
        70
      );
    });
  });

  describe('categorizeNewTransactions (Cron)', () => {
    it('should queue categorization jobs for all spaces', async () => {
      const spaces = [{ id: 'space-1' }, { id: 'space-2' }];
      prisma.space.findMany.mockResolvedValue(spaces as any);
      queueService.addCategorizeTransactionsJob.mockResolvedValue(undefined);

      await service.categorizeNewTransactions();

      expect(prisma.space.findMany).toHaveBeenCalledWith({ select: { id: true } });
      expect(queueService.addCategorizeTransactionsJob).toHaveBeenCalledTimes(2);
      expect(queueService.addCategorizeTransactionsJob).toHaveBeenCalledWith(
        { spaceId: 'space-1' },
        30,
        expect.stringMatching(/^cron-categorize-space-1-\d{4}-\d{2}-\d{2}T\d{2}$/)
      );
    });
  });

  describe('syncCryptoPortfolios (Cron)', () => {
    it('should queue sync jobs for all Bitso connections', async () => {
      const connections = [
        { userId: 'user-1', id: 'conn-1' },
        { userId: 'user-2', id: 'conn-2' },
      ];
      prisma.providerConnection.findMany.mockResolvedValue(connections as any);
      queueService.addSyncTransactionsJob.mockResolvedValue(undefined);

      await service.syncCryptoPortfolios();

      expect(prisma.providerConnection.findMany).toHaveBeenCalledWith({
        where: { provider: 'bitso' },
        select: { userId: true, id: true },
        distinct: ['userId'],
      });
      expect(queueService.addSyncTransactionsJob).toHaveBeenCalledTimes(2);
      expect(queueService.addSyncTransactionsJob).toHaveBeenCalledWith(
        {
          provider: 'bitso',
          userId: 'user-1',
          connectionId: 'conn-1',
          fullSync: false,
        },
        50,
        0,
        expect.stringMatching(/^cron-sync-bitso-user-1-conn-1-\d{4}-\d{2}-\d{2}T\d{2}$/)
      );
    });
  });

  describe('generateValuationSnapshots (Cron)', () => {
    it('should queue snapshot jobs for all spaces', async () => {
      const spaces = [{ id: 'space-1' }, { id: 'space-2' }];
      prisma.space.findMany.mockResolvedValue(spaces as any);
      queueService.addValuationSnapshotJob.mockResolvedValue(undefined);

      await service.generateValuationSnapshots();

      expect(prisma.space.findMany).toHaveBeenCalledWith({ select: { id: true } });
      expect(queueService.addValuationSnapshotJob).toHaveBeenCalledTimes(2);
    });
  });

  describe('refreshESGData (Cron)', () => {
    it('should queue ESG refresh for crypto symbols', async () => {
      const accounts = [{ metadata: { cryptoCurrency: 'btc' } }, { metadata: { symbol: 'ETH' } }];
      prisma.account.findMany.mockResolvedValue(accounts as any);
      queueService.addESGUpdateJob.mockResolvedValue(undefined);

      await service.refreshESGData();

      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: { type: 'crypto' },
        select: { metadata: true },
        distinct: ['metadata'],
      });
      expect(queueService.addESGUpdateJob).toHaveBeenCalledWith(
        expect.objectContaining({
          symbols: expect.arrayContaining(['BTC', 'ETH', 'ADA', 'DOT', 'SOL']),
          forceRefresh: false,
        }),
        25,
        expect.stringMatching(/^cron-esg-refresh-\d{4}-\d{2}-\d{2}T\d{2}$/)
      );
    });

    it('should include popular cryptocurrencies', async () => {
      prisma.account.findMany.mockResolvedValue([]);
      queueService.addESGUpdateJob.mockResolvedValue(undefined);

      await service.refreshESGData();

      expect(queueService.addESGUpdateJob).toHaveBeenCalledWith(
        expect.objectContaining({
          symbols: expect.arrayContaining([
            'BTC',
            'ETH',
            'ADA',
            'DOT',
            'SOL',
            'ALGO',
            'MATIC',
            'AVAX',
          ]),
        }),
        25,
        expect.stringMatching(/^cron-esg-refresh-\d{4}-\d{2}-\d{2}T\d{2}$/)
      );
    });
  });

  describe('getJobStatistics', () => {
    it('should return job statistics summary', async () => {
      queueService.getAllQueueStats.mockResolvedValue(mockQueueStats);

      const result = await service.getJobStatistics();

      expect(result.queues).toEqual(mockQueueStats);
      expect(result.summary.totalJobs).toBe(164); // 5+2+100+3+0 + 0+1+50+1+2
      expect(result.summary.activeJobs).toBe(3); // 2+1
      expect(result.summary.failedJobs).toBe(4); // 3+1
      expect(result.timestamp).toBeDefined();
    });

    it('should calculate success rate', async () => {
      queueService.getAllQueueStats.mockResolvedValue(mockQueueStats);

      const result = await service.getJobStatistics();

      // (164-4)/164 * 100 = 97.56
      expect(result.summary.successRate).toBe('97.56');
    });

    it('should return 100% success rate when no jobs', async () => {
      queueService.getAllQueueStats.mockResolvedValue([]);

      const result = await service.getJobStatistics();

      expect(result.summary.successRate).toBe('100');
    });
  });

  describe('getFailedJobs', () => {
    it('should return stats for specific queue', async () => {
      queueService.getQueueStats.mockResolvedValue(mockQueueStats[0]);

      const result = await service.getFailedJobs('sync-transactions');

      expect(queueService.getQueueStats).toHaveBeenCalledWith('sync-transactions');
      expect(result).toEqual(mockQueueStats[0]);
    });

    it('should return all queue stats when no queue specified', async () => {
      queueService.getAllQueueStats.mockResolvedValue(mockQueueStats);

      const result = await service.getFailedJobs();

      expect(queueService.getAllQueueStats).toHaveBeenCalled();
      expect(result).toEqual(mockQueueStats);
    });
  });

  describe('retryAllFailedJobs', () => {
    it('should retry failed jobs in queues with failures', async () => {
      queueService.getAllQueueStats.mockResolvedValue(mockQueueStats);
      queueService.retryFailedJobs.mockResolvedValue(undefined);

      await service.retryAllFailedJobs();

      // Both queues have failed jobs
      expect(queueService.retryFailedJobs).toHaveBeenCalledTimes(2);
      expect(queueService.retryFailedJobs).toHaveBeenCalledWith('sync-transactions');
      expect(queueService.retryFailedJobs).toHaveBeenCalledWith('categorize-transactions');
    });

    it('should skip queues with no failed jobs', async () => {
      const statsWithNoFailures = [{ ...mockQueueStats[0], failed: 0 }];
      queueService.getAllQueueStats.mockResolvedValue(statsWithNoFailures);
      queueService.retryFailedJobs.mockResolvedValue(undefined);

      await service.retryAllFailedJobs();

      expect(queueService.retryFailedJobs).not.toHaveBeenCalled();
    });
  });
});
