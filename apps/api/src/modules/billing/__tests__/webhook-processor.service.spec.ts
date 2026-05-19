import { Test, TestingModule } from '@nestjs/testing';
import Stripe from 'stripe';

import { AuditService } from '../../../core/audit/audit.service';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { PostHogService } from '../../analytics/posthog.service';
import { SubscriptionLifecycleService } from '../services/subscription-lifecycle.service';
import { WebhookProcessorService } from '../services/webhook-processor.service';
import { StripeService } from '../stripe.service';

describe('WebhookProcessorService', () => {
  let service: WebhookProcessorService;
  let prisma: jest.Mocked<PrismaService>;
  let stripe: jest.Mocked<StripeService>;
  let lifecycle: jest.Mocked<SubscriptionLifecycleService>;
  let audit: jest.Mocked<AuditService>;
  let posthog: jest.Mocked<PostHogService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    stripeCustomerId: 'cus_test123',
    subscriptionTier: 'community',
    stripeSubscriptionId: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookProcessorService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            billingEvent: {
              create: jest.fn(),
            },
          },
        },
        {
          provide: StripeService,
          useValue: {
            retrieveCheckoutSession: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn(),
          },
        },
        {
          provide: PostHogService,
          useValue: {
            capture: jest.fn(),
          },
        },
        {
          provide: SubscriptionLifecycleService,
          useValue: {
            dispatchJanuaRoleUpgrade: jest.fn().mockResolvedValue(undefined),
            notifyJanuaOfTierChange: jest.fn().mockResolvedValue(undefined),
            notifyProductWebhooks: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<WebhookProcessorService>(WebhookProcessorService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    stripe = module.get(StripeService) as jest.Mocked<StripeService>;
    lifecycle = module.get(
      SubscriptionLifecycleService
    ) as jest.Mocked<SubscriptionLifecycleService>;
    audit = module.get(AuditService) as jest.Mocked<AuditService>;
    posthog = module.get(PostHogService) as jest.Mocked<PostHogService>;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── Stripe webhook handlers ──────────────────────────────────────────

  describe('handleSubscriptionCreated', () => {
    const makeEvent = (subscription: any): Stripe.Event =>
      ({
        id: 'evt_sub_created',
        type: 'customer.subscription.created',
        data: { object: subscription },
      }) as Stripe.Event;

    it('should update user tier and create billing event', async () => {
      const subscription = {
        id: 'sub_new',
        customer: 'cus_test123',
        current_period_start: 1700000000,
        current_period_end: 1703000000,
        items: { data: [{ price: { unit_amount: 1999, product: 'prod_abc' } }] },
        currency: 'usd',
        metadata: {},
      };

      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.user.update.mockResolvedValue({} as any);
      prisma.billingEvent.create.mockResolvedValue({} as any);

      await service.handleSubscriptionCreated(makeEvent(subscription));

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: expect.objectContaining({
          subscriptionTier: 'pro',
          stripeSubscriptionId: 'sub_new',
        }),
      });
      expect(prisma.billingEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          type: 'subscription_created',
          amount: 19.99,
          status: 'succeeded',
        }),
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SUBSCRIPTION_ACTIVATED' })
      );
      expect(posthog.capture).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'subscription_created' })
      );
    });

    it('should handle missing user gracefully', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await service.handleSubscriptionCreated(
        makeEvent({ customer: 'cus_gone', items: { data: [] } })
      );

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should dispatch Janua role upgrade when metadata includes janua_user_id', async () => {
      const subscription = {
        id: 'sub_janua',
        customer: 'cus_test123',
        current_period_start: 1700000000,
        current_period_end: 1703000000,
        items: { data: [{ price: { unit_amount: 999, product: 'prod_foundry' } }] },
        currency: 'usd',
        metadata: { janua_user_id: 'janua-u-1' },
      };

      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.user.update.mockResolvedValue({} as any);
      prisma.billingEvent.create.mockResolvedValue({} as any);

      await service.handleSubscriptionCreated(makeEvent(subscription));

      expect(lifecycle.dispatchJanuaRoleUpgrade).toHaveBeenCalledWith('janua-u-1', 'prod_foundry');
    });
  });

  describe('handleSubscriptionUpdated', () => {
    it('should update subscription expiry', async () => {
      const event = {
        id: 'evt_upd',
        type: 'customer.subscription.updated',
        data: {
          object: {
            customer: 'cus_test123',
            current_period_end: 1710000000,
          },
        },
      } as Stripe.Event;

      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.user.update.mockResolvedValue({} as any);

      await service.handleSubscriptionUpdated(event);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          subscriptionExpiresAt: new Date(1710000000 * 1000),
        },
      });
    });

    it('should skip when user not found', async () => {
      const event = {
        id: 'evt_upd2',
        type: 'customer.subscription.updated',
        data: { object: { customer: 'cus_ghost' } },
      } as Stripe.Event;

      prisma.user.findUnique.mockResolvedValue(null);

      await service.handleSubscriptionUpdated(event);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('handleSubscriptionCancelled', () => {
    it('should downgrade user to community and log events', async () => {
      const event = {
        id: 'evt_cancel',
        type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_cancel', customer: 'cus_test123' } },
      } as Stripe.Event;

      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.user.update.mockResolvedValue({} as any);
      prisma.billingEvent.create.mockResolvedValue({} as any);

      await service.handleSubscriptionCancelled(event);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          subscriptionTier: 'community',
          subscriptionExpiresAt: null,
          stripeSubscriptionId: null,
          cancelledAt: expect.any(Date),
          cancellationReason: null,
        },
      });
      expect(prisma.billingEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'subscription_cancelled',
          status: 'succeeded',
        }),
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SUBSCRIPTION_CANCELLED' })
      );
      expect(posthog.capture).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'subscription_cancelled' })
      );
    });
  });

  describe('handlePaymentSucceeded', () => {
    it('should create payment_succeeded billing event', async () => {
      const event = {
        id: 'evt_pay',
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            customer: 'cus_test123',
            amount_paid: 1999,
            currency: 'usd',
            id: 'inv_123',
            subscription: 'sub_123',
          },
        },
      } as Stripe.Event;

      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.billingEvent.create.mockResolvedValue({} as any);

      await service.handlePaymentSucceeded(event);

      expect(prisma.billingEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'payment_succeeded',
          amount: 19.99,
          status: 'succeeded',
        }),
      });
    });
  });

  describe('handlePaymentFailed', () => {
    it('should create payment_failed billing event and audit log', async () => {
      const event = {
        id: 'evt_fail',
        type: 'invoice.payment_failed',
        data: {
          object: {
            customer: 'cus_test123',
            amount_due: 1999,
            currency: 'usd',
            id: 'inv_fail',
            subscription: 'sub_123',
          },
        },
      } as Stripe.Event;

      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.billingEvent.create.mockResolvedValue({} as any);

      await service.handlePaymentFailed(event);

      expect(prisma.billingEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'payment_failed',
          status: 'failed',
        }),
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYMENT_FAILED', severity: 'high' })
      );
      expect(posthog.capture).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'payment_failed' })
      );
    });
  });

  describe('handleCheckoutCompleted', () => {
    it('should update user tier from checkout session metadata', async () => {
      const event = {
        id: 'evt_checkout',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_123',
            metadata: { janua_user_id: 'user-123', plan: 'pro', source: 'external' },
            customer: 'cus_test123',
            amount_total: 1999,
            currency: 'usd',
          },
        },
      } as Stripe.Event;

      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.user.update.mockResolvedValue({} as any);
      prisma.billingEvent.create.mockResolvedValue({} as any);
      stripe.retrieveCheckoutSession.mockResolvedValue({
        line_items: { data: [{ price: { product: 'prod_abc' } }] },
      } as any);

      await service.handleCheckoutCompleted(event);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: expect.objectContaining({
          subscriptionTier: 'pro',
          stripeCustomerId: 'cus_test123',
        }),
      });
      expect(lifecycle.dispatchJanuaRoleUpgrade).toHaveBeenCalledWith('user-123', 'prod_abc');
    });

    it('should skip when janua_user_id metadata is absent', async () => {
      const event = {
        id: 'evt_no_janua',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_no', metadata: {} } },
      } as Stripe.Event;

      await service.handleCheckoutCompleted(event);

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should default to pro tier for unknown plan', async () => {
      const event = {
        id: 'evt_unknown_plan',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_unk',
            metadata: { janua_user_id: 'user-123', plan: 'some_unknown' },
            customer: 'cus_test123',
            amount_total: 0,
            currency: 'usd',
          },
        },
      } as Stripe.Event;

      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.user.update.mockResolvedValue({} as any);
      prisma.billingEvent.create.mockResolvedValue({} as any);
      stripe.retrieveCheckoutSession.mockResolvedValue({
        line_items: { data: [] },
      } as any);

      await service.handleCheckoutCompleted(event);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ subscriptionTier: 'pro' }),
        })
      );
    });
  });

  // ─── Janua webhook handlers ───────────────────────────────────────────

  describe('handleJanuaSubscriptionCreated', () => {
    it('should update user tier and notify Janua for org-linked subscription', async () => {
      const payload = {
        id: 'janua_evt_1',
        type: 'subscription.created',
        data: {
          customer_id: 'janua_cus_1',
          subscription_id: 'janua_sub_1',
          plan_id: 'pro',
          provider: 'conekta',
          currency: 'MXN',
          metadata: { orgId: 'org-madfam', product: 'dhanam' },
        },
      };

      prisma.user.findFirst.mockResolvedValue({
        id: 'user-mx',
        januaCustomerId: 'janua_cus_1',
      } as any);
      prisma.user.update.mockResolvedValue({} as any);
      prisma.billingEvent.create.mockResolvedValue({} as any);

      await service.handleJanuaSubscriptionCreated(payload as any);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-mx' },
        data: expect.objectContaining({
          subscriptionTier: 'pro',
          billingProvider: 'conekta',
        }),
      });
      expect(lifecycle.notifyJanuaOfTierChange).toHaveBeenCalledWith(
        'org-madfam',
        'janua_cus_1',
        'pro'
      );
      expect(posthog.capture).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'subscription_created' })
      );
    });

    it('should handle missing user gracefully', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await service.handleJanuaSubscriptionCreated({
        id: 'evt_x',
        type: 'subscription.created',
        data: { customer_id: 'ghost' },
      } as any);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('handleJanuaSubscriptionCancelled', () => {
    it('should downgrade user to community', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-cancel',
        januaCustomerId: 'janua_cus_cancel',
      } as any);
      prisma.user.update.mockResolvedValue({} as any);
      prisma.billingEvent.create.mockResolvedValue({} as any);

      await service.handleJanuaSubscriptionCancelled({
        id: 'evt_cancel',
        type: 'subscription.cancelled',
        data: { customer_id: 'janua_cus_cancel', provider: 'polar', currency: 'USD' },
      } as any);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-cancel' },
        data: expect.objectContaining({
          subscriptionTier: 'community',
        }),
      });
      expect(posthog.capture).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'subscription_cancelled' })
      );
    });
  });

  describe('handleJanuaPaymentSucceeded', () => {
    it('should create billing event and ensure subscription is active', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-pay',
        januaCustomerId: 'janua_cus_pay',
      } as any);
      prisma.billingEvent.create.mockResolvedValue({} as any);
      prisma.user.update.mockResolvedValue({} as any);

      await service.handleJanuaPaymentSucceeded({
        id: 'evt_pay',
        type: 'payment.succeeded',
        data: {
          customer_id: 'janua_cus_pay',
          amount: 199,
          currency: 'MXN',
          provider: 'conekta',
          plan_id: 'essentials',
        },
      } as any);

      expect(prisma.billingEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'payment_succeeded',
          amount: 199,
          currency: 'MXN',
          status: 'succeeded',
        }),
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-pay' },
        data: { subscriptionTier: 'essentials' },
      });
    });
  });

  describe('handleJanuaPaymentFailed', () => {
    it('should create payment_failed event without downgrading', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-fail',
        januaCustomerId: 'janua_cus_fail',
      } as any);
      prisma.billingEvent.create.mockResolvedValue({} as any);

      await service.handleJanuaPaymentFailed({
        id: 'evt_fail',
        type: 'payment.failed',
        data: {
          customer_id: 'janua_cus_fail',
          amount: 99,
          currency: 'USD',
          provider: 'polar',
        },
      } as any);

      expect(prisma.billingEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'payment_failed',
          status: 'failed',
        }),
      });
      // Should NOT downgrade (provider will retry)
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('handleJanuaPaymentRefunded', () => {
    it('should create refund_issued billing event', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-refund',
      } as any);
      prisma.billingEvent.create.mockResolvedValue({} as any);

      await service.handleJanuaPaymentRefunded({
        id: 'evt_refund',
        type: 'payment.refunded',
        data: {
          customer_id: 'janua_cus_refund',
          amount: 50,
          currency: 'USD',
          provider: 'stripe',
        },
      } as any);

      expect(prisma.billingEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'refund_issued',
          amount: 50,
          status: 'succeeded',
        }),
      });
    });

    it('should skip when user not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await service.handleJanuaPaymentRefunded({
        id: 'evt_r',
        type: 'payment.refunded',
        data: { customer_id: 'ghost' },
      } as any);

      expect(prisma.billingEvent.create).not.toHaveBeenCalled();
    });
  });
});
