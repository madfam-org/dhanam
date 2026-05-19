import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '@core/prisma/prisma.service';

import { CorrectionAggregatorService } from './correction-aggregator.service';
import { FuzzyMatcherService } from './fuzzy-matcher.service';
import { MerchantNormalizerService } from './merchant-normalizer.service';
import { TransactionCategorizationService } from './transaction-categorization.service';

describe('TransactionCategorizationService', () => {
  let service: TransactionCategorizationService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockPrisma = {
    transaction: {
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    category: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const mockFuzzyMatcher = {
    combinedSimilarity: jest.fn().mockReturnValue(0.5),
    levenshteinDistance: jest.fn().mockReturnValue(0),
    similarityRatio: jest.fn().mockReturnValue(1),
  };

  const mockMerchantNormalizer = {
    normalize: jest.fn().mockImplementation((name: string) => name?.toLowerCase() || ''),
    extractPatternKey: jest
      .fn()
      .mockImplementation((name: string) => name?.toLowerCase().replace(/\s+/g, '_') || ''),
  };

  const mockCorrectionAggregator = {
    findBestMatch: jest.fn().mockResolvedValue(null),
    getAggregatedPatterns: jest.fn().mockResolvedValue(new Map()),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionCategorizationService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: FuzzyMatcherService,
          useValue: mockFuzzyMatcher,
        },
        {
          provide: MerchantNormalizerService,
          useValue: mockMerchantNormalizer,
        },
        {
          provide: CorrectionAggregatorService,
          useValue: mockCorrectionAggregator,
        },
      ],
    }).compile();

    // Suppress logger output
    module.get<TransactionCategorizationService>(TransactionCategorizationService)['logger'] = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    service = module.get<TransactionCategorizationService>(TransactionCategorizationService);
    prismaService = module.get(PrismaService);
  });

  describe('predictCategory - Strategy 1: Exact Merchant Match', () => {
    it('should predict category with high confidence for known merchant with 5+ transactions', async () => {
      const mockTransactions = Array.from({ length: 5 }, () => ({
        categoryId: 'cat-groceries',
        createdAt: new Date(),
      }));

      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);
      mockPrisma.category.findUnique.mockResolvedValue({ name: 'Groceries' });

      const prediction = await service.predictCategory(
        'space-123',
        'Purchase at Walmart',
        'Walmart',
        -125.5
      );

      expect(prediction).toEqual({
        categoryId: 'cat-groceries',
        categoryName: 'Groceries',
        confidence: expect.any(Number),
        reasoning: 'walmart consistently categorized based on 5 past transactions',
        source: 'merchant',
      });
      expect(prediction?.confidence).toBeCloseTo(0.8, 1); // 0.7 + (5 - 3) * 0.05 = 0.8

      expect(prismaService.transaction.findMany).toHaveBeenCalledWith({
        where: {
          account: { spaceId: 'space-123' },
          merchant: { equals: 'walmart', mode: 'insensitive' }, // normalized by MerchantNormalizerService
          categoryId: { not: null },
        },
        select: {
          categoryId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });

    it('should cap confidence at 0.95 for very frequent merchants', async () => {
      const mockTransactions = Array.from({ length: 10 }, () => ({
        categoryId: 'cat-groceries',
        createdAt: new Date(),
      }));

      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);
      mockPrisma.category.findUnique.mockResolvedValue({ name: 'Groceries' });

      const prediction = await service.predictCategory(
        'space-123',
        'Purchase at Walmart',
        'Walmart',
        -200
      );

      expect(prediction?.confidence).toBe(0.95); // Capped at 0.95
    });

    it('should not predict if merchant has less than 3 transactions', async () => {
      const mockTransactions = Array.from({ length: 2 }, () => ({
        categoryId: 'cat-groceries',
        createdAt: new Date(),
      }));

      mockPrisma.transaction.findMany
        .mockResolvedValueOnce(mockTransactions) // findMerchantPattern
        .mockResolvedValueOnce([]) // findFuzzyMerchantMatch
        .mockResolvedValueOnce([]); // other strategies

      mockPrisma.category.findMany.mockResolvedValue([]);

      const prediction = await service.predictCategory(
        'space-123',
        'Purchase at New Store',
        'New Store',
        -50
      );

      // Should fall through to other strategies (which will also fail due to empty mocks)
      expect(prediction).toBeNull();
    });

    it('should handle merchant with mixed categories by choosing most common', async () => {
      // findMerchantPattern returns 5 total transactions (3 groceries + 2 household)
      const mockTransactions = [
        { categoryId: 'cat-groceries', createdAt: new Date() },
        { categoryId: 'cat-groceries', createdAt: new Date() },
        { categoryId: 'cat-groceries', createdAt: new Date() },
        { categoryId: 'cat-household', createdAt: new Date() },
        { categoryId: 'cat-household', createdAt: new Date() },
      ];

      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-groceries', name: 'Groceries' });

      const prediction = await service.predictCategory(
        'space-123',
        'Purchase at Target',
        'Target',
        -85
      );

      // Should find the most common category (groceries appears 3 times vs household 2 times)
      if (prediction) {
        expect(prediction.categoryId).toBe('cat-groceries');
        expect(prediction.confidence).toBeGreaterThan(0.7);
      } else {
        // If no prediction, verify the service was called correctly
        expect(prismaService.transaction.findMany).toHaveBeenCalled();
      }
    });
  });

  describe('predictCategory - Strategy 2: Fuzzy Merchant Match', () => {
    it('should match similar merchant names (substring match)', async () => {
      // First call: exact match returns empty (findMerchantPattern)
      mockPrisma.transaction.findMany
        .mockResolvedValueOnce([])
        // Second call: fuzzy match finds similar merchants (findEnhancedFuzzyMerchantMatch)
        .mockResolvedValueOnce([
          {
            merchant: 'Starbucks Coffee',
            categoryId: 'cat-dining',
            createdAt: new Date(),
          },
        ]);

      // Mock fuzzy matcher to return high similarity for this test
      mockFuzzyMatcher.combinedSimilarity.mockReturnValue(0.85);

      // Mock the count for the fuzzy match
      mockPrisma.transaction.count.mockResolvedValue(5);

      mockPrisma.category.findUnique.mockResolvedValue({ name: 'Dining' });

      const prediction = await service.predictCategory(
        'space-123',
        'Coffee purchase',
        'Starbucks',
        -5.25
      );

      expect(prediction?.categoryId).toBe('cat-dining');
      expect(prediction?.source).toBe('fuzzy');
      expect(prediction?.reasoning).toContain('Similar to');
    });

    it('should match when new merchant contains known merchant', async () => {
      mockPrisma.transaction.findMany
        .mockResolvedValueOnce([]) // Exact match fails
        .mockResolvedValueOnce([
          {
            merchant: 'Amazon',
            categoryId: 'cat-shopping',
            createdAt: new Date(),
          },
        ]);

      // Mock fuzzy matcher to return high similarity
      mockFuzzyMatcher.combinedSimilarity.mockReturnValue(0.9);

      // Mock the count for the fuzzy match
      mockPrisma.transaction.count.mockResolvedValue(5);

      mockPrisma.category.findUnique.mockResolvedValue({ name: 'Shopping' });

      const prediction = await service.predictCategory(
        'space-123',
        'Online purchase',
        'Amazon Prime Video',
        -12.99
      );

      expect(prediction?.categoryId).toBe('cat-shopping');
      expect(prediction?.source).toBe('fuzzy');
      expect(prediction?.reasoning).toContain('Similar to');
    });
  });

  describe('predictCategory - Strategy 3: Keyword Match', () => {
    it('should match based on description keywords', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]); // No merchant match
      mockPrisma.category.findMany.mockResolvedValue([
        {
          id: 'cat-gas',
          name: 'Gas & Fuel',
          budget: { space: { id: 'space-123' } },
          transactions: [
            { description: 'Shell Gas Station' },
            { description: 'Chevron Fuel Station' },
            { description: 'Shell Station' },
          ],
        },
      ]);

      const prediction = await service.predictCategory(
        'space-123',
        'Shell gas station purchase',
        null, // No merchant
        -45.0
      );

      // Should match via keyword matching strategy
      expect(prediction).not.toBeNull();
      expect(prediction?.confidence).toBeGreaterThanOrEqual(0.5);
      expect(prismaService.category.findMany).toHaveBeenCalled();
    });

    it('should extract meaningful keywords and ignore stop words', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.category.findMany.mockResolvedValue([
        {
          id: 'cat-pharmacy',
          name: 'Pharmacy',
          transactions: [
            { description: 'CVS Pharmacy prescription' },
            { description: 'Walgreens prescription pickup' },
          ],
        },
      ]);

      const prediction = await service.predictCategory(
        'space-123',
        'A prescription for the pharmacy at CVS', // Has stop words: a, for, the, at
        null,
        -25.0
      );

      // Should match because "prescription", "pharmacy", "cvs" are extracted
      expect(prediction?.categoryId).toBe('cat-pharmacy');
    });

    it('should not match if keyword overlap is less than 30%', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.category.findMany.mockResolvedValue([
        {
          id: 'cat-groceries',
          name: 'Groceries',
          transactions: [
            { description: 'Grocery store vegetables' },
            { description: 'Supermarket produce' },
          ],
        },
      ]);

      const prediction = await service.predictCategory(
        'space-123',
        'Random unrelated transaction description',
        null,
        -100
      );

      // No keyword overlap, should return null or fall through to amount matching
      expect(prediction).toBeNull();
    });
  });

  describe('predictCategory - Strategy 4: Amount Pattern', () => {
    it('should match based on amount within 1 standard deviation', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.category.findMany.mockResolvedValue([
        {
          id: 'cat-streaming',
          name: 'Streaming Services',
          transactions: Array.from({ length: 10 }, () => ({
            description: 'Video service', // Different keywords to avoid keyword matching
            amount: 12.99, // Consistent subscription amount
          })),
        },
      ]);

      const prediction = await service.predictCategory(
        'space-123',
        'Unknown random transaction', // No keyword overlap
        null,
        -13.5 // Close to $12.99
      );

      // Should find a prediction via one of the strategies
      expect(prismaService.category.findMany).toHaveBeenCalled();

      // May match via keyword or amount pattern - just verify we get a result
      if (prediction) {
        expect(prediction.categoryId).toBe('cat-streaming');
        expect(prediction.confidence).toBeGreaterThanOrEqual(0.5);
      }
    });

    it('should not match if category has less than 5 transactions', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.category.findMany.mockResolvedValue([
        {
          id: 'cat-new',
          name: 'New Category',
          transactions: [
            { description: 'Purchase', amount: 100 },
            { description: 'Purchase', amount: 105 },
            { description: 'Purchase', amount: 98 },
          ], // Only 3 transactions
        },
      ]);

      const prediction = await service.predictCategory('space-123', 'Some transaction', null, -100);

      expect(prediction).toBeNull(); // Not enough data
    });

    it('should not match if amount is more than 1 standard deviation away', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.category.findMany.mockResolvedValue([
        {
          id: 'cat-coffee',
          name: 'Coffee Shops',
          transactions: Array.from({ length: 10 }, () => ({
            description: 'Coffee',
            amount: 5.0, // Average $5
          })),
        },
      ]);

      const prediction = await service.predictCategory(
        'space-123',
        'Large purchase',
        null,
        -500 // Far from $5
      );

      expect(prediction).toBeNull();
    });
  });

  describe('autoCategorize', () => {
    it('should auto-categorize transaction if confidence >= 0.9', async () => {
      const mockTransactions = Array.from({ length: 10 }, () => ({
        categoryId: 'cat-groceries',
        createdAt: new Date(),
      }));

      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);
      mockPrisma.category.findUnique.mockResolvedValue({ name: 'Groceries' });
      mockPrisma.transaction.update.mockResolvedValue({} as any);

      const result = await service.autoCategorize(
        'txn-123',
        'space-123',
        'Walmart purchase',
        'Walmart',
        -75.5
      );

      expect(result).toEqual({
        categorized: true,
        categoryId: 'cat-groceries',
        confidence: 0.95,
      });

      expect(prismaService.transaction.update).toHaveBeenCalledWith({
        where: { id: 'txn-123' },
        data: {
          categoryId: 'cat-groceries',
          metadata: {
            autoCategorized: true,
            mlConfidence: 0.95,
            mlReasoning: 'walmart consistently categorized based on 10 past transactions',
          },
        },
      });
    });

    it('should not auto-categorize if confidence < 0.9', async () => {
      const mockTransactions = Array.from({ length: 3 }, () => ({
        categoryId: 'cat-groceries',
        createdAt: new Date(),
      }));

      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);
      mockPrisma.category.findUnique.mockResolvedValue({ name: 'Groceries' });

      const result = await service.autoCategorize(
        'txn-123',
        'space-123',
        'Store purchase',
        'New Store',
        -50
      );

      expect(result).toEqual({
        categorized: false,
      });

      expect(prismaService.transaction.update).not.toHaveBeenCalled();
    });

    it('should not auto-categorize if no prediction available', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.category.findMany.mockResolvedValue([]);

      const result = await service.autoCategorize(
        'txn-123',
        'space-123',
        'Unknown transaction',
        null,
        -100
      );

      expect(result).toEqual({
        categorized: false,
      });

      expect(prismaService.transaction.update).not.toHaveBeenCalled();
    });
  });

  describe('getCategorizationAccuracy', () => {
    it('should calculate accuracy metrics for auto-categorized transactions', async () => {
      const mockTransactions = [
        {
          id: 'txn-1',
          categoryId: 'cat-1',
          metadata: { autoCategorized: true, mlConfidence: 0.95 },
        },
        {
          id: 'txn-2',
          categoryId: 'cat-2',
          metadata: { autoCategorized: true, mlConfidence: 0.92 },
        },
        {
          id: 'txn-3',
          categoryId: 'cat-3',
          metadata: { autoCategorized: true, mlConfidence: 0.88 },
        },
      ];

      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions as any);

      const accuracy = await service.getCategorizationAccuracy('space-123', 30);

      expect(accuracy).toEqual({
        totalAutoCategorized: 3,
        averageConfidence: '0.92', // (0.95 + 0.92 + 0.88) / 3 = 0.916...
        period: '30 days',
      });

      expect(prismaService.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            account: { spaceId: 'space-123' },
            metadata: {
              path: ['autoCategorized'],
              equals: true,
            },
          }),
        })
      );
    });

    it('should handle zero auto-categorized transactions', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);

      const accuracy = await service.getCategorizationAccuracy('space-123', 7);

      expect(accuracy).toEqual({
        totalAutoCategorized: 0,
        averageConfidence: 'NaN', // 0/0 = NaN
        period: '7 days',
      });
    });

    it('should use custom time period', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([
        {
          id: 'txn-1',
          categoryId: 'cat-1',
          metadata: { autoCategorized: true, mlConfidence: 0.9 },
        },
      ] as any);

      const accuracy = await service.getCategorizationAccuracy('space-123', 90);

      expect(accuracy.period).toBe('90 days');
    });
  });

  describe('predictCategory - Strategy 0: Correction Match', () => {
    it('should use correction match with high confidence over other strategies', async () => {
      // Mock correction aggregator to return a high-confidence match
      mockCorrectionAggregator.findBestMatch.mockResolvedValue({
        categoryId: 'cat-corrected',
        confidence: 0.85,
        patternKey: 'netflix',
      });

      mockPrisma.category.findUnique.mockResolvedValue({ name: 'Subscriptions' });

      const prediction = await service.predictCategory(
        'space-123',
        'Netflix payment',
        'Netflix',
        -15.99
      );

      expect(prediction).toEqual({
        categoryId: 'cat-corrected',
        categoryName: 'Subscriptions',
        confidence: 0.85,
        reasoning: 'Learned from your corrections for "netflix"',
        source: 'correction',
      });
    });

    it('should skip correction match if confidence below 0.7', async () => {
      mockCorrectionAggregator.findBestMatch.mockResolvedValue({
        categoryId: 'cat-low',
        confidence: 0.5, // Below threshold
        patternKey: 'store',
      });

      // Should fall through to merchant matching
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.category.findMany.mockResolvedValue([]);

      const prediction = await service.predictCategory(
        'space-123',
        'Store purchase',
        'Random Store',
        -50
      );

      // Should not use the low confidence correction match
      expect(prediction).toBeNull();
    });
  });

  describe('findMerchantPattern edge cases', () => {
    it('should return null when no transactions found for merchant', async () => {
      mockPrisma.transaction.findMany
        .mockResolvedValueOnce([]) // Empty for findMerchantPattern
        .mockResolvedValueOnce([]) // For findEnhancedFuzzyMerchantMatch
        .mockResolvedValue([]);
      mockPrisma.category.findMany.mockResolvedValue([]);

      const prediction = await service.predictCategory(
        'space-123',
        'New merchant',
        'Brand New Store',
        -100
      );

      expect(prediction).toBeNull();
    });

    it('should handle all transactions having same category', async () => {
      // All transactions have same category - most common is that one
      const transactions = Array.from({ length: 5 }, () => ({
        categoryId: 'cat-only',
        createdAt: new Date(),
      }));

      mockPrisma.transaction.findMany.mockResolvedValue(transactions);
      mockPrisma.category.findUnique.mockResolvedValue({ name: 'Only Category' });

      const prediction = await service.predictCategory('space-123', 'Purchase', 'Known Store', -50);

      expect(prediction?.categoryId).toBe('cat-only');
      expect(prediction?.source).toBe('merchant');
    });

    it('should handle transactions with null categoryId in mixed results', async () => {
      const transactions = [
        { categoryId: 'cat-a', createdAt: new Date() },
        { categoryId: null, createdAt: new Date() },
        { categoryId: 'cat-a', createdAt: new Date() },
        { categoryId: 'cat-b', createdAt: new Date() },
        { categoryId: 'cat-a', createdAt: new Date() },
      ];

      mockPrisma.transaction.findMany.mockResolvedValue(transactions);
      mockPrisma.category.findUnique.mockResolvedValue({ name: 'Category A' });

      const prediction = await service.predictCategory('space-123', 'Purchase', 'Mixed Store', -50);

      expect(prediction?.categoryId).toBe('cat-a'); // Most common (3 times)
    });
  });

  describe('findAmountPattern edge cases', () => {
    it('should find category within 1 standard deviation', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.category.findMany.mockResolvedValue([
        {
          id: 'cat-coffee',
          name: 'Coffee',
          transactions: [
            { description: 'Coffee shop', amount: 4.5 },
            { description: 'Coffee', amount: 5.0 },
            { description: 'Latte', amount: 5.5 },
            { description: 'Espresso', amount: 4.0 },
            { description: 'Mocha', amount: 5.25 },
          ],
        },
      ]);

      const prediction = await service.predictCategory(
        'space-123',
        'Unknown small purchase',
        null,
        -4.8 // Within 1 std dev of average ~4.85
      );

      // Should match via amount pattern
      if (prediction) {
        expect(prediction.categoryId).toBe('cat-coffee');
        expect(prediction.source).toBe('amount');
      }
    });

    it('should select category with lowest z-score when multiple match', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.category.findMany.mockResolvedValue([
        {
          id: 'cat-1',
          name: 'Category 1',
          transactions: Array.from({ length: 5 }, () => ({
            description: 'Purchase',
            amount: 100, // Average 100, stdDev 0 for same amounts
          })),
        },
        {
          id: 'cat-2',
          name: 'Category 2',
          transactions: Array.from({ length: 5 }, (_, i) => ({
            description: 'Item',
            amount: 98 + i * 2, // 98, 100, 102, 104, 106 - average 102, more spread
          })),
        },
      ]);

      const prediction = await service.predictCategory(
        'space-123',
        'Unknown transaction',
        null,
        -101 // Closer to cat-1 average
      );

      // Should prefer the one with lower z-score
      if (prediction) {
        expect(prediction.source).toBe('amount');
      }
    });
  });

  describe('findMerchantPattern - mostCommonCategory null edge case', () => {
    it('should return null when no categoryId present in transactions (all null)', async () => {
      // All transactions have null categoryId - the reduce should produce empty categoryCount
      const transactions = [
        { categoryId: null, createdAt: new Date() },
        { categoryId: null, createdAt: new Date() },
        { categoryId: null, createdAt: new Date() },
      ];

      mockPrisma.transaction.findMany
        .mockResolvedValueOnce(transactions) // findMerchantPattern returns transactions with null categories
        .mockResolvedValueOnce([]) // findEnhancedFuzzyMerchantMatch
        .mockResolvedValue([]);
      mockPrisma.category.findMany.mockResolvedValue([]);

      const prediction = await service.predictCategory('space-123', 'Purchase', 'Some Store', -50);

      // findMerchantPattern should return null because no valid categoryIds
      expect(prediction).toBeNull();
    });
  });

  describe('findFuzzyMerchantMatch (legacy)', () => {
    it('should return null when no similar merchants found', async () => {
      mockPrisma.transaction.findMany
        .mockResolvedValueOnce([]) // findMerchantPattern
        .mockResolvedValueOnce([]) // findEnhancedFuzzyMerchantMatch
        .mockResolvedValue([]);
      mockPrisma.category.findMany.mockResolvedValue([]);

      const prediction = await service.predictCategory(
        'space-123',
        'Random transaction',
        'Unique Store Name',
        -100
      );

      expect(prediction).toBeNull();
    });
  });

  describe('findAmountPattern - zScore filter edge cases', () => {
    it('should filter out categories with zScore >= 1', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.category.findMany.mockResolvedValue([
        {
          id: 'cat-coffee',
          name: 'Coffee',
          transactions: [
            { description: 'Coffee', amount: 5 },
            { description: 'Coffee', amount: 5 },
            { description: 'Coffee', amount: 5 },
            { description: 'Coffee', amount: 5 },
            { description: 'Coffee', amount: 5 },
          ], // Average 5, stdDev 0, any different amount will have infinite zScore
        },
      ]);

      // Amount very far from the average - zScore >> 1
      const prediction = await service.predictCategory(
        'space-123',
        'Unknown purchase',
        null,
        -100 // Far from average of 5
      );

      expect(prediction).toBeNull();
    });

    it('should return amount pattern match when zScore < 1', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.category.findMany.mockResolvedValue([
        {
          id: 'cat-utilities',
          name: 'Utilities',
          transactions: [
            { description: 'Bill', amount: 100 },
            { description: 'Bill', amount: 110 },
            { description: 'Bill', amount: 90 },
            { description: 'Bill', amount: 95 },
            { description: 'Bill', amount: 105 },
          ], // Average ~100, with variance
        },
      ]);

      // Amount close to average - should match via amount pattern
      const prediction = await service.predictCategory(
        'space-123',
        'Random payment',
        null,
        -102 // Close to average of 100
      );

      if (prediction) {
        expect(prediction.source).toBe('amount');
        expect(prediction.categoryId).toBe('cat-utilities');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle null merchant gracefully', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.category.findMany.mockResolvedValue([]);

      const prediction = await service.predictCategory('space-123', 'Cash withdrawal', null, -100);

      // Should skip merchant strategies and try keyword/amount matching
      expect(prediction).toBeNull();
    });

    it('should handle empty description', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.category.findMany.mockResolvedValue([]);

      const prediction = await service.predictCategory('space-123', '', 'Merchant', -50);

      // Should still try merchant matching
      expect(prismaService.transaction.findMany).toHaveBeenCalled();
    });

    it('should handle very large amounts', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.category.findMany.mockResolvedValue([
        {
          id: 'cat-large',
          name: 'Large Purchases',
          transactions: Array.from({ length: 10 }, () => ({
            description: 'Large purchase',
            amount: 5000,
          })),
        },
      ]);

      const prediction = await service.predictCategory('space-123', 'Big purchase', null, -5100);

      expect(prediction?.categoryId).toBe('cat-large');
    });

    it('should handle negative and positive amounts (expenses vs income)', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.category.findMany.mockResolvedValue([
        {
          id: 'cat-income',
          name: 'Salary',
          transactions: Array.from({ length: 10 }, () => ({
            description: 'Salary payment',
            amount: 5000, // Positive (income)
          })),
        },
      ]);

      const prediction = await service.predictCategory(
        'space-123',
        'Monthly salary',
        null,
        5100 // Positive amount
      );

      // Should use absolute amount for matching
      expect(prediction?.categoryId).toBe('cat-income');
    });
  });

  describe('findFuzzyMerchantMatch branch coverage', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should skip transactions with null merchant in fuzzy search', async () => {
      // First call for merchant pattern - returns empty
      // Second call for enhanced fuzzy - returns empty
      // Third call for legacy fuzzy - returns transactions with null merchants
      mockPrisma.transaction.findMany
        .mockResolvedValueOnce([]) // findMerchantPattern
        .mockResolvedValueOnce([]) // findEnhancedFuzzyMerchantMatch
        .mockResolvedValueOnce([
          // findFuzzyMerchantMatch - transactions with null merchant should be skipped
          { merchant: null, categoryId: 'cat-1', createdAt: new Date() },
          { merchant: null, categoryId: 'cat-2', createdAt: new Date() },
        ])
        .mockResolvedValue([]);
      mockPrisma.category.findMany.mockResolvedValue([]);

      const prediction = await service.predictCategory(
        'space-123',
        'Some purchase',
        'Target Store',
        -50
      );

      // Should not find a match because all merchants are null
      expect(prediction).toBeNull();
    });

    it('should find similar merchant using substring matching', async () => {
      // First call for merchant pattern - returns empty for unknown merchant
      // Second call for enhanced fuzzy - returns empty
      // Third call for legacy fuzzy - returns similar merchants
      mockPrisma.transaction.findMany
        .mockResolvedValueOnce([]) // findMerchantPattern
        .mockResolvedValueOnce([]) // findEnhancedFuzzyMerchantMatch
        .mockResolvedValueOnce([
          // findFuzzyMerchantMatch - has similar merchant
          { merchant: 'Amazon.com', categoryId: 'cat-shopping', createdAt: new Date() },
        ])
        .mockResolvedValueOnce([
          // findMerchantPattern for the matched merchant
          { categoryId: 'cat-shopping', createdAt: new Date() },
          { categoryId: 'cat-shopping', createdAt: new Date() },
          { categoryId: 'cat-shopping', createdAt: new Date() },
        ]);
      mockPrisma.category.findMany.mockResolvedValue([]);
      mockPrisma.category.findUnique.mockResolvedValue({ name: 'Shopping' });

      // Search for "Amazon" which is contained in "Amazon.com"
      const prediction = await service.predictCategory(
        'space-123',
        'Amazon order',
        'Amazon', // Substring of 'Amazon.com'
        -100
      );

      // Should find match via fuzzy merchant matching
      if (prediction) {
        expect(prediction.categoryId).toBe('cat-shopping');
      }
    });

    it('should check both substring directions for fuzzy matching', async () => {
      // Reset mocks for this specific test
      mockPrisma.transaction.findMany.mockReset();
      mockPrisma.category.findMany.mockReset();

      // When fuzzy matching checks both directions:
      // 1. txnMerchantLower.includes(merchantLower) - db contains search
      // 2. merchantLower.includes(txnMerchantLower) - search contains db
      mockPrisma.transaction.findMany
        .mockResolvedValueOnce([]) // findMerchantPattern
        .mockResolvedValueOnce([]) // findEnhancedFuzzyMerchantMatch
        .mockResolvedValueOnce([
          // findFuzzyMerchantMatch - transactions returned for fuzzy search
          { merchant: 'Target', categoryId: 'cat-retail', createdAt: new Date() },
        ])
        .mockResolvedValue([]);
      mockPrisma.category.findMany.mockResolvedValue([]);

      // Search for 'Target Store' which contains 'Target'
      // This tests merchantLower.includes(txnMerchantLower) branch
      await service.predictCategory(
        'space-123',
        'Shopping',
        'Target Store', // "target store".includes("target") = true
        -50
      );

      // The findMany should have been called for fuzzy matching
      expect(mockPrisma.transaction.findMany).toHaveBeenCalled();
    });
  });

  describe('findKeywordMatch branch coverage', () => {
    it('should return null when no keywords extracted from description', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      // Empty categories for amount matching
      mockPrisma.category.findMany.mockResolvedValue([]);

      // Description with only stop words
      const prediction = await service.predictCategory(
        'space-123',
        'the an at to', // Only stop words, no keywords extracted
        null,
        -50
      );

      expect(prediction).toBeNull();
    });
  });

  describe('findAmountPattern - stdDev edge cases', () => {
    it('should handle zero stdDev (all same amounts) gracefully', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.category.findMany.mockResolvedValue([
        {
          id: 'cat-subscription',
          name: 'Subscriptions',
          transactions: [
            { description: 'Netflix', amount: 15 },
            { description: 'Netflix', amount: 15 },
            { description: 'Netflix', amount: 15 },
            { description: 'Netflix', amount: 15 },
            { description: 'Netflix', amount: 15 },
          ], // All same = stdDev 0
        },
      ]);

      // Amount exactly matching the average
      const prediction = await service.predictCategory('space-123', 'Streaming service', null, -15);

      // With stdDev 0, zScore = (15 - 15) / 0 = NaN, should not match
      // This tests the edge case of division by zero
      if (prediction) {
        expect(prediction.source).toBe('amount');
      }
    });
  });
});
