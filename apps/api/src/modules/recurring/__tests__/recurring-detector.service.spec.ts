import { Test, TestingModule } from '@nestjs/testing';

import { RecurrenceFrequency, Currency } from '@db';

import { PrismaService } from '../../../core/prisma/prisma.service';
import { RecurringDetectorService } from '../recurring-detector.service';

describe('RecurringDetectorService', () => {
  let service: RecurringDetectorService;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockPrismaService = {
      transaction: {
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      recurringTransaction: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecurringDetectorService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<RecurringDetectorService>(RecurringDetectorService);
    prismaService = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('detectPatterns', () => {
    it('should detect monthly recurring patterns', async () => {
      const now = new Date();
      const transactions = [
        {
          id: '1',
          date: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
          amount: -50.0,
          merchant: 'Netflix',
          description: 'Netflix Subscription',
          currency: Currency.USD,
          recurringId: null,
        },
        {
          id: '2',
          date: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
          amount: -50.0,
          merchant: 'Netflix',
          description: 'Netflix Subscription',
          currency: Currency.USD,
          recurringId: null,
        },
        {
          id: '3',
          date: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          amount: -50.0,
          merchant: 'Netflix',
          description: 'Netflix Subscription',
          currency: Currency.USD,
          recurringId: null,
        },
        {
          id: '4',
          date: now,
          amount: -50.0,
          merchant: 'Netflix',
          description: 'Netflix Subscription',
          currency: Currency.USD,
          recurringId: null,
        },
      ];

      (prismaService.transaction.findMany as jest.Mock).mockResolvedValue(transactions);
      (prismaService.recurringTransaction.findMany as jest.Mock).mockResolvedValue([]);

      const patterns = await service.detectPatterns('space-1');

      expect(patterns).toHaveLength(1);
      expect(patterns[0]).toMatchObject({
        merchantName: 'Netflix',
        suggestedFrequency: 'monthly',
        averageAmount: 50.0,
        occurrenceCount: 4,
      });
      expect(patterns[0].confidence).toBeGreaterThanOrEqual(0.6);
    });

    it('should detect weekly recurring patterns', async () => {
      const now = new Date();
      const transactions = [];

      // Create weekly transactions for the last 6 weeks
      for (let i = 0; i < 6; i++) {
        transactions.push({
          id: `${i}`,
          date: new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000),
          amount: -25.0,
          merchant: 'Weekly Groceries',
          description: 'Weekly Groceries Store',
          currency: Currency.MXN,
          recurringId: null,
        });
      }

      (prismaService.transaction.findMany as jest.Mock).mockResolvedValue(transactions);
      (prismaService.recurringTransaction.findMany as jest.Mock).mockResolvedValue([]);

      const patterns = await service.detectPatterns('space-1');

      expect(patterns).toHaveLength(1);
      expect(patterns[0].suggestedFrequency).toBe('weekly');
    });

    it('should not detect patterns with high amount variance', async () => {
      const now = new Date();
      const transactions = [
        {
          id: '1',
          date: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
          amount: -10.0,
          merchant: 'Variable Shop',
          description: 'Variable Shop Purchase',
          currency: Currency.USD,
          recurringId: null,
        },
        {
          id: '2',
          date: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
          amount: -100.0,
          merchant: 'Variable Shop',
          description: 'Variable Shop Purchase',
          currency: Currency.USD,
          recurringId: null,
        },
        {
          id: '3',
          date: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          amount: -50.0,
          merchant: 'Variable Shop',
          description: 'Variable Shop Purchase',
          currency: Currency.USD,
          recurringId: null,
        },
      ];

      (prismaService.transaction.findMany as jest.Mock).mockResolvedValue(transactions);
      (prismaService.recurringTransaction.findMany as jest.Mock).mockResolvedValue([]);

      const patterns = await service.detectPatterns('space-1');

      // High variance should result in no pattern detected
      expect(patterns).toHaveLength(0);
    });

    it('should not detect patterns with less than 3 occurrences', async () => {
      const now = new Date();
      const transactions = [
        {
          id: '1',
          date: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          amount: -50.0,
          merchant: 'Rare Merchant',
          description: 'Rare Merchant Purchase',
          currency: Currency.USD,
          recurringId: null,
        },
        {
          id: '2',
          date: now,
          amount: -50.0,
          merchant: 'Rare Merchant',
          description: 'Rare Merchant Purchase',
          currency: Currency.USD,
          recurringId: null,
        },
      ];

      (prismaService.transaction.findMany as jest.Mock).mockResolvedValue(transactions);
      (prismaService.recurringTransaction.findMany as jest.Mock).mockResolvedValue([]);

      const patterns = await service.detectPatterns('space-1');

      expect(patterns).toHaveLength(0);
    });

    it('should skip already tracked merchants', async () => {
      const now = new Date();
      const transactions = [
        {
          id: '1',
          date: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
          amount: -50.0,
          merchant: 'Already Tracked',
          description: 'Already Tracked Service',
          currency: Currency.USD,
          recurringId: null,
        },
        {
          id: '2',
          date: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
          amount: -50.0,
          merchant: 'Already Tracked',
          description: 'Already Tracked Service',
          currency: Currency.USD,
          recurringId: null,
        },
        {
          id: '3',
          date: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          amount: -50.0,
          merchant: 'Already Tracked',
          description: 'Already Tracked Service',
          currency: Currency.USD,
          recurringId: null,
        },
      ];

      (prismaService.transaction.findMany as jest.Mock).mockResolvedValue(transactions);
      (prismaService.recurringTransaction.findMany as jest.Mock).mockResolvedValue([
        { merchantName: 'Already Tracked' },
      ]);

      const patterns = await service.detectPatterns('space-1');

      expect(patterns).toHaveLength(0);
    });
  });

  describe('calculateNextExpected', () => {
    it('should calculate next expected date for monthly frequency', () => {
      const lastOccurrence = new Date('2025-01-15');
      const next = service.calculateNextExpected(lastOccurrence, 'monthly');

      expect(next.getTime()).toBeGreaterThan(lastOccurrence.getTime());
      const daysDiff = Math.round(
        (next.getTime() - lastOccurrence.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(daysDiff).toBe(30);
    });

    it('should calculate next expected date for weekly frequency', () => {
      const lastOccurrence = new Date('2025-01-15');
      const next = service.calculateNextExpected(lastOccurrence, 'weekly');

      const daysDiff = Math.round(
        (next.getTime() - lastOccurrence.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(daysDiff).toBe(7);
    });

    it('should calculate next expected date for yearly frequency', () => {
      const lastOccurrence = new Date('2025-01-15');
      const next = service.calculateNextExpected(lastOccurrence, 'yearly');

      const daysDiff = Math.round(
        (next.getTime() - lastOccurrence.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(daysDiff).toBe(365);
    });

    it('should calculate next expected date for biweekly frequency', () => {
      const lastOccurrence = new Date('2025-01-15');
      const next = service.calculateNextExpected(lastOccurrence, 'biweekly');

      const daysDiff = Math.round(
        (next.getTime() - lastOccurrence.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(daysDiff).toBe(14);
    });

    it('should calculate next expected date for quarterly frequency', () => {
      const lastOccurrence = new Date('2025-01-15');
      const next = service.calculateNextExpected(lastOccurrence, 'quarterly');

      const daysDiff = Math.round(
        (next.getTime() - lastOccurrence.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(daysDiff).toBe(90);
    });
  });

  describe('detectPatterns - edge cases', () => {
    it('should handle transactions without merchant by using description', async () => {
      const now = new Date();
      const transactions = [
        {
          id: '1',
          date: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
          amount: -15.99,
          merchant: null,
          description: 'Spotify Premium',
          currency: Currency.USD,
          recurringId: null,
        },
        {
          id: '2',
          date: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
          amount: -15.99,
          merchant: null,
          description: 'Spotify Premium',
          currency: Currency.USD,
          recurringId: null,
        },
        {
          id: '3',
          date: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          amount: -15.99,
          merchant: null,
          description: 'Spotify Premium',
          currency: Currency.USD,
          recurringId: null,
        },
        {
          id: '4',
          date: now,
          amount: -15.99,
          merchant: null,
          description: 'Spotify Premium',
          currency: Currency.USD,
          recurringId: null,
        },
      ];

      (prismaService.transaction.findMany as jest.Mock).mockResolvedValue(transactions);
      (prismaService.recurringTransaction.findMany as jest.Mock).mockResolvedValue([]);

      const patterns = await service.detectPatterns('space-1');

      expect(patterns).toHaveLength(1);
      expect(patterns[0].merchantName).toBe('Spotify Premium');
    });

    it('should strip common payment prefixes from descriptions', async () => {
      const now = new Date();
      const transactions = [
        {
          id: '1',
          date: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
          amount: -9.99,
          merchant: null,
          description: 'POS Hulu Subscription',
          currency: Currency.USD,
          recurringId: null,
        },
        {
          id: '2',
          date: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
          amount: -9.99,
          merchant: null,
          description: 'POS Hulu Subscription',
          currency: Currency.USD,
          recurringId: null,
        },
        {
          id: '3',
          date: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          amount: -9.99,
          merchant: null,
          description: 'POS Hulu Subscription',
          currency: Currency.USD,
          recurringId: null,
        },
        {
          id: '4',
          date: now,
          amount: -9.99,
          merchant: null,
          description: 'POS Hulu Subscription',
          currency: Currency.USD,
          recurringId: null,
        },
      ];

      (prismaService.transaction.findMany as jest.Mock).mockResolvedValue(transactions);
      (prismaService.recurringTransaction.findMany as jest.Mock).mockResolvedValue([]);

      const patterns = await service.detectPatterns('space-1');

      expect(patterns).toHaveLength(1);
      // POS prefix should be stripped
      expect(patterns[0].merchantName).not.toContain('POS');
    });

    it('should strip trailing state codes from descriptions', async () => {
      const now = new Date();
      const transactions = [
        {
          id: '1',
          date: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
          amount: -29.99,
          merchant: null,
          description: 'Amazon Prime CA',
          currency: Currency.USD,
          recurringId: null,
        },
        {
          id: '2',
          date: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
          amount: -29.99,
          merchant: null,
          description: 'Amazon Prime CA',
          currency: Currency.USD,
          recurringId: null,
        },
        {
          id: '3',
          date: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          amount: -29.99,
          merchant: null,
          description: 'Amazon Prime CA',
          currency: Currency.USD,
          recurringId: null,
        },
        {
          id: '4',
          date: now,
          amount: -29.99,
          merchant: null,
          description: 'Amazon Prime CA',
          currency: Currency.USD,
          recurringId: null,
        },
      ];

      (prismaService.transaction.findMany as jest.Mock).mockResolvedValue(transactions);
      (prismaService.recurringTransaction.findMany as jest.Mock).mockResolvedValue([]);

      const patterns = await service.detectPatterns('space-1');

      expect(patterns).toHaveLength(1);
    });

    it('should not create pattern from too-short descriptions', async () => {
      const now = new Date();
      const transactions = [
        {
          id: '1',
          date: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
          amount: -5.0,
          merchant: null,
          description: 'AB',
          currency: Currency.USD,
          recurringId: null,
        },
        {
          id: '2',
          date: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
          amount: -5.0,
          merchant: null,
          description: 'AB',
          currency: Currency.USD,
          recurringId: null,
        },
        {
          id: '3',
          date: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          amount: -5.0,
          merchant: null,
          description: 'AB',
          currency: Currency.USD,
          recurringId: null,
        },
      ];

      (prismaService.transaction.findMany as jest.Mock).mockResolvedValue(transactions);
      (prismaService.recurringTransaction.findMany as jest.Mock).mockResolvedValue([]);

      const patterns = await service.detectPatterns('space-1');

      // Too-short merchant names (<=2 chars) should be filtered out
      expect(patterns).toHaveLength(0);
    });

    it('should not detect pattern with irregular intervals (low frequency score)', async () => {
      const now = new Date();
      // Create transactions with very irregular intervals
      const transactions = [
        {
          id: '1',
          date: new Date(now.getTime() - 150 * 24 * 60 * 60 * 1000),
          amount: -30.0,
          merchant: 'Irregular Service',
          description: 'Irregular Service Payment',
          currency: Currency.USD,
          recurringId: null,
        },
        {
          id: '2',
          date: new Date(now.getTime() - 140 * 24 * 60 * 60 * 1000), // 10 days after first
          amount: -30.0,
          merchant: 'Irregular Service',
          description: 'Irregular Service Payment',
          currency: Currency.USD,
          recurringId: null,
        },
        {
          id: '3',
          date: new Date(now.getTime() - 50 * 24 * 60 * 60 * 1000), // 90 days after second
          amount: -30.0,
          merchant: 'Irregular Service',
          description: 'Irregular Service Payment',
          currency: Currency.USD,
          recurringId: null,
        },
        {
          id: '4',
          date: now, // 50 days after third
          amount: -30.0,
          merchant: 'Irregular Service',
          description: 'Irregular Service Payment',
          currency: Currency.USD,
          recurringId: null,
        },
      ];

      (prismaService.transaction.findMany as jest.Mock).mockResolvedValue(transactions);
      (prismaService.recurringTransaction.findMany as jest.Mock).mockResolvedValue([]);

      const patterns = await service.detectPatterns('space-1');

      // Highly irregular intervals should result in low frequency score and no pattern
      expect(patterns).toHaveLength(0);
    });

    it('should handle empty transaction list', async () => {
      (prismaService.transaction.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.recurringTransaction.findMany as jest.Mock).mockResolvedValue([]);

      const patterns = await service.detectPatterns('space-1');

      expect(patterns).toHaveLength(0);
    });
  });

  describe('matchTransactionToRecurring', () => {
    beforeEach(() => {
      (prismaService.recurringTransaction.findMany as jest.Mock).mockResolvedValue([]);
    });

    it('should match transaction to existing confirmed pattern', async () => {
      const existingPattern = {
        id: 'pattern-1',
        merchantName: 'Netflix',
        expectedAmount: 15.99,
        amountVariance: 0.1,
        frequency: 'monthly',
        status: 'confirmed',
      };

      (prismaService.recurringTransaction.findMany as jest.Mock).mockResolvedValue([
        existingPattern,
      ]);
      (prismaService.transaction.update as jest.Mock).mockResolvedValue({});
      (prismaService.recurringTransaction.update as jest.Mock).mockResolvedValue({});

      const transaction = {
        id: 'txn-1',
        merchant: 'Netflix',
        description: 'Netflix Subscription',
        amount: 15.99,
        date: new Date(),
      };

      const result = await service.matchTransactionToRecurring(transaction, 'space-1');

      expect(result).toBe('pattern-1');
      expect(prismaService.transaction.update).toHaveBeenCalledWith({
        where: { id: 'txn-1' },
        data: { recurringId: 'pattern-1' },
      });
      expect(prismaService.recurringTransaction.update).toHaveBeenCalled();
    });

    it('should return null when no merchant can be extracted', async () => {
      const transaction = {
        id: 'txn-1',
        merchant: null,
        description: 'AB', // Too short to extract
        amount: 10.0,
        date: new Date(),
      };

      const result = await service.matchTransactionToRecurring(transaction, 'space-1');

      expect(result).toBeNull();
    });

    it('should return null when no patterns exist', async () => {
      (prismaService.recurringTransaction.findMany as jest.Mock).mockResolvedValue([]);

      const transaction = {
        id: 'txn-1',
        merchant: 'Unknown Merchant',
        description: 'Unknown Merchant Payment',
        amount: 50.0,
        date: new Date(),
      };

      const result = await service.matchTransactionToRecurring(transaction, 'space-1');

      expect(result).toBeNull();
    });

    it('should not match when merchant name does not match', async () => {
      const existingPattern = {
        id: 'pattern-1',
        merchantName: 'Netflix',
        expectedAmount: 15.99,
        amountVariance: 0.1,
        frequency: 'monthly',
        status: 'confirmed',
      };

      (prismaService.recurringTransaction.findMany as jest.Mock).mockResolvedValue([
        existingPattern,
      ]);

      const transaction = {
        id: 'txn-1',
        merchant: 'Spotify',
        description: 'Spotify Premium',
        amount: 15.99,
        date: new Date(),
      };

      const result = await service.matchTransactionToRecurring(transaction, 'space-1');

      expect(result).toBeNull();
    });

    it('should not match when amount is outside variance range', async () => {
      const existingPattern = {
        id: 'pattern-1',
        merchantName: 'Netflix',
        expectedAmount: 15.99,
        amountVariance: 0.1, // 10% variance = 14.39 to 17.59
        frequency: 'monthly',
        status: 'confirmed',
      };

      (prismaService.recurringTransaction.findMany as jest.Mock).mockResolvedValue([
        existingPattern,
      ]);

      const transaction = {
        id: 'txn-1',
        merchant: 'Netflix',
        description: 'Netflix Premium (upgraded)',
        amount: 22.99, // Outside variance range
        date: new Date(),
      };

      const result = await service.matchTransactionToRecurring(transaction, 'space-1');

      expect(result).toBeNull();
    });

    it('should match using description when merchant is null', async () => {
      const existingPattern = {
        id: 'pattern-1',
        merchantName: 'HBO Max',
        expectedAmount: 14.99,
        amountVariance: 0.05,
        frequency: 'monthly',
        status: 'confirmed',
      };

      (prismaService.recurringTransaction.findMany as jest.Mock).mockResolvedValue([
        existingPattern,
      ]);
      (prismaService.transaction.update as jest.Mock).mockResolvedValue({});
      (prismaService.recurringTransaction.update as jest.Mock).mockResolvedValue({});

      const transaction = {
        id: 'txn-1',
        merchant: null,
        description: 'HBO Max Subscription',
        amount: 14.99,
        date: new Date(),
      };

      const result = await service.matchTransactionToRecurring(transaction, 'space-1');

      expect(result).toBe('pattern-1');
    });

    it('should match when amount is within variance range (lower bound)', async () => {
      const existingPattern = {
        id: 'pattern-1',
        merchantName: 'Disney Plus',
        expectedAmount: 10.0,
        amountVariance: 0.2, // 20% variance = 8.00 to 12.00
        frequency: 'monthly',
        status: 'confirmed',
      };

      (prismaService.recurringTransaction.findMany as jest.Mock).mockResolvedValue([
        existingPattern,
      ]);
      (prismaService.transaction.update as jest.Mock).mockResolvedValue({});
      (prismaService.recurringTransaction.update as jest.Mock).mockResolvedValue({});

      const transaction = {
        id: 'txn-1',
        merchant: 'Disney Plus',
        description: 'Disney+ Subscription',
        amount: 8.5, // Within lower variance
        date: new Date(),
      };

      const result = await service.matchTransactionToRecurring(transaction, 'space-1');

      expect(result).toBe('pattern-1');
    });

    it('should update recurring pattern with new occurrence data', async () => {
      const existingPattern = {
        id: 'pattern-1',
        merchantName: 'Netflix',
        expectedAmount: 15.99,
        amountVariance: 0.1,
        frequency: 'monthly',
        status: 'confirmed',
      };

      (prismaService.recurringTransaction.findMany as jest.Mock).mockResolvedValue([
        existingPattern,
      ]);
      (prismaService.transaction.update as jest.Mock).mockResolvedValue({});
      (prismaService.recurringTransaction.update as jest.Mock).mockResolvedValue({});

      const transactionDate = new Date('2025-01-15');
      const transaction = {
        id: 'txn-1',
        merchant: 'Netflix',
        description: 'Netflix Subscription',
        amount: 15.99,
        date: transactionDate,
      };

      await service.matchTransactionToRecurring(transaction, 'space-1');

      expect(prismaService.recurringTransaction.update).toHaveBeenCalledWith({
        where: { id: 'pattern-1' },
        data: expect.objectContaining({
          lastOccurrence: transactionDate,
          occurrenceCount: { increment: 1 },
        }),
      });
    });

    it('should match partial merchant name (pattern contains transaction merchant)', async () => {
      const existingPattern = {
        id: 'pattern-1',
        merchantName: 'Amazon Prime Video',
        expectedAmount: 8.99,
        amountVariance: 0.1,
        frequency: 'monthly',
        status: 'confirmed',
      };

      (prismaService.recurringTransaction.findMany as jest.Mock).mockResolvedValue([
        existingPattern,
      ]);
      (prismaService.transaction.update as jest.Mock).mockResolvedValue({});
      (prismaService.recurringTransaction.update as jest.Mock).mockResolvedValue({});

      const transaction = {
        id: 'txn-1',
        merchant: 'Amazon Prime',
        description: 'Amazon Prime Video Subscription',
        amount: 8.99,
        date: new Date(),
      };

      const result = await service.matchTransactionToRecurring(transaction, 'space-1');

      expect(result).toBe('pattern-1');
    });
  });
});
