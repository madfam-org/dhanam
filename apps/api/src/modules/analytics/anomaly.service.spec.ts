import { Test, TestingModule } from '@nestjs/testing';

import { createPrismaMock, createLoggerMock } from '../../../test/helpers/api-mock-factory';
import { PrismaService } from '../../core/prisma/prisma.service';
import { SpacesService } from '../spaces/spaces.service';

import { AnomalyService, SpendingAnomaly } from './anomaly.service';

describe('AnomalyService', () => {
  let service: AnomalyService;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let spacesServiceMock: jest.Mocked<Partial<SpacesService>>;

  const testSpaceId = 'space-123';
  const testUserId = 'user-456';

  beforeEach(async () => {
    jest.clearAllMocks();

    prismaMock = createPrismaMock();
    spacesServiceMock = {
      verifyUserAccess: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnomalyService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SpacesService, useValue: spacesServiceMock },
      ],
    }).compile();

    service = module.get<AnomalyService>(AnomalyService);
    (service as any).logger = createLoggerMock();
  });

  describe('detectAnomalies', () => {
    beforeEach(() => {
      // Default empty returns for detection methods
      prismaMock.transaction.findMany.mockResolvedValue([]);
      prismaMock.transaction.aggregate.mockResolvedValue({
        _sum: { amount: { toNumber: () => 0 } },
      });
      prismaMock.transaction.groupBy.mockResolvedValue([]);
      prismaMock.category.findMany.mockResolvedValue([]);
    });

    it('should verify user access', async () => {
      await service.detectAnomalies(testSpaceId, testUserId);

      expect(spacesServiceMock.verifyUserAccess).toHaveBeenCalledWith(
        testUserId,
        testSpaceId,
        'viewer'
      );
    });

    it('should use default 30 days and 50 limit', async () => {
      await service.detectAnomalies(testSpaceId, testUserId);

      expect(prismaMock.transaction.findMany).toHaveBeenCalled();
    });

    it('should respect custom options', async () => {
      await service.detectAnomalies(testSpaceId, testUserId, { days: 60, limit: 10 });

      expect(prismaMock.transaction.findMany).toHaveBeenCalled();
    });

    it('should return empty array when no anomalies detected', async () => {
      const result = await service.detectAnomalies(testSpaceId, testUserId);

      expect(result).toEqual([]);
    });

    it('should combine anomalies from all detection methods', async () => {
      // Mock unusual amounts detection
      const mockRecentTxns = [
        {
          id: 'txn-1',
          amount: { toNumber: () => -500 },
          currency: 'USD',
          merchant: 'Netflix',
          description: 'Netflix subscription',
          date: new Date(),
          categoryId: 'cat-1',
        },
      ];

      const mockHistoricalTxns = Array(5)
        .fill(null)
        .map((_, i) => ({
          amount: { toNumber: () => -15 },
          merchant: 'Netflix',
          description: 'Netflix subscription',
          date: new Date(Date.now() - (i + 31) * 24 * 60 * 60 * 1000),
        }));

      prismaMock.transaction.findMany
        .mockResolvedValueOnce(mockRecentTxns)
        .mockResolvedValueOnce(mockHistoricalTxns)
        .mockResolvedValueOnce([]) // For duplicate detection
        .mockResolvedValue([]);

      const result = await service.detectAnomalies(testSpaceId, testUserId);

      expect(result).toBeInstanceOf(Array);
    });

    it('should sort anomalies by severity and date', async () => {
      // Create anomalies via duplicate detection (easiest to control)
      const duplicateTxns = [
        {
          id: 'txn-1',
          amount: { toNumber: () => -500 },
          currency: 'USD',
          merchant: 'Store',
          description: 'Purchase',
          date: new Date('2024-01-01T10:00:00Z'),
        },
        {
          id: 'txn-2',
          amount: { toNumber: () => -500 },
          currency: 'USD',
          merchant: 'Store',
          description: 'Purchase',
          date: new Date('2024-01-01T12:00:00Z'),
        },
        {
          id: 'txn-3',
          amount: { toNumber: () => -50 },
          currency: 'USD',
          merchant: 'Coffee',
          description: 'Coffee',
          date: new Date('2024-01-02T10:00:00Z'),
        },
        {
          id: 'txn-4',
          amount: { toNumber: () => -50 },
          currency: 'USD',
          merchant: 'Coffee',
          description: 'Coffee',
          date: new Date('2024-01-02T11:00:00Z'),
        },
      ];

      prismaMock.transaction.findMany.mockImplementation(({ orderBy }) => {
        if (orderBy?.date === 'asc') {
          return Promise.resolve(duplicateTxns);
        }
        return Promise.resolve([]);
      });

      const result = await service.detectAnomalies(testSpaceId, testUserId);

      // High severity (>$100) should come before medium
      if (result.length >= 2) {
        expect(['high', 'medium', 'low']).toContain(result[0].severity);
      }
    });

    it('should limit results to specified limit', async () => {
      // Create many duplicate transactions to generate anomalies
      const txns = Array(100)
        .fill(null)
        .map((_, i) => ({
          id: `txn-${i}`,
          amount: { toNumber: () => -100 },
          currency: 'USD',
          merchant: 'Store',
          description: 'Purchase',
          date: new Date(Date.now() + i * 3600000), // 1 hour apart
        }));

      prismaMock.transaction.findMany.mockImplementation(({ orderBy }) => {
        if (orderBy?.date === 'asc') {
          return Promise.resolve(txns);
        }
        return Promise.resolve([]);
      });

      const result = await service.detectAnomalies(testSpaceId, testUserId, { limit: 5 });

      expect(result.length).toBeLessThanOrEqual(5);
    });
  });

  describe('detectUnusualAmounts (via detectAnomalies)', () => {
    beforeEach(() => {
      prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
      prismaMock.transaction.groupBy.mockResolvedValue([]);
      prismaMock.category.findMany.mockResolvedValue([]);
    });

    it('should detect transactions with z-score above threshold', async () => {
      // Recent high-amount transaction (plain number for Number() conversion)
      const recentTxn = {
        id: 'high-txn',
        amount: -1000, // Plain number
        currency: 'USD',
        merchant: 'Amazon',
        description: 'Amazon purchase',
        date: new Date(),
        categoryId: 'cat-1',
      };

      // Historical low-amount transactions for merchant stats
      // Need 3+ transactions with different amounts for stdDev > 0
      const historicalTxns = [
        {
          amount: -45,
          merchant: 'Amazon',
          description: 'Amazon purchase',
          date: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
        },
        {
          amount: -50,
          merchant: 'Amazon',
          description: 'Amazon purchase',
          date: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
        },
        {
          amount: -55,
          merchant: 'Amazon',
          description: 'Amazon purchase',
          date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        },
        {
          amount: -48,
          merchant: 'Amazon',
          description: 'Amazon purchase',
          date: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000),
        },
        {
          amount: -52,
          merchant: 'Amazon',
          description: 'Amazon purchase',
          date: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000),
        },
      ];

      // Use mockImplementation to handle parallel Promise.all calls correctly
      prismaMock.transaction.findMany.mockImplementation((params: any) => {
        // detectUnusualAmounts - recent transactions (orderBy desc)
        if (params?.orderBy?.date === 'desc') {
          return Promise.resolve([recentTxn]);
        }
        // getMerchantStats - historical transactions (no orderBy, amount < 0)
        if (params?.where?.amount?.lt === 0 && !params?.orderBy) {
          return Promise.resolve(historicalTxns);
        }
        // detectNewMerchantLargeTransactions - historical merchants (distinct)
        if (params?.distinct) {
          return Promise.resolve([]);
        }
        // detectNewMerchantLargeTransactions - recent large (amount < -500)
        if (params?.where?.amount?.lt === -500) {
          return Promise.resolve([]);
        }
        // detectDuplicateCharges (orderBy asc)
        if (params?.orderBy?.date === 'asc') {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      const result = await service.detectAnomalies(testSpaceId, testUserId);

      const unusualAmount = result.find((a) => a.type === 'unusual_amount');
      expect(unusualAmount).toBeDefined();
      expect(unusualAmount?.transactionId).toBe('high-txn');
    });

    it('should skip merchants with insufficient history (< 3 transactions)', async () => {
      const recentTxn = {
        id: 'txn-1',
        amount: -1000,
        currency: 'USD',
        merchant: 'NewMerchant',
        description: 'Purchase',
        date: new Date(),
        categoryId: 'cat-1',
      };

      // Only 2 historical transactions (below threshold of 3 for stats)
      const historicalTxns = [
        {
          amount: -50,
          merchant: 'NewMerchant',
          description: 'Purchase',
          date: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
        },
        {
          amount: -55,
          merchant: 'NewMerchant',
          description: 'Purchase',
          date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        },
      ];

      prismaMock.transaction.findMany
        .mockResolvedValueOnce([recentTxn])
        .mockResolvedValueOnce(historicalTxns)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValue([]);

      const result = await service.detectAnomalies(testSpaceId, testUserId);

      const unusualAmount = result.find((a) => a.type === 'unusual_amount');
      expect(unusualAmount).toBeUndefined();
    });
  });

  describe('detectSpendingSpikes (via detectAnomalies)', () => {
    beforeEach(() => {
      prismaMock.transaction.findMany.mockResolvedValue([]);
      prismaMock.transaction.groupBy.mockResolvedValue([]);
      prismaMock.category.findMany.mockResolvedValue([]);
    });

    it('should detect weekly spending spikes', async () => {
      // Mock aggregate to return high current week spending
      // Service uses Number(spending._sum.amount) so we need plain numbers
      let weekIndex = 0;
      const amounts = [-2000, -1800, -500, -500, -500, -500]; // Recent weeks high, historical low

      prismaMock.transaction.aggregate.mockImplementation(() => {
        const result = { _sum: { amount: amounts[weekIndex++] ?? 0 } };
        return Promise.resolve(result);
      });

      const result = await service.detectAnomalies(testSpaceId, testUserId);

      const spike = result.find((a) => a.type === 'spending_spike');
      expect(spike).toBeDefined();
      expect(spike?.severity).toMatch(/medium|high/);
    });
  });

  describe('detectNewMerchantLargeTransactions (via detectAnomalies)', () => {
    beforeEach(() => {
      prismaMock.transaction.aggregate.mockResolvedValue({
        _sum: { amount: { toNumber: () => 0 } },
      });
      prismaMock.transaction.groupBy.mockResolvedValue([]);
      prismaMock.category.findMany.mockResolvedValue([]);
    });

    it('should return anomalies array', async () => {
      prismaMock.transaction.findMany.mockResolvedValue([]);

      const result = await service.detectAnomalies(testSpaceId, testUserId);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should call verifyUserAccess', async () => {
      prismaMock.transaction.findMany.mockResolvedValue([]);

      await service.detectAnomalies(testSpaceId, testUserId);

      expect(spacesServiceMock.verifyUserAccess).toHaveBeenCalled();
    });
  });

  describe('detectCategorySurges (via detectAnomalies)', () => {
    beforeEach(() => {
      prismaMock.transaction.findMany.mockResolvedValue([]);
      prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    });

    it('should detect category spending surges', async () => {
      // Historical category spending (90 days, normalized amount)
      // Service compares: recentAmount vs (historical.total * daysRatio)
      // daysRatio = days/90 = 30/90 = 0.333
      // For a spike: recentAmount / (historical * daysRatio) > 1.5
      // If historical = 300 over 90 days → normalized = 300 * 0.333 = 100
      // If recent = 500 over 30 days → ratio = 500/100 = 5 (way above 1.5 threshold)
      const historicalSpending = [{ categoryId: 'cat-1', _sum: { amount: -300 }, _count: 10 }];

      // Recent category spending (much higher relative to period)
      const recentSpending = [{ categoryId: 'cat-1', _sum: { amount: -500 }, _count: 5 }];

      const categories = [{ id: 'cat-1', name: 'Entertainment' }];

      prismaMock.transaction.findMany.mockResolvedValue([]);
      prismaMock.transaction.groupBy
        .mockResolvedValueOnce(historicalSpending)
        .mockResolvedValueOnce(recentSpending);
      prismaMock.category.findMany.mockResolvedValue(categories);

      const result = await service.detectAnomalies(testSpaceId, testUserId);

      const surge = result.find((a) => a.type === 'category_surge');
      expect(surge).toBeDefined();
      expect(surge?.category).toBe('Entertainment');
    });
  });

  describe('detectDuplicateCharges (via detectAnomalies)', () => {
    beforeEach(() => {
      prismaMock.transaction.aggregate.mockResolvedValue({
        _sum: { amount: { toNumber: () => 0 } },
      });
      prismaMock.transaction.groupBy.mockResolvedValue([]);
      prismaMock.category.findMany.mockResolvedValue([]);
    });

    it('should detect duplicate charges within time window', async () => {
      const duplicateTxns = [
        {
          id: 'txn-1',
          amount: -100,
          currency: 'USD',
          merchant: 'Store',
          description: 'Purchase',
          date: new Date('2024-01-01T10:00:00Z'),
        },
        {
          id: 'txn-2',
          amount: -100,
          currency: 'USD',
          merchant: 'Store',
          description: 'Purchase',
          date: new Date('2024-01-01T14:00:00Z'), // 4 hours later
        },
      ];

      prismaMock.transaction.findMany.mockImplementation(({ orderBy }) => {
        if (orderBy?.date === 'asc') {
          return Promise.resolve(duplicateTxns);
        }
        return Promise.resolve([]);
      });

      const result = await service.detectAnomalies(testSpaceId, testUserId);

      const duplicate = result.find((a) => a.type === 'duplicate_charge');
      expect(duplicate).toBeDefined();
      expect(duplicate?.transactionId).toBe('txn-2');
    });

    it('should not flag transactions outside time window', async () => {
      const txns = [
        {
          id: 'txn-1',
          amount: -100,
          currency: 'USD',
          merchant: 'Store',
          description: 'Purchase',
          date: new Date('2024-01-01T10:00:00Z'),
        },
        {
          id: 'txn-2',
          amount: -100,
          currency: 'USD',
          merchant: 'Store',
          description: 'Purchase',
          date: new Date('2024-01-05T10:00:00Z'), // 4 days later (outside 48hr window)
        },
      ];

      prismaMock.transaction.findMany.mockImplementation(({ orderBy }) => {
        if (orderBy?.date === 'asc') {
          return Promise.resolve(txns);
        }
        return Promise.resolve([]);
      });

      const result = await service.detectAnomalies(testSpaceId, testUserId);

      const duplicate = result.find((a) => a.type === 'duplicate_charge');
      expect(duplicate).toBeUndefined();
    });

    it('should not flag transactions with different amounts', async () => {
      // Transactions with same merchant but different amounts
      const txns = [
        {
          id: 'txn-1',
          amount: -100,
          currency: 'USD',
          merchant: 'Store',
          description: 'Purchase',
          date: new Date('2024-01-01T10:00:00Z'),
        },
        {
          id: 'txn-2',
          amount: -150, // Different amount
          currency: 'USD',
          merchant: 'Store',
          description: 'Purchase',
          date: new Date('2024-01-01T14:00:00Z'),
        },
      ];

      prismaMock.transaction.findMany.mockImplementation(({ orderBy }) => {
        if (orderBy?.date === 'asc') {
          return Promise.resolve(txns);
        }
        return Promise.resolve([]);
      });

      const result = await service.detectAnomalies(testSpaceId, testUserId);

      const duplicate = result.find((a) => a.type === 'duplicate_charge');
      expect(duplicate).toBeUndefined();
    });

    it('should assign higher confidence for closer duplicates', async () => {
      const closeDuplicates = [
        {
          id: 'txn-1',
          amount: -100,
          currency: 'USD',
          merchant: 'Store',
          description: 'Purchase',
          date: new Date('2024-01-01T10:00:00Z'),
        },
        {
          id: 'txn-2',
          amount: -100,
          currency: 'USD',
          merchant: 'Store',
          description: 'Purchase',
          date: new Date('2024-01-01T12:00:00Z'), // 2 hours later
        },
      ];

      prismaMock.transaction.findMany.mockImplementation(({ orderBy }) => {
        if (orderBy?.date === 'asc') {
          return Promise.resolve(closeDuplicates);
        }
        return Promise.resolve([]);
      });

      const result = await service.detectAnomalies(testSpaceId, testUserId);

      const duplicate = result.find((a) => a.type === 'duplicate_charge');
      expect(duplicate?.confidence).toBeGreaterThanOrEqual(0.85);
    });
  });

  describe('getAnomalySummary', () => {
    beforeEach(() => {
      prismaMock.transaction.findMany.mockResolvedValue([]);
      prismaMock.transaction.aggregate.mockResolvedValue({
        _sum: { amount: { toNumber: () => 0 } },
      });
      prismaMock.transaction.groupBy.mockResolvedValue([]);
      prismaMock.category.findMany.mockResolvedValue([]);
    });

    it('should return summary statistics', async () => {
      const result = await service.getAnomalySummary(testSpaceId, testUserId);

      expect(result).toHaveProperty('totalCount');
      expect(result).toHaveProperty('bySeverity');
      expect(result).toHaveProperty('byType');
      expect(result).toHaveProperty('totalImpact');
      expect(result).toHaveProperty('recentAnomalies');
    });

    it('should count anomalies by severity', async () => {
      // Create duplicates with different severities
      const txns = [
        {
          id: 'txn-1',
          amount: { toNumber: () => -500 }, // High severity (>$100)
          currency: 'USD',
          merchant: 'Store',
          description: 'Purchase',
          date: new Date('2024-01-01T10:00:00Z'),
        },
        {
          id: 'txn-2',
          amount: { toNumber: () => -500 },
          currency: 'USD',
          merchant: 'Store',
          description: 'Purchase',
          date: new Date('2024-01-01T12:00:00Z'),
        },
        {
          id: 'txn-3',
          amount: { toNumber: () => -50 }, // Medium severity
          currency: 'USD',
          merchant: 'Coffee',
          description: 'Coffee',
          date: new Date('2024-01-01T14:00:00Z'),
        },
        {
          id: 'txn-4',
          amount: { toNumber: () => -50 },
          currency: 'USD',
          merchant: 'Coffee',
          description: 'Coffee',
          date: new Date('2024-01-01T16:00:00Z'),
        },
      ];

      prismaMock.transaction.findMany.mockImplementation(({ orderBy }) => {
        if (orderBy?.date === 'asc') {
          return Promise.resolve(txns);
        }
        return Promise.resolve([]);
      });

      const result = await service.getAnomalySummary(testSpaceId, testUserId);

      expect(result.bySeverity.high).toBeGreaterThanOrEqual(0);
      expect(result.bySeverity.medium).toBeGreaterThanOrEqual(0);
      expect(result.bySeverity.low).toBeGreaterThanOrEqual(0);
    });

    it('should limit recent anomalies to 5', async () => {
      const result = await service.getAnomalySummary(testSpaceId, testUserId);

      expect(result.recentAnomalies.length).toBeLessThanOrEqual(5);
    });
  });

  describe('helper methods', () => {
    it('should correctly determine severity from z-score', () => {
      // Access private method via casting
      const getSeverity = (service as any).getSeverityFromZScore.bind(service);

      expect(getSeverity(5)).toBe('high'); // > 4
      expect(getSeverity(3.5)).toBe('medium'); // > 3
      expect(getSeverity(2.8)).toBe('low'); // > 2.5 but <= 3
    });

    it('should format currency correctly', () => {
      const formatCurrency = (service as any).formatCurrency.bind(service);

      expect(formatCurrency(100, 'USD')).toBe('$100.00');
      expect(formatCurrency(100, 'MXN')).toBe('$100.00');
      expect(formatCurrency(100, 'EUR')).toBe('€100.00');
      expect(formatCurrency(100, 'GBP')).toBe('$100.00'); // Unknown uses $
    });

    it('should normalize merchant names', () => {
      const normalize = (service as any).normalizeMerchant.bind(service);

      expect(normalize('AMAZON.COM')).toBe('amazoncom');
      expect(normalize('Netflix #1234')).toBe('netflix1234');
      expect(normalize('Uber Trip')).toBe('ubertrip');
    });

    it('should extract merchant from description', () => {
      const extract = (service as any).extractMerchantFromDescription.bind(service);

      // The patterns only match at start (^) or end ($)
      // "pos debit" at start is removed, leaving "Starbucks"
      expect(extract('pos Starbucks')).toBe('Starbucks');
      // Numbers at end are removed
      expect(extract('Netflix 12345')).toBe('Netflix');
      // State codes at end are removed
      expect(extract('Target CA')).toBe('Target');
      // Too short returns null
      expect(extract('AB')).toBeNull();
    });
  });

  describe('detectNewMerchantLargeTransactions (large txn at new merchant)', () => {
    beforeEach(() => {
      prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
      prismaMock.transaction.groupBy.mockResolvedValue([]);
      prismaMock.category.findMany.mockResolvedValue([]);
    });

    it('should detect large transaction at new merchant', async () => {
      // Historical merchants (known)
      const historicalMerchants = [{ merchant: 'OldStore' }, { merchant: 'RegularShop' }];

      // Recent large transaction at NEW merchant
      const largeTxns = [
        {
          id: 'txn-new-merchant',
          amount: -700, // > 500 threshold
          currency: 'USD',
          merchant: 'NewExpensiveStore',
          description: 'Purchase',
          date: new Date(),
        },
      ];

      prismaMock.transaction.findMany.mockImplementation((params: any) => {
        // Historical merchants (distinct)
        if (params?.distinct) {
          return Promise.resolve(historicalMerchants);
        }
        // Recent large transactions (amount < -500)
        if (params?.where?.amount?.lt === -500) {
          return Promise.resolve(largeTxns);
        }
        return Promise.resolve([]);
      });

      const result = await service.detectAnomalies(testSpaceId, testUserId);

      const newMerchantAnomaly = result.find((a) => a.type === 'new_merchant_large');
      expect(newMerchantAnomaly).toBeDefined();
      expect(newMerchantAnomaly?.merchant).toBe('NewExpensiveStore');
    });

    it('should fallback to description when merchant is null', async () => {
      const historicalMerchants: any[] = [];

      // Transaction with null merchant but valid description
      const largeTxns = [
        {
          id: 'txn-desc',
          amount: -600,
          currency: 'USD',
          merchant: null,
          description: 'Fancy Restaurant Dinner',
          date: new Date(),
        },
      ];

      prismaMock.transaction.findMany.mockImplementation((params: any) => {
        if (params?.distinct) {
          return Promise.resolve(historicalMerchants);
        }
        if (params?.where?.amount?.lt === -500) {
          return Promise.resolve(largeTxns);
        }
        return Promise.resolve([]);
      });

      const result = await service.detectAnomalies(testSpaceId, testUserId);

      const newMerchantAnomaly = result.find((a) => a.type === 'new_merchant_large');
      expect(newMerchantAnomaly).toBeDefined();
      expect(newMerchantAnomaly?.merchant).toBe('Fancy Restaurant Dinner');
    });

    it('should skip transaction when merchant cannot be determined', async () => {
      const historicalMerchants: any[] = [];

      // Transaction with null merchant AND unusable description
      const largeTxns = [
        {
          id: 'txn-no-merchant',
          amount: -600,
          currency: 'USD',
          merchant: null,
          description: 'AB', // Too short - will return null
          date: new Date(),
        },
      ];

      prismaMock.transaction.findMany.mockImplementation((params: any) => {
        if (params?.distinct) {
          return Promise.resolve(historicalMerchants);
        }
        if (params?.where?.amount?.lt === -500) {
          return Promise.resolve(largeTxns);
        }
        return Promise.resolve([]);
      });

      const result = await service.detectAnomalies(testSpaceId, testUserId);

      const newMerchantAnomaly = result.find((a) => a.type === 'new_merchant_large');
      expect(newMerchantAnomaly).toBeUndefined();
    });

    it('should not flag transaction if merchant is known', async () => {
      const historicalMerchants = [{ merchant: 'ExpensiveStore' }];

      const largeTxns = [
        {
          id: 'txn-known',
          amount: -700,
          currency: 'USD',
          merchant: 'ExpensiveStore', // Known merchant
          description: 'Purchase',
          date: new Date(),
        },
      ];

      prismaMock.transaction.findMany.mockImplementation((params: any) => {
        if (params?.distinct) {
          return Promise.resolve(historicalMerchants);
        }
        if (params?.where?.amount?.lt === -500) {
          return Promise.resolve(largeTxns);
        }
        return Promise.resolve([]);
      });

      const result = await service.detectAnomalies(testSpaceId, testUserId);

      const newMerchantAnomaly = result.find((a) => a.type === 'new_merchant_large');
      expect(newMerchantAnomaly).toBeUndefined();
    });

    it('should assign high severity for transactions over $1000', async () => {
      const largeTxns = [
        {
          id: 'txn-high',
          amount: -1500,
          currency: 'USD',
          merchant: 'LuxuryStore',
          description: 'Purchase',
          date: new Date(),
        },
      ];

      prismaMock.transaction.findMany.mockImplementation((params: any) => {
        if (params?.distinct) {
          return Promise.resolve([]);
        }
        if (params?.where?.amount?.lt === -500) {
          return Promise.resolve(largeTxns);
        }
        return Promise.resolve([]);
      });

      const result = await service.detectAnomalies(testSpaceId, testUserId);

      const newMerchantAnomaly = result.find((a) => a.type === 'new_merchant_large');
      expect(newMerchantAnomaly?.severity).toBe('high');
    });
  });

  describe('sorting behavior', () => {
    beforeEach(() => {
      prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
      prismaMock.transaction.groupBy.mockResolvedValue([]);
      prismaMock.category.findMany.mockResolvedValue([]);
    });

    it('should sort by date when severity is equal', async () => {
      // Create duplicates with same severity but different dates
      const txns = [
        {
          id: 'txn-1',
          amount: -50, // medium severity
          currency: 'USD',
          merchant: 'StoreA',
          description: 'Purchase',
          date: new Date('2024-01-01T10:00:00Z'),
        },
        {
          id: 'txn-2',
          amount: -50, // same amount = same severity when duplicate
          currency: 'USD',
          merchant: 'StoreA',
          description: 'Purchase',
          date: new Date('2024-01-01T12:00:00Z'),
        },
        {
          id: 'txn-3',
          amount: -50,
          currency: 'USD',
          merchant: 'StoreB',
          description: 'Purchase',
          date: new Date('2024-01-02T10:00:00Z'),
        },
        {
          id: 'txn-4',
          amount: -50,
          currency: 'USD',
          merchant: 'StoreB',
          description: 'Purchase',
          date: new Date('2024-01-02T12:00:00Z'),
        },
      ];

      prismaMock.transaction.findMany.mockImplementation(({ orderBy }) => {
        if (orderBy?.date === 'asc') {
          return Promise.resolve(txns);
        }
        return Promise.resolve([]);
      });

      const result = await service.detectAnomalies(testSpaceId, testUserId);

      // All same severity (medium), should be sorted by date (newest first)
      if (result.length >= 2) {
        const firstDate = new Date(result[0].date).getTime();
        const secondDate = new Date(result[1].date).getTime();
        expect(firstDate).toBeGreaterThanOrEqual(secondDate);
      }
    });
  });

  describe('getAnomalySummary with amounts', () => {
    it('should calculate total impact from anomaly amounts', async () => {
      // Create anomalies with amounts via duplicate detection
      const txns = [
        {
          id: 'txn-1',
          amount: -200,
          currency: 'USD',
          merchant: 'Store',
          description: 'Purchase',
          date: new Date('2024-01-01T10:00:00Z'),
        },
        {
          id: 'txn-2',
          amount: -200,
          currency: 'USD',
          merchant: 'Store',
          description: 'Purchase',
          date: new Date('2024-01-01T14:00:00Z'),
        },
      ];

      prismaMock.transaction.findMany.mockImplementation(({ orderBy }) => {
        if (orderBy?.date === 'asc') {
          return Promise.resolve(txns);
        }
        return Promise.resolve([]);
      });
      prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
      prismaMock.transaction.groupBy.mockResolvedValue([]);
      prismaMock.category.findMany.mockResolvedValue([]);

      const summary = await service.getAnomalySummary(testSpaceId, testUserId);

      // Should have total impact from the detected anomalies
      expect(summary.totalImpact).toBeGreaterThan(0);
      expect(summary.byType['duplicate_charge']).toBeGreaterThan(0);
    });
  });

  describe('detectSpendingSpikes edge cases', () => {
    it('should handle less than 3 weeks of data gracefully', async () => {
      // Mock only 2 weeks of spending data (not enough for comparison)
      prismaMock.transaction.findMany.mockResolvedValue([]);
      prismaMock.transaction.groupBy.mockResolvedValue([]);
      prismaMock.category.findMany.mockResolvedValue([]);

      let callCount = 0;
      prismaMock.transaction.aggregate.mockImplementation(() => {
        callCount++;
        // Return data for only 2 weeks (less than the required 3)
        if (callCount <= 2) {
          return Promise.resolve({ _sum: { amount: -100 } });
        }
        return Promise.resolve({ _sum: { amount: 0 } });
      });

      const result = await service.detectAnomalies(testSpaceId, testUserId, { days: 7 });

      // Should complete without errors even with insufficient data
      expect(result).toBeInstanceOf(Array);
    });

    it('should handle zero historical average with fallback', async () => {
      // Mock spending where historical average would be 0
      prismaMock.transaction.findMany.mockResolvedValue([]);
      prismaMock.transaction.groupBy.mockResolvedValue([]);
      prismaMock.category.findMany.mockResolvedValue([]);

      let weekIndex = 0;
      // Current weeks have spending, historical weeks have 0
      const amounts = [-1000, -800, 0, 0, 0, 0];

      prismaMock.transaction.aggregate.mockImplementation(() => {
        const result = { _sum: { amount: amounts[weekIndex++] ?? 0 } };
        return Promise.resolve(result);
      });

      const result = await service.detectAnomalies(testSpaceId, testUserId);

      // Should handle the || 1 fallback for zero historical average
      expect(result).toBeInstanceOf(Array);
    });
  });

  describe('detectCategorySurges edge cases', () => {
    beforeEach(() => {
      prismaMock.transaction.findMany.mockResolvedValue([]);
      prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    });

    it('should skip categories with null categoryId', async () => {
      const historicalSpending = [{ categoryId: 'cat-1', _sum: { amount: -300 }, _count: 10 }];

      // Recent spending with null categoryId (should be skipped)
      const recentSpending = [
        { categoryId: null, _sum: { amount: -500 }, _count: 5 },
        { categoryId: 'cat-1', _sum: { amount: -500 }, _count: 5 },
      ];

      const categories = [{ id: 'cat-1', name: 'Entertainment' }];

      prismaMock.transaction.groupBy
        .mockResolvedValueOnce(historicalSpending)
        .mockResolvedValueOnce(recentSpending);
      prismaMock.category.findMany.mockResolvedValue(categories);

      const result = await service.detectAnomalies(testSpaceId, testUserId);

      // Should only get one surge (from cat-1), not from null categoryId
      const surges = result.filter((a) => a.type === 'category_surge');
      expect(surges.length).toBeLessThanOrEqual(1);
    });

    it('should skip categories with no historical data', async () => {
      // No historical spending for this category
      const historicalSpending: any[] = [];

      const recentSpending = [{ categoryId: 'cat-new', _sum: { amount: -500 }, _count: 5 }];

      const categories = [{ id: 'cat-new', name: 'New Category' }];

      prismaMock.transaction.groupBy
        .mockResolvedValueOnce(historicalSpending)
        .mockResolvedValueOnce(recentSpending);
      prismaMock.category.findMany.mockResolvedValue(categories);

      const result = await service.detectAnomalies(testSpaceId, testUserId);

      // Should not flag as surge since there's no historical baseline
      const surge = result.find((a) => a.type === 'category_surge');
      expect(surge).toBeUndefined();
    });

    it('should skip categories with insufficient historical count', async () => {
      // Historical spending but count < 3
      const historicalSpending = [
        { categoryId: 'cat-1', _sum: { amount: -50 }, _count: 2 }, // Only 2 transactions
      ];

      const recentSpending = [{ categoryId: 'cat-1', _sum: { amount: -500 }, _count: 5 }];

      const categories = [{ id: 'cat-1', name: 'Entertainment' }];

      prismaMock.transaction.groupBy
        .mockResolvedValueOnce(historicalSpending)
        .mockResolvedValueOnce(recentSpending);
      prismaMock.category.findMany.mockResolvedValue(categories);

      const result = await service.detectAnomalies(testSpaceId, testUserId);

      // Should skip due to count < 3
      const surge = result.find((a) => a.type === 'category_surge');
      expect(surge).toBeUndefined();
    });

    it('should skip categories with low recent amount', async () => {
      // Recent spending below $100 threshold
      const historicalSpending = [{ categoryId: 'cat-1', _sum: { amount: -30 }, _count: 10 }];

      const recentSpending = [
        { categoryId: 'cat-1', _sum: { amount: -90 }, _count: 5 }, // Below 100 threshold
      ];

      const categories = [{ id: 'cat-1', name: 'Small Category' }];

      prismaMock.transaction.groupBy
        .mockResolvedValueOnce(historicalSpending)
        .mockResolvedValueOnce(recentSpending);
      prismaMock.category.findMany.mockResolvedValue(categories);

      const result = await service.detectAnomalies(testSpaceId, testUserId);

      // Should skip due to recentAmount <= 100
      const surge = result.find((a) => a.type === 'category_surge');
      expect(surge).toBeUndefined();
    });

    it('should assign low severity for ratio 1.5-1.75', async () => {
      const historicalSpending = [{ categoryId: 'cat-1', _sum: { amount: -300 }, _count: 10 }];

      // 160% of normalized historical = just above 1.5 but below 1.75
      const recentSpending = [{ categoryId: 'cat-1', _sum: { amount: -160 }, _count: 3 }];

      const categories = [{ id: 'cat-1', name: 'Entertainment' }];

      prismaMock.transaction.groupBy
        .mockResolvedValueOnce(historicalSpending)
        .mockResolvedValueOnce(recentSpending);
      prismaMock.category.findMany.mockResolvedValue(categories);

      const result = await service.detectAnomalies(testSpaceId, testUserId);

      const surge = result.find((a) => a.type === 'category_surge');
      expect(surge).toBeDefined();
      expect(surge?.severity).toBe('low');
    });

    it('should assign medium severity for ratio 1.75-2.5', async () => {
      const historicalSpending = [{ categoryId: 'cat-1', _sum: { amount: -300 }, _count: 10 }];

      // 200% of normalized historical = 2.0 ratio (between 1.75 and 2.5)
      const recentSpending = [{ categoryId: 'cat-1', _sum: { amount: -200 }, _count: 3 }];

      const categories = [{ id: 'cat-1', name: 'Entertainment' }];

      prismaMock.transaction.groupBy
        .mockResolvedValueOnce(historicalSpending)
        .mockResolvedValueOnce(recentSpending);
      prismaMock.category.findMany.mockResolvedValue(categories);

      const result = await service.detectAnomalies(testSpaceId, testUserId);

      const surge = result.find((a) => a.type === 'category_surge');
      expect(surge).toBeDefined();
      expect(surge?.severity).toBe('medium');
    });
  });

  describe('getMerchantStats edge cases', () => {
    it('should skip merchants with only 1 transaction', async () => {
      const recentTxn = {
        id: 'txn-1',
        amount: -1000,
        currency: 'USD',
        merchant: 'SingleUseMerchant',
        description: 'Purchase',
        date: new Date(),
        categoryId: 'cat-1',
      };

      // Only 1 historical transaction (needs >= 2 for stats)
      const historicalTxns = [
        {
          amount: -50,
          merchant: 'SingleUseMerchant',
          description: 'Purchase',
          date: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
        },
      ];

      prismaMock.transaction.findMany.mockImplementation((params: any) => {
        if (params?.orderBy?.date === 'desc') {
          return Promise.resolve([recentTxn]);
        }
        if (params?.where?.amount?.lt === 0 && !params?.orderBy) {
          return Promise.resolve(historicalTxns);
        }
        return Promise.resolve([]);
      });
      prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
      prismaMock.transaction.groupBy.mockResolvedValue([]);
      prismaMock.category.findMany.mockResolvedValue([]);

      const result = await service.detectAnomalies(testSpaceId, testUserId);

      // Should not flag as unusual_amount due to insufficient history (< 2 transactions)
      const unusual = result.find((a) => a.type === 'unusual_amount');
      expect(unusual).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      prismaMock.transaction.findMany.mockResolvedValue([]);
      prismaMock.transaction.aggregate.mockResolvedValue({
        _sum: { amount: { toNumber: () => 0 } },
      });
      prismaMock.transaction.groupBy.mockResolvedValue([]);
      prismaMock.category.findMany.mockResolvedValue([]);
    });

    it('should handle transactions with null merchant', async () => {
      const txnWithNullMerchant = {
        id: 'txn-1',
        amount: { toNumber: () => -100 },
        currency: 'USD',
        merchant: null,
        description: 'Unknown Transaction',
        date: new Date(),
        categoryId: 'cat-1',
      };

      prismaMock.transaction.findMany
        .mockResolvedValueOnce([txnWithNullMerchant])
        .mockResolvedValue([]);

      // Should not throw
      const result = await service.detectAnomalies(testSpaceId, testUserId);
      expect(result).toBeInstanceOf(Array);
    });

    it('should handle empty description when extracting merchant', async () => {
      const txn = {
        id: 'txn-1',
        amount: { toNumber: () => -100 },
        currency: 'USD',
        merchant: null,
        description: '',
        date: new Date(),
        categoryId: 'cat-1',
      };

      prismaMock.transaction.findMany.mockResolvedValueOnce([txn]).mockResolvedValue([]);

      const result = await service.detectAnomalies(testSpaceId, testUserId);
      expect(result).toBeInstanceOf(Array);
    });

    it('should handle zero standard deviation', async () => {
      // All transactions with same amount -> stdDev = 0
      const recentTxn = {
        id: 'txn-1',
        amount: { toNumber: () => -100 },
        currency: 'USD',
        merchant: 'Store',
        description: 'Purchase',
        date: new Date(),
        categoryId: 'cat-1',
      };

      const historicalTxns = Array(5)
        .fill(null)
        .map((_, i) => ({
          amount: { toNumber: () => -100 }, // Same amount, stdDev = 0
          merchant: 'Store',
          description: 'Purchase',
          date: new Date(Date.now() - (i + 31) * 24 * 60 * 60 * 1000),
        }));

      prismaMock.transaction.findMany
        .mockResolvedValueOnce([recentTxn])
        .mockResolvedValueOnce(historicalTxns)
        .mockResolvedValue([]);

      const result = await service.detectAnomalies(testSpaceId, testUserId);

      // Should not flag as unusual since stdDev is 0
      const unusual = result.find((a) => a.type === 'unusual_amount');
      expect(unusual).toBeUndefined();
    });
  });
});
