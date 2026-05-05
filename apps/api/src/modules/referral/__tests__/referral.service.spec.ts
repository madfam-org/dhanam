import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../core/prisma/prisma.service';
import { QueueService } from '../../jobs/queue.service';
import { AmbassadorService } from '../ambassador.service';
import { ReferralService } from '../referral.service';

describe('ReferralService', () => {
  let service: ReferralService;
  let prisma: jest.Mocked<PrismaService>;
  let ambassadorService: jest.Mocked<AmbassadorService>;
  let queueService: jest.Mocked<QueueService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralService,
        {
          provide: PrismaService,
          useValue: {
            referralReward: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
            },
            // $transaction(array) returns the resolved values of each
            // promise in order — mock by awaiting the input.
            $transaction: jest
              .fn()
              .mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
          },
        },
        {
          provide: AmbassadorService,
          useValue: {
            getProfile: jest.fn(),
            recalculateTier: jest.fn(),
          },
        },
        {
          provide: QueueService,
          useValue: {
            addReferralRewardJob: jest.fn().mockResolvedValue({ id: 'job-stub' }),
          },
        },
      ],
    }).compile();

    service = module.get<ReferralService>(ReferralService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    ambassadorService = module.get(AmbassadorService) as jest.Mocked<AmbassadorService>;
    queueService = module.get(QueueService) as jest.Mocked<QueueService>;

    jest.clearAllMocks();
    queueService.addReferralRewardJob.mockResolvedValue({ id: 'job-stub' } as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── handleConversionWebhook ────────────────────────────────────────

  describe('handleConversionWebhook', () => {
    const conversionData = {
      referral_code: 'KRF-ABCD1234',
      referrer_user_id: 'referrer-1',
      referred_user_id: 'referred-1',
      source_product: 'karafiel',
      target_product: 'dhanam',
      plan_id: 'pro',
      revenue_cents: 1199,
    };

    /**
     * Stub `prisma.referralReward.create` so each call resolves to a row
     * matching the input plus a synthetic id. The test then asserts on
     * call args via the standard jest mock instance.
     */
    function mockCreateRewardsWithIds(): void {
      let counter = 0;
      (prisma.referralReward.create as jest.Mock).mockImplementation((args: any) => {
        counter += 1;
        return Promise.resolve({
          id: `reward-${counter}`,
          recipientUserId: args.data.recipientUserId,
          rewardType: args.data.rewardType,
        });
      });
    }

    it('should create 3 rewards and recalculate tier', async () => {
      prisma.referralReward.findFirst.mockResolvedValue(null);
      mockCreateRewardsWithIds();
      ambassadorService.recalculateTier.mockResolvedValue({
        previousTier: 'none',
        newTier: 'bronze',
        promoted: true,
      });

      const result = await service.handleConversionWebhook(conversionData);

      expect(result.rewards_created).toBe(3);
      expect(result.ambassador_tier).toBe('bronze');

      expect(prisma.referralReward.create).toHaveBeenCalledTimes(3);
      const createCalls = (prisma.referralReward.create as jest.Mock).mock.calls.map(
        (c: any[]) => c[0]
      );
      expect(createCalls.map((c: any) => c.data)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            referralId: 'KRF-ABCD1234',
            recipientUserId: 'referrer-1',
            rewardType: 'subscription_extension',
            amount: 1,
          }),
          expect.objectContaining({
            referralId: 'KRF-ABCD1234',
            recipientUserId: 'referrer-1',
            rewardType: 'credit_grant',
            amount: 50,
          }),
          expect.objectContaining({
            referralId: 'KRF-ABCD1234',
            recipientUserId: 'referred-1',
            rewardType: 'credit_grant',
            amount: 50,
          }),
        ])
      );

      expect(ambassadorService.recalculateTier).toHaveBeenCalledWith('referrer-1');
    });

    it('should skip duplicate conversion and return 0 rewards', async () => {
      prisma.referralReward.findFirst.mockResolvedValue({
        id: 'existing-reward',
        referralId: 'KRF-ABCD1234',
        recipientUserId: 'referrer-1',
        rewardType: 'subscription_extension',
      } as any);

      ambassadorService.getProfile.mockResolvedValue({
        id: 'prof-1',
        tier: 'silver',
        totalReferrals: 8,
        totalConversions: 6,
        lifetimeCreditsEarned: 300,
        lifetimeMonthsEarned: 6,
        discountPercent: 10,
        publicProfile: false,
        displayName: null,
        nextTier: 'gold',
        conversionsToNextTier: 4,
      });

      const result = await service.handleConversionWebhook(conversionData);

      expect(result.rewards_created).toBe(0);
      expect(result.ambassador_tier).toBe('silver');
      expect(prisma.referralReward.create).not.toHaveBeenCalled();
      expect(ambassadorService.recalculateTier).not.toHaveBeenCalled();
      // Idempotency: a duplicate webhook MUST NOT enqueue any apply jobs.
      expect(queueService.addReferralRewardJob).not.toHaveBeenCalled();
    });

    it('should include source and target product in reward metadata', async () => {
      prisma.referralReward.findFirst.mockResolvedValue(null);
      mockCreateRewardsWithIds();
      ambassadorService.recalculateTier.mockResolvedValue({
        previousTier: 'bronze',
        newTier: 'bronze',
        promoted: false,
      });

      await service.handleConversionWebhook(conversionData);

      const createCalls = (prisma.referralReward.create as jest.Mock).mock.calls.map(
        (c: any[]) => c[0]
      );
      for (const call of createCalls) {
        expect(call.data.metadata).toEqual({
          source_product: 'karafiel',
          target_product: 'dhanam',
        });
      }
    });

    // ─── Auto-enqueue contract ────────────────────────────────────────

    it('should enqueue one BullMQ job per created reward', async () => {
      prisma.referralReward.findFirst.mockResolvedValue(null);
      mockCreateRewardsWithIds();
      ambassadorService.recalculateTier.mockResolvedValue({
        previousTier: 'none',
        newTier: 'bronze',
        promoted: true,
      });

      await service.handleConversionWebhook(conversionData);

      expect(queueService.addReferralRewardJob).toHaveBeenCalledTimes(3);
      const enqueueCalls = queueService.addReferralRewardJob.mock.calls.map((c) => c[0]);
      expect(enqueueCalls).toEqual(
        expect.arrayContaining([
          {
            rewardId: 'reward-1',
            recipientUserId: 'referrer-1',
            rewardType: 'subscription_extension',
            referralId: 'KRF-ABCD1234',
          },
          {
            rewardId: 'reward-2',
            recipientUserId: 'referrer-1',
            rewardType: 'credit_grant',
            referralId: 'KRF-ABCD1234',
          },
          {
            rewardId: 'reward-3',
            recipientUserId: 'referred-1',
            rewardType: 'credit_grant',
            referralId: 'KRF-ABCD1234',
          },
        ])
      );
    });

    it('should not throw when the queue is unreachable — cron sweep is the safety net', async () => {
      prisma.referralReward.findFirst.mockResolvedValue(null);
      mockCreateRewardsWithIds();
      ambassadorService.recalculateTier.mockResolvedValue({
        previousTier: 'none',
        newTier: 'bronze',
        promoted: true,
      });
      queueService.addReferralRewardJob.mockRejectedValue(new Error('redis unreachable'));

      const result = await service.handleConversionWebhook(conversionData);

      // Reward rows still created + tier still recalculated. The cron
      // sweep (ReferralRewardJob) will pick up the unapplied rewards.
      expect(result.rewards_created).toBe(3);
      expect(result.ambassador_tier).toBe('bronze');
      expect(ambassadorService.recalculateTier).toHaveBeenCalledWith('referrer-1');
    });

    it('should treat a null queue response as a benign skip (test/no-redis env)', async () => {
      prisma.referralReward.findFirst.mockResolvedValue(null);
      mockCreateRewardsWithIds();
      ambassadorService.recalculateTier.mockResolvedValue({
        previousTier: 'none',
        newTier: 'bronze',
        promoted: false,
      });
      queueService.addReferralRewardJob.mockResolvedValue(null);

      const result = await service.handleConversionWebhook(conversionData);

      expect(result.rewards_created).toBe(3);
      expect(queueService.addReferralRewardJob).toHaveBeenCalledTimes(3);
    });
  });

  // ─── getRewards ─────────────────────────────────────────────────────

  describe('getRewards', () => {
    it('should return reward history for a user', async () => {
      const rewards = [
        {
          id: 'rw-1',
          rewardType: 'credit_grant',
          amount: 50,
          description: 'Referral bonus',
          applied: true,
          appliedAt: new Date(),
          createdAt: new Date(),
        },
      ];

      prisma.referralReward.findMany.mockResolvedValue(rewards as any);

      const result = await service.getRewards('user-1');

      expect(result).toEqual(rewards);
      expect(prisma.referralReward.findMany).toHaveBeenCalledWith({
        where: { recipientUserId: 'user-1' },
        select: {
          id: true,
          rewardType: true,
          amount: true,
          description: true,
          applied: true,
          appliedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when user has no rewards', async () => {
      prisma.referralReward.findMany.mockResolvedValue([]);

      const result = await service.getRewards('user-no-rewards');

      expect(result).toEqual([]);
    });
  });
});
