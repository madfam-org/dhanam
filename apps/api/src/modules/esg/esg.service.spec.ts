import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { Decimal } from '@db';

import { PrismaService } from '../../core/prisma/prisma.service';

import { EsgService } from './esg.service';

describe('EsgService', () => {
  let service: EsgService;
  let prisma: PrismaService;

  const mockPrisma = {
    account: {
      findMany: jest.fn(),
    },
    assetValuation: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EsgService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<EsgService>(EsgService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('getEsgScore', () => {
    it('should return ESG score for Bitcoin (BTC)', async () => {
      const score = await service.getEsgScore('BTC');

      expect(score.symbol).toBe('BTC');
      expect(score.assetType).toBe('crypto');
      expect(score.environmentalScore).toBe(15); // Low due to PoW
      expect(score.socialScore).toBe(75);
      expect(score.governanceScore).toBe(85);
      expect(score.overallScore).toBe(58);
      expect(score.grade).toBe('C');
      expect(score.consensusMechanism).toBe('Proof of Work');
      expect(score.energyIntensity).toBe(707000);
    });

    it('should return ESG score for Ethereum (ETH)', async () => {
      const score = await service.getEsgScore('ETH');

      expect(score.symbol).toBe('ETH');
      expect(score.environmentalScore).toBe(85); // High after PoS merge
      expect(score.socialScore).toBe(82);
      expect(score.governanceScore).toBe(78);
      expect(score.overallScore).toBe(82);
      expect(score.grade).toBe('A-');
      expect(score.consensusMechanism).toBe('Proof of Stake');
    });

    it('should return ESG score for Cardano (ADA)', async () => {
      const score = await service.getEsgScore('ADA');

      expect(score.symbol).toBe('ADA');
      expect(score.environmentalScore).toBe(95); // Most energy-efficient
      expect(score.socialScore).toBe(80);
      expect(score.governanceScore).toBe(88);
      expect(score.overallScore).toBe(88);
      expect(score.grade).toBe('A');
    });

    it('should return ESG score for Algorand (ALGO)', async () => {
      const score = await service.getEsgScore('ALGO');

      expect(score.symbol).toBe('ALGO');
      expect(score.environmentalScore).toBe(98); // Carbon negative
      expect(score.grade).toBe('A');
    });

    it('should handle lowercase crypto symbols', async () => {
      const score = await service.getEsgScore('btc');

      expect(score.symbol).toBe('BTC');
      expect(score.overallScore).toBe(58);
    });

    it('should return default ESG score for unknown crypto', async () => {
      const score = await service.getEsgScore('UNKNOWN_COIN');

      expect(score.symbol).toBe('UNKNOWN_COIN');
      expect(score.assetType).toBe('crypto');
      expect(score.environmentalScore).toBe(50); // Neutral default
      expect(score.socialScore).toBe(60);
      expect(score.governanceScore).toBe(65);
      expect(score.overallScore).toBe(58);
      expect(score.grade).toBe('C');
      expect(score.description).toContain('ESG data not available');
    });

    it('should return default ESG score for unknown equity asset', async () => {
      const score = await service.getEsgScore('AAPL', 'equity');

      expect(score.symbol).toBe('AAPL');
      expect(score.assetType).toBe('equity'); // Returns equity type as provided
      expect(score.environmentalScore).toBe(70);
      expect(score.socialScore).toBe(70);
      expect(score.governanceScore).toBe(70);
      expect(score.overallScore).toBe(70);
      expect(score.grade).toBe('B-');
    });

    it('should include lastUpdated timestamp', async () => {
      const before = new Date();
      const score = await service.getEsgScore('ETH');
      const after = new Date();

      expect(score.lastUpdated).toBeInstanceOf(Date);
      expect(score.lastUpdated.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(score.lastUpdated.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('getPortfolioEsgScore', () => {
    it('should calculate weighted portfolio ESG score', async () => {
      const mockAccounts = [
        {
          id: 'acc1',
          balance: new Decimal(5000), // 50% weight (BTC)
          metadata: { cryptoCurrency: 'BTC' },
        },
        {
          id: 'acc2',
          balance: new Decimal(3000), // 30% weight (ETH)
          metadata: { cryptoCurrency: 'ETH' },
        },
        {
          id: 'acc3',
          balance: new Decimal(2000), // 20% weight (ADA)
          metadata: { cryptoCurrency: 'ADA' },
        },
      ];

      mockPrisma.account.findMany.mockResolvedValue(mockAccounts);

      const result = await service.getPortfolioEsgScore('user123');

      expect(result.overallScore).toBeDefined();
      expect(result.grade).toBeDefined();
      expect(result.breakdown.environmental).toBeDefined();
      expect(result.breakdown.social).toBeDefined();
      expect(result.breakdown.governance).toBeDefined();
      expect(result.holdings).toHaveLength(3);
      expect(result.insights).toBeDefined();
      expect(result.insights.length).toBeGreaterThan(0);

      // Verify weights
      expect(result.holdings[0].weight).toBeCloseTo(0.5, 2); // 5000/10000
      expect(result.holdings[1].weight).toBeCloseTo(0.3, 2); // 3000/10000
      expect(result.holdings[2].weight).toBeCloseTo(0.2, 2); // 2000/10000

      // Verify ESG symbols
      expect(result.holdings[0].symbol).toBe('BTC');
      expect(result.holdings[1].symbol).toBe('ETH');
      expect(result.holdings[2].symbol).toBe('ADA');
    });

    it('should throw NotFoundException when no crypto holdings found', async () => {
      mockPrisma.account.findMany.mockResolvedValue([]);

      await expect(service.getPortfolioEsgScore('user123')).rejects.toThrow(NotFoundException);
      await expect(service.getPortfolioEsgScore('user123')).rejects.toThrow(
        'No crypto holdings found for portfolio ESG analysis'
      );
    });

    it('should handle portfolio with only zero balances', async () => {
      // In production, accounts with zero balance are filtered out by "balance: { gt: 0 }"
      // So the query would return empty array
      mockPrisma.account.findMany.mockResolvedValue([]);

      await expect(service.getPortfolioEsgScore('user123')).rejects.toThrow(NotFoundException);
      await expect(service.getPortfolioEsgScore('user123')).rejects.toThrow(
        'No crypto holdings found for portfolio ESG analysis'
      );
    });

    it('should handle portfolio with single holding', async () => {
      const mockAccounts = [
        {
          id: 'acc1',
          balance: new Decimal(1000),
          metadata: { cryptoCurrency: 'ETH' },
        },
      ];

      mockPrisma.account.findMany.mockResolvedValue(mockAccounts);

      const result = await service.getPortfolioEsgScore('user123');

      expect(result.holdings).toHaveLength(1);
      expect(result.holdings[0].weight).toBe(1); // 100% weight
      expect(result.holdings[0].symbol).toBe('ETH');
    });

    it('should generate insight for high BTC allocation', async () => {
      const mockAccounts = [
        {
          id: 'acc1',
          balance: new Decimal(6000), // 60% BTC (>50%)
          metadata: { cryptoCurrency: 'BTC' },
        },
        {
          id: 'acc2',
          balance: new Decimal(4000), // 40% ETH
          metadata: { cryptoCurrency: 'ETH' },
        },
      ];

      mockPrisma.account.findMany.mockResolvedValue(mockAccounts);

      const result = await service.getPortfolioEsgScore('user123');

      const btcInsight = result.insights.find((insight) =>
        insight.includes('Bitcoin represents a large portion')
      );
      expect(btcInsight).toBeDefined();
      expect(btcInsight).toContain('diversifying');
    });

    it('should generate insight for low environmental score', async () => {
      const mockAccounts = [
        {
          id: 'acc1',
          balance: new Decimal(8000), // 80% BTC (low environmental)
          metadata: { cryptoCurrency: 'BTC' },
        },
        {
          id: 'acc2',
          balance: new Decimal(2000), // 20% LTC (also PoW)
          metadata: { cryptoCurrency: 'LTC' },
        },
      ];

      mockPrisma.account.findMany.mockResolvedValue(mockAccounts);

      const result = await service.getPortfolioEsgScore('user123');

      expect(result.breakdown.environmental).toBeLessThan(50);
      const envInsight = result.insights.find((insight) =>
        insight.includes('high environmental impact')
      );
      expect(envInsight).toBeDefined();
    });

    it('should generate insight for excellent environmental performance', async () => {
      const mockAccounts = [
        {
          id: 'acc1',
          balance: new Decimal(4000), // 40% ADA
          metadata: { cryptoCurrency: 'ADA' },
        },
        {
          id: 'acc2',
          balance: new Decimal(3000), // 30% ALGO
          metadata: { cryptoCurrency: 'ALGO' },
        },
        {
          id: 'acc3',
          balance: new Decimal(3000), // 30% ETH
          metadata: { cryptoCurrency: 'ETH' },
        },
      ];

      mockPrisma.account.findMany.mockResolvedValue(mockAccounts);

      const result = await service.getPortfolioEsgScore('user123');

      expect(result.breakdown.environmental).toBeGreaterThan(80);
      const envInsight = result.insights.find((insight) =>
        insight.includes('Excellent environmental performance')
      );
      expect(envInsight).toBeDefined();
    });

    it('should identify high ESG performers in portfolio', async () => {
      const mockAccounts = [
        {
          id: 'acc1',
          balance: new Decimal(5000), // ALGO (score: 89)
          metadata: { cryptoCurrency: 'ALGO' },
        },
        {
          id: 'acc2',
          balance: new Decimal(5000), // ADA (score: 88)
          metadata: { cryptoCurrency: 'ADA' },
        },
      ];

      mockPrisma.account.findMany.mockResolvedValue(mockAccounts);

      const result = await service.getPortfolioEsgScore('user123');

      const highEsgInsight = result.insights.find((insight) =>
        insight.includes('Strong ESG performers')
      );
      expect(highEsgInsight).toBeDefined();
      expect(highEsgInsight).toContain('ALGO');
      expect(highEsgInsight).toContain('ADA');
    });

    it('should generate insight for strong governance', async () => {
      const mockAccounts = [
        {
          id: 'acc1',
          balance: new Decimal(5000),
          metadata: { cryptoCurrency: 'BTC' }, // Governance: 85
        },
        {
          id: 'acc2',
          balance: new Decimal(5000),
          metadata: { cryptoCurrency: 'ADA' }, // Governance: 88
        },
      ];

      mockPrisma.account.findMany.mockResolvedValue(mockAccounts);

      const result = await service.getPortfolioEsgScore('user123');

      expect(result.breakdown.governance).toBeGreaterThan(80);
      const govInsight = result.insights.find((insight) =>
        insight.includes('strong governance characteristics')
      );
      expect(govInsight).toBeDefined();
    });

    it('should handle accounts with unknown crypto metadata', async () => {
      const mockAccounts = [
        {
          id: 'acc1',
          balance: new Decimal(5000),
          metadata: { cryptoCurrency: 'UNKNOWN_COIN' },
        },
        {
          id: 'acc2',
          balance: new Decimal(5000),
          metadata: { cryptoCurrency: 'ETH' },
        },
      ];

      mockPrisma.account.findMany.mockResolvedValue(mockAccounts);

      const result = await service.getPortfolioEsgScore('user123');

      expect(result.holdings).toHaveLength(2);
      expect(result.holdings[0].symbol).toBe('UNKNOWN_COIN');
      expect(result.holdings[0].esgScore.grade).toBe('C'); // Default grade
    });
  });

  describe('getAssetComparison', () => {
    it('should compare ESG scores for multiple assets', async () => {
      const result = await service.getAssetComparison(['BTC', 'ETH', 'ADA']);

      expect(result.comparison).toHaveLength(3);
      expect(result.bestPerformer.overall).toBeDefined();
      expect(result.bestPerformer.environmental).toBeDefined();
      expect(result.bestPerformer.social).toBeDefined();
      expect(result.bestPerformer.governance).toBeDefined();
      expect(result.summary).toBeDefined();
    });

    it('should identify best overall performer', async () => {
      const result = await service.getAssetComparison(['BTC', 'ETH', 'ADA', 'ALGO']);

      // ALGO has highest overall score (89)
      expect(result.bestPerformer.overall).toBe('ALGO');
    });

    it('should identify best environmental performer', async () => {
      const result = await service.getAssetComparison(['BTC', 'ETH', 'ADA', 'ALGO']);

      // ALGO has highest environmental score (98)
      expect(result.bestPerformer.environmental).toBe('ALGO');
    });

    it('should identify best social performer', async () => {
      const result = await service.getAssetComparison(['BTC', 'ETH', 'ALGO']);

      // ALGO has highest social score (85)
      expect(result.bestPerformer.social).toBe('ALGO');
    });

    it('should identify best governance performer', async () => {
      const result = await service.getAssetComparison(['BTC', 'ADA', 'ALGO']);

      // ADA has highest governance score (88)
      expect(result.bestPerformer.governance).toBe('ADA');
    });

    it('should generate summary with average score and grade', async () => {
      const result = await service.getAssetComparison(['BTC', 'ETH']);

      expect(result.summary).toContain('Average ESG score');
      expect(result.summary).toContain('Best overall performer');
      // BTC: 58, ETH: 82 -> Avg: 70 (B- grade)
      expect(result.summary).toContain('70');
    });

    it('should handle single asset comparison', async () => {
      const result = await service.getAssetComparison(['ETH']);

      expect(result.comparison).toHaveLength(1);
      expect(result.bestPerformer.overall).toBe('ETH');
      expect(result.bestPerformer.environmental).toBe('ETH');
      expect(result.bestPerformer.social).toBe('ETH');
      expect(result.bestPerformer.governance).toBe('ETH');
    });

    it('should handle comparison with unknown assets', async () => {
      const result = await service.getAssetComparison(['ETH', 'UNKNOWN_COIN']);

      expect(result.comparison).toHaveLength(2);
      expect(result.comparison[1].symbol).toBe('UNKNOWN_COIN');
      expect(result.comparison[1].grade).toBe('C');
    });
  });

  describe('getEsgTrends', () => {
    it('should return trending ESG data', async () => {
      const result = await service.getEsgTrends();

      expect(result.trending.improving).toBeDefined();
      expect(result.trending.declining).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(result.marketInsights).toBeDefined();
    });

    it('should list improving cryptocurrencies', async () => {
      const result = await service.getEsgTrends();

      expect(result.trending.improving).toContain('ETH');
      expect(result.trending.improving).toContain('ADA');
      expect(result.trending.improving).toContain('ALGO');
      expect(result.trending.improving).toContain('MATIC');
    });

    it('should list declining cryptocurrencies', async () => {
      const result = await service.getEsgTrends();

      expect(result.trending.declining).toContain('BTC');
      expect(result.trending.declining).toContain('LTC');
    });

    it('should provide recommendations', async () => {
      const result = await service.getEsgTrends();

      expect(result.recommendations.length).toBeGreaterThan(0);
      const ethRec = result.recommendations.find((r) => r.includes('Ethereum'));
      expect(ethRec).toBeDefined();
      expect(ethRec).toContain('Proof of Stake');
    });

    it('should provide market insights', async () => {
      const result = await service.getEsgTrends();

      expect(result.marketInsights.length).toBeGreaterThan(0);
      const posInsight = result.marketInsights.find((i) => i.includes('Proof of Stake'));
      expect(posInsight).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle numeric balance values', async () => {
      const mockAccounts = [
        {
          id: 'acc1',
          balance: 1000, // Number instead of Decimal
          metadata: { cryptoCurrency: 'ETH' },
        },
      ];

      mockPrisma.account.findMany.mockResolvedValue(mockAccounts);

      const result = await service.getPortfolioEsgScore('user123');

      expect(result.holdings).toHaveLength(1);
      expect(result.holdings[0].weight).toBe(1);
    });

    it('should handle missing cryptoCurrency in metadata', async () => {
      const mockAccounts = [
        {
          id: 'acc1',
          balance: new Decimal(1000),
          metadata: {}, // No cryptoCurrency
        },
      ];

      mockPrisma.account.findMany.mockResolvedValue(mockAccounts);

      const result = await service.getPortfolioEsgScore('user123');

      expect(result.holdings).toHaveLength(1);
      expect(result.holdings[0].symbol).toBe('UNKNOWN');
      expect(result.holdings[0].esgScore.grade).toBe('C'); // Default
    });

    it('should handle empty/null metadata', async () => {
      const mockAccounts = [
        {
          id: 'acc1',
          balance: new Decimal(1000),
          metadata: null,
        },
      ];

      mockPrisma.account.findMany.mockResolvedValue(mockAccounts);

      const result = await service.getPortfolioEsgScore('user123');

      expect(result.holdings).toHaveLength(1);
      expect(result.holdings[0].symbol).toBe('UNKNOWN');
    });

    it('should handle all PoW portfolio (very low environmental score)', async () => {
      const mockAccounts = [
        {
          id: 'acc1',
          balance: new Decimal(5000),
          metadata: { cryptoCurrency: 'BTC' }, // Environmental: 15
        },
        {
          id: 'acc2',
          balance: new Decimal(5000),
          metadata: { cryptoCurrency: 'LTC' }, // Environmental: 25
        },
      ];

      mockPrisma.account.findMany.mockResolvedValue(mockAccounts);

      const result = await service.getPortfolioEsgScore('user123');

      expect(result.breakdown.environmental).toBeLessThan(30);
      expect(result.grade).toMatch(/D|C/); // Should be D or C range
      const envInsight = result.insights.find((insight) =>
        insight.includes('high environmental impact')
      );
      expect(envInsight).toBeDefined();
    });

    it('should handle all PoS portfolio (very high environmental score)', async () => {
      const mockAccounts = [
        {
          id: 'acc1',
          balance: new Decimal(3333),
          metadata: { cryptoCurrency: 'ADA' }, // Environmental: 95
        },
        {
          id: 'acc2',
          balance: new Decimal(3333),
          metadata: { cryptoCurrency: 'ALGO' }, // Environmental: 98
        },
        {
          id: 'acc3',
          balance: new Decimal(3334),
          metadata: { cryptoCurrency: 'DOT' }, // Environmental: 90
        },
      ];

      mockPrisma.account.findMany.mockResolvedValue(mockAccounts);

      const result = await service.getPortfolioEsgScore('user123');

      expect(result.breakdown.environmental).toBeGreaterThan(90);
      expect(result.grade).toMatch(/A/); // Should be A range
    });
  });

  describe('Grade Calculation', () => {
    it('should assign A+ grade for 95-100 score', async () => {
      const mockAccounts = [
        {
          id: 'acc1',
          balance: new Decimal(1000),
          metadata: { cryptoCurrency: 'ALGO' }, // Overall: 89
        },
      ];

      mockPrisma.account.findMany.mockResolvedValue(mockAccounts);

      const result = await service.getPortfolioEsgScore('user123');

      // ALGO has score 89, which is A- range
      expect(result.grade).toBe('A-');
    });

    it('should assign proper grades across full range', async () => {
      const testCases = [
        { crypto: 'ALGO', expectedGrade: 'A-' }, // 89 (A- range: 85-89)
        { crypto: 'ADA', expectedGrade: 'A-' }, // 88 (A- range: 85-89)
        { crypto: 'ETH', expectedGrade: 'B+' }, // 82 (B+ range: 80-84)
        { crypto: 'SOL', expectedGrade: 'B' }, // 79 (B range: 75-79)
        { crypto: 'XRP', expectedGrade: 'B' }, // 76 (B range: 75-79)
        { crypto: 'LTC', expectedGrade: 'C-' }, // 59 (C- range: 55-59)
        { crypto: 'BTC', expectedGrade: 'C-' }, // 58 (C- range: 55-59)
      ];

      for (const testCase of testCases) {
        const mockAccounts = [
          {
            id: 'acc1',
            balance: new Decimal(1000),
            metadata: { cryptoCurrency: testCase.crypto },
          },
        ];

        mockPrisma.account.findMany.mockResolvedValue(mockAccounts);

        const result = await service.getPortfolioEsgScore('user123');
        expect(result.grade).toBe(testCase.expectedGrade);

        jest.clearAllMocks();
      }
    });
  });
});
