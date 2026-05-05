import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../core/prisma/prisma.service';
import { StripeService } from '../../billing/stripe.service';
import { ReferralRewardService } from '../referral-reward.service';

/**
 * =============================================================================
 * ReferralRewardService.applyReward — fallback paths
 * =============================================================================
 * Most of the apply behaviour is covered indirectly via the processor + cron
 * tests. This suite focuses on the "Stripe unavailable" fallback the audit
 * called out: when StripeService.isConfigured() === false (or the user
 * has no stripeCustomerId), the local-DB subscription extension path
 * must still run cleanly and the reward must end up applied=true.
 * =============================================================================
 */
describe('ReferralRewardService — Stripe-unavailable fallback', () => {
  let service: ReferralRewardService;
  let prisma: any;
  let stripe: jest.Mocked<StripeService>;

  beforeEach(async () => {
    prisma = {
      referralReward: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      creditBalance: {
        update: jest.fn(),
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralRewardService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: StripeService,
          useValue: { isConfigured: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(ReferralRewardService);
    stripe = module.get(StripeService) as jest.Mocked<StripeService>;
  });

  it('marks subscription_extension reward as applied even when Stripe is not configured', async () => {
    // Stripe stub returns false → the service should skip Stripe and
    // still write applied=true via the local-DB extension path.
    stripe.isConfigured.mockReturnValue(false);

    prisma.referralReward.findUnique.mockResolvedValue({
      id: 'reward-sub-1',
      recipientUserId: 'user-1',
      rewardType: 'subscription_extension',
      amount: 1,
      applied: false,
      stripeActionId: null,
    });
    prisma.referralReward.update.mockResolvedValue({});

    const result = await service.applyReward('reward-sub-1');

    expect(result.applied).toBe(true);
    // Reward row marked applied=true with applied_at timestamp.
    expect(prisma.referralReward.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'reward-sub-1' },
        data: expect.objectContaining({
          applied: true,
          appliedAt: expect.any(Date),
        }),
      })
    );
  });

  it('marks subscription_extension reward as applied when user has no Stripe customer id', async () => {
    stripe.isConfigured.mockReturnValue(true);

    prisma.referralReward.findUnique.mockResolvedValue({
      id: 'reward-sub-2',
      recipientUserId: 'user-2',
      rewardType: 'subscription_extension',
      amount: 1,
      applied: false,
      stripeActionId: null,
    });

    // First user lookup (Stripe customer id check) → no Stripe customer.
    prisma.user.findUnique.mockResolvedValueOnce({ stripeCustomerId: null });
    prisma.referralReward.update.mockResolvedValue({});

    const result = await service.applyReward('reward-sub-2');

    expect(result.applied).toBe(true);
    expect(prisma.referralReward.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'reward-sub-2' },
        data: expect.objectContaining({ applied: true }),
      })
    );
  });

  it('extends user.subscriptionExpiresAt locally when no expiry is set yet', async () => {
    stripe.isConfigured.mockReturnValue(true);

    prisma.referralReward.findUnique.mockResolvedValue({
      id: 'reward-sub-3',
      recipientUserId: 'user-3',
      rewardType: 'subscription_extension',
      amount: 2, // 2 months
      applied: false,
      stripeActionId: null,
    });

    prisma.user.findUnique
      .mockResolvedValueOnce({ stripeCustomerId: 'cus_x' })
      .mockResolvedValueOnce({ subscriptionExpiresAt: null });
    prisma.user.update.mockResolvedValue({});
    prisma.referralReward.update.mockResolvedValue({});

    const result = await service.applyReward('reward-sub-3');

    expect(result.applied).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-3' },
        data: expect.objectContaining({
          subscriptionExpiresAt: expect.any(Date),
        }),
      })
    );
  });

  it('short-circuits when reward is already applied (idempotent re-run)', async () => {
    prisma.referralReward.findUnique.mockResolvedValue({
      id: 'reward-already',
      recipientUserId: 'user-1',
      rewardType: 'credit_grant',
      amount: 50,
      applied: true,
      stripeActionId: null,
    });

    const result = await service.applyReward('reward-already');

    expect(result.applied).toBe(true);
    // No further mutations.
    expect(prisma.referralReward.update).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.creditBalance.update).not.toHaveBeenCalled();
    expect(prisma.creditBalance.upsert).not.toHaveBeenCalled();
  });
});
