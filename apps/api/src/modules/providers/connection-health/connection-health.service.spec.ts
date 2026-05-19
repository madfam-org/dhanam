import { Test, TestingModule } from '@nestjs/testing';

import { ConnectionStatus } from '@db';

import { createPrismaMock, createLoggerMock } from '../../../../test/helpers/api-mock-factory';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { CircuitBreakerService } from '../orchestrator/circuit-breaker.service';

import { ConnectionHealthService } from './connection-health.service';

describe('ConnectionHealthService', () => {
  let service: ConnectionHealthService;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let circuitBreakerMock: jest.Mocked<Partial<CircuitBreakerService>>;

  const testSpaceId = 'space-123';
  const testAccountId = 'account-456';

  beforeEach(async () => {
    jest.clearAllMocks();

    prismaMock = createPrismaMock();
    circuitBreakerMock = {
      getState: jest.fn().mockResolvedValue({
        provider: 'plaid',
        region: 'US',
        state: 'closed',
        failureCount: 0,
        lastFailure: null,
      }),
      recordSuccess: jest.fn().mockResolvedValue(undefined),
      recordFailure: jest.fn().mockResolvedValue({ isOpen: false }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConnectionHealthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: CircuitBreakerService, useValue: circuitBreakerMock },
      ],
    }).compile();

    service = module.get<ConnectionHealthService>(ConnectionHealthService);
    (service as any).logger = createLoggerMock();
  });

  describe('getConnectionHealth', () => {
    const mockAccounts = [
      {
        id: 'acc-1',
        name: 'Checking Account',
        provider: 'plaid',
        spaceId: testSpaceId,
        lastSyncedAt: new Date(),
        connection: { status: ConnectionStatus.connected, metadata: null },
      },
      {
        id: 'acc-2',
        name: 'Credit Card',
        provider: 'plaid',
        spaceId: testSpaceId,
        lastSyncedAt: new Date(),
        connection: { status: ConnectionStatus.connected, metadata: null },
      },
    ];

    beforeEach(() => {
      prismaMock.account.findMany.mockResolvedValue(mockAccounts);
      prismaMock.connectionAttempt.findMany.mockResolvedValue([]);
      prismaMock.providerHealthStatus.findMany.mockResolvedValue([]);
    });

    it('should return health summary for all accounts', async () => {
      const result = await service.getConnectionHealth(testSpaceId);

      expect(result.totalConnections).toBe(2);
      expect(result.accounts).toHaveLength(2);
      expect(result.healthyCount).toBe(2);
      expect(result.overallHealthScore).toBe(100);
    });

    it('should filter out manual accounts', async () => {
      prismaMock.account.findMany.mockResolvedValue([
        ...mockAccounts,
        { id: 'manual-1', name: 'Manual Asset', provider: 'manual', spaceId: testSpaceId },
      ]);

      const result = await service.getConnectionHealth(testSpaceId);

      // findMany should be called with filter excluding manual
      expect(prismaMock.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            provider: { not: 'manual' },
          }),
        })
      );
    });

    it('should mark account as error when connection status is error', async () => {
      prismaMock.account.findMany.mockResolvedValue([
        {
          id: 'acc-1',
          name: 'Error Account',
          provider: 'plaid',
          spaceId: testSpaceId,
          lastSyncedAt: new Date(),
          connection: { status: ConnectionStatus.error, metadata: null },
        },
      ]);

      const result = await service.getConnectionHealth(testSpaceId);

      expect(result.accounts[0].status).toBe('error');
      expect(result.accounts[0].healthScore).toBe(20);
      expect(result.accounts[0].actionRequired).toContain('Connection error');
      expect(result.errorCount).toBe(1);
    });

    it('should mark account as disconnected when connection status is disconnected', async () => {
      prismaMock.account.findMany.mockResolvedValue([
        {
          id: 'acc-1',
          name: 'Disconnected Account',
          provider: 'plaid',
          spaceId: testSpaceId,
          lastSyncedAt: new Date(),
          connection: { status: ConnectionStatus.disconnected, metadata: null },
        },
      ]);

      const result = await service.getConnectionHealth(testSpaceId);

      expect(result.accounts[0].status).toBe('disconnected');
      expect(result.accounts[0].healthScore).toBe(0);
      expect(result.accounts[0].actionRequired).toContain('disconnected');
    });

    it('should mark account as requires_reauth when metadata indicates expiration', async () => {
      prismaMock.account.findMany.mockResolvedValue([
        {
          id: 'acc-1',
          name: 'Expired Account',
          provider: 'plaid',
          spaceId: testSpaceId,
          lastSyncedAt: new Date(),
          connection: {
            status: ConnectionStatus.connected,
            metadata: { pendingExpiration: true },
          },
        },
      ]);

      const result = await service.getConnectionHealth(testSpaceId);

      expect(result.accounts[0].status).toBe('requires_reauth');
      expect(result.accounts[0].healthScore).toBe(10);
      expect(result.accounts[0].actionRequired).toContain('Authorization expired');
      expect(result.requiresReauthCount).toBe(1);
    });

    it('should mark account as requires_reauth when revoked', async () => {
      prismaMock.account.findMany.mockResolvedValue([
        {
          id: 'acc-1',
          name: 'Revoked Account',
          provider: 'plaid',
          spaceId: testSpaceId,
          lastSyncedAt: new Date(),
          connection: {
            status: ConnectionStatus.connected,
            metadata: { revokedAt: new Date().toISOString() },
          },
        },
      ]);

      const result = await service.getConnectionHealth(testSpaceId);

      expect(result.accounts[0].status).toBe('requires_reauth');
    });

    it('should degrade health for consecutive failures', async () => {
      prismaMock.account.findMany.mockResolvedValue([mockAccounts[0]]);
      prismaMock.connectionAttempt.findMany.mockResolvedValue([
        { accountId: 'acc-1', status: 'failure', errorMessage: 'Sync failed' },
        { accountId: 'acc-1', status: 'failure', errorMessage: 'Sync failed' },
        { accountId: 'acc-1', status: 'failure', errorMessage: 'Sync failed' },
      ]);

      const result = await service.getConnectionHealth(testSpaceId);

      expect(result.accounts[0].status).toBe('degraded');
      expect(result.accounts[0].healthScore).toBeLessThanOrEqual(60);
      expect(result.accounts[0].consecutiveFails).toBe(3);
    });

    it('should mark as error for 5+ consecutive failures', async () => {
      prismaMock.account.findMany.mockResolvedValue([mockAccounts[0]]);
      prismaMock.connectionAttempt.findMany.mockResolvedValue(
        Array(5)
          .fill(null)
          .map(() => ({
            accountId: 'acc-1',
            status: 'failure',
            errorMessage: 'Sync failed',
          }))
      );

      const result = await service.getConnectionHealth(testSpaceId);

      expect(result.accounts[0].status).toBe('error');
      expect(result.accounts[0].healthScore).toBeLessThanOrEqual(30);
      expect(result.accounts[0].actionRequired).toContain('5 failed sync attempts');
    });

    it('should degrade health for accounts not synced in 48+ hours', async () => {
      prismaMock.account.findMany.mockResolvedValue([
        {
          ...mockAccounts[0],
          lastSyncedAt: new Date(Date.now() - 49 * 60 * 60 * 1000), // 49 hours ago
        },
      ]);

      const result = await service.getConnectionHealth(testSpaceId);

      expect(result.accounts[0].status).toBe('degraded');
      expect(result.accounts[0].healthScore).toBeLessThanOrEqual(50);
      expect(result.accounts[0].actionRequired).toContain('not synced in over 48 hours');
    });

    it('should reduce health score for accounts not synced in 24+ hours', async () => {
      prismaMock.account.findMany.mockResolvedValue([
        {
          ...mockAccounts[0],
          lastSyncedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
        },
      ]);

      const result = await service.getConnectionHealth(testSpaceId);

      expect(result.accounts[0].healthScore).toBeLessThanOrEqual(70);
    });

    it('should degrade health when provider circuit breaker is open', async () => {
      prismaMock.account.findMany.mockResolvedValue([mockAccounts[0]]);
      prismaMock.providerHealthStatus.findMany.mockResolvedValue([
        { provider: 'plaid', region: 'US', circuitBreakerOpen: true },
      ]);

      const result = await service.getConnectionHealth(testSpaceId);

      expect(result.accounts[0].status).toBe('degraded');
      expect(result.accounts[0].healthScore).toBeLessThanOrEqual(40);
      expect(result.accounts[0].actionRequired).toContain('provider is experiencing issues');
    });

    it('should calculate overall health score as average', async () => {
      prismaMock.account.findMany.mockResolvedValue([
        {
          ...mockAccounts[0],
          connection: { status: ConnectionStatus.error, metadata: null }, // score 20
        },
        {
          ...mockAccounts[1],
          connection: { status: ConnectionStatus.connected, metadata: null }, // score 100
        },
      ]);

      const result = await service.getConnectionHealth(testSpaceId);

      // Average of 20 and 100 = 60
      expect(result.overallHealthScore).toBe(60);
    });

    it('should return 100 for overall health score when no accounts', async () => {
      prismaMock.account.findMany.mockResolvedValue([]);

      const result = await service.getConnectionHealth(testSpaceId);

      expect(result.overallHealthScore).toBe(100);
      expect(result.totalConnections).toBe(0);
    });

    it('should include provider health information', async () => {
      prismaMock.providerHealthStatus.findMany.mockResolvedValue([
        {
          provider: 'plaid',
          region: 'US',
          status: 'healthy',
          errorRate: { toNumber: () => 0.05 },
          avgResponseTimeMs: 250,
        },
      ]);

      const result = await service.getConnectionHealth(testSpaceId);

      expect(result.providerHealth).toHaveLength(1);
      expect(result.providerHealth[0]).toEqual({
        provider: 'plaid',
        status: 'healthy',
        circuitState: 'closed',
        errorRate: 0.05,
        avgResponseTime: 250,
      });
    });
  });

  describe('getAccountHealth', () => {
    const mockAccount = {
      id: testAccountId,
      name: 'Test Account',
      provider: 'plaid',
      spaceId: testSpaceId,
      lastSyncedAt: new Date(),
      connection: { status: ConnectionStatus.connected, metadata: null },
    };

    beforeEach(() => {
      prismaMock.account.findUnique.mockResolvedValue(mockAccount);
      prismaMock.account.findMany.mockResolvedValue([mockAccount]);
      prismaMock.connectionAttempt.findMany.mockResolvedValue([]);
      prismaMock.providerHealthStatus.findMany.mockResolvedValue([]);
    });

    it('should return health for a single account', async () => {
      const result = await service.getAccountHealth(testAccountId);

      expect(result).not.toBeNull();
      expect(result?.accountId).toBe(testAccountId);
      expect(result?.status).toBe('healthy');
    });

    it('should return null for non-existent account', async () => {
      prismaMock.account.findUnique.mockResolvedValue(null);

      const result = await service.getAccountHealth('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('recordConnectionAttempt', () => {
    it('should create a connection attempt record', async () => {
      prismaMock.connectionAttempt.create.mockResolvedValue({} as any);

      await service.recordConnectionAttempt(testSpaceId, testAccountId, 'plaid', 'success');

      expect(prismaMock.connectionAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          spaceId: testSpaceId,
          accountId: testAccountId,
          provider: 'plaid',
          status: 'success',
          attemptType: 'sync',
          failoverUsed: false,
        }),
      });
    });

    it('should record with optional parameters', async () => {
      prismaMock.connectionAttempt.create.mockResolvedValue({} as any);

      await service.recordConnectionAttempt(testSpaceId, testAccountId, 'plaid', 'failure', {
        institutionId: 'inst-123',
        attemptType: 'link',
        errorCode: 'ITEM_ERROR',
        errorMessage: 'Connection failed',
        responseTimeMs: 1500,
        failoverUsed: true,
        failoverProvider: 'mx',
      });

      expect(prismaMock.connectionAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          institutionId: 'inst-123',
          attemptType: 'link',
          errorCode: 'ITEM_ERROR',
          errorMessage: 'Connection failed',
          responseTimeMs: 1500,
          failoverUsed: true,
          failoverProvider: 'mx',
        }),
      });
    });

    it('should record success with circuit breaker', async () => {
      prismaMock.connectionAttempt.create.mockResolvedValue({} as any);

      await service.recordConnectionAttempt(testSpaceId, testAccountId, 'plaid', 'success', {
        responseTimeMs: 200,
      });

      expect(circuitBreakerMock.recordSuccess).toHaveBeenCalledWith('plaid', 'US', 200);
    });

    it('should record failure with circuit breaker', async () => {
      prismaMock.connectionAttempt.create.mockResolvedValue({} as any);

      await service.recordConnectionAttempt(testSpaceId, testAccountId, 'plaid', 'failure', {
        errorMessage: 'Connection timeout',
        responseTimeMs: 5000,
      });

      expect(circuitBreakerMock.recordFailure).toHaveBeenCalledWith(
        'plaid',
        'US',
        'Connection timeout',
        5000
      );
    });

    it('should allow null accountId', async () => {
      prismaMock.connectionAttempt.create.mockResolvedValue({} as any);

      await service.recordConnectionAttempt(testSpaceId, null, 'plaid', 'success');

      expect(prismaMock.connectionAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accountId: null,
        }),
      });
    });
  });

  describe('getAccountsNeedingAttention', () => {
    beforeEach(() => {
      prismaMock.connectionAttempt.findMany.mockResolvedValue([]);
      prismaMock.providerHealthStatus.findMany.mockResolvedValue([]);
    });

    it('should return accounts with errors', async () => {
      prismaMock.account.findMany.mockResolvedValue([
        {
          id: 'acc-1',
          name: 'Error Account',
          provider: 'plaid',
          spaceId: testSpaceId,
          lastSyncedAt: new Date(),
          connection: { status: ConnectionStatus.error, metadata: null },
        },
        {
          id: 'acc-2',
          name: 'Healthy Account',
          provider: 'plaid',
          spaceId: testSpaceId,
          lastSyncedAt: new Date(),
          connection: { status: ConnectionStatus.connected, metadata: null },
        },
      ]);

      const result = await service.getAccountsNeedingAttention(testSpaceId);

      expect(result).toHaveLength(1);
      expect(result[0].accountId).toBe('acc-1');
    });

    it('should return accounts requiring reauth', async () => {
      prismaMock.account.findMany.mockResolvedValue([
        {
          id: 'acc-1',
          name: 'Reauth Account',
          provider: 'plaid',
          spaceId: testSpaceId,
          lastSyncedAt: new Date(),
          connection: {
            status: ConnectionStatus.connected,
            metadata: { pendingExpiration: true },
          },
        },
      ]);

      const result = await service.getAccountsNeedingAttention(testSpaceId);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('requires_reauth');
    });

    it('should return disconnected accounts', async () => {
      prismaMock.account.findMany.mockResolvedValue([
        {
          id: 'acc-1',
          name: 'Disconnected Account',
          provider: 'plaid',
          spaceId: testSpaceId,
          lastSyncedAt: new Date(),
          connection: { status: ConnectionStatus.disconnected, metadata: null },
        },
      ]);

      const result = await service.getAccountsNeedingAttention(testSpaceId);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('disconnected');
    });

    it('should not return degraded accounts', async () => {
      prismaMock.account.findMany.mockResolvedValue([
        {
          id: 'acc-1',
          name: 'Degraded Account',
          provider: 'plaid',
          spaceId: testSpaceId,
          lastSyncedAt: new Date(Date.now() - 49 * 60 * 60 * 1000), // 49 hours ago
          connection: { status: ConnectionStatus.connected, metadata: null },
        },
      ]);

      const result = await service.getAccountsNeedingAttention(testSpaceId);

      // Degraded is not included, only error/requires_reauth/disconnected
      expect(result).toHaveLength(0);
    });
  });

  describe('getAccountsRequiringReauth', () => {
    beforeEach(() => {
      prismaMock.connectionAttempt.findMany.mockResolvedValue([]);
      prismaMock.providerHealthStatus.findMany.mockResolvedValue([]);
    });

    it('should return account IDs that need reauth', async () => {
      prismaMock.account.findMany.mockResolvedValue([
        {
          id: 'acc-1',
          name: 'Reauth Account',
          provider: 'plaid',
          spaceId: testSpaceId,
          lastSyncedAt: new Date(),
          connection: {
            status: ConnectionStatus.connected,
            metadata: { pendingExpiration: true },
          },
        },
        {
          id: 'acc-2',
          name: 'Healthy Account',
          provider: 'plaid',
          spaceId: testSpaceId,
          lastSyncedAt: new Date(),
          connection: { status: ConnectionStatus.connected, metadata: null },
        },
      ]);

      const result = await service.getAccountsRequiringReauth(testSpaceId);

      expect(result).toEqual(['acc-1']);
    });

    it('should return empty array when no accounts need reauth', async () => {
      prismaMock.account.findMany.mockResolvedValue([
        {
          id: 'acc-1',
          name: 'Healthy Account',
          provider: 'plaid',
          spaceId: testSpaceId,
          lastSyncedAt: new Date(),
          connection: { status: ConnectionStatus.connected, metadata: null },
        },
      ]);

      const result = await service.getAccountsRequiringReauth(testSpaceId);

      expect(result).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle account with no connection', async () => {
      prismaMock.account.findMany.mockResolvedValue([
        {
          id: 'acc-1',
          name: 'No Connection Account',
          provider: 'plaid',
          spaceId: testSpaceId,
          lastSyncedAt: null,
          connection: null,
        },
      ]);
      prismaMock.connectionAttempt.findMany.mockResolvedValue([]);
      prismaMock.providerHealthStatus.findMany.mockResolvedValue([]);

      const result = await service.getConnectionHealth(testSpaceId);

      expect(result.accounts).toHaveLength(1);
      // With no connection and never synced, should be degraded
      expect(result.accounts[0].healthScore).toBeLessThanOrEqual(50);
    });

    it('should handle connection attempt with no accountId', async () => {
      prismaMock.account.findMany.mockResolvedValue([
        {
          id: 'acc-1',
          name: 'Test Account',
          provider: 'plaid',
          spaceId: testSpaceId,
          lastSyncedAt: new Date(),
          connection: { status: ConnectionStatus.connected, metadata: null },
        },
      ]);
      prismaMock.connectionAttempt.findMany.mockResolvedValue([
        { accountId: null, status: 'failure', errorMessage: 'Error' },
      ]);
      prismaMock.providerHealthStatus.findMany.mockResolvedValue([]);

      const result = await service.getConnectionHealth(testSpaceId);

      // Should not crash, and account should still be healthy
      expect(result.accounts[0].status).toBe('healthy');
    });

    it('should handle provider health with null errorRate', async () => {
      prismaMock.account.findMany.mockResolvedValue([]);
      prismaMock.connectionAttempt.findMany.mockResolvedValue([]);
      prismaMock.providerHealthStatus.findMany.mockResolvedValue([
        {
          provider: 'plaid',
          region: 'US',
          status: 'healthy',
          errorRate: null,
          avgResponseTimeMs: 200,
        },
      ]);

      const result = await service.getConnectionHealth(testSpaceId);

      expect(result.providerHealth[0].errorRate).toBe(0);
    });
  });
});
