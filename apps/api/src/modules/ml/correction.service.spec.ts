import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { createPrismaMock, createLoggerMock } from '../../../test/helpers/api-mock-factory';
import { PrismaService } from '../../core/prisma/prisma.service';

import { CategoryCorrectionService } from './correction.service';
import { MerchantNormalizerService } from './merchant-normalizer.service';

describe('CategoryCorrectionService', () => {
  let service: CategoryCorrectionService;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let merchantNormalizerMock: jest.Mocked<Partial<MerchantNormalizerService>>;

  const testSpaceId = 'space-123';
  const testUserId = 'user-456';
  const testTransactionId = 'txn-789';

  beforeEach(async () => {
    jest.clearAllMocks();

    prismaMock = createPrismaMock();
    merchantNormalizerMock = {
      extractPatternKey: jest.fn().mockImplementation((merchant) => {
        if (!merchant) return null;
        return merchant.toLowerCase().replace(/[^a-z0-9]/g, '');
      }),
      extractDescriptionTerms: jest.fn().mockReturnValue(['payment', 'service']),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryCorrectionService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: MerchantNormalizerService, useValue: merchantNormalizerMock },
      ],
    }).compile();

    service = module.get<CategoryCorrectionService>(CategoryCorrectionService);
    (service as any).logger = createLoggerMock();
  });

  describe('recordCorrection', () => {
    const mockTransaction = {
      id: testTransactionId,
      categoryId: 'old-category',
      merchant: 'Netflix',
      description: 'Netflix Monthly Subscription',
      metadata: { mlConfidence: 0.7 },
      account: {
        id: 'account-1',
        spaceId: testSpaceId,
      },
      category: { id: 'old-category', name: 'Unknown' },
    };

    beforeEach(() => {
      prismaMock.transaction.findUnique.mockResolvedValue(mockTransaction);
      prismaMock.categoryCorrection.create.mockResolvedValue({});
      prismaMock.transaction.update.mockResolvedValue({});
      prismaMock.transaction.findMany.mockResolvedValue([]);
    });

    it('should record a correction successfully', async () => {
      await service.recordCorrection({
        transactionId: testTransactionId,
        spaceId: testSpaceId,
        correctedCategoryId: 'new-category',
        userId: testUserId,
        applyToFuture: true,
      });

      expect(prismaMock.categoryCorrection.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          spaceId: testSpaceId,
          transactionId: testTransactionId,
          originalCategoryId: 'old-category',
          correctedCategoryId: 'new-category',
          createdBy: testUserId,
          appliedToFuture: true,
        }),
      });

      expect(prismaMock.transaction.update).toHaveBeenCalledWith({
        where: { id: testTransactionId },
        data: expect.objectContaining({
          categoryId: 'new-category',
          metadata: expect.objectContaining({
            userCorrected: true,
            correctedBy: testUserId,
          }),
        }),
      });
    });

    it('should throw NotFoundException when transaction does not exist', async () => {
      prismaMock.transaction.findUnique.mockResolvedValue(null);

      await expect(
        service.recordCorrection({
          transactionId: 'non-existent',
          spaceId: testSpaceId,
          correctedCategoryId: 'new-category',
          userId: testUserId,
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when transaction belongs to different space', async () => {
      prismaMock.transaction.findUnique.mockResolvedValue({
        ...mockTransaction,
        account: { ...mockTransaction.account, spaceId: 'different-space' },
      });

      await expect(
        service.recordCorrection({
          transactionId: testTransactionId,
          spaceId: testSpaceId,
          correctedCategoryId: 'new-category',
          userId: testUserId,
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('should apply correction to similar transactions when applyToFuture is true', async () => {
      const similarTransactions = [
        { id: 'txn-1', merchant: 'Netflix', categoryId: null, account: { spaceId: testSpaceId } },
        { id: 'txn-2', merchant: 'NETFLIX', categoryId: null, account: { spaceId: testSpaceId } },
      ];

      prismaMock.transaction.findMany.mockResolvedValue(similarTransactions);

      await service.recordCorrection({
        transactionId: testTransactionId,
        spaceId: testSpaceId,
        correctedCategoryId: 'streaming-category',
        userId: testUserId,
        applyToFuture: true,
      });

      // Should update both similar transactions
      expect(prismaMock.transaction.update).toHaveBeenCalledTimes(3); // 1 original + 2 similar
    });

    it('should not apply to similar transactions when applyToFuture is false', async () => {
      await service.recordCorrection({
        transactionId: testTransactionId,
        spaceId: testSpaceId,
        correctedCategoryId: 'new-category',
        userId: testUserId,
        applyToFuture: false,
      });

      // Should only update the original transaction
      expect(prismaMock.transaction.update).toHaveBeenCalledTimes(1);
    });

    it('should handle transaction with null metadata', async () => {
      prismaMock.transaction.findUnique.mockResolvedValue({
        ...mockTransaction,
        metadata: null,
      });

      await service.recordCorrection({
        transactionId: testTransactionId,
        spaceId: testSpaceId,
        correctedCategoryId: 'new-category',
        userId: testUserId,
      });

      expect(prismaMock.transaction.update).toHaveBeenCalledWith({
        where: { id: testTransactionId },
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            userCorrected: true,
          }),
        }),
      });
    });

    it('should handle transaction with null categoryId', async () => {
      prismaMock.transaction.findUnique.mockResolvedValue({
        ...mockTransaction,
        categoryId: null,
      });

      await service.recordCorrection({
        transactionId: testTransactionId,
        spaceId: testSpaceId,
        correctedCategoryId: 'new-category',
        userId: testUserId,
      });

      expect(prismaMock.categoryCorrection.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          originalCategoryId: null,
        }),
      });
    });

    it('should handle null merchant pattern (line 84)', async () => {
      // When extractPatternKey returns null, merchantPattern should be null
      merchantNormalizerMock.extractPatternKey!.mockReturnValue(null);

      prismaMock.transaction.findUnique.mockResolvedValue({
        ...mockTransaction,
        merchant: null, // null merchant should give null pattern
      });

      await service.recordCorrection({
        transactionId: testTransactionId,
        spaceId: testSpaceId,
        correctedCategoryId: 'new-category',
        userId: testUserId,
        applyToFuture: true,
      });

      expect(prismaMock.categoryCorrection.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          merchantPattern: null,
        }),
      });

      // Should NOT call applyCorrectionToSimilarTransactions because merchantPattern is null
      expect(prismaMock.transaction.update).toHaveBeenCalledTimes(1); // Only the original transaction
    });

    it('should handle empty description terms (line 85)', async () => {
      // When extractDescriptionTerms returns empty array, descriptionPattern should be null/empty
      merchantNormalizerMock.extractDescriptionTerms!.mockReturnValue([]);

      await service.recordCorrection({
        transactionId: testTransactionId,
        spaceId: testSpaceId,
        correctedCategoryId: 'new-category',
        userId: testUserId,
      });

      expect(prismaMock.categoryCorrection.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          descriptionPattern: null, // Empty joined string should be null
        }),
      });
    });

    it('should early return from applyCorrectionToSimilarTransactions when merchantPattern is empty (line 129)', async () => {
      merchantNormalizerMock.extractPatternKey!.mockReturnValue(''); // Empty string pattern

      await service.recordCorrection({
        transactionId: testTransactionId,
        spaceId: testSpaceId,
        correctedCategoryId: 'new-category',
        userId: testUserId,
        applyToFuture: true,
      });

      // Should update only the original transaction because merchantPattern is empty
      expect(prismaMock.transaction.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('getLearnedPatterns', () => {
    it('should return learned patterns sorted by correction count', async () => {
      const mockCorrections = [
        {
          merchantPattern: 'netflix',
          correctedCategoryId: 'cat-1',
          _count: { id: 10 },
          _max: { createdAt: new Date() },
        },
        {
          merchantPattern: 'spotify',
          correctedCategoryId: 'cat-2',
          _count: { id: 5 },
          _max: { createdAt: new Date() },
        },
      ];

      const mockCategories = [
        { id: 'cat-1', name: 'Entertainment' },
        { id: 'cat-2', name: 'Music' },
      ];

      prismaMock.categoryCorrection.groupBy.mockResolvedValue(mockCorrections as any);
      prismaMock.category.findMany.mockResolvedValue(mockCategories);

      const result = await service.getLearnedPatterns(testSpaceId);

      expect(result).toHaveLength(2);
      expect(result[0].merchantPattern).toBe('netflix');
      expect(result[0].correctionCount).toBe(10);
      expect(result[0].categoryName).toBe('Entertainment');
      expect(result[1].merchantPattern).toBe('spotify');
    });

    it('should filter out null merchant patterns', async () => {
      prismaMock.categoryCorrection.groupBy.mockResolvedValue([
        {
          merchantPattern: null,
          correctedCategoryId: 'cat-1',
          _count: { id: 5 },
          _max: { createdAt: new Date() },
        },
        {
          merchantPattern: 'netflix',
          correctedCategoryId: 'cat-2',
          _count: { id: 3 },
          _max: { createdAt: new Date() },
        },
      ] as any);
      prismaMock.category.findMany.mockResolvedValue([]);

      const result = await service.getLearnedPatterns(testSpaceId);

      expect(result).toHaveLength(1);
      expect(result[0].merchantPattern).toBe('netflix');
    });

    it('should return Unknown for missing category names', async () => {
      prismaMock.categoryCorrection.groupBy.mockResolvedValue([
        {
          merchantPattern: 'netflix',
          correctedCategoryId: 'missing-cat',
          _count: { id: 1 },
          _max: { createdAt: new Date() },
        },
      ] as any);
      prismaMock.category.findMany.mockResolvedValue([]);

      const result = await service.getLearnedPatterns(testSpaceId);

      expect(result[0].categoryName).toBe('Unknown');
    });
  });

  describe('findCategoryFromCorrections', () => {
    it('should find category with high confidence for consistent corrections', async () => {
      const now = new Date();
      const corrections = Array(10)
        .fill(null)
        .map((_, i) => ({
          correctedCategoryId: 'cat-1',
          createdAt: new Date(now.getTime() - i * 24 * 60 * 60 * 1000), // Past 10 days
        }));

      prismaMock.categoryCorrection.findMany.mockResolvedValue(corrections);
      merchantNormalizerMock.extractPatternKey!.mockReturnValue('netflix');

      const result = await service.findCategoryFromCorrections(testSpaceId, 'Netflix');

      expect(result).not.toBeNull();
      expect(result?.categoryId).toBe('cat-1');
      expect(result?.confidence).toBeGreaterThan(0.5);
    });

    it('should return null when no corrections exist', async () => {
      prismaMock.categoryCorrection.findMany.mockResolvedValue([]);

      const result = await service.findCategoryFromCorrections(testSpaceId, 'Unknown Merchant');

      expect(result).toBeNull();
    });

    it('should return null when merchant pattern is null', async () => {
      merchantNormalizerMock.extractPatternKey!.mockReturnValue(null);

      const result = await service.findCategoryFromCorrections(testSpaceId, '');

      expect(result).toBeNull();
    });

    it('should apply recency weighting to corrections', async () => {
      const now = new Date();
      const corrections = [
        // Recent corrections to cat-2
        { correctedCategoryId: 'cat-2', createdAt: new Date(now.getTime() - 1000) },
        { correctedCategoryId: 'cat-2', createdAt: new Date(now.getTime() - 2000) },
        // Old corrections to cat-1
        {
          correctedCategoryId: 'cat-1',
          createdAt: new Date(now.getTime() - 300 * 24 * 60 * 60 * 1000),
        },
        {
          correctedCategoryId: 'cat-1',
          createdAt: new Date(now.getTime() - 350 * 24 * 60 * 60 * 1000),
        },
        {
          correctedCategoryId: 'cat-1',
          createdAt: new Date(now.getTime() - 360 * 24 * 60 * 60 * 1000),
        },
      ];

      prismaMock.categoryCorrection.findMany.mockResolvedValue(corrections);
      merchantNormalizerMock.extractPatternKey!.mockReturnValue('merchant');

      const result = await service.findCategoryFromCorrections(testSpaceId, 'Merchant');

      // Recent corrections should win despite fewer count
      expect(result?.categoryId).toBe('cat-2');
    });

    it('should cap confidence at 0.95', async () => {
      const now = new Date();
      // Many recent consistent corrections
      const corrections = Array(20)
        .fill(null)
        .map(() => ({
          correctedCategoryId: 'cat-1',
          createdAt: new Date(now.getTime() - 1000),
        }));

      prismaMock.categoryCorrection.findMany.mockResolvedValue(corrections);
      merchantNormalizerMock.extractPatternKey!.mockReturnValue('merchant');

      const result = await service.findCategoryFromCorrections(testSpaceId, 'Merchant');

      expect(result?.confidence).toBeLessThanOrEqual(0.95);
    });
  });

  describe('getCorrectionStats', () => {
    it('should return correction statistics', async () => {
      const corrections = [
        { merchantPattern: 'netflix', correctedCategoryId: 'cat-1' },
        { merchantPattern: 'spotify', correctedCategoryId: 'cat-2' },
        { merchantPattern: 'netflix', correctedCategoryId: 'cat-1' },
      ];

      prismaMock.categoryCorrection.findMany.mockResolvedValue(corrections);
      prismaMock.transaction.count.mockResolvedValue(100);
      prismaMock.category.findMany.mockResolvedValue([
        { id: 'cat-1', name: 'Entertainment' },
        { id: 'cat-2', name: 'Music' },
      ]);

      const stats = await service.getCorrectionStats(testSpaceId, 30);

      expect(stats.totalCorrections).toBe(3);
      expect(stats.uniqueMerchants).toBe(2);
      expect(stats.correctionRate).toBe(0.03);
      expect(stats.topCorrectedCategories).toHaveLength(2);
      expect(stats.topCorrectedCategories[0].count).toBe(2);
    });

    it('should handle zero transactions gracefully', async () => {
      prismaMock.categoryCorrection.findMany.mockResolvedValue([]);
      prismaMock.transaction.count.mockResolvedValue(0);
      prismaMock.category.findMany.mockResolvedValue([]);

      const stats = await service.getCorrectionStats(testSpaceId);

      expect(stats.correctionRate).toBe(0);
      expect(stats.totalCorrections).toBe(0);
    });

    it('should sort top categories by count descending', async () => {
      const corrections = [
        { merchantPattern: 'a', correctedCategoryId: 'cat-1' },
        { merchantPattern: 'b', correctedCategoryId: 'cat-2' },
        { merchantPattern: 'c', correctedCategoryId: 'cat-2' },
        { merchantPattern: 'd', correctedCategoryId: 'cat-2' },
      ];

      prismaMock.categoryCorrection.findMany.mockResolvedValue(corrections);
      prismaMock.transaction.count.mockResolvedValue(10);
      prismaMock.category.findMany.mockResolvedValue([
        { id: 'cat-1', name: 'Cat1' },
        { id: 'cat-2', name: 'Cat2' },
      ]);

      const stats = await service.getCorrectionStats(testSpaceId);

      expect(stats.topCorrectedCategories[0].categoryId).toBe('cat-2');
      expect(stats.topCorrectedCategories[0].count).toBe(3);
    });

    it('should limit top categories to 5', async () => {
      const corrections = Array(10)
        .fill(null)
        .map((_, i) => ({
          merchantPattern: `m${i}`,
          correctedCategoryId: `cat-${i}`,
        }));

      prismaMock.categoryCorrection.findMany.mockResolvedValue(corrections);
      prismaMock.transaction.count.mockResolvedValue(100);
      prismaMock.category.findMany.mockResolvedValue([]);

      const stats = await service.getCorrectionStats(testSpaceId);

      expect(stats.topCorrectedCategories.length).toBeLessThanOrEqual(5);
    });
  });

  describe('cleanupOldCorrections', () => {
    it('should delete corrections older than specified days', async () => {
      prismaMock.categoryCorrection.deleteMany.mockResolvedValue({ count: 50 });

      const result = await service.cleanupOldCorrections(365);

      expect(result).toBe(50);
      expect(prismaMock.categoryCorrection.deleteMany).toHaveBeenCalledWith({
        where: {
          createdAt: { lt: expect.any(Date) },
        },
      });
    });

    it('should use default 365 days when not specified', async () => {
      prismaMock.categoryCorrection.deleteMany.mockResolvedValue({ count: 10 });

      await service.cleanupOldCorrections();

      expect(prismaMock.categoryCorrection.deleteMany).toHaveBeenCalled();
    });

    it('should log cleanup result', async () => {
      prismaMock.categoryCorrection.deleteMany.mockResolvedValue({ count: 25 });
      const logger = (service as any).logger;

      await service.cleanupOldCorrections(180);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('25 corrections'));
    });
  });
});
