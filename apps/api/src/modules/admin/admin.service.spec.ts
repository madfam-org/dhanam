import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AuditService } from '@core/audit/audit.service';
import { LoggerService } from '@core/logger/logger.service';
import { PrismaService } from '@core/prisma/prisma.service';
import { RedisService } from '@core/redis/redis.service';

import { AdminService } from './admin.service';
import { UserSearchDto, UserSortBy, SortOrder } from './dto';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: PrismaService;
  let redis: RedisService;
  let auditService: AuditService;

  const mockPrismaService = {
    user: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    userSpace: {
      findMany: jest.fn(),
    },
    space: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    account: {
      count: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    transaction: {
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    budget: {
      count: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    hgetall: jest.fn(),
    hget: jest.fn(),
    hset: jest.fn(),
    ping: jest.fn().mockResolvedValue(true),
  };

  const mockLoggerService = {
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn(),
    logEvent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: LoggerService, useValue: mockLoggerService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    prisma = module.get<PrismaService>(PrismaService);
    redis = module.get<RedisService>(RedisService);
    auditService = module.get<AuditService>(AuditService);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('searchUsers', () => {
    it('should return paginated users', async () => {
      const mockUsers = [
        {
          id: 'user1',
          email: 'user1@example.com',
          name: 'User One',
          _count: { userSpaces: 2, sessions: 1 },
        },
        {
          id: 'user2',
          email: 'user2@example.com',
          name: 'User Two',
          _count: { userSpaces: 1, sessions: 0 },
        },
      ];

      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);
      mockPrismaService.user.count.mockResolvedValue(2);

      const dto: UserSearchDto = {
        page: 1,
        limit: 20,
        sortBy: UserSortBy.CREATED_AT,
        sortOrder: SortOrder.DESC,
      };

      const result = await service.searchUsers(dto);

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
      expect(result.data[0]).toHaveProperty('spaceCount', 2);
      expect(result.data[0]._count).toBeUndefined();
    });

    it('should filter users by search term', async () => {
      const dto: UserSearchDto = {
        search: 'test@example.com',
        page: 1,
        limit: 20,
      };

      await service.searchUsers(dto);

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { email: { contains: 'test@example.com', mode: 'insensitive' } },
              { name: { contains: 'test@example.com', mode: 'insensitive' } },
            ],
          },
        })
      );
    });
  });

  describe('getUserDetails', () => {
    it('should return detailed user information', async () => {
      const mockUser = {
        id: 'user1',
        email: 'user@example.com',
        name: 'Test User',
        userSpaces: [
          {
            spaceId: 'space1',
            role: 'owner',
            createdAt: new Date(),
            space: {
              id: 'space1',
              name: 'Personal Space',
              type: 'personal',
              currency: 'MXN',
              _count: { accounts: 3, budgets: 2 },
            },
          },
        ],
        providerConnections: [
          {
            provider: 'belvo',
            createdAt: new Date(),
          },
        ],
        sessions: [],
        auditLogs: [],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.transaction.count.mockResolvedValue(100);
      mockPrismaService.account.count.mockResolvedValue(3);
      mockPrismaService.transaction.findFirst.mockResolvedValue(null);
      mockPrismaService.account.findFirst.mockResolvedValue(null);
      mockPrismaService.account.findMany.mockResolvedValue([]);

      const result = await service.getUserDetails('user1', 'admin1');

      expect(result.id).toBe('user1');
      expect(result.spaces).toHaveLength(1);
      expect(result.connections).toHaveLength(1);
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'admin.view_user_details',
          resourceId: 'user1',
          severity: 'medium',
        })
      );
    });

    it('should throw NotFoundException for non-existent user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserDetails('invalid', 'admin1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSystemStats', () => {
    it('should return system statistics from cache if available', async () => {
      const cachedStats = JSON.stringify({
        totalUsers: 100,
        activeUsers: 50,
      });

      mockRedisService.get.mockResolvedValue(cachedStats);

      const result = await service.getSystemStats();

      expect(result.totalUsers).toBe(100);
      expect(mockPrismaService.user.count).not.toHaveBeenCalled();
    });

    it('should calculate and cache system statistics', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.count.mockResolvedValue(150);
      mockPrismaService.space.count.mockResolvedValue(200);
      mockPrismaService.space.groupBy.mockResolvedValue([
        { type: 'personal', _count: 150 },
        { type: 'business', _count: 50 },
      ]);
      mockPrismaService.account.count.mockResolvedValue(500);
      mockPrismaService.transaction.count.mockResolvedValue(10000);
      mockPrismaService.budget.count.mockResolvedValue(300);
      mockPrismaService.account.groupBy.mockResolvedValue([
        { provider: 'belvo', _count: 200 },
        { provider: 'plaid', _count: 150 },
      ]);
      mockPrismaService.$queryRaw.mockResolvedValue([{ connection_count: '10' }]);
      mockPrismaService.auditLog.count.mockResolvedValue(0);
      mockPrismaService.auditLog.findFirst.mockResolvedValue(null);

      const result = await service.getSystemStats();

      expect(result.totalUsers).toBe(150);
      expect(result.totalSpaces).toBe(200);
      expect(result.personalSpaces).toBe(150);
      expect(result.businessSpaces).toBe(50);
      expect(mockRedisService.set).toHaveBeenCalled();
    });
  });

  describe('getFeatureFlags', () => {
    it('should return all feature flags', async () => {
      const mockFlags = {
        esg_scoring: JSON.stringify({
          name: 'ESG Scoring',
          description: 'Enable ESG scoring',
          enabled: true,
        }),
        advanced_analytics: JSON.stringify({
          name: 'Advanced Analytics',
          description: 'Enable advanced analytics',
          enabled: false,
        }),
      };

      mockRedisService.hgetall.mockResolvedValue(mockFlags);

      const result = await service.getFeatureFlags();

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe('esg_scoring');
      expect(result[0].enabled).toBe(true);
    });
  });

  describe('updateFeatureFlag', () => {
    it('should update an existing feature flag', async () => {
      const existingFlag = JSON.stringify({
        name: 'ESG Scoring',
        description: 'Enable ESG scoring',
        enabled: false,
      });

      mockRedisService.hget.mockResolvedValue(existingFlag);

      const result = await service.updateFeatureFlag('esg_scoring', { enabled: true }, 'admin1');

      expect(result.enabled).toBe(true);
      expect(mockRedisService.hset).toHaveBeenCalled();
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'admin.update_feature_flag',
          resourceId: 'esg_scoring',
          severity: 'high',
        })
      );
    });

    it('should throw NotFoundException for non-existent feature flag', async () => {
      mockRedisService.hget.mockResolvedValue(null);

      await expect(
        service.updateFeatureFlag('invalid', { enabled: true }, 'admin1')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('searchAuditLogs', () => {
    it('should search audit logs with filters', async () => {
      const mockLogs = [
        {
          id: 'log1',
          userId: 'user1',
          action: 'login',
          resource: 'User',
          resourceId: 'user1',
          severity: 'low',
          timestamp: new Date(),
          user: {
            id: 'user1',
            email: 'user1@example.com',
            name: 'User One',
          },
        },
      ];

      mockPrismaService.auditLog.findMany.mockResolvedValue(mockLogs);
      mockPrismaService.auditLog.count.mockResolvedValue(1);

      const dto = {
        page: 1,
        limit: 20,
        userId: 'user1',
        action: 'login',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      };

      const result = await service.searchAuditLogs(dto);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user1',
            action: { contains: 'login', mode: 'insensitive' },
            timestamp: {
              gte: expect.any(Date),
              lte: expect.any(Date),
            },
          }),
        })
      );
    });

    it('should handle empty audit log results', async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue([]);
      mockPrismaService.auditLog.count.mockResolvedValue(0);

      const result = await service.searchAuditLogs({
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('getOnboardingFunnel', () => {
    it('should calculate onboarding funnel metrics correctly', async () => {
      // Mock all the counts
      mockPrismaService.user.count
        .mockResolvedValueOnce(1000) // totalStarted
        .mockResolvedValueOnce(800) // emailVerified
        .mockResolvedValueOnce(600) // profileSetup
        .mockResolvedValueOnce(500) // spaceCreated
        .mockResolvedValueOnce(400) // firstConnection
        .mockResolvedValueOnce(350); // completed

      mockPrismaService.user.findMany
        .mockResolvedValueOnce([
          {
            createdAt: new Date('2024-01-01'),
            onboardingCompletedAt: new Date('2024-01-02'),
          },
        ]) // completion times
        .mockResolvedValueOnce([
          {
            providerConnections: [{ provider: 'belvo' }],
          },
          {
            providerConnections: [{ provider: 'plaid' }],
          },
        ]); // first connections

      // Mock time-based metrics
      mockPrismaService.user.count
        .mockResolvedValueOnce(10) // 24h started
        .mockResolvedValueOnce(5) // 24h completed
        .mockResolvedValueOnce(50) // 7d started
        .mockResolvedValueOnce(30) // 7d completed
        .mockResolvedValueOnce(200) // 30d started
        .mockResolvedValueOnce(150); // 30d completed

      const result = await service.getOnboardingFunnel();

      expect(result).toMatchObject({
        totalStarted: 1000,
        stepBreakdown: {
          emailVerification: 800,
          profileSetup: 600,
          spaceCreation: 500,
          firstConnection: 400,
          completed: 350,
        },
        conversionRates: {
          startToEmailVerified: 80,
          emailVerifiedToProfile: 75,
          profileToSpace: expect.closeTo(83.33, 2),
          spaceToConnection: 80,
          connectionToComplete: 87.5,
          overallConversion: 35,
        },
        averageCompletionTime: 24, // 1 day in hours
        abandonmentRates: {
          emailVerification: 20,
          profileSetup: 25,
          spaceCreation: expect.closeTo(16.67, 2),
          firstConnection: 20,
        },
        timeMetrics: {
          last24Hours: { started: 10, completed: 5 },
          last7Days: { started: 50, completed: 30 },
          last30Days: { started: 200, completed: 150 },
        },
      });
    });

    it('should handle zero counts gracefully', async () => {
      // Mock all counts as zero
      mockPrismaService.user.count.mockResolvedValue(0);
      mockPrismaService.user.findMany.mockResolvedValue([]);

      const result = await service.getOnboardingFunnel();

      expect(result.totalStarted).toBe(0);
      expect(result.conversionRates.overallConversion).toBe(0);
      expect(result.averageCompletionTime).toBe(0);
    });
  });

  describe('private helper methods', () => {
    it('should get database connections count', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ connection_count: '25' }]);

      const stats = await service.getSystemStats();

      expect(stats.systemHealth.databaseConnections).toBe(25);
    });

    it('should handle database connection query failure', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(new Error('Query failed'));
      mockRedisService.get.mockResolvedValue(null);

      // Mock all other required calls
      mockPrismaService.user.count.mockResolvedValue(0);
      mockPrismaService.space.count.mockResolvedValue(0);
      mockPrismaService.space.groupBy.mockResolvedValue([]);
      mockPrismaService.account.count.mockResolvedValue(0);
      mockPrismaService.transaction.count.mockResolvedValue(0);
      mockPrismaService.budget.count.mockResolvedValue(0);
      mockPrismaService.account.groupBy.mockResolvedValue([]);
      mockPrismaService.auditLog.count.mockResolvedValue(0);
      mockPrismaService.auditLog.findFirst.mockResolvedValue(null);

      const stats = await service.getSystemStats();

      expect(stats.systemHealth.databaseConnections).toBe(0);
    });

    it('should determine queue status correctly', async () => {
      // Test error status
      mockPrismaService.auditLog.count
        .mockResolvedValueOnce(5) // failed jobs
        .mockResolvedValueOnce(0); // active jobs

      mockRedisService.get.mockResolvedValue(null);

      // Mock all required calls
      mockPrismaService.user.count.mockResolvedValue(0);
      mockPrismaService.space.count.mockResolvedValue(0);
      mockPrismaService.space.groupBy.mockResolvedValue([]);
      mockPrismaService.account.count.mockResolvedValue(0);
      mockPrismaService.transaction.count.mockResolvedValue(0);
      mockPrismaService.budget.count.mockResolvedValue(0);
      mockPrismaService.account.groupBy.mockResolvedValue([]);
      mockPrismaService.auditLog.findFirst.mockResolvedValue(null);
      mockPrismaService.$queryRaw.mockResolvedValue([{ connection_count: '10' }]);

      const stats = await service.getSystemStats();

      expect(stats.systemHealth.jobQueueStatus).toBe('error');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle partial data in getUserDetails', async () => {
      const userWithMinimalData = {
        id: 'user1',
        email: 'user@example.com',
        name: null,
        userSpaces: [],
        providerConnections: [],
        sessions: [],
        auditLogs: [],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(userWithMinimalData);
      mockPrismaService.transaction.count.mockResolvedValue(0);
      mockPrismaService.account.count.mockResolvedValue(0);
      mockPrismaService.transaction.findFirst.mockResolvedValue(null);
      mockPrismaService.account.findFirst.mockResolvedValue(null);
      mockPrismaService.account.findMany.mockResolvedValue([]);

      const result = await service.getUserDetails('user1', 'admin1');

      expect(result).toBeTruthy();
      expect(result.spaces).toHaveLength(0);
      expect(result.connections).toHaveLength(0);
      expect(result.activitySummary.totalTransactions).toBe(0);
    });

    it('should filter users by isActive flag', async () => {
      const dto: UserSearchDto = {
        page: 1,
        limit: 20,
        isActive: true,
      };

      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.user.count.mockResolvedValue(0);

      await service.searchUsers(dto);

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        })
      );
    });

    it('should filter users by emailVerified flag', async () => {
      const dto: UserSearchDto = {
        page: 1,
        limit: 20,
        emailVerified: false,
      };

      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.user.count.mockResolvedValue(0);

      await service.searchUsers(dto);

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { emailVerified: false },
        })
      );
    });

    it('should filter users by totpEnabled flag', async () => {
      const dto: UserSearchDto = {
        page: 1,
        limit: 20,
        totpEnabled: true,
      };

      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.user.count.mockResolvedValue(0);

      await service.searchUsers(dto);

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { totpEnabled: true },
        })
      );
    });

    it('should filter users by onboardingCompleted flag', async () => {
      const dto: UserSearchDto = {
        page: 1,
        limit: 20,
        onboardingCompleted: false,
      };

      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.user.count.mockResolvedValue(0);

      await service.searchUsers(dto);

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { onboardingCompleted: false },
        })
      );
    });

    it('should handle date filtering edge cases in searchUsers', async () => {
      const dto = {
        page: 1,
        limit: 20,
        createdAfter: '2024-01-01T00:00:00Z',
        createdBefore: '2024-12-31T23:59:59Z',
      };

      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.user.count.mockResolvedValue(0);

      await service.searchUsers(dto);

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            createdAt: {
              gte: expect.any(Date),
              lte: expect.any(Date),
            },
          },
        })
      );
    });

    it('should handle missing provider connections gracefully', async () => {
      const user = {
        id: 'user1',
        email: 'user@example.com',
        userSpaces: [{ spaceId: 'space1', space: { _count: { accounts: 1, budgets: 0 } } }],
        providerConnections: [],
        sessions: [],
        auditLogs: [],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockPrismaService.transaction.count.mockResolvedValue(0);
      mockPrismaService.account.count.mockResolvedValue(1);
      mockPrismaService.transaction.findFirst.mockResolvedValue(null);
      mockPrismaService.account.findFirst.mockResolvedValue(null);
      mockPrismaService.account.findMany.mockResolvedValue([
        { provider: 'manual', lastSyncAt: new Date(), status: 'active' },
      ]);

      const result = await service.getUserDetails('user1', 'admin1');

      expect(result.connections).toHaveLength(0);
    });

    it('should update provider connection lastSyncedAt correctly', async () => {
      const now = new Date();
      const earlier = new Date(now.getTime() - 3600000); // 1 hour earlier
      const mockUser = {
        id: 'user1',
        email: 'user@example.com',
        name: 'Test User',
        userSpaces: [
          {
            spaceId: 'space1',
            role: 'owner',
            createdAt: now,
            space: {
              id: 'space1',
              name: 'Personal Space',
              type: 'personal',
              currency: 'MXN',
              _count: { accounts: 2, budgets: 1 },
            },
          },
        ],
        providerConnections: [
          {
            id: 'conn1',
            provider: 'belvo',
            providerUserId: 'belvo-123',
            metadata: {},
            createdAt: earlier,
            updatedAt: now,
          },
        ],
        sessions: [{ id: 'session1', createdAt: now }],
        auditLogs: [
          {
            id: 'log1',
            action: 'login',
            resource: 'User',
            resourceId: 'user1',
            severity: 'low',
            timestamp: now,
            ipAddress: '192.168.1.1',
          },
        ],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.transaction.count.mockResolvedValue(50);
      mockPrismaService.account.count.mockResolvedValue(2);
      mockPrismaService.transaction.findFirst.mockResolvedValue({ date: now });
      mockPrismaService.account.findFirst.mockResolvedValue({ lastSyncedAt: now });
      // Return accounts with lastSyncedAt - should update the provider connection
      mockPrismaService.account.findMany.mockResolvedValue([
        { provider: 'belvo', lastSyncedAt: earlier },
        { provider: 'belvo', lastSyncedAt: now },
      ]);

      const result = await service.getUserDetails('user1', 'admin1');

      expect(result.connections).toHaveLength(1);
      expect(result.connections[0].provider).toBe('belvo');
      expect(result.connections[0].accountCount).toBe(2);
      expect(result.connections[0].lastSyncedAt).toEqual(now);
    });

    it('should format audit logs with optional fields correctly', async () => {
      const now = new Date();
      const mockUser = {
        id: 'user1',
        email: 'user@example.com',
        name: 'Test User',
        userSpaces: [],
        providerConnections: [],
        sessions: [{ id: 'session1', createdAt: now }],
        auditLogs: [
          {
            id: 'log1',
            action: 'login',
            resource: null,
            resourceId: null,
            severity: 'low',
            timestamp: now,
            ipAddress: null,
          },
          {
            id: 'log2',
            action: 'password_change',
            resource: 'User',
            resourceId: 'user1',
            severity: 'high',
            timestamp: now,
            ipAddress: '10.0.0.1',
          },
        ],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.transaction.count.mockResolvedValue(0);
      mockPrismaService.account.count.mockResolvedValue(0);
      mockPrismaService.transaction.findFirst.mockResolvedValue(null);
      mockPrismaService.account.findFirst.mockResolvedValue(null);
      mockPrismaService.account.findMany.mockResolvedValue([]);

      const result = await service.getUserDetails('user1', 'admin1');

      expect(result.recentAuditLogs).toHaveLength(2);
      expect(result.recentAuditLogs[0].resource).toBeUndefined();
      expect(result.recentAuditLogs[0].resourceId).toBeUndefined();
      expect(result.recentAuditLogs[0].ipAddress).toBeUndefined();
      expect(result.recentAuditLogs[1].resource).toBe('User');
      expect(result.recentAuditLogs[1].ipAddress).toBe('10.0.0.1');
      expect(result.sessions.recentIpAddresses).toEqual(['10.0.0.1']);
    });
  });

  describe('searchAuditLogs additional filters', () => {
    it('should filter audit logs by resource', async () => {
      const dto = {
        page: 1,
        limit: 20,
        resource: 'User',
      };

      mockPrismaService.auditLog.findMany.mockResolvedValue([]);
      mockPrismaService.auditLog.count.mockResolvedValue(0);

      await service.searchAuditLogs(dto);

      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ resource: 'User' }),
        })
      );
    });

    it('should filter audit logs by resourceId', async () => {
      const dto = {
        page: 1,
        limit: 20,
        resourceId: 'resource-123',
      };

      mockPrismaService.auditLog.findMany.mockResolvedValue([]);
      mockPrismaService.auditLog.count.mockResolvedValue(0);

      await service.searchAuditLogs(dto);

      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ resourceId: 'resource-123' }),
        })
      );
    });

    it('should filter audit logs by severity', async () => {
      const dto = {
        page: 1,
        limit: 20,
        severity: 'high',
      };

      mockPrismaService.auditLog.findMany.mockResolvedValue([]);
      mockPrismaService.auditLog.count.mockResolvedValue(0);

      await service.searchAuditLogs(dto);

      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ severity: 'high' }),
        })
      );
    });

    it('should filter audit logs by ipAddress', async () => {
      const dto = {
        page: 1,
        limit: 20,
        ipAddress: '192.168.1.100',
      };

      mockPrismaService.auditLog.findMany.mockResolvedValue([]);
      mockPrismaService.auditLog.count.mockResolvedValue(0);

      await service.searchAuditLogs(dto);

      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ ipAddress: '192.168.1.100' }),
        })
      );
    });
  });

  describe('getQueueStatus error and edge cases', () => {
    it('should return active status when active jobs exist', async () => {
      // No failed jobs, but active jobs exist
      mockPrismaService.auditLog.count
        .mockResolvedValueOnce(0) // failed jobs
        .mockResolvedValueOnce(3); // active jobs

      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.count.mockResolvedValue(0);
      mockPrismaService.space.count.mockResolvedValue(0);
      mockPrismaService.space.groupBy.mockResolvedValue([]);
      mockPrismaService.account.count.mockResolvedValue(0);
      mockPrismaService.transaction.count.mockResolvedValue(0);
      mockPrismaService.budget.count.mockResolvedValue(0);
      mockPrismaService.account.groupBy.mockResolvedValue([]);
      mockPrismaService.auditLog.findFirst.mockResolvedValue(null);
      mockPrismaService.$queryRaw.mockResolvedValue([{ connection_count: '10' }]);

      const stats = await service.getSystemStats();

      expect(stats.systemHealth.jobQueueStatus).toBe('active');
    });

    it('should return idle status when no jobs are active', async () => {
      // No failed jobs and no active jobs
      mockPrismaService.auditLog.count
        .mockResolvedValueOnce(0) // failed jobs
        .mockResolvedValueOnce(0); // active jobs

      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.count.mockResolvedValue(0);
      mockPrismaService.space.count.mockResolvedValue(0);
      mockPrismaService.space.groupBy.mockResolvedValue([]);
      mockPrismaService.account.count.mockResolvedValue(0);
      mockPrismaService.transaction.count.mockResolvedValue(0);
      mockPrismaService.budget.count.mockResolvedValue(0);
      mockPrismaService.account.groupBy.mockResolvedValue([]);
      mockPrismaService.auditLog.findFirst.mockResolvedValue(null);
      mockPrismaService.$queryRaw.mockResolvedValue([{ connection_count: '10' }]);

      const stats = await service.getSystemStats();

      expect(stats.systemHealth.jobQueueStatus).toBe('idle');
    });

    it('should return error status when queue status check fails', async () => {
      // Simulate an error in getQueueStatus
      mockPrismaService.auditLog.count.mockRejectedValueOnce(new Error('Query failed'));

      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.count.mockResolvedValue(0);
      mockPrismaService.space.count.mockResolvedValue(0);
      mockPrismaService.space.groupBy.mockResolvedValue([]);
      mockPrismaService.account.count.mockResolvedValue(0);
      mockPrismaService.transaction.count.mockResolvedValue(0);
      mockPrismaService.budget.count.mockResolvedValue(0);
      mockPrismaService.account.groupBy.mockResolvedValue([]);
      mockPrismaService.auditLog.findFirst.mockResolvedValue(null);
      mockPrismaService.$queryRaw.mockResolvedValue([{ connection_count: '10' }]);

      const stats = await service.getSystemStats();

      expect(stats.systemHealth.jobQueueStatus).toBe('error');
    });
  });
});
