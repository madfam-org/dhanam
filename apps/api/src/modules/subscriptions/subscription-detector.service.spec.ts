import { Test, TestingModule } from '@nestjs/testing';

import { createPrismaMock, createLoggerMock } from '../../../test/helpers/api-mock-factory';
import { PrismaService } from '../../core/prisma/prisma.service';

import { SubscriptionDetectorService } from './subscription-detector.service';

describe('SubscriptionDetectorService', () => {
  let service: SubscriptionDetectorService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  const testSpaceId = 'space-123';

  beforeEach(async () => {
    jest.clearAllMocks();

    prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [SubscriptionDetectorService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<SubscriptionDetectorService>(SubscriptionDetectorService);
    (service as any).logger = createLoggerMock();
  });

  describe('detectSubscriptions', () => {
    it('should detect known subscription services', async () => {
      const recurringPatterns = [
        {
          id: 'recurring-1',
          merchantName: 'Netflix Monthly',
          expectedAmount: 15.99,
          currency: 'USD',
          frequency: 'monthly',
          confidence: 0.95,
          lastOccurrence: new Date('2025-01-01'),
          nextExpected: new Date('2025-02-01'),
        },
      ];

      prismaMock.recurringTransaction.findMany.mockResolvedValue(recurringPatterns);

      const result = await service.detectSubscriptions(testSpaceId);

      expect(result).toHaveLength(1);
      expect(result[0].serviceName).toBe('Netflix');
      expect(result[0].category).toBe('streaming');
      expect(result[0].serviceIcon).toBe('netflix');
      expect(result[0].amount).toBe(15.99);
    });

    it('should detect subscriptions by alias', async () => {
      const recurringPatterns = [
        {
          id: 'recurring-1',
          merchantName: 'SPOTIFY AB',
          expectedAmount: 9.99,
          currency: 'USD',
          frequency: 'monthly',
          confidence: 0.9,
          lastOccurrence: null,
          nextExpected: null,
        },
      ];

      prismaMock.recurringTransaction.findMany.mockResolvedValue(recurringPatterns);

      const result = await service.detectSubscriptions(testSpaceId);

      expect(result).toHaveLength(1);
      expect(result[0].serviceName).toBe('Spotify');
      expect(result[0].category).toBe('music');
    });

    it('should detect multiple known services', async () => {
      const recurringPatterns = [
        {
          id: 'r-1',
          merchantName: 'Netflix.com',
          expectedAmount: 15.99,
          currency: 'USD',
          frequency: 'monthly',
          confidence: 0.95,
          lastOccurrence: null,
          nextExpected: null,
        },
        {
          id: 'r-2',
          merchantName: 'Disney Plus',
          expectedAmount: 7.99,
          currency: 'USD',
          frequency: 'monthly',
          confidence: 0.9,
          lastOccurrence: null,
          nextExpected: null,
        },
        {
          id: 'r-3',
          merchantName: 'GitHub Inc',
          expectedAmount: 4.0,
          currency: 'USD',
          frequency: 'monthly',
          confidence: 0.85,
          lastOccurrence: null,
          nextExpected: null,
        },
      ];

      prismaMock.recurringTransaction.findMany.mockResolvedValue(recurringPatterns);

      const result = await service.detectSubscriptions(testSpaceId);

      expect(result).toHaveLength(3);
      expect(result.map((s) => s.category)).toEqual(
        expect.arrayContaining(['streaming', 'streaming', 'software'])
      );
    });

    it('should detect unknown services via heuristics', async () => {
      const recurringPatterns = [
        {
          id: 'r-1',
          merchantName: 'SomeApp Premium Subscription',
          expectedAmount: 5.99,
          currency: 'USD',
          frequency: 'monthly',
          confidence: 0.8,
          lastOccurrence: null,
          nextExpected: null,
        },
      ];

      prismaMock.recurringTransaction.findMany.mockResolvedValue(recurringPatterns);

      const result = await service.detectSubscriptions(testSpaceId);

      expect(result).toHaveLength(1);
      expect(result[0].serviceName).toBe('Someapp Premium Subscription');
      // Confidence for unknown services is multiplied by 0.8
      expect(result[0].confidence).toBeCloseTo(0.8 * 0.8, 5);
    });

    it('should not detect patterns below confidence threshold', async () => {
      const recurringPatterns = [
        {
          id: 'r-1',
          merchantName: 'Random App',
          expectedAmount: 5.99,
          currency: 'USD',
          frequency: 'monthly',
          confidence: 0.5, // Below 0.7 threshold
          lastOccurrence: null,
          nextExpected: null,
        },
      ];

      prismaMock.recurringTransaction.findMany.mockResolvedValue(recurringPatterns);

      const result = await service.detectSubscriptions(testSpaceId);

      expect(result).toHaveLength(0);
    });

    it('should return empty array when no recurring patterns exist', async () => {
      prismaMock.recurringTransaction.findMany.mockResolvedValue([]);

      const result = await service.detectSubscriptions(testSpaceId);

      expect(result).toHaveLength(0);
    });
  });

  describe('looksLikeSubscription', () => {
    const testCases = [
      { input: 'netflix subscription', expected: true },
      { input: 'monthly plan', expected: true },
      { input: 'annual membership', expected: true },
      { input: 'premium access', expected: true },
      { input: 'pro version', expected: true },
      { input: 'plus plan', expected: true },
      { input: 'membership fee', expected: true },
      { input: 'app.io service', expected: true },
      { input: 'myapp.com billing', expected: true },
      { input: 'cloud storage', expected: true },
      { input: 'digital media', expected: true },
      { input: 'streaming service', expected: true },
      { input: 'grocery store', expected: false },
      { input: 'gas station', expected: false },
      { input: 'restaurant bill', expected: false },
    ];

    it.each(testCases)('should return $expected for "$input"', ({ input, expected }) => {
      const result = (service as any).looksLikeSubscription(input);
      expect(result).toBe(expected);
    });
  });

  describe('guessCategory', () => {
    // Note: Categories are checked in order, so if a term matches multiple, first wins
    // e.g., "invest app" matches 'app' in software before 'invest' in finance
    const testCases: Array<{ input: string; expected: string }> = [
      { input: 'video streaming', expected: 'streaming' },
      { input: 'music player', expected: 'music' },
      { input: 'podcast service', expected: 'music' },
      { input: 'software saas', expected: 'software' },
      { input: 'dev tools', expected: 'software' },
      { input: 'gaming service', expected: 'gaming' },
      { input: 'xbox live', expected: 'gaming' },
      { input: 'news daily times', expected: 'news' },
      { input: 'fitness tracker', expected: 'fitness' },
      { input: 'gym membership', expected: 'fitness' },
      { input: 'food delivery', expected: 'food_delivery' },
      { input: 'cloud storage backup', expected: 'cloud_storage' },
      { input: 'productivity office', expected: 'productivity' },
      { input: 'learn platform', expected: 'education' },
      { input: 'language course', expected: 'education' },
      { input: 'finance tracker', expected: 'finance' },
      { input: 'invest platform', expected: 'finance' },
      { input: 'random unknown service', expected: 'other' },
    ];

    it.each(testCases)('should categorize "$input" as "$expected"', ({ input, expected }) => {
      const result = (service as any).guessCategory(input);
      expect(result).toBe(expected);
    });
  });

  describe('formatServiceName', () => {
    const testCases = [
      { input: 'netflix', expected: 'Netflix' },
      { input: 'SPOTIFY', expected: 'Spotify' },
      { input: 'disney plus', expected: 'Disney Plus' },
      { input: 'new_york_times', expected: 'New York Times' },
      { input: 'some-app-name', expected: 'Some App Name' },
      { input: 'GITHUB INC', expected: 'Github Inc' },
    ];

    it.each(testCases)('should format "$input" as "$expected"', ({ input, expected }) => {
      const result = (service as any).formatServiceName(input);
      expect(result).toBe(expected);
    });
  });

  describe('calculateAnnualCost', () => {
    const testCases = [
      { amount: 1, cycle: 'daily', expected: 365 },
      { amount: 10, cycle: 'weekly', expected: 520 },
      { amount: 50, cycle: 'biweekly', expected: 1300 },
      { amount: 15, cycle: 'monthly', expected: 180 },
      { amount: 30, cycle: 'quarterly', expected: 120 },
      { amount: 100, cycle: 'yearly', expected: 100 },
    ];

    it.each(testCases)(
      'should calculate $amount/$cycle as $expected/year',
      ({ amount, cycle, expected }) => {
        const result = service.calculateAnnualCost(amount, cycle as any);
        expect(result).toBe(expected);
      }
    );

    it('should round to 2 decimal places', () => {
      const result = service.calculateAnnualCost(9.99, 'monthly');
      expect(result).toBe(119.88);
    });
  });

  describe('generateSavingsRecommendation', () => {
    it('should recommend cancellation for low usage', () => {
      const result = service.generateSavingsRecommendation('Netflix', 'low', 180);

      expect(result).toContain('cancelling Netflix');
      expect(result).toContain('$180.00/year');
    });

    it('should recommend annual billing for medium usage with high cost', () => {
      const result = service.generateSavingsRecommendation('Adobe CC', 'medium', 600);

      expect(result).toContain('annual billing discounts');
      expect(result).toContain('Adobe CC');
    });

    it('should return null for high usage', () => {
      const result = service.generateSavingsRecommendation('Spotify', 'high', 120);

      expect(result).toBeNull();
    });

    it('should return null for unknown usage', () => {
      const result = service.generateSavingsRecommendation('Service', 'unknown', 200);

      expect(result).toBeNull();
    });

    it('should return null for null usage', () => {
      const result = service.generateSavingsRecommendation('Service', null, 200);

      expect(result).toBeNull();
    });

    it('should not recommend annual billing for low-cost medium usage', () => {
      const result = service.generateSavingsRecommendation('App', 'medium', 50);

      expect(result).toBeNull();
    });
  });

  describe('determineStatus', () => {
    const now = new Date();
    const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const future = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    it('should return cancelled when cancelledAt is set', () => {
      const result = service.determineStatus(null, past, null);
      expect(result).toBe('cancelled');
    });

    it('should return expired when endDate is in the past', () => {
      const result = service.determineStatus(null, null, past);
      expect(result).toBe('expired');
    });

    it('should return trial when trialEndDate is in the future', () => {
      const result = service.determineStatus(future, null, null);
      expect(result).toBe('trial');
    });

    it('should return active when no special conditions', () => {
      const result = service.determineStatus(null, null, null);
      expect(result).toBe('active');
    });

    it('should return active when trial has ended', () => {
      const result = service.determineStatus(past, null, null);
      expect(result).toBe('active');
    });

    it('should prioritize cancelled over expired', () => {
      const result = service.determineStatus(null, past, past);
      expect(result).toBe('cancelled');
    });

    it('should prioritize expired over trial', () => {
      const result = service.determineStatus(future, null, past);
      expect(result).toBe('expired');
    });
  });

  describe('known services detection', () => {
    const knownServices = [
      { merchant: 'Netflix', category: 'streaming' },
      { merchant: 'Spotify', category: 'music' },
      { merchant: 'Disney+', category: 'streaming' },
      { merchant: 'Amazon Prime', category: 'streaming' },
      { merchant: 'HBO Max', category: 'streaming' },
      { merchant: 'YouTube Premium', category: 'streaming' },
      { merchant: 'Apple Music', category: 'streaming' },
      { merchant: 'GitHub', category: 'software' },
      { merchant: 'Dropbox', category: 'cloud_storage' },
      { merchant: 'Google One', category: 'cloud_storage' },
      { merchant: 'Microsoft 365', category: 'software' },
      { merchant: 'Adobe Creative Cloud', category: 'software' },
      { merchant: 'Notion', category: 'productivity' },
      { merchant: 'Slack', category: 'productivity' },
      { merchant: 'Zoom', category: 'productivity' },
      { merchant: 'New York Times', category: 'news' },
      { merchant: 'WSJ', category: 'news' },
      { merchant: 'Uber Eats', category: 'food_delivery' },
      { merchant: 'DoorDash', category: 'food_delivery' },
      { merchant: 'Rappi', category: 'food_delivery' },
      { merchant: 'Peloton', category: 'fitness' },
      { merchant: 'Headspace', category: 'fitness' },
      { merchant: 'Duolingo', category: 'education' },
      { merchant: 'Coursera', category: 'education' },
    ];

    it.each(knownServices)(
      'should detect $merchant as $category',
      async ({ merchant, category }) => {
        prismaMock.recurringTransaction.findMany.mockResolvedValue([
          {
            id: 'r-1',
            merchantName: merchant,
            expectedAmount: 10,
            currency: 'USD',
            frequency: 'monthly',
            confidence: 0.9,
            lastOccurrence: null,
            nextExpected: null,
          },
        ]);

        const result = await service.detectSubscriptions(testSpaceId);

        expect(result).toHaveLength(1);
        expect(result[0].category).toBe(category);
      }
    );
  });

  describe('analyzeAsSubscription edge cases', () => {
    it('should handle weekly patterns that are not subscriptions', async () => {
      prismaMock.recurringTransaction.findMany.mockResolvedValue([
        {
          id: 'r-1',
          merchantName: 'Unknown Weekly Payment',
          expectedAmount: 50,
          currency: 'USD',
          frequency: 'weekly',
          confidence: 0.8,
          lastOccurrence: null,
          nextExpected: null,
        },
      ]);

      const result = await service.detectSubscriptions(testSpaceId);

      // Weekly patterns without subscription keywords should not be detected
      expect(result).toHaveLength(0);
    });

    it('should detect yearly subscriptions', async () => {
      prismaMock.recurringTransaction.findMany.mockResolvedValue([
        {
          id: 'r-1',
          merchantName: 'Annual Premium Membership',
          expectedAmount: 99,
          currency: 'USD',
          frequency: 'yearly',
          confidence: 0.85,
          lastOccurrence: null,
          nextExpected: null,
        },
      ]);

      const result = await service.detectSubscriptions(testSpaceId);

      expect(result).toHaveLength(1);
      expect(result[0].billingCycle).toBe('yearly');
    });
  });
});
