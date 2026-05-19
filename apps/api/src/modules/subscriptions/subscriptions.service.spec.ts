import { NotFoundException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { createPrismaMock, createLoggerMock } from '../../../test/helpers/api-mock-factory';
import { PrismaService } from '../../core/prisma/prisma.service';
import { SpacesService } from '../spaces/spaces.service';

import { SubscriptionDetectorService } from './subscription-detector.service';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let spacesServiceMock: jest.Mocked<Partial<SpacesService>>;
  let detectorServiceMock: jest.Mocked<Partial<SubscriptionDetectorService>>;

  const testSpaceId = 'space-123';
  const testUserId = 'user-456';
  const testSubId = 'sub-789';

  const mockSubscription = {
    id: testSubId,
    spaceId: testSpaceId,
    serviceName: 'Netflix',
    serviceUrl: 'https://netflix.com',
    serviceIcon: 'netflix-icon',
    category: 'entertainment',
    description: 'Streaming service',
    amount: 15.99,
    currency: 'USD',
    billingCycle: 'monthly',
    nextBillingDate: new Date('2025-02-15'),
    lastBillingDate: new Date('2025-01-15'),
    status: 'active',
    startDate: new Date('2024-01-15'),
    endDate: null,
    trialEndDate: null,
    cancelledAt: null,
    cancellationReason: null,
    annualCost: 191.88,
    usageFrequency: 'daily',
    savingsRecommendation: null,
    alternativeServices: null,
    alertBeforeDays: 3,
    alertEnabled: true,
    notes: null,
    recurringId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prismaMock = createPrismaMock();
    spacesServiceMock = {
      verifyUserAccess: jest.fn().mockResolvedValue(undefined),
    };
    detectorServiceMock = {
      calculateAnnualCost: jest.fn().mockImplementation((amount, cycle) => {
        const multipliers: Record<string, number> = {
          weekly: 52,
          biweekly: 26,
          monthly: 12,
          quarterly: 4,
          yearly: 1,
        };
        return amount * (multipliers[cycle] || 12);
      }),
      generateSavingsRecommendation: jest.fn().mockReturnValue(null),
      detectSubscriptions: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SpacesService, useValue: spacesServiceMock },
        { provide: SubscriptionDetectorService, useValue: detectorServiceMock },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
    (service as any).logger = createLoggerMock();
  });

  describe('findAll', () => {
    it('should return all subscriptions for a space', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([mockSubscription]);

      const result = await service.findAll(testSpaceId, testUserId);

      expect(spacesServiceMock.verifyUserAccess).toHaveBeenCalledWith(
        testUserId,
        testSpaceId,
        'viewer'
      );
      expect(prismaMock.subscription.findMany).toHaveBeenCalledWith({
        where: { spaceId: testSpaceId },
        orderBy: { nextBillingDate: 'asc' },
        include: expect.any(Object),
      });
      expect(result).toHaveLength(1);
      expect(result[0].serviceName).toBe('Netflix');
    });

    it('should filter by status', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([mockSubscription]);

      await service.findAll(testSpaceId, testUserId, { status: 'active' });

      expect(prismaMock.subscription.findMany).toHaveBeenCalledWith({
        where: { spaceId: testSpaceId, status: 'active' },
        orderBy: { nextBillingDate: 'asc' },
        include: expect.any(Object),
      });
    });

    it('should filter by category', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([]);

      await service.findAll(testSpaceId, testUserId, { category: 'entertainment' });

      expect(prismaMock.subscription.findMany).toHaveBeenCalledWith({
        where: { spaceId: testSpaceId, category: 'entertainment' },
        orderBy: { nextBillingDate: 'asc' },
        include: expect.any(Object),
      });
    });

    it('should filter by both status and category', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([]);

      await service.findAll(testSpaceId, testUserId, {
        status: 'active',
        category: 'entertainment',
      });

      expect(prismaMock.subscription.findMany).toHaveBeenCalledWith({
        where: { spaceId: testSpaceId, status: 'active', category: 'entertainment' },
        orderBy: { nextBillingDate: 'asc' },
        include: expect.any(Object),
      });
    });

    it('should transform response correctly', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([mockSubscription]);

      const result = await service.findAll(testSpaceId, testUserId);

      expect(result[0]).toEqual({
        id: testSubId,
        spaceId: testSpaceId,
        serviceName: 'Netflix',
        serviceUrl: 'https://netflix.com',
        serviceIcon: 'netflix-icon',
        category: 'entertainment',
        description: 'Streaming service',
        amount: 15.99,
        currency: 'USD',
        billingCycle: 'monthly',
        nextBillingDate: expect.any(String),
        lastBillingDate: expect.any(String),
        status: 'active',
        startDate: expect.any(String),
        endDate: null,
        trialEndDate: null,
        cancelledAt: null,
        cancellationReason: null,
        annualCost: 191.88,
        usageFrequency: 'daily',
        savingsRecommendation: null,
        alternativeServices: null,
        alertBeforeDays: 3,
        alertEnabled: true,
        notes: null,
        recurringId: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        recurringPattern: null,
      });
    });
  });

  describe('findOne', () => {
    it('should return a subscription with transactions', async () => {
      const subWithRecurring = {
        ...mockSubscription,
        recurringPattern: {
          id: 'rec-1',
          merchantName: 'Netflix',
          occurrenceCount: 12,
          lastOccurrence: new Date(),
          transactions: [{ id: 'txn-1', date: new Date(), amount: 15.99, description: 'Netflix' }],
        },
      };
      prismaMock.subscription.findFirst.mockResolvedValue(subWithRecurring);

      const result = await service.findOne(testSpaceId, testUserId, testSubId);

      expect(spacesServiceMock.verifyUserAccess).toHaveBeenCalledWith(
        testUserId,
        testSpaceId,
        'viewer'
      );
      expect(result.serviceName).toBe('Netflix');
      expect(result.recurringPattern).not.toBeNull();
    });

    it('should throw NotFoundException when subscription not found', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue(null);

      await expect(service.findOne(testSpaceId, testUserId, 'non-existent')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('create', () => {
    const createDto = {
      serviceName: 'Spotify',
      amount: 9.99,
      currency: 'USD',
      billingCycle: 'monthly' as const,
      startDate: '2025-01-15',
    };

    beforeEach(() => {
      prismaMock.subscription.findFirst.mockResolvedValue(null);
      prismaMock.subscription.create.mockResolvedValue({
        ...mockSubscription,
        id: 'new-sub',
        serviceName: 'Spotify',
        amount: 9.99,
        annualCost: 119.88,
      });
    });

    it('should create a new subscription', async () => {
      const result = await service.create(testSpaceId, testUserId, createDto);

      expect(spacesServiceMock.verifyUserAccess).toHaveBeenCalledWith(
        testUserId,
        testSpaceId,
        'member'
      );
      expect(detectorServiceMock.calculateAnnualCost).toHaveBeenCalledWith(9.99, 'monthly');
      expect(prismaMock.subscription.create).toHaveBeenCalled();
      expect(result.serviceName).toBe('Spotify');
    });

    it('should throw ConflictException for duplicate active subscription', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue(mockSubscription);

      await expect(service.create(testSpaceId, testUserId, createDto)).rejects.toThrow(
        ConflictException
      );
    });

    it('should validate recurring pattern if provided', async () => {
      prismaMock.subscription.findFirst
        .mockResolvedValueOnce(null) // No existing subscription
        .mockResolvedValueOnce(null); // No existing subscription for recurring

      prismaMock.recurringTransaction.findFirst.mockResolvedValue({ id: 'rec-1' });
      prismaMock.subscription.create.mockResolvedValue({
        ...mockSubscription,
        recurringId: 'rec-1',
      });

      await service.create(testSpaceId, testUserId, { ...createDto, recurringId: 'rec-1' });

      expect(prismaMock.recurringTransaction.findFirst).toHaveBeenCalledWith({
        where: { id: 'rec-1', spaceId: testSpaceId },
      });
    });

    it('should throw NotFoundException for non-existent recurring pattern', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue(null);
      prismaMock.recurringTransaction.findFirst.mockResolvedValue(null);

      await expect(
        service.create(testSpaceId, testUserId, { ...createDto, recurringId: 'non-existent' })
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if recurring pattern already linked', async () => {
      prismaMock.subscription.findFirst
        .mockResolvedValueOnce(null) // No existing subscription by name
        .mockResolvedValueOnce(mockSubscription); // Existing subscription for recurring

      prismaMock.recurringTransaction.findFirst.mockResolvedValue({ id: 'rec-1' });

      await expect(
        service.create(testSpaceId, testUserId, { ...createDto, recurringId: 'rec-1' })
      ).rejects.toThrow(ConflictException);
    });

    it('should set default values for optional fields', async () => {
      await service.create(testSpaceId, testUserId, createDto);

      expect(prismaMock.subscription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          category: 'other',
          status: 'active',
          alertBeforeDays: 3,
          alertEnabled: true,
        }),
      });
    });

    it('should handle all optional fields', async () => {
      const fullDto = {
        ...createDto,
        serviceUrl: 'https://spotify.com',
        serviceIcon: 'spotify-icon',
        category: 'music',
        description: 'Music streaming',
        nextBillingDate: '2025-02-15',
        status: 'trial' as const,
        trialEndDate: '2025-01-30',
        alertBeforeDays: 7,
        alertEnabled: false,
        notes: 'Family plan',
      };

      await service.create(testSpaceId, testUserId, fullDto);

      expect(prismaMock.subscription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          serviceUrl: 'https://spotify.com',
          serviceIcon: 'spotify-icon',
          category: 'music',
          description: 'Music streaming',
          status: 'trial',
          alertBeforeDays: 7,
          alertEnabled: false,
          notes: 'Family plan',
        }),
      });
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prismaMock.subscription.findFirst.mockResolvedValue(mockSubscription);
      prismaMock.subscription.update.mockResolvedValue({
        ...mockSubscription,
        amount: 19.99,
        annualCost: 239.88,
      });
    });

    it('should update a subscription', async () => {
      const result = await service.update(testSpaceId, testUserId, testSubId, { amount: 19.99 });

      expect(spacesServiceMock.verifyUserAccess).toHaveBeenCalledWith(
        testUserId,
        testSpaceId,
        'member'
      );
      expect(prismaMock.subscription.update).toHaveBeenCalled();
      expect(result.amount).toBe(19.99);
    });

    it('should throw NotFoundException for non-existent subscription', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue(null);

      await expect(
        service.update(testSpaceId, testUserId, 'non-existent', { amount: 19.99 })
      ).rejects.toThrow(NotFoundException);
    });

    it('should recalculate annual cost when amount changes', async () => {
      await service.update(testSpaceId, testUserId, testSubId, { amount: 19.99 });

      expect(detectorServiceMock.calculateAnnualCost).toHaveBeenCalledWith(19.99, 'monthly');
    });

    it('should recalculate annual cost when billing cycle changes', async () => {
      await service.update(testSpaceId, testUserId, testSubId, { billingCycle: 'yearly' });

      expect(detectorServiceMock.calculateAnnualCost).toHaveBeenCalledWith(15.99, 'yearly');
    });

    it('should generate savings recommendation when usage frequency is set', async () => {
      detectorServiceMock.generateSavingsRecommendation!.mockReturnValue(
        'Consider cancelling - low usage'
      );

      await service.update(testSpaceId, testUserId, testSubId, { usageFrequency: 'rarely' });

      expect(detectorServiceMock.generateSavingsRecommendation).toHaveBeenCalledWith(
        'Netflix',
        'rarely',
        expect.any(Number)
      );
    });

    it('should only update provided fields', async () => {
      await service.update(testSpaceId, testUserId, testSubId, { serviceName: 'Netflix Premium' });

      const updateCall = prismaMock.subscription.update.mock.calls[0][0];
      expect(updateCall.where).toEqual({ id: testSubId });
      expect(updateCall.data.serviceName).toBe('Netflix Premium');
      expect(updateCall.data.annualCost).toBeDefined();
      // Should not include fields that weren't updated
      expect(updateCall.data.amount).toBeUndefined();
      expect(updateCall.data.billingCycle).toBeUndefined();
    });
  });

  describe('cancel', () => {
    beforeEach(() => {
      prismaMock.subscription.findFirst.mockResolvedValue(mockSubscription);
      prismaMock.subscription.update.mockResolvedValue({
        ...mockSubscription,
        status: 'cancelled',
        cancelledAt: new Date(),
      });
    });

    it('should cancel a subscription', async () => {
      const result = await service.cancel(testSpaceId, testUserId, testSubId, {
        reason: 'Too expensive',
      });

      expect(prismaMock.subscription.update).toHaveBeenCalledWith({
        where: { id: testSubId },
        data: expect.objectContaining({
          status: 'cancelled',
          cancellationReason: 'Too expensive',
        }),
      });
      expect(result.status).toBe('cancelled');
    });

    it('should throw NotFoundException for non-existent subscription', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue(null);

      await expect(service.cancel(testSpaceId, testUserId, 'non-existent', {})).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ConflictException for already cancelled subscription', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue({
        ...mockSubscription,
        status: 'cancelled',
      });

      await expect(service.cancel(testSpaceId, testUserId, testSubId, {})).rejects.toThrow(
        ConflictException
      );
    });

    it('should set end date if provided', async () => {
      await service.cancel(testSpaceId, testUserId, testSubId, {
        reason: 'Switching services',
        endDate: '2025-02-28',
      });

      expect(prismaMock.subscription.update).toHaveBeenCalledWith({
        where: { id: testSubId },
        data: expect.objectContaining({
          endDate: expect.any(Date),
        }),
      });
    });
  });

  describe('pause', () => {
    beforeEach(() => {
      prismaMock.subscription.findFirst.mockResolvedValue(mockSubscription);
      prismaMock.subscription.update.mockResolvedValue({
        ...mockSubscription,
        status: 'paused',
      });
    });

    it('should pause an active subscription', async () => {
      const result = await service.pause(testSpaceId, testUserId, testSubId);

      expect(prismaMock.subscription.update).toHaveBeenCalledWith({
        where: { id: testSubId },
        data: { status: 'paused' },
      });
      expect(result.status).toBe('paused');
    });

    it('should throw NotFoundException for non-existent subscription', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue(null);

      await expect(service.pause(testSpaceId, testUserId, 'non-existent')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ConflictException for non-active subscription', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue({
        ...mockSubscription,
        status: 'cancelled',
      });

      await expect(service.pause(testSpaceId, testUserId, testSubId)).rejects.toThrow(
        ConflictException
      );
    });
  });

  describe('resume', () => {
    beforeEach(() => {
      prismaMock.subscription.findFirst.mockResolvedValue({
        ...mockSubscription,
        status: 'paused',
      });
      prismaMock.subscription.update.mockResolvedValue({
        ...mockSubscription,
        status: 'active',
      });
    });

    it('should resume a paused subscription', async () => {
      const result = await service.resume(testSpaceId, testUserId, testSubId);

      expect(prismaMock.subscription.update).toHaveBeenCalledWith({
        where: { id: testSubId },
        data: { status: 'active' },
      });
      expect(result.status).toBe('active');
    });

    it('should throw NotFoundException for non-existent subscription', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue(null);

      await expect(service.resume(testSpaceId, testUserId, 'non-existent')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ConflictException for non-paused subscription', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue(mockSubscription); // active

      await expect(service.resume(testSpaceId, testUserId, testSubId)).rejects.toThrow(
        ConflictException
      );
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      prismaMock.subscription.findFirst.mockResolvedValue(mockSubscription);
      prismaMock.subscription.delete.mockResolvedValue(mockSubscription);
    });

    it('should delete a subscription', async () => {
      await service.remove(testSpaceId, testUserId, testSubId);

      expect(spacesServiceMock.verifyUserAccess).toHaveBeenCalledWith(
        testUserId,
        testSpaceId,
        'member'
      );
      expect(prismaMock.subscription.delete).toHaveBeenCalledWith({
        where: { id: testSubId },
      });
    });

    it('should throw NotFoundException for non-existent subscription', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue(null);

      await expect(service.remove(testSpaceId, testUserId, 'non-existent')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('detectAndCreate', () => {
    it('should detect and create subscriptions from recurring patterns', async () => {
      const detectedSubs = [
        {
          serviceName: 'Spotify',
          serviceUrl: 'https://spotify.com',
          serviceIcon: 'spotify-icon',
          category: 'music',
          amount: 9.99,
          currency: 'USD',
          billingCycle: 'monthly',
          nextBillingDate: new Date('2025-02-15'),
          lastBillingDate: new Date('2025-01-15'),
          recurringId: 'rec-1',
        },
      ];

      detectorServiceMock.detectSubscriptions!.mockResolvedValue(detectedSubs);
      prismaMock.subscription.create.mockResolvedValue({
        ...mockSubscription,
        serviceName: 'Spotify',
      });

      const result = await service.detectAndCreate(testSpaceId, testUserId);

      expect(detectorServiceMock.detectSubscriptions).toHaveBeenCalledWith(testSpaceId);
      expect(prismaMock.subscription.create).toHaveBeenCalledTimes(1);
      expect(result.detected).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should skip duplicate subscriptions silently', async () => {
      const detectedSubs = [
        { serviceName: 'Spotify', amount: 9.99, currency: 'USD', billingCycle: 'monthly' },
        { serviceName: 'Netflix', amount: 15.99, currency: 'USD', billingCycle: 'monthly' },
      ];

      detectorServiceMock.detectSubscriptions!.mockResolvedValue(detectedSubs);
      prismaMock.subscription.create
        .mockRejectedValueOnce({ code: 'P2002' }) // Duplicate error
        .mockResolvedValueOnce(mockSubscription);

      const result = await service.detectAndCreate(testSpaceId, testUserId);

      expect(result.detected).toHaveLength(1);
      expect(result.total).toBe(2);
    });

    it('should throw non-duplicate errors', async () => {
      const detectedSubs = [
        { serviceName: 'Spotify', amount: 9.99, currency: 'USD', billingCycle: 'monthly' },
      ];

      detectorServiceMock.detectSubscriptions!.mockResolvedValue(detectedSubs);
      prismaMock.subscription.create.mockRejectedValue(new Error('Database error'));

      await expect(service.detectAndCreate(testSpaceId, testUserId)).rejects.toThrow(
        'Database error'
      );
    });

    it('should return empty when no subscriptions detected', async () => {
      detectorServiceMock.detectSubscriptions!.mockResolvedValue([]);

      const result = await service.detectAndCreate(testSpaceId, testUserId);

      expect(result.detected).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getSummary', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-15T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return subscription summary', async () => {
      const subscriptions = [
        { ...mockSubscription, category: 'entertainment', annualCost: 191.88 },
        { ...mockSubscription, id: 'sub-2', category: 'entertainment', annualCost: 119.88 },
        { ...mockSubscription, id: 'sub-3', category: 'productivity', annualCost: 99.99 },
      ];

      prismaMock.subscription.findMany
        .mockResolvedValueOnce(subscriptions) // Active subscriptions
        .mockResolvedValueOnce([subscriptions[0]]) // Upcoming
        .mockResolvedValueOnce([]); // With savings

      prismaMock.subscription.groupBy.mockResolvedValue([
        { status: 'active', _count: { status: 3 } },
        { status: 'cancelled', _count: { status: 2 } },
      ]);

      const result = await service.getSummary(testSpaceId, testUserId);

      expect(result.totalAnnual).toBeCloseTo(411.75, 1);
      expect(result.totalMonthly).toBeCloseTo(34.31, 1);
      expect(result.activeCount).toBe(3);
      expect(result.cancelledCount).toBe(2);
      expect(result.byCategory).toHaveLength(2);
    });

    it('should calculate category totals correctly', async () => {
      const subscriptions = [
        { ...mockSubscription, category: 'entertainment', annualCost: 120 },
        { ...mockSubscription, id: 'sub-2', category: 'entertainment', annualCost: 240 },
      ];

      prismaMock.subscription.findMany
        .mockResolvedValueOnce(subscriptions)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      prismaMock.subscription.groupBy.mockResolvedValue([]);

      const result = await service.getSummary(testSpaceId, testUserId);

      const entertainment = result.byCategory.find((c) => c.category === 'entertainment');
      expect(entertainment?.count).toBe(2);
      expect(entertainment?.monthlyTotal).toBe(30); // (120 + 240) / 12
    });

    it('should return upcoming subscriptions this month', async () => {
      const upcoming = [
        { ...mockSubscription, nextBillingDate: new Date('2025-01-20') },
        { ...mockSubscription, id: 'sub-2', nextBillingDate: new Date('2025-01-25') },
      ];

      prismaMock.subscription.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(upcoming)
        .mockResolvedValueOnce([]);
      prismaMock.subscription.groupBy.mockResolvedValue([]);

      const result = await service.getSummary(testSpaceId, testUserId);

      expect(result.upcomingThisMonth).toHaveLength(2);
      expect(result.upcomingThisMonth[0].daysUntil).toBe(5); // Jan 20 - Jan 15
    });

    it('should return savings opportunities', async () => {
      const withSavings = [
        {
          ...mockSubscription,
          savingsRecommendation: 'Consider cancelling - low usage',
          annualCost: 191.88,
        },
      ];

      prismaMock.subscription.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(withSavings);
      prismaMock.subscription.groupBy.mockResolvedValue([]);

      const result = await service.getSummary(testSpaceId, testUserId);

      expect(result.savingsOpportunities).toHaveLength(1);
      expect(result.savingsOpportunities[0].recommendation).toBe('Consider cancelling - low usage');
    });

    it('should handle empty subscriptions', async () => {
      prismaMock.subscription.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      prismaMock.subscription.groupBy.mockResolvedValue([]);

      const result = await service.getSummary(testSpaceId, testUserId);

      expect(result.totalMonthly).toBe(0);
      expect(result.totalAnnual).toBe(0);
      expect(result.activeCount).toBe(0);
      expect(result.byCategory).toHaveLength(0);
    });

    it('should count all subscription statuses', async () => {
      prismaMock.subscription.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      prismaMock.subscription.groupBy.mockResolvedValue([
        { status: 'active', _count: { status: 5 } },
        { status: 'trial', _count: { status: 2 } },
        { status: 'paused', _count: { status: 1 } },
        { status: 'cancelled', _count: { status: 3 } },
      ]);

      const result = await service.getSummary(testSpaceId, testUserId);

      expect(result.activeCount).toBe(5);
      expect(result.trialCount).toBe(2);
      expect(result.pausedCount).toBe(1);
      expect(result.cancelledCount).toBe(3);
    });
  });

  describe('transformToResponse', () => {
    it('should handle null dates correctly', async () => {
      const subWithNulls = {
        ...mockSubscription,
        nextBillingDate: null,
        lastBillingDate: null,
        endDate: null,
        trialEndDate: null,
        cancelledAt: null,
      };

      prismaMock.subscription.findMany.mockResolvedValue([subWithNulls]);

      const result = await service.findAll(testSpaceId, testUserId);

      expect(result[0].nextBillingDate).toBeNull();
      expect(result[0].lastBillingDate).toBeNull();
      expect(result[0].endDate).toBeNull();
    });

    it('should include recurring pattern when present', async () => {
      const subWithPattern = {
        ...mockSubscription,
        recurringPattern: {
          id: 'rec-1',
          merchantName: 'Netflix',
          occurrenceCount: 12,
          lastOccurrence: new Date(),
        },
      };

      prismaMock.subscription.findMany.mockResolvedValue([subWithPattern]);

      const result = await service.findAll(testSpaceId, testUserId);

      expect(result[0].recurringPattern).not.toBeNull();
      expect(result[0].recurringPattern.merchantName).toBe('Netflix');
    });
  });

  describe('access control', () => {
    it('should require viewer access for findAll', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([]);
      await service.findAll(testSpaceId, testUserId);
      expect(spacesServiceMock.verifyUserAccess).toHaveBeenCalledWith(
        testUserId,
        testSpaceId,
        'viewer'
      );
    });

    it('should require viewer access for findOne', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue(mockSubscription);
      await service.findOne(testSpaceId, testUserId, testSubId);
      expect(spacesServiceMock.verifyUserAccess).toHaveBeenCalledWith(
        testUserId,
        testSpaceId,
        'viewer'
      );
    });

    it('should require member access for create', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue(null);
      prismaMock.subscription.create.mockResolvedValue(mockSubscription);
      await service.create(testSpaceId, testUserId, {
        serviceName: 'Test',
        amount: 9.99,
        currency: 'USD',
        billingCycle: 'monthly',
        startDate: '2025-01-15',
      });
      expect(spacesServiceMock.verifyUserAccess).toHaveBeenCalledWith(
        testUserId,
        testSpaceId,
        'member'
      );
    });

    it('should require member access for update', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue(mockSubscription);
      prismaMock.subscription.update.mockResolvedValue(mockSubscription);
      await service.update(testSpaceId, testUserId, testSubId, { amount: 19.99 });
      expect(spacesServiceMock.verifyUserAccess).toHaveBeenCalledWith(
        testUserId,
        testSpaceId,
        'member'
      );
    });

    it('should require member access for cancel', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue(mockSubscription);
      prismaMock.subscription.update.mockResolvedValue({
        ...mockSubscription,
        status: 'cancelled',
      });
      await service.cancel(testSpaceId, testUserId, testSubId, {});
      expect(spacesServiceMock.verifyUserAccess).toHaveBeenCalledWith(
        testUserId,
        testSpaceId,
        'member'
      );
    });

    it('should require member access for remove', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue(mockSubscription);
      prismaMock.subscription.delete.mockResolvedValue(mockSubscription);
      await service.remove(testSpaceId, testUserId, testSubId);
      expect(spacesServiceMock.verifyUserAccess).toHaveBeenCalledWith(
        testUserId,
        testSpaceId,
        'member'
      );
    });

    it('should require viewer access for getSummary', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([]);
      prismaMock.subscription.groupBy.mockResolvedValue([]);
      await service.getSummary(testSpaceId, testUserId);
      expect(spacesServiceMock.verifyUserAccess).toHaveBeenCalledWith(
        testUserId,
        testSpaceId,
        'viewer'
      );
    });
  });
});
