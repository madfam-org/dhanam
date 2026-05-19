import { HealthService } from '../../core/monitoring/health.service';

describe('Queue Failure Chaos Tests', () => {
  let service: HealthService;
  let mockPrisma: any;
  let mockConfig: any;
  let mockQueueService: any;

  beforeEach(() => {
    mockPrisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    mockConfig = {
      get: jest.fn((key: string, defaultValue?: string) => {
        const config: Record<string, string> = {
          REDIS_URL: 'redis://localhost:6379',
          NODE_ENV: 'test',
        };
        return config[key] ?? defaultValue;
      }),
    };
    mockQueueService = {
      getAllQueueStats: jest.fn().mockResolvedValue([]),
    };

    service = new HealthService(mockPrisma, mockConfig, mockQueueService);
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('queue stats retrieval fails → queue check is down', async () => {
    mockQueueService.getAllQueueStats.mockRejectedValue(new Error('BullMQ connection failed'));

    const health = await service.getHealthStatus();
    expect(health.checks.queues.status).toBe('down');
    expect(health.checks.queues.error).toContain('BullMQ connection failed');
  });

  it('failed jobs retained in queue history → queue health is degraded', async () => {
    mockQueueService.getAllQueueStats.mockResolvedValue([
      { name: 'sync', active: 2, waiting: 50, completed: 100, failed: 5 },
      { name: 'email', active: 0, waiting: 0, completed: 50, failed: 0 },
    ]);

    const health = await service.getHealthStatus();
    expect(health.checks.queues.status).toBe('degraded');
    expect(health.checks.queues.details.failedJobs).toBe(5);
    expect(health.checks.queues.details.failedQueues).toEqual([{ name: 'sync', failed: 5 }]);
  });

  it('queue backpressure → queue health is down', async () => {
    mockQueueService.getAllQueueStats.mockResolvedValue([
      { name: 'sync', active: 2, waiting: 1001, completed: 100, failed: 0 },
    ]);

    const health = await service.getHealthStatus();
    expect(health.checks.queues.status).toBe('down');
    expect(health.checks.queues.details.backpressure).toBe(true);
  });

  it('empty queues are healthy', async () => {
    mockQueueService.getAllQueueStats.mockResolvedValue([]);

    const health = await service.getHealthStatus();
    expect(health.checks.queues.status).toBe('up');
  });
});
