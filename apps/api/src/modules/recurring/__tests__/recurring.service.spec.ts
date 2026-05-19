import { NotFoundException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../core/prisma/prisma.service';
import { SpacesService } from '../../spaces/spaces.service';
import { RecurringDetectorService } from '../recurring-detector.service';
import { RecurringService } from '../recurring.service';

describe('RecurringService', () => {
  let service: RecurringService;
  let prisma: jest.Mocked<PrismaService>;
  let spacesService: jest.Mocked<SpacesService>;
  let detectorService: jest.Mocked<RecurringDetectorService>;

  const mockRecurring = {
    id: 'rec-123',
    spaceId: 'space-123',
    merchantName: 'Netflix',
    merchantPattern: null,
    expectedAmount: 15.99,
    amountVariance: 0.1,
    currency: 'USD',
    frequency: 'monthly',
    status: 'confirmed',
    categoryId: 'cat-1',
    lastOccurrence: new Date('2026-02-01'),
    nextExpected: new Date('2026-03-01'),
    occurrenceCount: 5,
    confidence: 1.0,
    alertBeforeDays: 3,
    alertEnabled: true,
    notes: null,
    firstDetectedAt: new Date('2025-10-01'),
    confirmedAt: new Date('2025-10-15'),
    dismissedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    transactions: [],
  };

  beforeEach(async () => {
    const mockPrisma = {
      recurringTransaction: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      transaction: {
        updateMany: jest.fn(),
      },
    };

    const mockSpacesService = {
      verifyUserAccess: jest.fn().mockResolvedValue(true),
    };

    const mockDetectorService = {
      detectPatterns: jest.fn(),
      calculateNextExpected: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecurringService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SpacesService, useValue: mockSpacesService },
        { provide: RecurringDetectorService, useValue: mockDetectorService },
      ],
    }).compile();

    service = module.get<RecurringService>(RecurringService);
    prisma = module.get(PrismaService);
    spacesService = module.get(SpacesService);
    detectorService = module.get(RecurringDetectorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should verify user access as viewer', async () => {
      prisma.recurringTransaction.findMany.mockResolvedValue([]);

      await service.findAll('space-123', 'user-123');

      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        'user-123',
        'space-123',
        'viewer'
      );
    });

    it('should return confirmed and paused patterns by default', async () => {
      prisma.recurringTransaction.findMany.mockResolvedValue([mockRecurring] as any);

      const result = await service.findAll('space-123', 'user-123');

      expect(prisma.recurringTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { spaceId: 'space-123', status: { in: ['confirmed', 'paused'] } },
        })
      );
      expect(result).toHaveLength(1);
    });

    it('should filter by status when provided', async () => {
      prisma.recurringTransaction.findMany.mockResolvedValue([]);

      await service.findAll('space-123', 'user-123', { status: 'detected' as any });

      expect(prisma.recurringTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { spaceId: 'space-123', status: 'detected' },
        })
      );
    });

    it('should include detected patterns when includeDetected is true', async () => {
      prisma.recurringTransaction.findMany.mockResolvedValue([]);

      await service.findAll('space-123', 'user-123', { includeDetected: true });

      expect(prisma.recurringTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { spaceId: 'space-123' },
        })
      );
    });

    it('should transform response with numeric amounts', async () => {
      prisma.recurringTransaction.findMany.mockResolvedValue([mockRecurring] as any);

      const result = await service.findAll('space-123', 'user-123');

      expect(result[0].expectedAmount).toBe(15.99);
      expect(result[0].merchantName).toBe('Netflix');
    });
  });

  describe('findOne', () => {
    it('should return a recurring transaction by id', async () => {
      prisma.recurringTransaction.findFirst.mockResolvedValue(mockRecurring as any);

      const result = await service.findOne('space-123', 'user-123', 'rec-123');

      expect(result.id).toBe('rec-123');
      expect(prisma.recurringTransaction.findFirst).toHaveBeenCalledWith({
        where: { id: 'rec-123', spaceId: 'space-123' },
        include: expect.objectContaining({ transactions: expect.any(Object) }),
      });
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.recurringTransaction.findFirst.mockResolvedValue(null);

      await expect(service.findOne('space-123', 'user-123', 'missing')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('create', () => {
    const createDto = {
      merchantName: 'Spotify',
      merchantPattern: 'SPOTIFY*',
      expectedAmount: 9.99,
      currency: 'USD' as const,
      frequency: 'monthly' as const,
      categoryId: 'cat-2',
    };

    it('should verify user access as member', async () => {
      prisma.recurringTransaction.findFirst.mockResolvedValue(null);
      prisma.recurringTransaction.create.mockResolvedValue({
        ...mockRecurring,
        ...createDto,
      } as any);

      await service.create('space-123', 'user-123', createDto as any);

      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        'user-123',
        'space-123',
        'member'
      );
    });

    it('should create with confidence 1.0 for manual creation', async () => {
      prisma.recurringTransaction.findFirst.mockResolvedValue(null);
      prisma.recurringTransaction.create.mockResolvedValue({
        ...mockRecurring,
        ...createDto,
      } as any);

      await service.create('space-123', 'user-123', createDto as any);

      expect(prisma.recurringTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          confidence: 1.0,
          status: 'confirmed',
          confirmedAt: expect.any(Date),
        }),
      });
    });

    it('should throw ConflictException for duplicate merchant', async () => {
      prisma.recurringTransaction.findFirst.mockResolvedValue(mockRecurring as any);

      await expect(service.create('space-123', 'user-123', createDto as any)).rejects.toThrow(
        ConflictException
      );
    });

    it('should use default amountVariance of 0.1 when not provided', async () => {
      prisma.recurringTransaction.findFirst.mockResolvedValue(null);
      prisma.recurringTransaction.create.mockResolvedValue(mockRecurring as any);

      const dtoNoVariance = { ...createDto, amountVariance: undefined };
      await service.create('space-123', 'user-123', dtoNoVariance as any);

      expect(prisma.recurringTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ amountVariance: 0.1 }),
      });
    });
  });

  describe('update', () => {
    it('should update existing recurring transaction', async () => {
      prisma.recurringTransaction.findFirst.mockResolvedValue(mockRecurring as any);
      prisma.recurringTransaction.update.mockResolvedValue({
        ...mockRecurring,
        merchantName: 'Netflix Premium',
      } as any);

      const result = await service.update('space-123', 'user-123', 'rec-123', {
        merchantName: 'Netflix Premium',
      } as any);

      expect(result.merchantName).toBe('Netflix Premium');
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.recurringTransaction.findFirst.mockResolvedValue(null);

      await expect(
        service.update('space-123', 'user-123', 'missing', { merchantName: 'X' } as any)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('confirm', () => {
    it('should confirm a detected pattern', async () => {
      const detected = { ...mockRecurring, status: 'detected' };
      prisma.recurringTransaction.findFirst.mockResolvedValue(detected as any);
      prisma.recurringTransaction.update.mockResolvedValue({
        ...detected,
        status: 'confirmed',
        confirmedAt: new Date(),
      } as any);

      const result = await service.confirm('space-123', 'user-123', 'rec-123', {} as any);

      expect(prisma.recurringTransaction.update).toHaveBeenCalledWith({
        where: { id: 'rec-123' },
        data: expect.objectContaining({ status: 'confirmed', confirmedAt: expect.any(Date) }),
      });
      expect(result.status).toBe('confirmed');
    });

    it('should throw ConflictException for non-detected patterns', async () => {
      prisma.recurringTransaction.findFirst.mockResolvedValue(mockRecurring as any); // already confirmed

      await expect(service.confirm('space-123', 'user-123', 'rec-123', {} as any)).rejects.toThrow(
        ConflictException
      );
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.recurringTransaction.findFirst.mockResolvedValue(null);

      await expect(service.confirm('space-123', 'user-123', 'missing', {} as any)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('dismiss', () => {
    it('should set status to dismissed with timestamp', async () => {
      prisma.recurringTransaction.findFirst.mockResolvedValue(mockRecurring as any);
      prisma.recurringTransaction.update.mockResolvedValue({
        ...mockRecurring,
        status: 'dismissed',
        dismissedAt: new Date(),
      } as any);

      const result = await service.dismiss('space-123', 'user-123', 'rec-123');

      expect(prisma.recurringTransaction.update).toHaveBeenCalledWith({
        where: { id: 'rec-123' },
        data: { status: 'dismissed', dismissedAt: expect.any(Date) },
      });
      expect(result.status).toBe('dismissed');
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.recurringTransaction.findFirst.mockResolvedValue(null);

      await expect(service.dismiss('space-123', 'user-123', 'missing')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('togglePause', () => {
    it('should toggle confirmed to paused', async () => {
      prisma.recurringTransaction.findFirst.mockResolvedValue(mockRecurring as any);
      prisma.recurringTransaction.update.mockResolvedValue({
        ...mockRecurring,
        status: 'paused',
      } as any);

      const result = await service.togglePause('space-123', 'user-123', 'rec-123');

      expect(prisma.recurringTransaction.update).toHaveBeenCalledWith({
        where: { id: 'rec-123' },
        data: { status: 'paused' },
      });
      expect(result.status).toBe('paused');
    });

    it('should toggle paused to confirmed', async () => {
      const paused = { ...mockRecurring, status: 'paused' };
      prisma.recurringTransaction.findFirst.mockResolvedValue(paused as any);
      prisma.recurringTransaction.update.mockResolvedValue({
        ...paused,
        status: 'confirmed',
      } as any);

      const result = await service.togglePause('space-123', 'user-123', 'rec-123');

      expect(prisma.recurringTransaction.update).toHaveBeenCalledWith({
        where: { id: 'rec-123' },
        data: { status: 'confirmed' },
      });
      expect(result.status).toBe('confirmed');
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.recurringTransaction.findFirst.mockResolvedValue(null);

      await expect(service.togglePause('space-123', 'user-123', 'missing')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('remove', () => {
    it('should unlink transactions and delete pattern', async () => {
      prisma.recurringTransaction.findFirst.mockResolvedValue(mockRecurring as any);
      prisma.transaction.updateMany.mockResolvedValue({ count: 5 });
      prisma.recurringTransaction.delete.mockResolvedValue(mockRecurring as any);

      await service.remove('space-123', 'user-123', 'rec-123');

      expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
        where: { recurringId: 'rec-123' },
        data: { recurringId: null },
      });
      expect(prisma.recurringTransaction.delete).toHaveBeenCalledWith({
        where: { id: 'rec-123' },
      });
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.recurringTransaction.findFirst.mockResolvedValue(null);

      await expect(service.remove('space-123', 'user-123', 'missing')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('detectAndStore', () => {
    it('should verify member access', async () => {
      detectorService.detectPatterns.mockResolvedValue([]);

      await service.detectAndStore('space-123', 'user-123');

      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        'user-123',
        'space-123',
        'member'
      );
    });

    it('should create recurring transactions from detected patterns', async () => {
      const patterns = [
        {
          merchantName: 'Netflix',
          averageAmount: 15.99,
          amountVariance: 0.05,
          currency: 'USD',
          suggestedFrequency: 'monthly',
          lastOccurrence: '2026-02-01',
          occurrenceCount: 4,
          confidence: 0.85,
          transactions: [{ id: 'txn-1' }, { id: 'txn-2' }],
        },
      ];
      detectorService.detectPatterns.mockResolvedValue(patterns as any);
      detectorService.calculateNextExpected.mockReturnValue(new Date('2026-03-01'));
      prisma.recurringTransaction.create.mockResolvedValue({
        ...mockRecurring,
        status: 'detected',
      } as any);
      prisma.transaction.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.detectAndStore('space-123', 'user-123');

      expect(result.detected).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(prisma.recurringTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'detected',
          merchantName: 'Netflix',
          confidence: 0.85,
        }),
      });
    });

    it('should link detected transactions to recurring record', async () => {
      const patterns = [
        {
          merchantName: 'Spotify',
          averageAmount: 9.99,
          amountVariance: 0,
          currency: 'USD',
          suggestedFrequency: 'monthly',
          lastOccurrence: '2026-02-15',
          occurrenceCount: 3,
          confidence: 0.9,
          transactions: [{ id: 'txn-10' }, { id: 'txn-11' }],
        },
      ];
      detectorService.detectPatterns.mockResolvedValue(patterns as any);
      detectorService.calculateNextExpected.mockReturnValue(new Date());
      prisma.recurringTransaction.create.mockResolvedValue(mockRecurring as any);
      prisma.transaction.updateMany.mockResolvedValue({ count: 2 });

      await service.detectAndStore('space-123', 'user-123');

      expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['txn-10', 'txn-11'] } },
        data: { recurringId: mockRecurring.id },
      });
    });

    it('should skip duplicate patterns silently (P2002 error)', async () => {
      const patterns = [
        {
          merchantName: 'Netflix',
          averageAmount: 15.99,
          amountVariance: 0,
          currency: 'USD',
          suggestedFrequency: 'monthly',
          lastOccurrence: '2026-02-01',
          occurrenceCount: 3,
          confidence: 0.8,
          transactions: [],
        },
      ];
      detectorService.detectPatterns.mockResolvedValue(patterns as any);
      detectorService.calculateNextExpected.mockReturnValue(new Date());
      prisma.recurringTransaction.create.mockRejectedValue({ code: 'P2002' });

      const result = await service.detectAndStore('space-123', 'user-123');

      expect(result.detected).toHaveLength(0);
      expect(result.total).toBe(1);
    });

    it('should rethrow non-P2002 errors', async () => {
      const patterns = [
        {
          merchantName: 'Netflix',
          averageAmount: 15.99,
          amountVariance: 0,
          currency: 'USD',
          suggestedFrequency: 'monthly',
          lastOccurrence: '2026-02-01',
          occurrenceCount: 3,
          confidence: 0.8,
          transactions: [],
        },
      ];
      detectorService.detectPatterns.mockResolvedValue(patterns as any);
      detectorService.calculateNextExpected.mockReturnValue(new Date());
      prisma.recurringTransaction.create.mockRejectedValue(new Error('DB crashed'));

      await expect(service.detectAndStore('space-123', 'user-123')).rejects.toThrow('DB crashed');
    });

    it('should return empty results when no patterns detected', async () => {
      detectorService.detectPatterns.mockResolvedValue([]);

      const result = await service.detectAndStore('space-123', 'user-123');

      expect(result.detected).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getSummary', () => {
    it('should calculate monthly total for monthly frequency', async () => {
      prisma.recurringTransaction.findMany
        .mockResolvedValueOnce([
          { ...mockRecurring, frequency: 'monthly', expectedAmount: 50 },
        ] as any) // confirmed
        .mockResolvedValueOnce([] as any); // upcoming
      prisma.recurringTransaction.count.mockResolvedValue(2);

      const result = await service.getSummary('space-123', 'user-123');

      expect(result.totalMonthly).toBe(50);
      expect(result.totalAnnual).toBe(600);
    });

    it('should calculate monthly total for weekly frequency', async () => {
      prisma.recurringTransaction.findMany
        .mockResolvedValueOnce([
          { ...mockRecurring, frequency: 'weekly', expectedAmount: 10 },
        ] as any)
        .mockResolvedValueOnce([] as any);
      prisma.recurringTransaction.count.mockResolvedValue(0);

      const result = await service.getSummary('space-123', 'user-123');

      expect(result.totalMonthly).toBeCloseTo(43.3, 0);
    });

    it('should calculate monthly total for yearly frequency', async () => {
      prisma.recurringTransaction.findMany
        .mockResolvedValueOnce([
          { ...mockRecurring, frequency: 'yearly', expectedAmount: 120 },
        ] as any)
        .mockResolvedValueOnce([] as any);
      prisma.recurringTransaction.count.mockResolvedValue(0);

      const result = await service.getSummary('space-123', 'user-123');

      expect(result.totalMonthly).toBe(10);
    });

    it('should calculate monthly total for daily frequency', async () => {
      prisma.recurringTransaction.findMany
        .mockResolvedValueOnce([{ ...mockRecurring, frequency: 'daily', expectedAmount: 5 }] as any)
        .mockResolvedValueOnce([] as any);
      prisma.recurringTransaction.count.mockResolvedValue(0);

      const result = await service.getSummary('space-123', 'user-123');

      expect(result.totalMonthly).toBe(150);
    });

    it('should calculate monthly total for biweekly frequency', async () => {
      prisma.recurringTransaction.findMany
        .mockResolvedValueOnce([
          { ...mockRecurring, frequency: 'biweekly', expectedAmount: 100 },
        ] as any)
        .mockResolvedValueOnce([] as any);
      prisma.recurringTransaction.count.mockResolvedValue(0);

      const result = await service.getSummary('space-123', 'user-123');

      expect(result.totalMonthly).toBeCloseTo(217, 0);
    });

    it('should calculate monthly total for quarterly frequency', async () => {
      prisma.recurringTransaction.findMany
        .mockResolvedValueOnce([
          { ...mockRecurring, frequency: 'quarterly', expectedAmount: 300 },
        ] as any)
        .mockResolvedValueOnce([] as any);
      prisma.recurringTransaction.count.mockResolvedValue(0);

      const result = await service.getSummary('space-123', 'user-123');

      expect(result.totalMonthly).toBe(100);
    });

    it('should include detected count and upcoming list', async () => {
      prisma.recurringTransaction.findMany
        .mockResolvedValueOnce([mockRecurring] as any) // confirmed
        .mockResolvedValueOnce([mockRecurring] as any); // upcoming
      prisma.recurringTransaction.count.mockResolvedValue(3);

      const result = await service.getSummary('space-123', 'user-123');

      expect(result.activeCount).toBe(1);
      expect(result.detectedCount).toBe(3);
      expect(result.upcomingThisMonth).toHaveLength(1);
    });

    it('should calculate daysUntil for upcoming items', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      const upcomingItem = { ...mockRecurring, nextExpected: futureDate };

      prisma.recurringTransaction.findMany
        .mockResolvedValueOnce([] as any)
        .mockResolvedValueOnce([upcomingItem] as any);
      prisma.recurringTransaction.count.mockResolvedValue(0);

      const result = await service.getSummary('space-123', 'user-123');

      expect(result.upcomingThisMonth[0].daysUntil).toBeGreaterThanOrEqual(4);
      expect(result.upcomingThisMonth[0].daysUntil).toBeLessThanOrEqual(6);
    });
  });
});
