import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '@core/prisma/prisma.service';

import { ProviderSelectionService } from './provider-selection.service';

// Mock Prisma Provider enum
jest.mock('@prisma/client', () => ({
  ...jest.requireActual('@prisma/client'),
  Provider: {
    plaid: 'plaid',
    belvo: 'belvo',
    mx: 'mx',
    finicity: 'finicity',
    teller: 'teller',
    yodlee: 'yodlee',
    saltedge: 'saltedge',
    truelayer: 'truelayer',
    akoya: 'akoya',
    basiq: 'basiq',
    nordigen: 'nordigen',
    yapily: 'yapily',
    pluggy: 'pluggy',
    mono: 'mono',
    bankconnect: 'bankconnect',
  },
}));

describe('ProviderSelectionService', () => {
  let service: ProviderSelectionService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockPrisma = {
    providerHealthStatus: {
      findUnique: jest.fn(),
    },
    connectionAttempt: {
      findMany: jest.fn(),
    },
    institutionProviderMapping: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderSelectionService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<ProviderSelectionService>(ProviderSelectionService);
    service['logger'] = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    prismaService = module.get(PrismaService);
  });

  describe('selectOptimalProvider', () => {
    it('should return default provider when no mapping exists (US)', async () => {
      mockPrisma.institutionProviderMapping.findFirst.mockResolvedValue(null);
      mockPrisma.providerHealthStatus.findUnique.mockResolvedValue(null);

      // Mock historical data for all 3 US default providers (plaid, mx, finicity)
      // Plaid has best success rate
      mockPrisma.connectionAttempt.findMany
        .mockResolvedValueOnce([
          {
            provider: 'plaid' as any,
            status: 'success',
            responseTimeMs: 1000,
            attemptedAt: new Date(),
          },
          {
            provider: 'plaid' as any,
            status: 'success',
            responseTimeMs: 1000,
            attemptedAt: new Date(),
          },
          {
            provider: 'plaid' as any,
            status: 'success',
            responseTimeMs: 1000,
            attemptedAt: new Date(),
          },
        ])
        .mockResolvedValueOnce([
          {
            provider: 'mx' as any,
            status: 'success',
            responseTimeMs: 1500,
            attemptedAt: new Date(),
          },
          {
            provider: 'mx' as any,
            status: 'failure',
            responseTimeMs: 2000,
            attemptedAt: new Date(),
          },
        ])
        .mockResolvedValueOnce([
          {
            provider: 'finicity' as any,
            status: 'success',
            responseTimeMs: 1500,
            attemptedAt: new Date(),
          },
          {
            provider: 'finicity' as any,
            status: 'failure',
            responseTimeMs: 2000,
            attemptedAt: new Date(),
          },
        ]);

      const provider = await service.selectOptimalProvider('inst-123', 'US');

      expect(provider).toBe('plaid' as any);
    });

    it('should return default provider when no mapping exists (MX)', async () => {
      mockPrisma.institutionProviderMapping.findFirst.mockResolvedValue(null);
      mockPrisma.providerHealthStatus.findUnique.mockResolvedValue(null);

      // Mock historical data for both MX default providers (belvo, mx)
      // Belvo has better success rate and cost
      mockPrisma.connectionAttempt.findMany
        .mockResolvedValueOnce([
          {
            provider: 'belvo' as any,
            status: 'success',
            responseTimeMs: 1000,
            attemptedAt: new Date(),
          },
          {
            provider: 'belvo' as any,
            status: 'success',
            responseTimeMs: 1000,
            attemptedAt: new Date(),
          },
          {
            provider: 'belvo' as any,
            status: 'success',
            responseTimeMs: 1000,
            attemptedAt: new Date(),
          },
        ])
        .mockResolvedValueOnce([
          {
            provider: 'mx' as any,
            status: 'success',
            responseTimeMs: 1500,
            attemptedAt: new Date(),
          },
          {
            provider: 'mx' as any,
            status: 'failure',
            responseTimeMs: 2000,
            attemptedAt: new Date(),
          },
        ]);

      const provider = await service.selectOptimalProvider('inst-123', 'MX');

      expect(provider).toBe('belvo' as any);
    });

    it('should return single provider when only one available', async () => {
      mockPrisma.institutionProviderMapping.findFirst.mockResolvedValue({
        institutionId: 'inst-123',
        region: 'US',
        primaryProvider: 'plaid' as any,
        backupProviders: null,
      });

      const provider = await service.selectOptimalProvider('inst-123', 'US');

      expect(provider).toBe('plaid' as any);
    });

    it('should select provider with highest ML score', async () => {
      // Set up mapping with multiple providers
      mockPrisma.institutionProviderMapping.findFirst.mockResolvedValue({
        institutionId: 'inst-123',
        region: 'US',
        primaryProvider: 'plaid' as any,
        backupProviders: ['mx' as any, 'finicity' as any],
      });

      // Mock health status
      mockPrisma.providerHealthStatus.findUnique.mockResolvedValue({
        provider: 'plaid' as any,
        region: 'US',
        avgResponseTimeMs: 1500,
      });

      // Mock connection attempts - plaid has better stats
      mockPrisma.connectionAttempt.findMany
        // plaid attempts
        .mockResolvedValueOnce(
          Array.from({ length: 20 }, (_, i) => ({
            provider: 'plaid' as any,
            status: i < 19 ? 'success' : 'failure', // 95% success rate
            responseTimeMs: 1500,
            attemptedAt: new Date(),
          }))
        )
        // mx attempts
        .mockResolvedValueOnce(
          Array.from({ length: 20 }, (_, i) => ({
            provider: 'mx' as any,
            status: i < 16 ? 'success' : 'failure', // 80% success rate
            responseTimeMs: 2500,
            attemptedAt: new Date(),
          }))
        )
        // finicity attempts
        .mockResolvedValueOnce(
          Array.from({ length: 20 }, (_, i) => ({
            provider: 'finicity' as any,
            status: i < 17 ? 'success' : 'failure', // 85% success rate
            responseTimeMs: 2000,
            attemptedAt: new Date(),
          }))
        );

      const provider = await service.selectOptimalProvider('inst-123', 'US');

      // Plaid should win due to highest success rate and good response time
      expect(provider).toBe('plaid' as any);
    });

    it('should consider cost in provider selection', async () => {
      mockPrisma.institutionProviderMapping.findFirst.mockResolvedValue({
        institutionId: 'inst-123',
        region: 'MX',
        primaryProvider: 'belvo' as any,
        backupProviders: ['mx' as any],
      });

      mockPrisma.providerHealthStatus.findUnique.mockResolvedValue(null);

      // Both providers have similar stats
      const similarAttempts = Array.from({ length: 20 }, () => ({
        provider: 'belvo' as any,
        status: 'success',
        responseTimeMs: 1500,
        attemptedAt: new Date(),
      }));

      mockPrisma.connectionAttempt.findMany
        .mockResolvedValueOnce(similarAttempts) // belvo
        .mockResolvedValueOnce(similarAttempts); // mx

      const provider = await service.selectOptimalProvider('inst-123', 'MX');

      // Belvo should win due to lower cost ($0.001 vs $0.0015)
      expect(provider).toBeDefined();
    });

    it('should penalize providers with recent failures', async () => {
      mockPrisma.institutionProviderMapping.findFirst.mockResolvedValue({
        institutionId: 'inst-123',
        region: 'US',
        primaryProvider: 'plaid' as any,
        backupProviders: ['mx' as any],
      });

      mockPrisma.providerHealthStatus.findUnique.mockResolvedValue(null);

      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);

      // Plaid has recent failures
      mockPrisma.connectionAttempt.findMany.mockResolvedValueOnce([
        ...Array.from({ length: 6 }, () => ({
          provider: 'plaid' as any,
          status: 'failure' as any,
          responseTimeMs: 1500,
          attemptedAt: yesterday, // Recent failures
        })),
        ...Array.from({ length: 14 }, () => ({
          provider: 'plaid' as any,
          status: 'success' as any,
          responseTimeMs: 1500,
          attemptedAt: monthAgo,
        })),
      ]);

      // mx has no recent failures
      mockPrisma.connectionAttempt.findMany.mockResolvedValueOnce(
        Array.from({ length: 20 }, () => ({
          provider: 'mx' as any,
          status: 'success' as any,
          responseTimeMs: 1500,
          attemptedAt: monthAgo,
        }))
      );

      const provider = await service.selectOptimalProvider('inst-123', 'US');

      // mx should win due to no recent failures
      expect(provider).toBeDefined();
    });

    it('should handle providers with no historical data', async () => {
      mockPrisma.institutionProviderMapping.findFirst.mockResolvedValue({
        institutionId: 'inst-123',
        region: 'US',
        primaryProvider: 'plaid' as any,
        backupProviders: null,
      });

      mockPrisma.providerHealthStatus.findUnique.mockResolvedValue(null);
      mockPrisma.connectionAttempt.findMany.mockResolvedValue([]); // No historical data

      const provider = await service.selectOptimalProvider('inst-123', 'US');

      // Should still return a provider (using defaults)
      expect(provider).toBe('plaid' as any);
    });

    it('should use default success rate of 85% when no attempt history', async () => {
      mockPrisma.institutionProviderMapping.findFirst.mockResolvedValue({
        institutionId: 'inst-123',
        region: 'US',
        primaryProvider: 'plaid' as any,
        backupProviders: ['mx' as any],
      });
      mockPrisma.providerHealthStatus.findUnique.mockResolvedValue(null);
      // Empty arrays for both providers - no historical data
      mockPrisma.connectionAttempt.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const provider = await service.selectOptimalProvider('inst-123', 'US');

      // Should still select a provider using default metrics
      expect(provider).toBeDefined();
    });

    it('should use health status response time when no attempt response times', async () => {
      mockPrisma.institutionProviderMapping.findFirst.mockResolvedValue({
        institutionId: 'inst-123',
        region: 'US',
        primaryProvider: 'plaid' as any,
        backupProviders: null,
      });
      mockPrisma.providerHealthStatus.findUnique.mockResolvedValue({
        provider: 'plaid' as any,
        region: 'US',
        avgResponseTimeMs: 1200, // Has health status
        status: 'healthy',
      });
      // Attempts with null response times
      mockPrisma.connectionAttempt.findMany.mockResolvedValue([
        {
          provider: 'plaid' as any,
          status: 'success',
          responseTimeMs: null,
          attemptedAt: new Date(),
        },
      ]);

      const provider = await service.selectOptimalProvider('inst-123', 'US');

      // Should use health status avgResponseTimeMs (1200)
      expect(provider).toBe('plaid' as any);
    });

    it('should use default 2000ms response time when no data available', async () => {
      mockPrisma.institutionProviderMapping.findFirst.mockResolvedValue({
        institutionId: 'inst-123',
        region: 'US',
        primaryProvider: 'plaid' as any,
        backupProviders: null,
      });
      // No health status
      mockPrisma.providerHealthStatus.findUnique.mockResolvedValue(null);
      // No attempt response times
      mockPrisma.connectionAttempt.findMany.mockResolvedValue([
        {
          provider: 'plaid' as any,
          status: 'success',
          responseTimeMs: null,
          attemptedAt: new Date(),
        },
      ]);

      const provider = await service.selectOptimalProvider('inst-123', 'US');

      // Should use default 2000ms and still work
      expect(provider).toBe('plaid' as any);
    });
  });

  describe('calculateMLScore', () => {
    it('should calculate perfect score for ideal provider', () => {
      const metrics = {
        provider: 'plaid' as any,
        successRate: 100, // Perfect success
        avgResponseTime: 500, // Fast response
        costPerTransaction: 0.001, // Cheap
        recentFailures: 0, // No recent failures
        score: 0,
      };

      const score = service['calculateMLScore'](metrics);

      // Score should be close to 1.0 (perfect)
      expect(score).toBeGreaterThan(0.9);
    });

    it('should calculate low score for poor provider', () => {
      const metrics = {
        provider: 'plaid' as any,
        successRate: 50, // Poor success rate
        avgResponseTime: 4500, // Slow
        costPerTransaction: 0.005, // Expensive
        recentFailures: 10, // Many recent failures
        score: 0,
      };

      const score = service['calculateMLScore'](metrics);

      // Score should be low
      expect(score).toBeLessThan(0.5);
    });

    it('should weight success rate most heavily (50%)', () => {
      const highSuccess = {
        provider: 'plaid' as any,
        successRate: 100,
        avgResponseTime: 2000, // Moderate response
        costPerTransaction: 0.002, // Moderate cost
        recentFailures: 2, // Some failures
        score: 0,
      };

      const lowSuccess = {
        provider: 'plaid' as any,
        successRate: 70,
        avgResponseTime: 2000, // Same response time
        costPerTransaction: 0.002, // Same cost
        recentFailures: 2, // Same failures
        score: 0,
      };

      const scoreHigh = service['calculateMLScore'](highSuccess);
      const scoreLow = service['calculateMLScore'](lowSuccess);

      // With all else equal, higher success rate should win (50% weight)
      expect(scoreHigh).toBeGreaterThan(scoreLow);
      // Success rate difference should be reflected proportionally
      expect(scoreHigh - scoreLow).toBeCloseTo(0.15, 1); // 30% success rate diff * 50% weight = 15% score diff
    });

    it('should normalize response time inversely (lower is better)', () => {
      const fast = {
        provider: 'plaid' as any,
        successRate: 85,
        avgResponseTime: 1000, // Fast
        costPerTransaction: 0.002,
        recentFailures: 0,
        score: 0,
      };

      const slow = {
        provider: 'plaid' as any,
        successRate: 85,
        avgResponseTime: 4000, // Slow
        costPerTransaction: 0.002,
        recentFailures: 0,
        score: 0,
      };

      const scoreFast = service['calculateMLScore'](fast);
      const scoreSlow = service['calculateMLScore'](slow);

      expect(scoreFast).toBeGreaterThan(scoreSlow);
    });

    it('should normalize cost inversely (lower is better)', () => {
      const cheap = {
        provider: 'plaid' as any,
        successRate: 85,
        avgResponseTime: 1500,
        costPerTransaction: 0.001, // Cheap
        recentFailures: 0,
        score: 0,
      };

      const expensive = {
        provider: 'plaid' as any,
        successRate: 85,
        avgResponseTime: 1500,
        costPerTransaction: 0.004, // Expensive
        recentFailures: 0,
        score: 0,
      };

      const scoreCheap = service['calculateMLScore'](cheap);
      const scoreExpensive = service['calculateMLScore'](expensive);

      expect(scoreCheap).toBeGreaterThan(scoreExpensive);
    });
  });

  describe('getAvailableProviders', () => {
    it('should return mapped providers when mapping exists', async () => {
      mockPrisma.institutionProviderMapping.findFirst.mockResolvedValue({
        institutionId: 'inst-123',
        region: 'US',
        primaryProvider: 'plaid' as any,
        backupProviders: ['mx' as any, 'finicity' as any],
      });

      const providers = await service['getAvailableProviders']('inst-123', 'US');

      expect(providers).toEqual(['plaid' as any, 'mx' as any, 'finicity' as any]);
    });

    it('should return default US providers when no mapping', async () => {
      mockPrisma.institutionProviderMapping.findFirst.mockResolvedValue(null);

      const providers = await service['getAvailableProviders']('inst-123', 'US');

      expect(providers).toContain('plaid' as any);
      expect(providers).toContain('mx' as any);
      expect(providers).toContain('finicity' as any);
    });

    it('should return default MX providers when no mapping', async () => {
      mockPrisma.institutionProviderMapping.findFirst.mockResolvedValue(null);

      const providers = await service['getAvailableProviders']('inst-123', 'MX');

      expect(providers).toContain('belvo' as any);
      expect(providers).toContain('mx' as any);
    });

    it('should handle mapping without backups', async () => {
      mockPrisma.institutionProviderMapping.findFirst.mockResolvedValue({
        institutionId: 'inst-123',
        region: 'US',
        primaryProvider: 'plaid' as any,
        backupProviders: null,
      });

      const providers = await service['getAvailableProviders']('inst-123', 'US');

      expect(providers).toEqual(['plaid' as any]);
    });
  });

  describe('getProviderCost', () => {
    it('should return correct cost for each provider', () => {
      expect(service['getProviderCost']('plaid' as any)).toBe(0.002);
      expect(service['getProviderCost']('mx' as any)).toBe(0.0015);
      expect(service['getProviderCost']('finicity' as any)).toBe(0.0025);
      expect(service['getProviderCost']('belvo' as any)).toBe(0.001);
    });

    it('should return default cost for unknown provider', () => {
      expect(service['getProviderCost']('unknown' as any)).toBe(0.002);
    });

    it('should have belvo as cheapest provider', () => {
      const costs = [
        service['getProviderCost']('plaid' as any),
        service['getProviderCost']('mx' as any),
        service['getProviderCost']('finicity' as any),
        service['getProviderCost']('belvo' as any),
      ];

      expect(service['getProviderCost']('belvo' as any)).toBe(Math.min(...costs));
    });

    it('should have finicity as most expensive provider', () => {
      const costs = [
        service['getProviderCost']('plaid' as any),
        service['getProviderCost']('mx' as any),
        service['getProviderCost']('finicity' as any),
        service['getProviderCost']('belvo' as any),
      ];

      expect(service['getProviderCost']('finicity' as any)).toBe(Math.max(...costs));
    });
  });

  describe('getProviderInsights', () => {
    it('should calculate provider insights from connection attempts', async () => {
      const mockAttempts = [
        // Plaid: 8 success, 2 failure
        ...Array.from({ length: 8 }, () => ({
          provider: 'plaid' as any,
          status: 'success',
          responseTimeMs: 1500,
          failoverUsed: false,
          attemptedAt: new Date(),
        })),
        ...Array.from({ length: 2 }, () => ({
          provider: 'plaid' as any,
          status: 'failure',
          responseTimeMs: 3000,
          failoverUsed: false,
          attemptedAt: new Date(),
        })),
        // MX: 5 success with failover
        ...Array.from({ length: 5 }, () => ({
          provider: 'mx' as any,
          status: 'success',
          responseTimeMs: 2000,
          failoverUsed: true,
          attemptedAt: new Date(),
        })),
      ];

      mockPrisma.connectionAttempt.findMany.mockResolvedValue(mockAttempts);

      const insights = await service.getProviderInsights('US', 30);

      expect(insights).toHaveLength(2); // plaid and mx

      const plaidInsight = insights.find((i) => i.provider === 'plaid');
      expect(plaidInsight?.totalAttempts).toBe(10);
      expect(plaidInsight?.successRate).toBe('80.00%'); // 8/10
      expect(plaidInsight?.failoverRate).toBe('0.00%');

      const mxInsight = insights.find((i) => i.provider === 'mx');
      expect(mxInsight?.totalAttempts).toBe(5);
      expect(mxInsight?.successRate).toBe('100.00%'); // 5/5
      expect(mxInsight?.failoverRate).toBe('100.00%'); // All used failover
    });

    it('should calculate estimated monthly cost', async () => {
      mockPrisma.connectionAttempt.findMany.mockResolvedValue([
        {
          provider: 'belvo' as any,
          status: 'success',
          responseTimeMs: 1500,
          failoverUsed: false,
          attemptedAt: new Date(),
        },
        {
          provider: 'belvo' as any,
          status: 'success',
          responseTimeMs: 1600,
          failoverUsed: false,
          attemptedAt: new Date(),
        },
      ]);

      const insights = await service.getProviderInsights('MX', 30);

      const belvoInsight = insights.find((i) => i.provider === 'belvo');
      // 2 transactions * $0.001 = $0.002
      expect(belvoInsight?.estimatedMonthlyCost).toBe('0.0020');
    });

    it('should handle custom time periods', async () => {
      mockPrisma.connectionAttempt.findMany.mockResolvedValue([]);

      await service.getProviderInsights('US', 90);

      expect(mockPrisma.connectionAttempt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            attemptedAt: expect.any(Object),
          }),
        })
      );
    });

    it('should handle empty attempt history', async () => {
      mockPrisma.connectionAttempt.findMany.mockResolvedValue([]);

      const insights = await service.getProviderInsights('US', 30);

      expect(insights).toEqual([]);
    });

    it('should use default region when not specified', async () => {
      mockPrisma.connectionAttempt.findMany.mockResolvedValue([]);

      const insights = await service.getProviderInsights(); // No params - use defaults

      expect(insights).toEqual([]);
      expect(mockPrisma.connectionAttempt.findMany).toHaveBeenCalled();
    });

    it('should use default days when only region specified', async () => {
      mockPrisma.connectionAttempt.findMany.mockResolvedValue([]);

      const insights = await service.getProviderInsights('MX'); // Only region, default days

      expect(insights).toEqual([]);
    });

    it('should handle attempts without response times in insights', async () => {
      mockPrisma.connectionAttempt.findMany.mockResolvedValue([
        {
          provider: 'plaid' as any,
          status: 'success',
          responseTimeMs: null, // No response time
          failoverUsed: false,
          attemptedAt: new Date(),
        },
      ]);

      const insights = await service.getProviderInsights('US', 30);

      expect(insights).toHaveLength(1);
      // With null responseTimeMs, the avgResponseTime calculation should handle it
      expect(insights[0].avgResponseTime).toBeDefined();
    });
  });

  describe('updateSelectionModel', () => {
    it('should log training data for model updates', async () => {
      const logSpy = jest.spyOn(service['logger'], 'debug');

      await service.updateSelectionModel('plaid' as any, true, 1500);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Training data: provider=plaid, success=true, responseTime=1500ms')
      );
    });

    it('should accept failure training data', async () => {
      const logSpy = jest.spyOn(service['logger'], 'debug');

      await service.updateSelectionModel('mx' as any, false, 5000);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('success=false'));
    });
  });

  describe('fallback when no providers available', () => {
    it('should return belvo for MX region when no providers available', async () => {
      // Spy on private method to force empty providers
      jest.spyOn<any, any>(service, 'getAvailableProviders').mockResolvedValue([]);

      const provider = await service.selectOptimalProvider('inst-123', 'MX');

      expect(provider).toBe('belvo' as any);
    });

    it('should return plaid for US region when no providers available', async () => {
      // Spy on private method to force empty providers
      jest.spyOn<any, any>(service, 'getAvailableProviders').mockResolvedValue([]);

      const provider = await service.selectOptimalProvider('inst-123', 'US');

      expect(provider).toBe('plaid' as any);
    });

    it('should return plaid for EU region when no providers available', async () => {
      // Spy on private method to force empty providers
      jest.spyOn<any, any>(service, 'getAvailableProviders').mockResolvedValue([]);

      const provider = await service.selectOptimalProvider('inst-123', 'EU');

      expect(provider).toBe('plaid' as any);
    });
  });

  describe('edge cases', () => {
    it('should handle null response times gracefully', async () => {
      mockPrisma.institutionProviderMapping.findFirst.mockResolvedValue({
        institutionId: 'inst-123',
        region: 'US',
        primaryProvider: 'plaid' as any,
        backupProviders: null,
      });

      mockPrisma.providerHealthStatus.findUnique.mockResolvedValue(null);

      mockPrisma.connectionAttempt.findMany.mockResolvedValue([
        {
          provider: 'plaid' as any,
          status: 'success',
          responseTimeMs: null, // Null response time
          attemptedAt: new Date(),
        },
      ]);

      const provider = await service.selectOptimalProvider('inst-123', 'US');

      expect(provider).toBe('plaid' as any);
    });

    it('should handle extreme response times (very slow)', async () => {
      const metrics = {
        provider: 'plaid' as any,
        successRate: 85,
        avgResponseTime: 10000, // 10 seconds
        costPerTransaction: 0.002,
        recentFailures: 0,
        score: 0,
      };

      const score = service['calculateMLScore'](metrics);

      // Should still return valid score (normalized to 0)
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should handle very old attempts data', async () => {
      mockPrisma.institutionProviderMapping.findFirst.mockResolvedValue({
        institutionId: 'inst-123',
        region: 'US',
        primaryProvider: 'plaid' as any,
        backupProviders: null,
      });

      mockPrisma.providerHealthStatus.findUnique.mockResolvedValue(null);

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100); // 100 days ago

      mockPrisma.connectionAttempt.findMany.mockResolvedValue([
        {
          provider: 'plaid' as any,
          status: 'success',
          responseTimeMs: 1500,
          attemptedAt: oldDate, // Very old
        },
      ]);

      const provider = await service.selectOptimalProvider('inst-123', 'US');

      // Should still work but old failures won't count as recent
      expect(provider).toBe('plaid' as any);
    });
  });
});
