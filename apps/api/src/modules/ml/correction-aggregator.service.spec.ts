import { Test, TestingModule } from '@nestjs/testing';

import { createPrismaMock, createLoggerMock } from '../../../test/helpers/api-mock-factory';
import { PrismaService } from '../../core/prisma/prisma.service';

import { CorrectionAggregatorService } from './correction-aggregator.service';
import { FuzzyMatcherService } from './fuzzy-matcher.service';
import { MerchantNormalizerService } from './merchant-normalizer.service';

describe('CorrectionAggregatorService', () => {
  let service: CorrectionAggregatorService;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let fuzzyMatcherMock: jest.Mocked<Partial<FuzzyMatcherService>>;
  let merchantNormalizerMock: jest.Mocked<Partial<MerchantNormalizerService>>;

  const testSpaceId = 'space-123';

  beforeEach(async () => {
    jest.clearAllMocks();

    prismaMock = createPrismaMock();

    fuzzyMatcherMock = {
      findBestMatch: jest.fn().mockReturnValue({ match: null, similarity: 0, index: -1 }),
      findAllMatches: jest.fn().mockReturnValue([]),
    };

    merchantNormalizerMock = {
      extractPatternKey: jest.fn().mockImplementation((merchant) => {
        if (!merchant) return '';
        return merchant.toLowerCase().replace(/[^a-z0-9]/g, '');
      }),
      extractDescriptionTerms: jest.fn().mockReturnValue(['payment', 'service']),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CorrectionAggregatorService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: FuzzyMatcherService, useValue: fuzzyMatcherMock },
        { provide: MerchantNormalizerService, useValue: merchantNormalizerMock },
      ],
    }).compile();

    service = module.get<CorrectionAggregatorService>(CorrectionAggregatorService);
    (service as any).logger = createLoggerMock();
  });

  afterEach(() => {
    // Clear internal caches between tests
    service.invalidateCache(testSpaceId);
  });

  describe('findBestMatch', () => {
    const mockPatterns = new Map([
      [
        'netflix',
        {
          patternKey: 'netflix',
          categoryId: 'cat-streaming',
          categoryName: 'Streaming',
          correctionCount: 10,
          weight: 5.0,
          lastUpdated: new Date(),
        },
      ],
      [
        'spotify',
        {
          patternKey: 'spotify',
          categoryId: 'cat-music',
          categoryName: 'Music',
          correctionCount: 5,
          weight: 2.5,
          lastUpdated: new Date(),
        },
      ],
    ]);

    beforeEach(() => {
      // Mock buildPatterns to return test patterns
      jest.spyOn(service as any, 'buildPatterns').mockResolvedValue(mockPatterns);
    });

    it('should return null when no patterns exist', async () => {
      jest.spyOn(service as any, 'buildPatterns').mockResolvedValue(new Map());

      const result = await service.findBestMatch(testSpaceId, 'Netflix', 'Monthly subscription');

      expect(result).toBeNull();
    });

    it('should find exact match with high confidence', async () => {
      merchantNormalizerMock.extractPatternKey!.mockReturnValue('netflix');

      const result = await service.findBestMatch(testSpaceId, 'Netflix', 'Monthly subscription');

      expect(result).not.toBeNull();
      expect(result?.categoryId).toBe('cat-streaming');
      expect(result?.source).toBe('exact');
      expect(result?.confidence).toBeGreaterThan(0.7);
    });

    it('should cap confidence at 0.95 for exact match', async () => {
      // Create pattern with very high correction count
      const highCountPatterns = new Map([
        [
          'netflix',
          {
            patternKey: 'netflix',
            categoryId: 'cat-streaming',
            categoryName: 'Streaming',
            correctionCount: 1000, // Very high count
            weight: 100.0,
            lastUpdated: new Date(),
          },
        ],
      ]);
      jest.spyOn(service as any, 'buildPatterns').mockResolvedValue(highCountPatterns);
      merchantNormalizerMock.extractPatternKey!.mockReturnValue('netflix');

      const result = await service.findBestMatch(testSpaceId, 'Netflix', 'Monthly subscription');

      expect(result?.confidence).toBeLessThanOrEqual(0.95);
    });

    it('should find fuzzy match when exact match fails', async () => {
      merchantNormalizerMock.extractPatternKey!.mockReturnValue('netflx');
      fuzzyMatcherMock.findBestMatch!.mockReturnValue({
        match: 'netflix',
        similarity: 0.9,
        index: 0,
      });

      const result = await service.findBestMatch(testSpaceId, 'Netflx', 'Monthly subscription');

      expect(result).not.toBeNull();
      expect(result?.categoryId).toBe('cat-streaming');
      expect(result?.source).toBe('fuzzy');
    });

    it('should not use fuzzy match below 0.8 similarity', async () => {
      merchantNormalizerMock.extractPatternKey!.mockReturnValue('random');
      fuzzyMatcherMock.findBestMatch!.mockReturnValue({
        match: 'netflix',
        similarity: 0.5, // Below threshold
        index: 0,
      });
      merchantNormalizerMock.extractDescriptionTerms!.mockReturnValue([]);

      const result = await service.findBestMatch(
        testSpaceId,
        'Random Merchant',
        'Some description'
      );

      // Should fall through to description matching or return null
      expect(result?.source).not.toBe('fuzzy');
    });

    it('should find description match when merchant match fails', async () => {
      merchantNormalizerMock.extractPatternKey!.mockReturnValue('unknownmerchant');
      fuzzyMatcherMock.findBestMatch!.mockReturnValue({
        match: null,
        similarity: 0,
        index: -1,
      });
      merchantNormalizerMock.extractDescriptionTerms!.mockReturnValue(['streaming', 'service']);
      fuzzyMatcherMock.findAllMatches!.mockReturnValue([
        { match: 'netflix', similarity: 0.7, index: 0 },
      ]);

      const result = await service.findBestMatch(
        testSpaceId,
        'Unknown Merchant',
        'Streaming service subscription'
      );

      expect(result).not.toBeNull();
      expect(result?.source).toBe('description');
    });

    it('should return null when no matches found', async () => {
      merchantNormalizerMock.extractPatternKey!.mockReturnValue('unknownmerchant');
      fuzzyMatcherMock.findBestMatch!.mockReturnValue({
        match: null,
        similarity: 0,
        index: -1,
      });
      merchantNormalizerMock.extractDescriptionTerms!.mockReturnValue([]);

      const result = await service.findBestMatch(
        testSpaceId,
        'Unknown Merchant',
        'Unknown description'
      );

      expect(result).toBeNull();
    });

    it('should handle null merchant', async () => {
      merchantNormalizerMock.extractDescriptionTerms!.mockReturnValue([]);

      const result = await service.findBestMatch(testSpaceId, null, 'Some description');

      // Should still work, just skip merchant matching
      expect(result).toBeNull();
    });

    it('should require weight >= 1.0 for exact match', async () => {
      // Create pattern with low weight
      const lowWeightPatterns = new Map([
        [
          'lowweight',
          {
            patternKey: 'lowweight',
            categoryId: 'cat-1',
            categoryName: 'Category',
            correctionCount: 1,
            weight: 0.5, // Below threshold
            lastUpdated: new Date(),
          },
        ],
      ]);
      jest.spyOn(service as any, 'buildPatterns').mockResolvedValue(lowWeightPatterns);
      merchantNormalizerMock.extractPatternKey!.mockReturnValue('lowweight');
      fuzzyMatcherMock.findBestMatch!.mockReturnValue({
        match: null,
        similarity: 0,
        index: -1,
      });
      merchantNormalizerMock.extractDescriptionTerms!.mockReturnValue([]);

      const result = await service.findBestMatch(testSpaceId, 'LowWeight', 'Description');

      // Should not match exact because weight is below 1.0
      expect(result?.source).not.toBe('exact');
    });
  });

  describe('getAggregatedPatterns', () => {
    it('should build patterns when cache is empty', async () => {
      const buildPatternsSpy = jest
        .spyOn(service as any, 'buildPatterns')
        .mockResolvedValue(new Map());

      await service.getAggregatedPatterns(testSpaceId);

      expect(buildPatternsSpy).toHaveBeenCalledWith(testSpaceId);
    });

    it('should return cached patterns when available', async () => {
      const mockPatterns = new Map([['test', { patternKey: 'test' }]]);
      jest.spyOn(service as any, 'buildPatterns').mockResolvedValue(mockPatterns);

      // First call - builds patterns
      await service.getAggregatedPatterns(testSpaceId);

      // Second call - should use cache
      const buildPatternsSpy = jest.spyOn(service as any, 'buildPatterns');
      buildPatternsSpy.mockClear();

      await service.getAggregatedPatterns(testSpaceId);

      expect(buildPatternsSpy).not.toHaveBeenCalled();
    });

    it('should refresh cache after expiry', async () => {
      jest.spyOn(service as any, 'buildPatterns').mockResolvedValue(new Map());

      await service.getAggregatedPatterns(testSpaceId);

      // Manually set cache expiry to past
      (service as any).cacheExpiry.set(testSpaceId, Date.now() - 1000);

      const buildPatternsSpy = jest.spyOn(service as any, 'buildPatterns');
      buildPatternsSpy.mockClear();

      await service.getAggregatedPatterns(testSpaceId);

      expect(buildPatternsSpy).toHaveBeenCalled();
    });
  });

  describe('buildPatterns (private, tested via getAggregatedPatterns)', () => {
    beforeEach(() => {
      // Reset mock to use actual buildPatterns
      jest.restoreAllMocks();
    });

    it('should build patterns from corrections', async () => {
      const mockCorrections = [
        {
          merchantPattern: 'netflix',
          correctedCategoryId: 'cat-1',
          createdAt: new Date(),
        },
        {
          merchantPattern: 'netflix',
          correctedCategoryId: 'cat-1',
          createdAt: new Date(),
        },
        {
          merchantPattern: 'spotify',
          correctedCategoryId: 'cat-2',
          createdAt: new Date(),
        },
      ];

      const mockCategories = [
        { id: 'cat-1', name: 'Entertainment' },
        { id: 'cat-2', name: 'Music' },
      ];

      prismaMock.categoryCorrection.findMany.mockResolvedValue(mockCorrections);
      prismaMock.category.findMany.mockResolvedValue(mockCategories);

      const patterns = await service.getAggregatedPatterns(testSpaceId);

      expect(patterns.size).toBe(2);
      expect(patterns.get('netflix')).toBeDefined();
      expect(patterns.get('spotify')).toBeDefined();
    });

    it('should skip corrections with null merchantPattern', async () => {
      const mockCorrections = [
        {
          merchantPattern: null,
          correctedCategoryId: 'cat-1',
          createdAt: new Date(),
        },
        {
          merchantPattern: 'valid',
          correctedCategoryId: 'cat-1',
          createdAt: new Date(),
        },
      ];

      prismaMock.categoryCorrection.findMany.mockResolvedValue(mockCorrections);
      prismaMock.category.findMany.mockResolvedValue([{ id: 'cat-1', name: 'Category' }]);

      const patterns = await service.getAggregatedPatterns(testSpaceId);

      expect(patterns.size).toBe(1);
      expect(patterns.get('valid')).toBeDefined();
    });

    it('should apply recency weighting to corrections', async () => {
      const now = new Date();
      const mockCorrections = [
        // Recent correction for cat-2
        {
          merchantPattern: 'merchant',
          correctedCategoryId: 'cat-2',
          createdAt: new Date(now.getTime() - 1000), // 1 second ago
        },
        // Old correction for cat-1
        {
          merchantPattern: 'merchant',
          correctedCategoryId: 'cat-1',
          createdAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000), // 180 days ago
        },
      ];

      prismaMock.categoryCorrection.findMany.mockResolvedValue(mockCorrections);
      prismaMock.category.findMany.mockResolvedValue([
        { id: 'cat-1', name: 'Old' },
        { id: 'cat-2', name: 'Recent' },
      ]);

      const patterns = await service.getAggregatedPatterns(testSpaceId);

      const merchantPattern = patterns.get('merchant');
      expect(merchantPattern).toBeDefined();
      // Recent correction should have higher weight
      expect(merchantPattern?.categoryId).toBe('cat-2');
    });

    it('should use "Unknown" for missing category names', async () => {
      const mockCorrections = [
        {
          merchantPattern: 'test',
          correctedCategoryId: 'missing-cat',
          createdAt: new Date(),
        },
      ];

      prismaMock.categoryCorrection.findMany.mockResolvedValue(mockCorrections);
      prismaMock.category.findMany.mockResolvedValue([]); // No categories found

      const patterns = await service.getAggregatedPatterns(testSpaceId);

      expect(patterns.get('test')?.categoryName).toBe('Unknown');
    });

    it('should handle empty corrections', async () => {
      prismaMock.categoryCorrection.findMany.mockResolvedValue([]);
      prismaMock.category.findMany.mockResolvedValue([]);

      const patterns = await service.getAggregatedPatterns(testSpaceId);

      expect(patterns.size).toBe(0);
    });
  });

  describe('invalidateCache', () => {
    beforeEach(() => {
      jest.restoreAllMocks();
    });

    it('should clear cache for specific space', async () => {
      prismaMock.categoryCorrection.findMany.mockResolvedValue([]);
      prismaMock.category.findMany.mockResolvedValue([]);

      // Populate cache
      await service.getAggregatedPatterns(testSpaceId);

      // Invalidate
      service.invalidateCache(testSpaceId);

      // Should rebuild on next call
      const buildPatternsSpy = jest.spyOn(service as any, 'buildPatterns');

      await service.getAggregatedPatterns(testSpaceId);

      expect(buildPatternsSpy).toHaveBeenCalled();
    });

    it('should not affect other spaces', async () => {
      prismaMock.categoryCorrection.findMany.mockResolvedValue([]);
      prismaMock.category.findMany.mockResolvedValue([]);

      const otherSpaceId = 'other-space';

      // Populate caches for both spaces
      await service.getAggregatedPatterns(testSpaceId);
      await service.getAggregatedPatterns(otherSpaceId);

      // Invalidate only one
      service.invalidateCache(testSpaceId);

      // Other space should still be cached
      const buildPatternsSpy = jest.spyOn(service as any, 'buildPatterns');
      buildPatternsSpy.mockClear();

      await service.getAggregatedPatterns(otherSpaceId);

      expect(buildPatternsSpy).not.toHaveBeenCalled();
    });
  });

  describe('retrainAllPatterns', () => {
    beforeEach(() => {
      jest.restoreAllMocks();
    });

    it('should retrain patterns for all spaces with corrections', async () => {
      const spaces = [{ spaceId: 'space-1' }, { spaceId: 'space-2' }];

      prismaMock.categoryCorrection.findMany.mockImplementation(({ select, distinct }) => {
        if (select?.spaceId && distinct) {
          return Promise.resolve(spaces);
        }
        return Promise.resolve([]);
      });
      prismaMock.category.findMany.mockResolvedValue([]);

      const result = await service.retrainAllPatterns();

      expect(result.spacesProcessed).toBe(2);
      expect(result.patternsBuilt).toBe(0);
    });

    it('should handle no spaces with corrections', async () => {
      prismaMock.categoryCorrection.findMany.mockResolvedValue([]);

      const result = await service.retrainAllPatterns();

      expect(result.spacesProcessed).toBe(0);
      expect(result.patternsBuilt).toBe(0);
    });

    it('should invalidate cache before rebuilding', async () => {
      const spaces = [{ spaceId: testSpaceId }];
      prismaMock.categoryCorrection.findMany.mockImplementation(({ select, distinct }) => {
        if (select?.spaceId && distinct) {
          return Promise.resolve(spaces);
        }
        return Promise.resolve([]);
      });
      prismaMock.category.findMany.mockResolvedValue([]);

      const invalidateSpy = jest.spyOn(service, 'invalidateCache');

      await service.retrainAllPatterns();

      expect(invalidateSpy).toHaveBeenCalledWith(testSpaceId);
    });
  });

  describe('getPatternStats', () => {
    it('should return statistics for patterns', async () => {
      const mockPatterns = new Map([
        [
          'netflix',
          {
            patternKey: 'netflix',
            categoryId: 'cat-1',
            categoryName: 'Entertainment',
            correctionCount: 10,
            weight: 5.0,
            lastUpdated: new Date('2024-01-01'),
          },
        ],
        [
          'spotify',
          {
            patternKey: 'spotify',
            categoryId: 'cat-2',
            categoryName: 'Music',
            correctionCount: 5,
            weight: 2.5,
            lastUpdated: new Date('2024-01-02'),
          },
        ],
      ]);

      jest.spyOn(service as any, 'buildPatterns').mockResolvedValue(mockPatterns);

      const stats = await service.getPatternStats(testSpaceId);

      expect(stats.totalPatterns).toBe(2);
      expect(stats.avgCorrectionsPerPattern).toBe(7.5); // (10 + 5) / 2
      expect(stats.topPatterns).toHaveLength(2);
      expect(stats.recentPatterns).toHaveLength(2);
    });

    it('should sort topPatterns by correction count descending', async () => {
      const mockPatterns = new Map([
        [
          'pattern1',
          {
            patternKey: 'pattern1',
            categoryId: 'cat-1',
            categoryName: 'Cat1',
            correctionCount: 5,
            weight: 1.0,
            lastUpdated: new Date(),
          },
        ],
        [
          'pattern2',
          {
            patternKey: 'pattern2',
            categoryId: 'cat-2',
            categoryName: 'Cat2',
            correctionCount: 10,
            weight: 1.0,
            lastUpdated: new Date(),
          },
        ],
      ]);

      jest.spyOn(service as any, 'buildPatterns').mockResolvedValue(mockPatterns);

      const stats = await service.getPatternStats(testSpaceId);

      expect(stats.topPatterns[0].pattern).toBe('pattern2');
      expect(stats.topPatterns[0].count).toBe(10);
    });

    it('should sort recentPatterns by lastUpdated descending', async () => {
      const older = new Date('2024-01-01');
      const newer = new Date('2024-01-15');

      const mockPatterns = new Map([
        [
          'older',
          {
            patternKey: 'older',
            categoryId: 'cat-1',
            categoryName: 'Old',
            correctionCount: 10,
            weight: 1.0,
            lastUpdated: older,
          },
        ],
        [
          'newer',
          {
            patternKey: 'newer',
            categoryId: 'cat-2',
            categoryName: 'New',
            correctionCount: 5,
            weight: 1.0,
            lastUpdated: newer,
          },
        ],
      ]);

      jest.spyOn(service as any, 'buildPatterns').mockResolvedValue(mockPatterns);

      const stats = await service.getPatternStats(testSpaceId);

      expect(stats.recentPatterns[0].pattern).toBe('newer');
    });

    it('should limit topPatterns to 10', async () => {
      const mockPatterns = new Map();
      for (let i = 0; i < 15; i++) {
        mockPatterns.set(`pattern${i}`, {
          patternKey: `pattern${i}`,
          categoryId: `cat-${i}`,
          categoryName: `Category ${i}`,
          correctionCount: i,
          weight: 1.0,
          lastUpdated: new Date(),
        });
      }

      jest.spyOn(service as any, 'buildPatterns').mockResolvedValue(mockPatterns);

      const stats = await service.getPatternStats(testSpaceId);

      expect(stats.topPatterns.length).toBeLessThanOrEqual(10);
    });

    it('should handle empty patterns', async () => {
      jest.spyOn(service as any, 'buildPatterns').mockResolvedValue(new Map());

      const stats = await service.getPatternStats(testSpaceId);

      expect(stats.totalPatterns).toBe(0);
      expect(stats.avgCorrectionsPerPattern).toBe(0);
      expect(stats.topPatterns).toEqual([]);
      expect(stats.recentPatterns).toEqual([]);
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      jest.restoreAllMocks();
    });

    it('should handle very large number of corrections', async () => {
      const corrections = Array(500)
        .fill(null)
        .map((_, i) => ({
          merchantPattern: `merchant${i % 50}`,
          correctedCategoryId: `cat-${i % 5}`,
          createdAt: new Date(Date.now() - i * 1000),
        }));

      prismaMock.categoryCorrection.findMany.mockResolvedValue(corrections);
      prismaMock.category.findMany.mockResolvedValue([
        { id: 'cat-0', name: 'Cat0' },
        { id: 'cat-1', name: 'Cat1' },
        { id: 'cat-2', name: 'Cat2' },
        { id: 'cat-3', name: 'Cat3' },
        { id: 'cat-4', name: 'Cat4' },
      ]);

      const patterns = await service.getAggregatedPatterns(testSpaceId);

      expect(patterns.size).toBe(50);
    });

    it('should handle corrections with same timestamp', async () => {
      const sameTime = new Date();
      const corrections = [
        { merchantPattern: 'merchant', correctedCategoryId: 'cat-1', createdAt: sameTime },
        { merchantPattern: 'merchant', correctedCategoryId: 'cat-1', createdAt: sameTime },
        { merchantPattern: 'merchant', correctedCategoryId: 'cat-2', createdAt: sameTime },
      ];

      prismaMock.categoryCorrection.findMany.mockResolvedValue(corrections);
      prismaMock.category.findMany.mockResolvedValue([
        { id: 'cat-1', name: 'Cat1' },
        { id: 'cat-2', name: 'Cat2' },
      ]);

      const patterns = await service.getAggregatedPatterns(testSpaceId);

      // cat-1 has more corrections (2 vs 1)
      expect(patterns.get('merchant')?.categoryId).toBe('cat-1');
    });

    it('should handle unicode in pattern keys', async () => {
      const corrections = [
        { merchantPattern: 'café', correctedCategoryId: 'cat-1', createdAt: new Date() },
      ];

      prismaMock.categoryCorrection.findMany.mockResolvedValue(corrections);
      prismaMock.category.findMany.mockResolvedValue([{ id: 'cat-1', name: 'Coffee' }]);

      const patterns = await service.getAggregatedPatterns(testSpaceId);

      expect(patterns.get('café')).toBeDefined();
    });

    it('should handle case sensitivity in pattern keys', async () => {
      const corrections = [
        { merchantPattern: 'NETFLIX', correctedCategoryId: 'cat-1', createdAt: new Date() },
        { merchantPattern: 'netflix', correctedCategoryId: 'cat-1', createdAt: new Date() },
      ];

      prismaMock.categoryCorrection.findMany.mockResolvedValue(corrections);
      prismaMock.category.findMany.mockResolvedValue([{ id: 'cat-1', name: 'Streaming' }]);

      const patterns = await service.getAggregatedPatterns(testSpaceId);

      // Both should be lowercased to same key
      expect(patterns.has('netflix')).toBe(true);
      expect(patterns.get('netflix')?.correctionCount).toBe(2);
    });

    it('should handle fuzzy match when pattern map returns undefined (line 77-78)', async () => {
      // Create patterns but ensure fuzzy match points to non-existent key
      const mockPatterns = new Map([
        [
          'netflix',
          {
            patternKey: 'netflix',
            categoryId: 'cat-1',
            categoryName: 'Streaming',
            correctionCount: 10,
            weight: 5.0,
            lastUpdated: new Date(),
          },
        ],
      ]);

      jest.spyOn(service as any, 'buildPatterns').mockResolvedValue(mockPatterns);
      merchantNormalizerMock.extractPatternKey!.mockReturnValue('unknownmerchant');
      // Fuzzy match returns a key that doesn't exist in patterns
      fuzzyMatcherMock.findBestMatch!.mockReturnValue({
        match: 'nonexistent',
        similarity: 0.9,
        index: 0,
      });
      merchantNormalizerMock.extractDescriptionTerms!.mockReturnValue([]);

      const result = await service.findBestMatch(testSpaceId, 'SomeMerchant', 'Description');

      // Should not crash and should return null since pattern doesn't exist
      expect(result).toBeNull();
    });

    it('should handle description match when pattern map returns undefined (line 101-102)', async () => {
      const mockPatterns = new Map([
        [
          'netflix',
          {
            patternKey: 'netflix',
            categoryId: 'cat-1',
            categoryName: 'Streaming',
            correctionCount: 10,
            weight: 5.0,
            lastUpdated: new Date(),
          },
        ],
      ]);

      jest.spyOn(service as any, 'buildPatterns').mockResolvedValue(mockPatterns);
      merchantNormalizerMock.extractPatternKey!.mockReturnValue('unknownmerchant');
      fuzzyMatcherMock.findBestMatch!.mockReturnValue({
        match: null,
        similarity: 0,
        index: -1,
      });
      merchantNormalizerMock.extractDescriptionTerms!.mockReturnValue(['streaming']);
      // Description match returns a key that doesn't exist in patterns
      fuzzyMatcherMock.findAllMatches!.mockReturnValue([
        { match: 'nonexistent', similarity: 0.7, index: 0 },
      ]);

      const result = await service.findBestMatch(testSpaceId, 'SomeMerchant', 'Description');

      // Should not crash and should return null since pattern doesn't exist
      expect(result).toBeNull();
    });

    it('should handle description match when no description terms (line 91)', async () => {
      const mockPatterns = new Map([
        [
          'netflix',
          {
            patternKey: 'netflix',
            categoryId: 'cat-1',
            categoryName: 'Streaming',
            correctionCount: 10,
            weight: 5.0,
            lastUpdated: new Date(),
          },
        ],
      ]);

      jest.spyOn(service as any, 'buildPatterns').mockResolvedValue(mockPatterns);
      merchantNormalizerMock.extractPatternKey!.mockReturnValue('unknownmerchant');
      fuzzyMatcherMock.findBestMatch!.mockReturnValue({
        match: null,
        similarity: 0,
        index: -1,
      });
      // Empty description terms
      merchantNormalizerMock.extractDescriptionTerms!.mockReturnValue([]);

      const result = await service.findBestMatch(testSpaceId, 'SomeMerchant', '');

      expect(result).toBeNull();
    });

    it('should update lastUpdated when newer correction arrives (line 202-204)', async () => {
      const oldDate = new Date('2024-01-01');
      const newDate = new Date('2024-06-15');

      const corrections = [
        { merchantPattern: 'merchant', correctedCategoryId: 'cat-1', createdAt: oldDate },
        { merchantPattern: 'merchant', correctedCategoryId: 'cat-1', createdAt: newDate },
      ];

      prismaMock.categoryCorrection.findMany.mockResolvedValue(corrections);
      prismaMock.category.findMany.mockResolvedValue([{ id: 'cat-1', name: 'Cat1' }]);

      const patterns = await service.getAggregatedPatterns(testSpaceId);

      // lastUpdated should be the newer date
      expect(patterns.get('merchant')?.lastUpdated).toEqual(newDate);
    });
  });
});
