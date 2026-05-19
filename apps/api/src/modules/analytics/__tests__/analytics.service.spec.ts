import { Currency } from '@dhanam/shared';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../core/prisma/prisma.service';
import { FxRatesService } from '../../fx-rates/fx-rates.service';
import { SpacesService } from '../../spaces/spaces.service';
import { AnalyticsQueryService } from '../analytics-query.service';
import { AnalyticsService } from '../analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let module: TestingModule;
  let prisma: jest.Mocked<PrismaService>;
  let spacesService: jest.Mocked<SpacesService>;
  let fxRatesService: jest.Mocked<FxRatesService>;

  const mockUserId = 'user-123';
  const mockSpaceId = 'space-123';

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: PrismaService,
          useValue: {
            account: {
              findMany: jest.fn(),
            },
            assetValuation: {
              findMany: jest.fn(),
            },
            transaction: {
              findMany: jest.fn().mockResolvedValue([]),
              aggregate: jest.fn(),
              groupBy: jest.fn(),
            },
            category: {
              findMany: jest.fn(),
            },
            space: {
              findUnique: jest.fn().mockResolvedValue({ currency: 'MXN' }),
            },
            manualAsset: {
              findMany: jest.fn().mockResolvedValue([]),
            },
            budget: {
              findMany: jest.fn().mockResolvedValue([]),
            },
            goal: {
              findMany: jest.fn().mockResolvedValue([]),
            },
            $queryRaw: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: SpacesService,
          useValue: {
            verifyUserAccess: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: FxRatesService,
          useValue: {
            convertAmount: jest
              .fn()
              .mockImplementation((amount: number) => Promise.resolve(amount)),
            getExchangeRate: jest.fn().mockResolvedValue(1),
          },
        },
        {
          provide: AnalyticsQueryService,
          useValue: {
            getStatistics: jest.fn().mockResolvedValue({
              topPurchases: [],
              topMerchants: [],
              topCategories: [],
              totalTransactions: 0,
              totalAmount: 0,
            }),
            getAnnualTrends: jest.fn().mockResolvedValue({
              months: [],
              summary: {
                totalIncome: 0,
                totalExpenses: 0,
                totalNet: 0,
                totalTransactions: 0,
                overallSavingsRate: 0,
              },
            }),
            executeQuery: jest.fn().mockResolvedValue([]),
            getCalendarData: jest.fn().mockResolvedValue({ year: 2026, month: 1, days: [] }),
          },
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    spacesService = module.get(SpacesService) as jest.Mocked<SpacesService>;
    fxRatesService = module.get(FxRatesService) as jest.Mocked<FxRatesService>;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getNetWorth', () => {
    it('should calculate net worth correctly', async () => {
      const mockAccounts = [
        {
          id: 'acc-1',
          name: 'Checking',
          balance: 10000,
          type: 'checking',
          currency: 'MXN',
          assetValuations: [],
        },
        {
          id: 'acc-2',
          name: 'Savings',
          balance: 50000,
          type: 'savings',
          currency: 'MXN',
          assetValuations: [],
        },
        {
          id: 'acc-3',
          name: 'Credit Card',
          balance: -5000,
          type: 'credit',
          currency: 'MXN',
          assetValuations: [],
        },
      ];

      prisma.account.findMany.mockResolvedValue(
        mockAccounts.map((acc) => ({
          ...acc,
          balance: { toNumber: () => acc.balance } as any,
        })) as any
      );

      prisma.assetValuation.findMany.mockResolvedValue([]);

      const result = await service.getNetWorth(mockUserId, mockSpaceId);

      expect(result.totalAssets).toBe(60000); // 10000 + 50000
      expect(result.totalLiabilities).toBe(5000); // |-5000|
      expect(result.netWorth).toBe(55000); // 60000 - 5000
      expect(result.currency).toBe(Currency.MXN);
      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        mockUserId,
        mockSpaceId,
        'viewer'
      );
    });

    it('should include historical trend data', async () => {
      const mockAccounts = [
        {
          id: 'acc-1',
          balance: { toNumber: () => 10000 },
          assetValuations: [],
        },
      ];

      const mockValuations = [
        {
          id: 'val-1',
          accountId: 'acc-1',
          date: new Date('2024-01-01'),
          value: { toNumber: () => 8000 },
        },
        {
          id: 'val-2',
          accountId: 'acc-1',
          date: new Date('2024-01-15'),
          value: { toNumber: () => 9000 },
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockAccounts as any);
      prisma.assetValuation.findMany.mockResolvedValue(mockValuations as any);

      const result = await service.getNetWorth(mockUserId, mockSpaceId);

      expect(result.trend).toHaveLength(2);
      expect(result.trend[0].value).toBe(8000);
      expect(result.trend[1].value).toBe(9000);
    });

    it('should handle accounts with zero balances', async () => {
      const mockAccounts = [
        {
          id: 'acc-1',
          balance: { toNumber: () => 0 },
          assetValuations: [],
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockAccounts as any);
      prisma.assetValuation.findMany.mockResolvedValue([]);

      const result = await service.getNetWorth(mockUserId, mockSpaceId);

      expect(result.totalAssets).toBe(0);
      expect(result.totalLiabilities).toBe(0);
      expect(result.netWorth).toBe(0);
    });
  });

  describe('getCashflowForecast', () => {
    it('should generate 60-day forecast with weekly granularity', async () => {
      const mockLiquidAccounts = [
        {
          id: 'acc-1',
          type: 'checking',
          balance: { toNumber: () => 10000 },
        },
        {
          id: 'acc-2',
          type: 'savings',
          balance: { toNumber: () => 20000 },
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockLiquidAccounts as any);

      // Mock income aggregate
      prisma.transaction.aggregate
        .mockResolvedValueOnce({
          _sum: { amount: { toNumber: () => 36000 } }, // 90 days of income
          _count: 10,
        } as any)
        // Mock expense aggregate
        .mockResolvedValueOnce({
          _sum: { amount: { toNumber: () => -27000 } }, // 90 days of expenses
          _count: 50,
        } as any);

      const result = await service.getCashflowForecast(mockUserId, mockSpaceId, 60);

      // 60 days / 7 = ~9 weeks (rounded up to include all days)
      expect(result.forecast.length).toBeGreaterThan(0);
      expect(result.summary.currentBalance).toBe(30000); // 10000 + 20000

      // Weekly income = 36000 / (90/7) ≈ 2800
      // Weekly expenses = 27000 / (90/7) ≈ 2100
      expect(result.summary.totalIncome).toBeGreaterThan(0);
      expect(result.summary.totalExpenses).toBeGreaterThan(0);
      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        mockUserId,
        mockSpaceId,
        'viewer'
      );
    });

    it('should handle custom forecast periods', async () => {
      const mockLiquidAccounts = [
        {
          id: 'acc-1',
          balance: { toNumber: () => 10000 },
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockLiquidAccounts as any);
      prisma.transaction.aggregate
        .mockResolvedValueOnce({
          _sum: { amount: { toNumber: () => 10000 } },
          _count: 5,
        } as any)
        .mockResolvedValueOnce({
          _sum: { amount: { toNumber: () => -8000 } },
          _count: 10,
        } as any);

      const result = await service.getCashflowForecast(mockUserId, mockSpaceId, 30);

      expect(result.forecast.length).toBeGreaterThan(0);
    });

    it('should handle accounts with no transaction history', async () => {
      const mockLiquidAccounts = [
        {
          id: 'acc-1',
          balance: { toNumber: () => 5000 },
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockLiquidAccounts as any);
      prisma.transaction.aggregate
        .mockResolvedValueOnce({
          _sum: { amount: null },
          _count: 0,
        } as any)
        .mockResolvedValueOnce({
          _sum: { amount: null },
          _count: 0,
        } as any);

      const result = await service.getCashflowForecast(mockUserId, mockSpaceId);

      expect(result.summary.currentBalance).toBe(5000);
      expect(result.forecast.length).toBeGreaterThan(0);
    });
  });

  describe('getSpendingByCategory', () => {
    it('should aggregate spending by category', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockTransactions = [
        {
          categoryId: 'cat-1',
          _sum: { amount: { toNumber: () => -5000 } },
          _count: 10,
        },
        {
          categoryId: 'cat-2',
          _sum: { amount: { toNumber: () => -3000 } },
          _count: 5,
        },
      ];

      const mockCategories = [
        {
          id: 'cat-1',
          name: 'Groceries',
          icon: '🛒',
          color: '#FF6B6B',
        },
        {
          id: 'cat-2',
          name: 'Transportation',
          icon: '🚗',
          color: '#4ECDC4',
        },
      ];

      prisma.transaction.groupBy.mockResolvedValue(mockTransactions as any);
      prisma.category.findMany.mockResolvedValue(mockCategories as any);

      const result = await service.getSpendingByCategory(
        mockUserId,
        mockSpaceId,
        startDate,
        endDate
      );

      expect(result).toHaveLength(2);
      expect(result[0].categoryName).toBe('Groceries');
      expect(result[0].amount).toBe(5000); // Absolute value
      expect(result[0].transactionCount).toBe(10);
      expect(result[1].categoryName).toBe('Transportation');
      expect(result[1].amount).toBe(3000);
      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        mockUserId,
        mockSpaceId,
        'viewer'
      );
    });

    it('should sort categories by amount descending', async () => {
      const mockTransactions = [
        {
          categoryId: 'cat-1',
          _sum: { amount: { toNumber: () => -1000 } },
          _count: 5,
        },
        {
          categoryId: 'cat-2',
          _sum: { amount: { toNumber: () => -5000 } },
          _count: 10,
        },
      ];

      const mockCategories = [
        { id: 'cat-1', name: 'Category 1' },
        { id: 'cat-2', name: 'Category 2' },
      ];

      prisma.transaction.groupBy.mockResolvedValue(mockTransactions as any);
      prisma.category.findMany.mockResolvedValue(mockCategories as any);

      const result = await service.getSpendingByCategory(
        mockUserId,
        mockSpaceId,
        new Date(),
        new Date()
      );

      expect(result[0].amount).toBeGreaterThan(result[1].amount);
    });

    it('should handle uncategorized transactions', async () => {
      const mockTransactions = [
        {
          categoryId: 'cat-1',
          _sum: { amount: { toNumber: () => -1000 } },
          _count: 5,
        },
        {
          categoryId: null,
          _sum: { amount: { toNumber: () => -500 } },
          _count: 2,
        },
      ];

      const mockCategories = [{ id: 'cat-1', name: 'Category 1' }];

      prisma.transaction.groupBy.mockResolvedValue(mockTransactions as any);
      prisma.category.findMany.mockResolvedValue(mockCategories as any);

      const result = await service.getSpendingByCategory(
        mockUserId,
        mockSpaceId,
        new Date(),
        new Date()
      );

      // Should only include categorized transactions
      expect(result).toHaveLength(1);
    });
  });

  describe('getIncomeVsExpenses', () => {
    it('should return monthly income vs expenses', async () => {
      const now = new Date();
      const month1 = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);
      const month2 = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 7);

      (prisma.$queryRaw as jest.Mock).mockResolvedValue([
        { month: month1, income: '10000', expenses: '8000' },
        { month: month2, income: '12000', expenses: '9000' },
      ]);

      const result = await service.getIncomeVsExpenses(mockUserId, mockSpaceId, 2);

      expect(result).toHaveLength(2);
      expect(result[0].income).toBe(10000);
      expect(result[0].expenses).toBe(8000);
      expect(result[0].net).toBe(2000); // 10000 - 8000
      expect(result[1].income).toBe(12000);
      expect(result[1].expenses).toBe(9000);
      expect(result[1].net).toBe(3000);
      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        mockUserId,
        mockSpaceId,
        'viewer'
      );
    });

    it('should handle months with no data', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      const result = await service.getIncomeVsExpenses(mockUserId, mockSpaceId, 1);

      expect(result).toHaveLength(1);
      expect(result[0].income).toBe(0);
      expect(result[0].expenses).toBe(0);
      expect(result[0].net).toBe(0);
    });

    it('should format month correctly', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      const result = await service.getIncomeVsExpenses(mockUserId, mockSpaceId, 1);

      // Should be in YYYY-MM format
      expect(result[0].month).toMatch(/^\d{4}-\d{2}$/);
    });
  });

  describe('getAccountBalances', () => {
    it('should return account balances ordered by balance', async () => {
      const mockAccounts = [
        {
          id: 'acc-1',
          name: 'Savings',
          type: 'savings',
          balance: { toNumber: () => 50000 },
          currency: 'MXN',
          lastSyncedAt: new Date('2024-01-01'),
        },
        {
          id: 'acc-2',
          name: 'Checking',
          type: 'checking',
          balance: { toNumber: () => 10000 },
          currency: 'MXN',
          lastSyncedAt: new Date('2024-01-02'),
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockAccounts as any);

      const result = await service.getAccountBalances(mockUserId, mockSpaceId);

      expect(result).toHaveLength(2);
      expect(result[0].accountName).toBe('Savings');
      expect(result[0].balance).toBe(50000);
      expect(result[0].currency).toBe(Currency.MXN);
      expect(result[1].accountName).toBe('Checking');
      expect(result[1].balance).toBe(10000);
      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        mockUserId,
        mockSpaceId,
        'viewer'
      );
    });

    it('should handle accounts without last sync date', async () => {
      const mockAccounts = [
        {
          id: 'acc-1',
          name: 'Cash',
          type: 'cash',
          balance: { toNumber: () => 1000 },
          currency: 'MXN',
          lastSyncedAt: null,
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockAccounts as any);

      const result = await service.getAccountBalances(mockUserId, mockSpaceId);

      expect(result[0].lastSynced).toBeUndefined();
    });
  });

  describe('access control', () => {
    it('should verify user access for all methods', async () => {
      prisma.account.findMany.mockResolvedValue([]);
      prisma.assetValuation.findMany.mockResolvedValue([]);
      prisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: null },
        _count: 0,
      } as any);
      prisma.transaction.groupBy.mockResolvedValue([]);
      prisma.category.findMany.mockResolvedValue([]);

      await service.getNetWorth(mockUserId, mockSpaceId);
      await service.getCashflowForecast(mockUserId, mockSpaceId);
      await service.getSpendingByCategory(mockUserId, mockSpaceId, new Date(), new Date());
      await service.getIncomeVsExpenses(mockUserId, mockSpaceId);
      await service.getAccountBalances(mockUserId, mockSpaceId);

      expect(spacesService.verifyUserAccess).toHaveBeenCalledTimes(5);
    });
  });

  describe('getNetWorth - DeFi and manual assets', () => {
    it('should include DeFi value for crypto accounts', async () => {
      const mockAccounts = [
        {
          id: 'crypto-1',
          name: 'Ethereum Wallet',
          balance: { toNumber: () => 5000 },
          type: 'crypto',
          currency: 'USD',
          metadata: { defiValueUsd: 3000 },
          assetValuations: [],
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockAccounts as any);
      prisma.assetValuation.findMany.mockResolvedValue([]);

      const result = await service.getNetWorth(mockUserId, mockSpaceId);

      // Base balance (5000) + DeFi value (3000) = 8000
      expect(result.totalAssets).toBe(8000);
    });

    it('should convert DeFi value from USD to target currency', async () => {
      fxRatesService.getExchangeRate.mockImplementation(async (from, to) => {
        if (from === 'USD' && to === 'MXN') return 17;
        return 1;
      });

      const mockAccounts = [
        {
          id: 'crypto-1',
          name: 'Ethereum Wallet',
          balance: { toNumber: () => 0 },
          type: 'crypto',
          currency: 'USD',
          metadata: { defiValueUsd: 1000 },
          assetValuations: [],
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockAccounts as any);
      prisma.assetValuation.findMany.mockResolvedValue([]);

      const result = await service.getNetWorth(mockUserId, mockSpaceId);

      // DeFi value converted: 1000 USD * 17 = 17000 MXN
      expect(result.totalAssets).toBe(17000);
    });

    it('should include manual assets in net worth', async () => {
      const mockAccounts = [
        {
          id: 'acc-1',
          balance: { toNumber: () => 10000 },
          type: 'checking',
          currency: 'MXN',
          assetValuations: [],
        },
      ];

      const mockManualAssets = [
        {
          id: 'ma-1',
          name: 'Car',
          currentValue: { toNumber: () => 50000 },
          currency: 'MXN',
        },
        {
          id: 'ma-2',
          name: 'Jewelry',
          currentValue: { toNumber: () => 15000 },
          currency: 'MXN',
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockAccounts as any);
      prisma.manualAsset.findMany.mockResolvedValue(mockManualAssets as any);
      prisma.assetValuation.findMany.mockResolvedValue([]);

      const result = await service.getNetWorth(mockUserId, mockSpaceId);

      // Account (10000) + Car (50000) + Jewelry (15000) = 75000
      expect(result.totalAssets).toBe(75000);
    });

    it('should convert manual assets from different currencies', async () => {
      fxRatesService.getExchangeRate.mockImplementation(async (from, to) => {
        if (from === 'USD' && to === 'MXN') return 17;
        return 1;
      });

      prisma.account.findMany.mockResolvedValue([]);
      prisma.manualAsset.findMany.mockResolvedValue([
        {
          id: 'ma-1',
          name: 'USD Asset',
          currentValue: { toNumber: () => 1000 },
          currency: 'USD',
        },
      ] as any);
      prisma.assetValuation.findMany.mockResolvedValue([]);

      const result = await service.getNetWorth(mockUserId, mockSpaceId);

      // 1000 USD * 17 = 17000 MXN
      expect(result.totalAssets).toBe(17000);
    });

    it('should calculate change percentage from trend', async () => {
      const mockAccounts = [
        {
          id: 'acc-1',
          balance: { toNumber: () => 10000 },
          type: 'checking',
          currency: 'MXN',
          assetValuations: [],
        },
      ];

      const mockValuations = [
        {
          id: 'val-1',
          accountId: 'acc-1',
          date: new Date('2024-01-01'),
          value: { toNumber: () => 8000 },
          currency: 'MXN',
        },
        {
          id: 'val-2',
          accountId: 'acc-1',
          date: new Date('2024-01-31'),
          value: { toNumber: () => 10000 },
          currency: 'MXN',
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockAccounts as any);
      prisma.assetValuation.findMany.mockResolvedValue(mockValuations as any);

      const result = await service.getNetWorth(mockUserId, mockSpaceId);

      // Change from 8000 to 10000 = 25%
      expect(result.changePercent).toBe(25);
      expect(result.changeAmount).toBe(2000);
    });
  });

  describe('getNetWorthByOwnership', () => {
    it('should categorize accounts by ownership', async () => {
      const mockAccounts = [
        {
          id: 'acc-1',
          balance: { toNumber: () => 10000 },
          currency: 'MXN',
          type: 'checking',
          ownership: 'individual',
          ownerId: mockUserId,
        },
        {
          id: 'acc-2',
          balance: { toNumber: () => 20000 },
          currency: 'MXN',
          type: 'savings',
          ownership: 'joint',
          ownerId: null,
        },
        {
          id: 'acc-3',
          balance: { toNumber: () => 15000 },
          currency: 'MXN',
          type: 'investment',
          ownership: 'individual',
          ownerId: 'partner-id',
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockAccounts as any);

      const result = await service.getNetWorthByOwnership(mockUserId, mockSpaceId);

      expect(result.yours).toBe(10000);
      expect(result.ours).toBe(20000);
      expect(result.mine).toBe(15000);
      expect(result.total).toBe(45000);
    });

    it('should handle trust accounts as ours', async () => {
      const mockAccounts = [
        {
          id: 'acc-1',
          balance: { toNumber: () => 100000 },
          currency: 'MXN',
          type: 'investment',
          ownership: 'trust',
          ownerId: null,
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockAccounts as any);

      const result = await service.getNetWorthByOwnership(mockUserId, mockSpaceId);

      expect(result.ours).toBe(100000);
    });

    it('should default unassigned accounts to yours', async () => {
      const mockAccounts = [
        {
          id: 'acc-1',
          balance: { toNumber: () => 5000 },
          currency: 'MXN',
          type: 'checking',
          ownership: 'individual',
          ownerId: null,
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockAccounts as any);

      const result = await service.getNetWorthByOwnership(mockUserId, mockSpaceId);

      expect(result.yours).toBe(5000);
    });

    it('should separate assets and liabilities by ownership', async () => {
      const mockAccounts = [
        {
          id: 'acc-1',
          balance: { toNumber: () => 10000 },
          currency: 'MXN',
          type: 'checking',
          ownership: 'individual',
          ownerId: mockUserId,
        },
        {
          id: 'acc-2',
          balance: { toNumber: () => -5000 },
          currency: 'MXN',
          type: 'credit',
          ownership: 'individual',
          ownerId: mockUserId,
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockAccounts as any);

      const result = await service.getNetWorthByOwnership(mockUserId, mockSpaceId);

      expect(result.breakdown[0].assets).toBe(10000);
      expect(result.breakdown[0].liabilities).toBe(5000);
      expect(result.breakdown[0].netWorth).toBe(5000);
    });

    it('should include DeFi value in crypto accounts by ownership', async () => {
      const mockAccounts = [
        {
          id: 'crypto-1',
          balance: { toNumber: () => 1000 },
          currency: 'USD',
          type: 'crypto',
          ownership: 'individual',
          ownerId: mockUserId,
          metadata: { defiValueUsd: 500 },
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockAccounts as any);

      const result = await service.getNetWorthByOwnership(mockUserId, mockSpaceId);

      // 1000 + 500 = 1500
      expect(result.yours).toBe(1500);
    });
  });

  describe('getAccountsByOwnership', () => {
    const mockAccounts = [
      {
        id: 'acc-1',
        balance: { toNumber: () => 10000 },
        ownership: 'individual',
        ownerId: mockUserId,
      },
      {
        id: 'acc-2',
        balance: { toNumber: () => 20000 },
        ownership: 'joint',
        ownerId: null,
      },
      {
        id: 'acc-3',
        balance: { toNumber: () => 15000 },
        ownership: 'individual',
        ownerId: 'partner-id',
      },
    ];

    beforeEach(() => {
      prisma.account.findMany.mockResolvedValue(mockAccounts as any);
    });

    it('should return all accounts with ownership category', async () => {
      const result = await service.getAccountsByOwnership(mockUserId, mockSpaceId, 'all');

      expect(result).toHaveLength(3);
      expect(result[0].ownershipCategory).toBe('yours');
      expect(result[1].ownershipCategory).toBe('ours');
      expect(result[2].ownershipCategory).toBe('mine');
    });

    it('should filter by yours ownership', async () => {
      const result = await service.getAccountsByOwnership(mockUserId, mockSpaceId, 'yours');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('acc-1');
    });

    it('should filter by ours ownership', async () => {
      const result = await service.getAccountsByOwnership(mockUserId, mockSpaceId, 'ours');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('acc-2');
    });

    it('should filter by mine ownership', async () => {
      const result = await service.getAccountsByOwnership(mockUserId, mockSpaceId, 'mine');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('acc-3');
    });
  });

  describe('getNetWorthHistory', () => {
    it('should return daily snapshots for the period', async () => {
      const mockAccounts = [
        {
          id: 'acc-1',
          balance: { toNumber: () => 10000 },
          type: 'checking',
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockAccounts as any);
      prisma.manualAsset.findMany.mockResolvedValue([]);
      prisma.assetValuation.findMany.mockResolvedValue([]);

      const result = await service.getNetWorthHistory(mockUserId, mockSpaceId, 7);

      expect(result.length).toBe(8); // 7 days + today
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('netWorth');
      expect(result[0]).toHaveProperty('assets');
      expect(result[0]).toHaveProperty('liabilities');
    });

    it('should use valuations to track historical balances', async () => {
      const today = new Date();
      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(today.getDate() - 3);

      const mockAccounts = [
        {
          id: 'acc-1',
          balance: { toNumber: () => 15000 },
          type: 'savings',
        },
      ];

      const mockValuations = [
        {
          id: 'val-1',
          accountId: 'acc-1',
          date: threeDaysAgo,
          value: { toNumber: () => 12000 },
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockAccounts as any);
      prisma.manualAsset.findMany.mockResolvedValue([]);
      prisma.assetValuation.findMany.mockResolvedValue(mockValuations as any);

      const result = await service.getNetWorthHistory(mockUserId, mockSpaceId, 7);

      // Should have history points
      expect(result.length).toBeGreaterThan(0);
    });

    it('should separate assets and liabilities correctly', async () => {
      const mockAccounts = [
        {
          id: 'acc-1',
          balance: { toNumber: () => 20000 },
          type: 'savings',
        },
        {
          id: 'acc-2',
          balance: { toNumber: () => -5000 },
          type: 'credit',
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockAccounts as any);
      prisma.manualAsset.findMany.mockResolvedValue([]);
      prisma.assetValuation.findMany.mockResolvedValue([]);

      const result = await service.getNetWorthHistory(mockUserId, mockSpaceId, 1);

      // Check the last point
      const lastPoint = result[result.length - 1];
      expect(lastPoint.assets).toBe(20000);
      expect(lastPoint.liabilities).toBe(5000);
      expect(lastPoint.netWorth).toBe(15000);
    });

    it('should include manual assets in history', async () => {
      prisma.account.findMany.mockResolvedValue([]);
      prisma.manualAsset.findMany.mockResolvedValue([
        {
          id: 'ma-1',
          currentValue: { toNumber: () => 50000 },
        },
      ] as any);
      prisma.assetValuation.findMany.mockResolvedValue([]);

      const result = await service.getNetWorthHistory(mockUserId, mockSpaceId, 1);

      expect(result[result.length - 1].assets).toBe(50000);
    });
  });

  describe('getPortfolioAllocation', () => {
    it('should group accounts by type', async () => {
      const mockAccounts = [
        {
          id: 'acc-1',
          balance: { toNumber: () => 10000 },
          type: 'checking',
        },
        {
          id: 'acc-2',
          balance: { toNumber: () => 20000 },
          type: 'savings',
        },
        {
          id: 'acc-3',
          balance: { toNumber: () => 30000 },
          type: 'investment',
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockAccounts as any);

      const result = await service.getPortfolioAllocation(mockUserId, mockSpaceId);

      expect(result).toHaveLength(3);

      const investment = result.find((r) => r.assetType === 'investment');
      expect(investment?.value).toBe(30000);
      expect(investment?.percentage).toBe(50); // 30000 / 60000 * 100
    });

    it('should calculate percentages correctly', async () => {
      const mockAccounts = [
        {
          id: 'acc-1',
          balance: { toNumber: () => 25000 },
          type: 'stocks',
        },
        {
          id: 'acc-2',
          balance: { toNumber: () => 75000 },
          type: 'bonds',
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockAccounts as any);

      const result = await service.getPortfolioAllocation(mockUserId, mockSpaceId);

      const stocks = result.find((r) => r.assetType === 'stocks');
      const bonds = result.find((r) => r.assetType === 'bonds');

      expect(stocks?.percentage).toBe(25);
      expect(bonds?.percentage).toBe(75);
    });

    it('should count accounts per type', async () => {
      const mockAccounts = [
        { id: 'acc-1', balance: { toNumber: () => 5000 }, type: 'checking' },
        { id: 'acc-2', balance: { toNumber: () => 10000 }, type: 'checking' },
        { id: 'acc-3', balance: { toNumber: () => 20000 }, type: 'savings' },
      ];

      prisma.account.findMany.mockResolvedValue(mockAccounts as any);

      const result = await service.getPortfolioAllocation(mockUserId, mockSpaceId);

      const checking = result.find((r) => r.assetType === 'checking');
      expect(checking?.accountCount).toBe(2);
    });

    it('should handle empty accounts', async () => {
      prisma.account.findMany.mockResolvedValue([]);

      const result = await service.getPortfolioAllocation(mockUserId, mockSpaceId);

      expect(result).toEqual([]);
    });

    it('should use absolute values for balances', async () => {
      const mockAccounts = [{ id: 'acc-1', balance: { toNumber: () => -5000 }, type: 'credit' }];

      prisma.account.findMany.mockResolvedValue(mockAccounts as any);

      const result = await service.getPortfolioAllocation(mockUserId, mockSpaceId);

      expect(result[0].value).toBe(5000);
    });
  });

  describe('getDashboardData', () => {
    beforeEach(() => {
      // Setup common mocks
      prisma.account.findMany.mockResolvedValue([
        {
          id: 'acc-1',
          name: 'Checking',
          balance: { toNumber: () => 10000 },
          type: 'checking',
          currency: 'MXN',
          assetValuations: [],
        },
      ] as any);

      (prisma.transaction as any).findMany = jest.fn().mockResolvedValue([]);
      prisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: { toNumber: () => 0 } },
        _count: 0,
      } as any);

      (prisma.budget as any).findMany = jest.fn().mockResolvedValue([]);
      (prisma.goal as any).findMany = jest.fn().mockResolvedValue([]);
      prisma.assetValuation.findMany.mockResolvedValue([]);
    });

    it('should return all dashboard components', async () => {
      const result = await service.getDashboardData(mockUserId, mockSpaceId);

      expect(result).toHaveProperty('accounts');
      expect(result).toHaveProperty('recentTransactions');
      expect(result).toHaveProperty('budgets');
      expect(result).toHaveProperty('netWorth');
      expect(result).toHaveProperty('cashflowForecast');
      expect(result).toHaveProperty('portfolioAllocation');
      expect(result).toHaveProperty('goals');
    });

    it('should convert account balances to numbers', async () => {
      const result = await service.getDashboardData(mockUserId, mockSpaceId);

      expect(typeof result.accounts[0].balance).toBe('number');
      expect(result.accounts[0].balance).toBe(10000);
    });

    it('should limit recent transactions to 5', async () => {
      const mockTransactions = Array(10)
        .fill(null)
        .map((_, i) => ({
          id: `txn-${i}`,
          amount: { toNumber: () => -100 },
          date: new Date(),
          account: { id: 'acc-1' },
        }));

      (prisma.transaction as any).findMany.mockResolvedValue(mockTransactions);

      const result = await service.getDashboardData(mockUserId, mockSpaceId);

      // The service takes 5, so the result should be capped
      expect(result.recentTransactions.data.length).toBeLessThanOrEqual(10);
    });

    it('should include goals with converted decimal values', async () => {
      (prisma.goal as any).findMany.mockResolvedValue([
        {
          id: 'goal-1',
          name: 'Emergency Fund',
          targetAmount: { toNumber: () => 100000 },
          currentProbability: { toNumber: () => 0.75 },
          confidenceLow: { toNumber: () => 0.6 },
          confidenceHigh: { toNumber: () => 0.9 },
          currentProgress: { toNumber: () => 50000 },
          expectedReturn: { toNumber: () => 0.05 },
          volatility: { toNumber: () => 0.1 },
          monthlyContribution: { toNumber: () => 5000 },
          allocations: [],
        },
      ]);

      const result = await service.getDashboardData(mockUserId, mockSpaceId);

      expect(result.goals[0].targetAmount).toBe(100000);
      expect(result.goals[0].currentProbability).toBe(0.75);
    });

    it('should convert goal allocations with account balances', async () => {
      (prisma.goal as any).findMany.mockResolvedValue([
        {
          id: 'goal-1',
          name: 'Emergency Fund',
          targetAmount: { toNumber: () => 100000 },
          currentProbability: { toNumber: () => 0.75 },
          confidenceLow: { toNumber: () => 0.6 },
          confidenceHigh: { toNumber: () => 0.9 },
          currentProgress: { toNumber: () => 50000 },
          expectedReturn: { toNumber: () => 0.05 },
          volatility: { toNumber: () => 0.1 },
          monthlyContribution: { toNumber: () => 5000 },
          allocations: [
            {
              id: 'alloc-1',
              goalId: 'goal-1',
              accountId: 'acc-1',
              percentage: { toNumber: () => 0.6 },
              account: {
                id: 'acc-1',
                name: 'Savings',
                balance: { toNumber: () => 30000 },
                currency: 'MXN',
              },
            },
            {
              id: 'alloc-2',
              goalId: 'goal-1',
              accountId: 'acc-2',
              percentage: { toNumber: () => 0.4 },
              account: {
                id: 'acc-2',
                name: 'Investment',
                balance: { toNumber: () => 20000 },
                currency: 'MXN',
              },
            },
          ],
        },
      ]);

      const result = await service.getDashboardData(mockUserId, mockSpaceId);

      expect(result.goals[0].allocations).toHaveLength(2);
      expect(result.goals[0].allocations[0].percentage).toBe(0.6);
      expect(result.goals[0].allocations[0].account.balance).toBe(30000);
      expect(result.goals[0].allocations[1].percentage).toBe(0.4);
      expect(result.goals[0].allocations[1].account.balance).toBe(20000);
    });

    it('should handle goals with null optional fields', async () => {
      (prisma.goal as any).findMany.mockResolvedValue([
        {
          id: 'goal-1',
          name: 'Simple Goal',
          targetAmount: { toNumber: () => 50000 },
          currentProbability: null,
          confidenceLow: null,
          confidenceHigh: null,
          currentProgress: null,
          expectedReturn: null,
          volatility: null,
          monthlyContribution: null,
          allocations: [],
        },
      ]);

      const result = await service.getDashboardData(mockUserId, mockSpaceId);

      expect(result.goals[0].targetAmount).toBe(50000);
      expect(result.goals[0].currentProbability).toBeNull();
      expect(result.goals[0].confidenceLow).toBeNull();
      expect(result.goals[0].confidenceHigh).toBeNull();
      expect(result.goals[0].currentProgress).toBeNull();
      expect(result.goals[0].expectedReturn).toBeNull();
      expect(result.goals[0].volatility).toBeNull();
      expect(result.goals[0].monthlyContribution).toBeNull();
    });

    it('should return partial data when getNetWorth fails', async () => {
      // Make FxRatesService throw to crash getNetWorth (currency conversion)
      fxRatesService.getExchangeRate.mockRejectedValue(new Error('FX rate unavailable'));

      // Add an account with a different currency to trigger conversion
      prisma.account.findMany.mockResolvedValue([
        {
          id: 'acc-1',
          name: 'Checking',
          balance: { toNumber: () => 10000 },
          type: 'checking',
          currency: 'USD',
          assetValuations: [],
        },
      ] as any);

      const result = await service.getDashboardData(mockUserId, mockSpaceId);

      // Accounts should still be returned (direct Prisma query, not dependent on FX)
      expect(result.accounts).toHaveLength(1);
      expect(result.accounts[0].balance).toBe(10000);
      // netWorth should fall back to null
      expect(result.netWorth).toBeNull();
      // _errors should report the failure
      expect(result._errors).toContain('netWorth');
    });

    it('should return partial data when getCashflowForecast fails', async () => {
      // Make transaction.aggregate throw to crash getCashflowForecast
      prisma.transaction.aggregate.mockRejectedValue(new Error('DB connection lost'));

      const result = await service.getDashboardData(mockUserId, mockSpaceId);

      // Accounts should still be returned
      expect(result.accounts).toBeDefined();
      // cashflowForecast should fall back to null
      expect(result.cashflowForecast).toBeNull();
      // _errors should report the failure
      expect(result._errors).toContain('cashflowForecast');
      // Other sections that don't depend on aggregate should still work
      expect(result.budgets).toBeDefined();
      expect(result.goals).toBeDefined();
    });
  });

  describe('getBudgetsWithSummary (via getDashboardData)', () => {
    beforeEach(() => {
      prisma.account.findMany.mockResolvedValue([]);
      (prisma.transaction as any).findMany = jest.fn().mockResolvedValue([]);
      prisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: { toNumber: () => 0 } },
        _count: 0,
      } as any);
      (prisma.goal as any).findMany = jest.fn().mockResolvedValue([]);
      prisma.assetValuation.findMany.mockResolvedValue([]);
    });

    it('should return empty when no budgets exist', async () => {
      (prisma.budget as any).findMany = jest.fn().mockResolvedValue([]);

      const result = await service.getDashboardData(mockUserId, mockSpaceId);

      expect(result.budgets).toEqual([]);
      expect(result.currentBudgetSummary).toBeNull();
    });

    it('should calculate category spending summaries', async () => {
      const mockBudgets = [
        {
          id: 'budget-1',
          name: 'January Budget',
          period: 'monthly',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
          income: { toNumber: () => 50000 },
          createdAt: new Date(),
          categories: [
            {
              id: 'cat-1',
              budgetId: 'budget-1',
              name: 'Groceries',
              budgetedAmount: { toNumber: () => 5000 },
              carryoverAmount: { toNumber: () => 500 },
              icon: null,
              color: null,
              description: null,
              _count: { transactions: 10 },
            },
          ],
        },
      ];

      const mockTransactions = [
        {
          id: 'txn-1',
          categoryId: 'cat-1',
          amount: { toNumber: () => -3000 },
          date: new Date('2024-01-15'),
          account: { id: 'acc-1' },
        },
      ];

      (prisma.budget as any).findMany = jest.fn().mockResolvedValue(mockBudgets);
      prisma.transaction.findMany.mockResolvedValue(mockTransactions as any);

      const result = await service.getDashboardData(mockUserId, mockSpaceId);

      expect(result.currentBudgetSummary).toBeDefined();
      expect(result.currentBudgetSummary?.categories[0].spent).toBe(3000);
      expect(result.currentBudgetSummary?.categories[0].remaining).toBe(2500); // 5000 + 500 - 3000
    });

    it('should calculate total budget summary', async () => {
      const mockBudgets = [
        {
          id: 'budget-1',
          name: 'Budget',
          period: 'monthly',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
          income: { toNumber: () => 60000 },
          createdAt: new Date(),
          categories: [
            {
              id: 'cat-1',
              budgetId: 'budget-1',
              name: 'Food',
              budgetedAmount: { toNumber: () => 10000 },
              carryoverAmount: { toNumber: () => 0 },
              icon: null,
              color: null,
              description: null,
            },
            {
              id: 'cat-2',
              budgetId: 'budget-1',
              name: 'Transport',
              budgetedAmount: { toNumber: () => 5000 },
              carryoverAmount: { toNumber: () => 1000 },
              icon: null,
              color: null,
              description: null,
            },
          ],
        },
      ];

      (prisma.budget as any).findMany = jest.fn().mockResolvedValue(mockBudgets);
      (prisma.transaction as any).findMany.mockResolvedValue([]);

      const result = await service.getDashboardData(mockUserId, mockSpaceId);

      expect(result.currentBudgetSummary?.summary.totalBudgeted).toBe(15000);
      expect(result.currentBudgetSummary?.summary.totalCarryover).toBe(1000);
      expect(result.currentBudgetSummary?.summary.totalIncome).toBe(60000);
      expect(result.currentBudgetSummary?.summary.readyToAssign).toBe(46000); // 60000 + 1000 - 15000
    });
  });

  describe('getNetWorth edge cases', () => {
    it('should use MXN when space has no currency', async () => {
      prisma.space.findUnique.mockResolvedValue({ id: mockSpaceId, currency: null } as any);
      prisma.account.findMany.mockResolvedValue([]);
      prisma.assetValuation.findMany.mockResolvedValue([]);

      const result = await service.getNetWorth(mockUserId, mockSpaceId);

      expect(result.currency).toBe(Currency.MXN);
    });

    it('should handle DeFi value when displayCurrency is USD', async () => {
      prisma.space.findUnique.mockResolvedValue({ id: mockSpaceId, currency: 'USD' } as any);

      const mockAccounts = [
        {
          id: 'crypto-1',
          balance: { toNumber: () => 0 },
          type: 'crypto',
          currency: 'USD',
          metadata: { defiValueUsd: 1000 },
          assetValuations: [],
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockAccounts as any);
      prisma.assetValuation.findMany.mockResolvedValue([]);

      const result = await service.getNetWorth(mockUserId, mockSpaceId);

      // No conversion needed when displayCurrency is USD
      expect(result.totalAssets).toBe(1000);
    });

    it('should handle DeFi value of zero', async () => {
      const mockAccounts = [
        {
          id: 'crypto-1',
          balance: { toNumber: () => 5000 },
          type: 'crypto',
          currency: 'MXN',
          metadata: { defiValueUsd: 0 }, // Zero DeFi value
          assetValuations: [],
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockAccounts as any);
      prisma.assetValuation.findMany.mockResolvedValue([]);

      const result = await service.getNetWorth(mockUserId, mockSpaceId);

      // Only base balance, no DeFi value added
      expect(result.totalAssets).toBe(5000);
    });

    it('should handle DeFi metadata being null', async () => {
      const mockAccounts = [
        {
          id: 'crypto-1',
          balance: { toNumber: () => 3000 },
          type: 'crypto',
          currency: 'MXN',
          metadata: null, // Null metadata
          assetValuations: [],
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockAccounts as any);
      prisma.assetValuation.findMany.mockResolvedValue([]);

      const result = await service.getNetWorth(mockUserId, mockSpaceId);

      expect(result.totalAssets).toBe(3000);
    });

    it('should use valuation currency fallback to account currency', async () => {
      const mockAccounts = [
        {
          id: 'acc-1',
          balance: { toNumber: () => 10000 },
          type: 'checking',
          currency: 'MXN',
          assetValuations: [],
        },
      ];

      // Valuation without currency - should fall back to account currency
      const mockValuations = [
        {
          id: 'val-1',
          accountId: 'acc-1',
          date: new Date(),
          value: { toNumber: () => 9000 },
          currency: null, // No currency on valuation
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockAccounts as any);
      prisma.assetValuation.findMany.mockResolvedValue(mockValuations as any);

      const result = await service.getNetWorth(mockUserId, mockSpaceId);

      // Should have trend data using account currency as fallback
      expect(result.trend.length).toBe(1);
    });

    it('should handle single trend point (no change calculation)', async () => {
      const mockAccounts = [
        {
          id: 'acc-1',
          balance: { toNumber: () => 10000 },
          type: 'checking',
          currency: 'MXN',
          assetValuations: [],
        },
      ];

      // Only one valuation = no change can be calculated
      const mockValuations = [
        {
          id: 'val-1',
          accountId: 'acc-1',
          date: new Date(),
          value: { toNumber: () => 10000 },
          currency: 'MXN',
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockAccounts as any);
      prisma.assetValuation.findMany.mockResolvedValue(mockValuations as any);

      const result = await service.getNetWorth(mockUserId, mockSpaceId);

      // With only 1 trend point, change should be 0
      expect(result.changeAmount).toBe(0);
      expect(result.changePercent).toBe(0);
    });

    it('should handle zero earliest value (avoid division by zero)', async () => {
      const mockAccounts = [
        {
          id: 'acc-1',
          balance: { toNumber: () => 10000 },
          type: 'checking',
          currency: 'MXN',
          assetValuations: [],
        },
      ];

      const mockValuations = [
        {
          id: 'val-1',
          accountId: 'acc-1',
          date: new Date('2024-01-01'),
          value: { toNumber: () => 0 }, // Zero earliest value
          currency: 'MXN',
        },
        {
          id: 'val-2',
          accountId: 'acc-1',
          date: new Date('2024-01-15'),
          value: { toNumber: () => 10000 },
          currency: 'MXN',
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockAccounts as any);
      prisma.assetValuation.findMany.mockResolvedValue(mockValuations as any);

      const result = await service.getNetWorth(mockUserId, mockSpaceId);

      // Should handle division by zero gracefully
      expect(result.changePercent).toBe(0);
      expect(result.changeAmount).toBe(10000);
    });
  });

  describe('getNetWorthHistory edge cases', () => {
    it('should handle account with zero balance in history', async () => {
      const mockAccounts = [
        {
          id: 'acc-1',
          balance: { toNumber: () => 0 }, // Zero balance
          type: 'checking',
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockAccounts as any);
      prisma.manualAsset.findMany.mockResolvedValue([]);
      prisma.assetValuation.findMany.mockResolvedValue([]);

      const result = await service.getNetWorthHistory(mockUserId, mockSpaceId, 3);

      // Should handle zero values correctly
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].assets).toBe(0);
    });

    it('should handle positive credit account balance (unusual case)', async () => {
      // Credit account with positive balance (payment overage or refund)
      const mockAccounts = [
        {
          id: 'acc-1',
          balance: { toNumber: () => 500 }, // Positive balance on credit account
          type: 'credit',
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockAccounts as any);
      prisma.manualAsset.findMany.mockResolvedValue([]);
      prisma.assetValuation.findMany.mockResolvedValue([]);

      const result = await service.getNetWorthHistory(mockUserId, mockSpaceId, 1);

      // Credit accounts always count as liabilities regardless of sign
      const lastPoint = result[result.length - 1];
      expect(lastPoint.liabilities).toBe(500);
    });
  });

  describe('getNetWorthByOwnership edge cases', () => {
    it('should handle DeFi value when displayCurrency is USD', async () => {
      prisma.space.findUnique.mockResolvedValue({ id: mockSpaceId, currency: 'USD' } as any);

      const mockAccounts = [
        {
          id: 'crypto-1',
          balance: { toNumber: () => 0 },
          currency: 'USD',
          type: 'crypto',
          ownership: 'individual',
          ownerId: mockUserId,
          metadata: { defiValueUsd: 2000 },
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockAccounts as any);

      const result = await service.getNetWorthByOwnership(mockUserId, mockSpaceId);

      // No conversion needed when displayCurrency is USD
      expect(result.yours).toBe(2000);
    });

    it('should handle DeFi value of zero in ownership', async () => {
      const mockAccounts = [
        {
          id: 'crypto-1',
          balance: { toNumber: () => 5000 },
          currency: 'MXN',
          type: 'crypto',
          ownership: 'individual',
          ownerId: mockUserId,
          metadata: { defiValueUsd: 0 }, // Zero DeFi value
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockAccounts as any);

      const result = await service.getNetWorthByOwnership(mockUserId, mockSpaceId);

      // Only base balance, no DeFi value
      expect(result.yours).toBe(5000);
    });
  });

  describe('currency conversion', () => {
    it('should convert account balances to target currency', async () => {
      fxRatesService.getExchangeRate.mockImplementation(async (from, to) => {
        if (from === 'USD' && to === 'MXN') return 17;
        return 1;
      });

      const mockAccounts = [
        {
          id: 'acc-1',
          balance: { toNumber: () => 1000 },
          type: 'checking',
          currency: 'USD',
          assetValuations: [],
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockAccounts as any);
      prisma.assetValuation.findMany.mockResolvedValue([]);

      const result = await service.getNetWorth(mockUserId, mockSpaceId);

      expect(result.totalAssets).toBe(17000);
      expect(fxRatesService.getExchangeRate).toHaveBeenCalledWith('USD', 'MXN');
    });

    it('should preserve negative sign after currency conversion', async () => {
      fxRatesService.getExchangeRate.mockResolvedValue(17);

      const mockAccounts = [
        {
          id: 'acc-1',
          balance: { toNumber: () => -1000 },
          type: 'credit',
          currency: 'USD',
          assetValuations: [],
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockAccounts as any);
      prisma.assetValuation.findMany.mockResolvedValue([]);

      const result = await service.getNetWorth(mockUserId, mockSpaceId);

      // -1000 USD = -17000 MXN (liability)
      expect(result.totalLiabilities).toBe(17000);
    });

    it('should convert historical valuations to target currency', async () => {
      fxRatesService.getExchangeRate.mockImplementation(async (from, to) => {
        if (from === 'USD' && to === 'MXN') return 17;
        return 1;
      });

      const mockAccounts = [
        {
          id: 'acc-1',
          balance: { toNumber: () => 0 },
          currency: 'USD',
          assetValuations: [],
        },
      ];

      const mockValuations = [
        {
          id: 'val-1',
          accountId: 'acc-1',
          date: new Date(),
          value: { toNumber: () => 100 },
          currency: 'USD',
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockAccounts as any);
      prisma.assetValuation.findMany.mockResolvedValue(mockValuations as any);

      const result = await service.getNetWorth(mockUserId, mockSpaceId);

      expect(result.trend[0].value).toBe(1700);
    });

    it('should use target currency when provided', async () => {
      const mockAccounts = [
        {
          id: 'acc-1',
          balance: { toNumber: () => 1000 },
          currency: 'USD',
          assetValuations: [],
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockAccounts as any);
      prisma.assetValuation.findMany.mockResolvedValue([]);

      const result = await service.getNetWorth(mockUserId, mockSpaceId, Currency.USD);

      expect(result.currency).toBe(Currency.USD);
      // No conversion needed since account is already in USD
      expect(result.totalAssets).toBe(1000);
    });
  });

  describe('getConsolidatedNetWorth', () => {
    it('should consolidate net worth across multiple spaces', async () => {
      // Mock userSpace.findMany returning 2 spaces
      (prisma as any).userSpace = {
        findMany: jest.fn().mockResolvedValue([
          { spaceId: 'space-1', space: { name: 'Personal', currency: 'MXN' } },
          { spaceId: 'space-2', space: { name: 'Business', currency: 'USD' } },
        ]),
      };

      // First space: MXN accounts
      prisma.account.findMany
        .mockResolvedValueOnce([
          {
            id: 'acc-1',
            balance: { toNumber: () => 50000 },
            type: 'checking',
            currency: 'MXN',
            assetValuations: [],
          },
        ] as any)
        .mockResolvedValueOnce([
          {
            id: 'acc-2',
            balance: { toNumber: () => 1000 },
            type: 'checking',
            currency: 'USD',
            assetValuations: [],
          },
        ] as any);

      prisma.manualAsset.findMany.mockResolvedValue([]);
      prisma.assetValuation.findMany.mockResolvedValue([]);

      // Mock FX rate for USD->MXN
      fxRatesService.getExchangeRate.mockImplementation(async (from, to) => {
        if (from === 'USD' && to === 'MXN') return 17;
        return 1;
      });

      const result = await service.getConsolidatedNetWorth(mockUserId, Currency.MXN);

      expect(result.currency).toBe(Currency.MXN);
      expect(result.spaces).toHaveLength(2);
      expect(result.spaces[0].spaceName).toBe('Personal');
      expect(result.spaces[1].spaceName).toBe('Business');
      // Space 1: 50000 MXN
      expect(result.spaces[0].assets).toBe(50000);
      // Space 2: 1000 USD * 17 = 17000 MXN
      expect(result.spaces[1].assets).toBe(17000);
      // Total: 50000 + 17000 = 67000
      expect(result.totalNetWorth).toBe(67000);
    });

    it('should handle spaces with net worth errors gracefully', async () => {
      (prisma as any).userSpace = {
        findMany: jest.fn().mockResolvedValue([
          { spaceId: 'space-1', space: { name: 'Personal', currency: 'MXN' } },
          { spaceId: 'space-2', space: { name: 'Broken', currency: 'USD' } },
        ]),
      };

      // First space works
      prisma.account.findMany
        .mockResolvedValueOnce([
          {
            id: 'acc-1',
            balance: { toNumber: () => 10000 },
            type: 'checking',
            currency: 'MXN',
            assetValuations: [],
          },
        ] as any)
        // Second space throws
        .mockRejectedValueOnce(new Error('DB error'));

      prisma.manualAsset.findMany.mockResolvedValue([]);
      prisma.assetValuation.findMany.mockResolvedValue([]);

      const result = await service.getConsolidatedNetWorth(mockUserId, Currency.MXN);

      // Should still return data from the working space
      expect(result.spaces).toHaveLength(1);
      expect(result.totalNetWorth).toBe(10000);
    });

    it('should return empty when user has no spaces', async () => {
      (prisma as any).userSpace = {
        findMany: jest.fn().mockResolvedValue([]),
      };

      const result = await service.getConsolidatedNetWorth(mockUserId, Currency.MXN);

      expect(result.spaces).toHaveLength(0);
      expect(result.totalNetWorth).toBe(0);
    });
  });

  describe('budgetId filter', () => {
    it('getSpendingByCategory should pass budgetId to groupBy where clause', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      prisma.transaction.groupBy.mockResolvedValue([]);
      prisma.category.findMany.mockResolvedValue([]);

      await service.getSpendingByCategory(
        mockUserId,
        mockSpaceId,
        startDate,
        endDate,
        'budget-123'
      );

      expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: { budgetId: 'budget-123', excludeFromTotals: false },
          }),
        })
      );
    });

    it('getSpendingByCategory without budgetId should use OR clause', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      prisma.transaction.groupBy.mockResolvedValue([]);
      prisma.category.findMany.mockResolvedValue([]);

      await service.getSpendingByCategory(mockUserId, mockSpaceId, startDate, endDate);

      expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ category: { is: null } }, { category: { excludeFromTotals: false } }],
          }),
        })
      );
    });

    it('getIncomeVsExpenses should accept budgetId param', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      await service.getIncomeVsExpenses(mockUserId, mockSpaceId, 6, 'budget-123');

      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        mockUserId,
        mockSpaceId,
        'viewer'
      );
    });

    it('getStatistics should pass budgetId through to query service', async () => {
      const mockQueryService = module.get(
        AnalyticsQueryService
      ) as jest.Mocked<AnalyticsQueryService>;
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      await service.getStatistics(mockUserId, mockSpaceId, startDate, endDate, 'budget-123');

      expect(mockQueryService.getStatistics).toHaveBeenCalledWith(
        mockUserId,
        mockSpaceId,
        startDate,
        endDate,
        'budget-123'
      );
    });

    it('getAnnualTrends should pass budgetId through to query service', async () => {
      const mockQueryService = module.get(
        AnalyticsQueryService
      ) as jest.Mocked<AnalyticsQueryService>;

      await service.getAnnualTrends(mockUserId, mockSpaceId, 12, 'budget-123');

      expect(mockQueryService.getAnnualTrends).toHaveBeenCalledWith(
        mockUserId,
        mockSpaceId,
        12,
        'budget-123'
      );
    });

    it('getCalendarData should pass budgetId through to query service', async () => {
      const mockQueryService = module.get(
        AnalyticsQueryService
      ) as jest.Mocked<AnalyticsQueryService>;

      await service.getCalendarData(mockUserId, mockSpaceId, 2026, 3, 'budget-123');

      expect(mockQueryService.getCalendarData).toHaveBeenCalledWith(
        mockUserId,
        mockSpaceId,
        2026,
        3,
        'budget-123'
      );
    });
  });
});
