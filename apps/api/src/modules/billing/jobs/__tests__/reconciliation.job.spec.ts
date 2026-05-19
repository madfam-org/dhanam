import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../../core/prisma/prisma.service';
import { ReconciliationJob } from '../reconciliation.job';

// Mock the Stripe constructor so we can control the subscriptions.list response
const mockSubscriptionsList = jest.fn();
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    subscriptions: {
      list: mockSubscriptionsList,
    },
  }));
});

describe('ReconciliationJob', () => {
  let job: ReconciliationJob;
  let prisma: jest.Mocked<PrismaService>;

  const subscribedUser = {
    id: 'user-sub-1',
    email: 'subscribed@example.com',
    subscriptionTier: 'pro',
    stripeCustomerId: 'cus_active123',
    subscriptionExpiresAt: new Date('2026-12-31'),
  };

  const anotherSubscribedUser = {
    id: 'user-sub-2',
    email: 'another@example.com',
    subscriptionTier: 'essentials',
    stripeCustomerId: 'cus_essentials456',
    subscriptionExpiresAt: new Date('2026-06-30'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconciliationJob,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findMany: jest.fn(),
            },
            billingEvent: {
              create: jest.fn(),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'STRIPE_SECRET_KEY') return 'sk_test_mock';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    job = module.get<ReconciliationJob>(ReconciliationJob);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  it('should be defined', () => {
    expect(job).toBeDefined();
  });

  describe('reconcile', () => {
    it('should flag mismatch when local says subscribed but Stripe has no active subscription', async () => {
      // Arrange: local DB returns a user with an active subscription
      prisma.user.findMany.mockResolvedValue([subscribedUser] as any);

      // Stripe returns no active subscriptions for this customer
      mockSubscriptionsList.mockResolvedValue({ data: [] });

      prisma.billingEvent.create.mockResolvedValue({} as any);

      // Act
      await job.reconcile();

      // Assert: Stripe was queried for this customer
      expect(mockSubscriptionsList).toHaveBeenCalledWith({
        customer: 'cus_active123',
        status: 'active',
        limit: 1,
      });

      // Assert: a reconciliation_mismatch BillingEvent was created
      expect(prisma.billingEvent.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-sub-1',
          type: 'reconciliation_mismatch',
          amount: 0,
          currency: 'USD',
          status: 'flagged',
          metadata: {
            type: 'local_active_stripe_inactive',
            localTier: 'pro',
            stripeStatus: 'no_active_subscription',
          },
        },
      });
    });

    it('should not flag when local and Stripe agree on active subscription', async () => {
      // Arrange
      prisma.user.findMany.mockResolvedValue([subscribedUser] as any);

      // Stripe returns an active subscription
      mockSubscriptionsList.mockResolvedValue({
        data: [
          {
            id: 'sub_123',
            status: 'active',
            items: { data: [{ price: { id: 'price_pro' } }] },
          },
        ],
      });

      // Act
      await job.reconcile();

      // Assert: no mismatch flagged
      expect(prisma.billingEvent.create).not.toHaveBeenCalled();
    });

    it('should handle Stripe API errors gracefully without throwing', async () => {
      // Arrange
      prisma.user.findMany.mockResolvedValue([subscribedUser] as any);
      mockSubscriptionsList.mockRejectedValue(new Error('Stripe rate limited'));

      // Act & Assert: should not throw
      await expect(job.reconcile()).resolves.not.toThrow();

      // No mismatch event should be created on error
      expect(prisma.billingEvent.create).not.toHaveBeenCalled();
    });

    it('should process multiple users and count mismatches correctly', async () => {
      // Arrange: two subscribed users
      prisma.user.findMany.mockResolvedValue([subscribedUser, anotherSubscribedUser] as any);

      // First user: no Stripe subscription (mismatch)
      // Second user: has Stripe subscription (match)
      mockSubscriptionsList.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({
        data: [
          {
            id: 'sub_456',
            status: 'active',
            items: { data: [{ price: { id: 'price_essentials' } }] },
          },
        ],
      });

      prisma.billingEvent.create.mockResolvedValue({} as any);

      // Act
      await job.reconcile();

      // Assert: only one mismatch flagged (the first user)
      expect(prisma.billingEvent.create).toHaveBeenCalledTimes(1);
      expect(prisma.billingEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-sub-1',
          type: 'reconciliation_mismatch',
        }),
      });
    });

    it('should do nothing when no subscribed users exist', async () => {
      // Arrange
      prisma.user.findMany.mockResolvedValue([]);

      // Act
      await job.reconcile();

      // Assert
      expect(mockSubscriptionsList).not.toHaveBeenCalled();
      expect(prisma.billingEvent.create).not.toHaveBeenCalled();
    });

    it('should flag mismatch when Stripe has active sub but local has no tier', async () => {
      // This scenario tests the stripe_active_local_inactive path.
      // It requires a user with stripeCustomerId and subscriptionTier set (per
      // the findMany where clause), but the reconciliation logic only enters
      // the stripe_active_local_inactive branch when !user.subscriptionTier.
      // In practice this can happen if the tier field is set to an empty string
      // or was cleared between the findMany and Stripe call, or if the where
      // clause is loosened. We test the branch with a minimal mock.
      const userNoTier = {
        id: 'user-no-tier',
        email: 'notier@example.com',
        subscriptionTier: null,
        stripeCustomerId: 'cus_ghost789',
        subscriptionExpiresAt: null,
      };

      prisma.user.findMany.mockResolvedValue([userNoTier] as any);

      mockSubscriptionsList.mockResolvedValue({
        data: [
          {
            id: 'sub_ghost',
            status: 'active',
            items: { data: [{ price: { id: 'price_pro' } }] },
          },
        ],
      });

      prisma.billingEvent.create.mockResolvedValue({} as any);

      await job.reconcile();

      expect(prisma.billingEvent.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-no-tier',
          type: 'reconciliation_mismatch',
          amount: 0,
          currency: 'USD',
          status: 'flagged',
          metadata: {
            type: 'stripe_active_local_inactive',
            stripeStatus: 'active',
            stripePlan: 'price_pro',
          },
        },
      });
    });
  });
});
