import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UsageMetricType } from '@db';
import Stripe from 'stripe';

import { PrismaService } from '../../../core/prisma/prisma.service';
import { AuditService } from '../../../core/audit/audit.service';
import { BillingService } from '../billing.service';
import { StripeService } from '../stripe.service';
import { JanuaBillingService } from '../janua-billing.service';

describe('BillingService', () => {
  let service: BillingService;
  let prisma: jest.Mocked<PrismaService>;
  let stripe: jest.Mocked<StripeService>;
  let audit: jest.Mocked<AuditService>;
  let config: jest.Mocked<ConfigService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    stripeCustomerId: null,
    subscriptionTier: 'community' as const,
    subscriptionStartedAt: null,
    subscriptionExpiresAt: null,
    stripeSubscriptionId: null,
  };

  const mockProUser = {
    ...mockUser,
    id: 'user-pro',
    stripeCustomerId: 'cus_pro123',
    subscriptionTier: 'pro' as const,
    subscriptionStartedAt: new Date('2024-01-01'),
    subscriptionExpiresAt: new Date('2025-01-01'),
    stripeSubscriptionId: 'sub_pro123',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            billingEvent: {
              create: jest.fn(),
              findMany: jest.fn(),
            },
            usageMetric: {
              upsert: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: StripeService,
          useValue: {
            createCustomer: jest.fn(),
            createCheckoutSession: jest.fn(),
            createPortalSession: jest.fn(),
            cancelSubscription: jest.fn(),
            updateSubscription: jest.fn(),
            getSubscription: jest.fn(),
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
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              if (key === 'STRIPE_PREMIUM_PRICE_ID') return 'price_premium123';
              if (key === 'WEB_URL') return 'http://localhost:3000';
              return defaultValue;
            }),
          },
        },
        {
          provide: JanuaBillingService,
          useValue: {
            isEnabled: jest.fn().mockReturnValue(false),
            getProviderForCountry: jest.fn().mockReturnValue('stripe'),
            createCustomer: jest.fn(),
            createCheckoutSession: jest.fn(),
            createPortalSession: jest.fn(),
            cancelSubscription: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    stripe = module.get(StripeService) as jest.Mocked<StripeService>;
    audit = module.get(AuditService) as jest.Mocked<AuditService>;
    config = module.get(ConfigService) as jest.Mocked<ConfigService>;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('upgradeToPremium', () => {
    it('should create Stripe customer and checkout session for new user', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(mockUser as any) // First call for user lookup
        .mockResolvedValueOnce(mockUser as any); // Second call for tier check

      const mockCustomer = { id: 'cus_new123' } as Stripe.Customer;
      const mockSession = {
        id: 'cs_test123',
        url: 'https://checkout.stripe.com/pay/cs_test123',
      } as Stripe.Checkout.Session;

      stripe.createCustomer.mockResolvedValue(mockCustomer);
      stripe.createCheckoutSession.mockResolvedValue(mockSession);
      prisma.user.update.mockResolvedValue({ ...mockUser, stripeCustomerId: 'cus_new123' } as any);

      const result = await service.upgradeToPremium('user-123');

      expect(stripe.createCustomer).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'Test User',
        metadata: { userId: 'user-123' },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { stripeCustomerId: 'cus_new123' },
      });
      expect(stripe.createCheckoutSession).toHaveBeenCalledWith({
        customerId: 'cus_new123',
        priceId: 'price_premium123',
        successUrl: 'http://localhost:3000/billing/success?session_id={CHECKOUT_SESSION_ID}',
        cancelUrl: 'http://localhost:3000/billing/cancel',
        metadata: { userId: 'user-123', plan: 'pro' },
        couponId: undefined,
      });
      expect(audit.log).toHaveBeenCalled();
      expect(result).toEqual({ checkoutUrl: 'https://checkout.stripe.com/pay/cs_test123', provider: 'stripe' });
    });

    it('should use existing Stripe customer ID if available', async () => {
      const userWithStripe = { ...mockUser, stripeCustomerId: 'cus_existing123' };
      prisma.user.findUnique
        .mockResolvedValueOnce(userWithStripe as any)
        .mockResolvedValueOnce(userWithStripe as any);

      const mockSession = {
        id: 'cs_test123',
        url: 'https://checkout.stripe.com/pay/cs_test123',
      } as Stripe.Checkout.Session;

      stripe.createCheckoutSession.mockResolvedValue(mockSession);

      await service.upgradeToPremium('user-123');

      expect(stripe.createCustomer).not.toHaveBeenCalled();
      expect(stripe.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: 'cus_existing123' })
      );
    });

    it('should throw error if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.upgradeToPremium('nonexistent')).rejects.toThrow('User not found');
    });

    it('should throw error if user is already premium', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(mockProUser as any)
        .mockResolvedValueOnce(mockProUser as any);

      await expect(service.upgradeToPremium('user-pro')).rejects.toThrow(
        'User is already on pro tier'
      );
    });

    it('should pass product in options through to upgrade flow', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(mockUser as any)
        .mockResolvedValueOnce(mockUser as any);

      const mockCustomer = { id: 'cus_new123' } as Stripe.Customer;
      const mockSession = {
        id: 'cs_test123',
        url: 'https://checkout.stripe.com/pay/cs_test123',
      } as Stripe.Checkout.Session;

      stripe.createCustomer.mockResolvedValue(mockCustomer);
      stripe.createCheckoutSession.mockResolvedValue(mockSession);
      prisma.user.update.mockResolvedValue({ ...mockUser, stripeCustomerId: 'cus_new123' } as any);

      const result = await service.upgradeToPremium('user-123', {
        plan: 'enclii_pro',
        product: 'enclii',
      });

      expect(result).toEqual({
        checkoutUrl: 'https://checkout.stripe.com/pay/cs_test123',
        provider: 'stripe',
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'BILLING_UPGRADE_INITIATED',
        })
      );
    });
  });

  describe('createPortalSession', () => {
    it('should create billing portal session for existing customer', async () => {
      const userWithStripe = { ...mockUser, stripeCustomerId: 'cus_existing123' };
      prisma.user.findUnique.mockResolvedValue(userWithStripe as any);

      const mockSession = {
        url: 'https://billing.stripe.com/session/test123',
      } as Stripe.BillingPortal.Session;

      stripe.createPortalSession.mockResolvedValue(mockSession);

      const result = await service.createPortalSession('user-123');

      expect(stripe.createPortalSession).toHaveBeenCalledWith({
        customerId: 'cus_existing123',
        returnUrl: 'http://localhost:3000/billing',
      });
      expect(result).toEqual({ portalUrl: 'https://billing.stripe.com/session/test123' });
    });

    it('should throw error if no Stripe customer found', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);

      await expect(service.createPortalSession('user-123')).rejects.toThrow(
        'No Stripe customer found for this user'
      );
    });
  });

  describe('handleSubscriptionCreated', () => {
    it('should update user to pro tier and create billing event', async () => {
      const mockSubscription = {
        id: 'sub_new123',
        customer: 'cus_test123',
        current_period_start: 1609459200, // 2021-01-01
        current_period_end: 1640995200, // 2022-01-01
        items: {
          data: [
            {
              price: {
                unit_amount: 1999,
              },
            },
          ],
        },
        currency: 'usd',
      } as any;

      const mockEvent = {
        id: 'evt_test123',
        type: 'customer.subscription.created',
        data: { object: mockSubscription },
      } as Stripe.Event;

      const userWithStripe = { ...mockUser, stripeCustomerId: 'cus_test123' };
      prisma.user.findUnique.mockResolvedValue(userWithStripe as any);
      prisma.user.update.mockResolvedValue({ ...userWithStripe, subscriptionTier: 'pro' } as any);
      prisma.billingEvent.create.mockResolvedValue({} as any);

      await service.handleSubscriptionCreated(mockEvent);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          subscriptionTier: 'pro',
          subscriptionStartedAt: new Date(1609459200 * 1000),
          subscriptionExpiresAt: new Date(1640995200 * 1000),
          stripeSubscriptionId: 'sub_new123',
        },
      });
      expect(prisma.billingEvent.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          type: 'subscription_created',
          amount: 19.99,
          currency: 'USD',
          status: 'succeeded',
          stripeEventId: 'evt_test123',
          metadata: { subscriptionId: 'sub_new123' },
        },
      });
      expect(audit.log).toHaveBeenCalledWith({
        userId: 'user-123',
        action: 'SUBSCRIPTION_ACTIVATED',
        severity: 'high',
        metadata: { tier: 'pro', subscriptionId: 'sub_new123' },
      });
    });

    it('should handle missing user gracefully', async () => {
      const mockSubscription = {
        customer: 'cus_nonexistent',
      } as any;

      const mockEvent = {
        id: 'evt_test123',
        type: 'customer.subscription.created',
        data: { object: mockSubscription },
      } as Stripe.Event;

      prisma.user.findUnique.mockResolvedValue(null);

      await service.handleSubscriptionCreated(mockEvent);

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.billingEvent.create).not.toHaveBeenCalled();
    });
  });

  describe('handleSubscriptionCancelled', () => {
    it('should downgrade user to community tier and create billing event', async () => {
      const mockSubscription = {
        id: 'sub_cancelled123',
        customer: 'cus_test123',
      } as any;

      const mockEvent = {
        id: 'evt_test123',
        type: 'customer.subscription.deleted',
        data: { object: mockSubscription },
      } as Stripe.Event;

      const userWithStripe = { ...mockProUser, stripeCustomerId: 'cus_test123' };
      prisma.user.findUnique.mockResolvedValue(userWithStripe as any);
      prisma.user.update.mockResolvedValue({ ...userWithStripe, subscriptionTier: 'community' } as any);
      prisma.billingEvent.create.mockResolvedValue({} as any);

      await service.handleSubscriptionCancelled(mockEvent);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-pro' },
        data: {
          subscriptionTier: 'community',
          subscriptionExpiresAt: null,
          stripeSubscriptionId: null,
        },
      });
      expect(prisma.billingEvent.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-pro',
          type: 'subscription_cancelled',
          amount: 0,
          currency: 'USD',
          status: 'succeeded',
          stripeEventId: 'evt_test123',
          metadata: { subscriptionId: 'sub_cancelled123' },
        },
      });
      expect(audit.log).toHaveBeenCalledWith({
        userId: 'user-pro',
        action: 'SUBSCRIPTION_CANCELLED',
        severity: 'medium',
        metadata: { subscriptionId: 'sub_cancelled123' },
      });
    });
  });

  describe('recordUsage', () => {
    it('should create new usage metric for today', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      prisma.usageMetric.upsert.mockResolvedValue({
        id: 'metric-123',
        userId: 'user-123',
        metricType: 'esg_calculation',
        date: today,
        count: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.recordUsage('user-123', 'esg_calculation');

      expect(prisma.usageMetric.upsert).toHaveBeenCalledWith({
        where: {
          userId_metricType_date: {
            userId: 'user-123',
            metricType: 'esg_calculation',
            date: today,
          },
        },
        create: {
          userId: 'user-123',
          metricType: 'esg_calculation',
          date: today,
          count: 1,
        },
        update: {
          count: { increment: 1 },
        },
      });
    });
  });

  describe('checkUsageLimit', () => {
    it('should return true for pro users (unlimited)', async () => {
      prisma.user.findUnique.mockResolvedValue(mockProUser as any);

      const result = await service.checkUsageLimit('user-pro', 'monte_carlo_simulation');

      expect(result).toBe(true);
    });

    it('should return true for community users within limit', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.usageMetric.findUnique.mockResolvedValue({
        id: 'metric-123',
        userId: 'user-123',
        metricType: 'esg_calculation',
        date: today,
        count: 3, // Community tier limit is 5
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.checkUsageLimit('user-123', 'esg_calculation');

      expect(result).toBe(true);
    });

    it('should return false for community users at limit', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.usageMetric.findUnique.mockResolvedValue({
        id: 'metric-123',
        userId: 'user-123',
        metricType: 'esg_calculation',
        date: today,
        count: 5, // Community tier limit is 5
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.checkUsageLimit('user-123', 'esg_calculation');

      expect(result).toBe(false);
    });

    it('should return false for features not available in community tier', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);

      const result = await service.checkUsageLimit('user-123', 'portfolio_rebalance');

      expect(result).toBe(false);
    });

    it('should return true for users with no usage today', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.usageMetric.findUnique.mockResolvedValue(null);

      const result = await service.checkUsageLimit('user-123', 'esg_calculation');

      expect(result).toBe(true);
    });
  });

  describe('getUserUsage', () => {
    it('should return usage metrics for all metric types', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.usageMetric.findMany.mockResolvedValue([
        {
          id: 'metric-1',
          userId: 'user-123',
          metricType: 'esg_calculation',
          date: today,
          count: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'metric-2',
          userId: 'user-123',
          metricType: 'monte_carlo_simulation',
          date: today,
          count: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.getUserUsage('user-123');

      expect(result).toEqual({
        date: today,
        tier: 'community',
        usage: {
          esg_calculation: { used: 5, limit: 5 },
          monte_carlo_simulation: { used: 2, limit: 2 },
          goal_probability: { used: 0, limit: 0 },
          scenario_analysis: { used: 0, limit: 0 },
          portfolio_rebalance: { used: 0, limit: 0 },
          api_request: { used: 0, limit: 500 },
        },
      });
    });

    it('should return unlimited (-1) for pro user', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      prisma.user.findUnique.mockResolvedValue(mockProUser as any);
      prisma.usageMetric.findMany.mockResolvedValue([]);

      const result = await service.getUserUsage('user-pro');

      expect(result.tier).toBe('pro');
      expect(result.usage.esg_calculation).toEqual({ used: 0, limit: -1 });
      expect(result.usage.monte_carlo_simulation).toEqual({ used: 0, limit: -1 });
    });
  });

  describe('getBillingHistory', () => {
    it('should return billing events for user', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          userId: 'user-123',
          type: 'payment_succeeded',
          amount: 19.99,
          currency: 'USD',
          status: 'succeeded',
          stripeEventId: 'evt_1',
          metadata: {},
          createdAt: new Date(),
        },
        {
          id: 'event-2',
          userId: 'user-123',
          type: 'subscription_created',
          amount: 19.99,
          currency: 'USD',
          status: 'succeeded',
          stripeEventId: 'evt_2',
          metadata: {},
          createdAt: new Date(),
        },
      ];

      prisma.billingEvent.findMany.mockResolvedValue(mockEvents as any);

      const result = await service.getBillingHistory('user-123');

      expect(prisma.billingEvent.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      expect(result).toEqual(mockEvents);
    });

    it('should respect custom limit parameter', async () => {
      prisma.billingEvent.findMany.mockResolvedValue([]);

      await service.getBillingHistory('user-123', 5);

      expect(prisma.billingEvent.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });
    });
  });

  describe('createExternalCheckout', () => {
    it('should create checkout session via Stripe for existing user', async () => {
      const userWithCountry = {
        ...mockUser,
        countryCode: 'MX',
        billingProvider: null,
        januaCustomerId: null,
      };
      prisma.user.findUnique.mockResolvedValue(userWithCountry as any);

      const mockCustomer = { id: 'cus_new123' } as any;
      const mockSession = {
        id: 'cs_test123',
        url: 'https://checkout.stripe.com/pay/cs_test123',
      } as any;

      stripe.createCustomer.mockResolvedValue(mockCustomer);
      stripe.createCheckoutSession.mockResolvedValue(mockSession);
      prisma.user.update.mockResolvedValue({ ...userWithCountry, stripeCustomerId: 'cus_new123' } as any);

      const result = await service.createExternalCheckout(
        'user-123',
        'pro',
        'https://app.dhan.am/billing'
      );

      expect(result).toBe('https://checkout.stripe.com/pay/cs_test123');
      expect(stripe.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            janua_user_id: 'user-123',
            plan: 'pro',
            source: 'external',
          }),
        })
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'BILLING_UPGRADE_INITIATED' })
      );
    });

    it('should throw NotFoundException for missing user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createExternalCheckout('nonexistent', 'pro', 'https://app.dhan.am')
      ).rejects.toThrow('User not found');
    });

    it('should reuse existing stripeCustomerId', async () => {
      const userWithStripe = {
        ...mockUser,
        stripeCustomerId: 'cus_existing',
        countryCode: 'US',
        billingProvider: null,
        januaCustomerId: null,
      };
      prisma.user.findUnique.mockResolvedValue(userWithStripe as any);

      stripe.createCheckoutSession.mockResolvedValue({
        id: 'cs_test',
        url: 'https://checkout.stripe.com/cs_test',
      } as any);

      await service.createExternalCheckout('user-123', 'essentials', 'https://app.dhan.am');

      expect(stripe.createCustomer).not.toHaveBeenCalled();
      expect(stripe.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: 'cus_existing' })
      );
    });

    it('should accept product parameter', async () => {
      const userWithCountry = {
        ...mockUser,
        countryCode: 'US',
        billingProvider: null,
        januaCustomerId: null,
      };
      prisma.user.findUnique.mockResolvedValue(userWithCountry as any);

      const mockCustomer = { id: 'cus_new123' } as any;
      const mockSession = {
        id: 'cs_test_product',
        url: 'https://checkout.stripe.com/pay/cs_test_product',
      } as any;

      stripe.createCustomer.mockResolvedValue(mockCustomer);
      stripe.createCheckoutSession.mockResolvedValue(mockSession);
      prisma.user.update.mockResolvedValue({ ...userWithCountry, stripeCustomerId: 'cus_new123' } as any);

      const result = await service.createExternalCheckout(
        'user-123',
        'enclii_pro',
        'https://app.enclii.dev/billing',
        'enclii'
      );

      expect(result).toBe('https://checkout.stripe.com/pay/cs_test_product');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'BILLING_UPGRADE_INITIATED',
          metadata: expect.objectContaining({
            plan: 'enclii_pro',
            source: 'external',
          }),
        })
      );
    });
  });

  describe('handleCheckoutCompleted', () => {
    it('should update user tier and create billing event', async () => {
      const mockSession = {
        id: 'cs_test123',
        metadata: { janua_user_id: 'user-123', plan: 'pro', source: 'external' },
        customer: 'cus_test123',
        amount_total: 1999,
        currency: 'usd',
      };
      const mockEvent = {
        id: 'evt_test123',
        type: 'checkout.session.completed',
        data: { object: mockSession },
      } as Stripe.Event;

      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.user.update.mockResolvedValue({ ...mockUser, subscriptionTier: 'pro' } as any);
      prisma.billingEvent.create.mockResolvedValue({} as any);
      stripe.retrieveCheckoutSession.mockResolvedValue({
        ...mockSession,
        line_items: { data: [{ price: { product: 'prod_abc' } }] },
      } as any);

      await service.handleCheckoutCompleted(mockEvent);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: expect.objectContaining({
          subscriptionTier: 'pro',
          stripeCustomerId: 'cus_test123',
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
    });

    it('should skip when janua_user_id metadata is missing', async () => {
      const mockEvent = {
        id: 'evt_test123',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_test', metadata: {} } },
      } as Stripe.Event;

      await service.handleCheckoutCompleted(mockEvent);

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should handle missing user gracefully', async () => {
      const mockEvent = {
        id: 'evt_test123',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_test', metadata: { janua_user_id: 'missing' } } },
      } as Stripe.Event;

      prisma.user.findUnique.mockResolvedValue(null);

      await service.handleCheckoutCompleted(mockEvent);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should default to pro tier when plan is not in PLAN_TIER_MAP', async () => {
      const mockEvent = {
        id: 'evt_test123',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test',
            metadata: { janua_user_id: 'user-123', plan: 'unknown_plan' },
            customer: 'cus_test',
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

      await service.handleCheckoutCompleted(mockEvent);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ subscriptionTier: 'pro' }),
        })
      );
    });
  });

  describe('getUsageLimits', () => {
    it('should return usage limits configuration', () => {
      const limits = service.getUsageLimits();

      expect(limits).toEqual({
        community: {
          esg_calculation: 5,
          monte_carlo_simulation: 2,
          goal_probability: 0,
          scenario_analysis: 0,
          portfolio_rebalance: 0,
          api_request: 500,
        },
        essentials: {
          esg_calculation: 20,
          monte_carlo_simulation: 10,
          goal_probability: 5,
          scenario_analysis: 3,
          portfolio_rebalance: 0,
          api_request: 5_000,
        },
        pro: {
          esg_calculation: Infinity,
          monte_carlo_simulation: Infinity,
          goal_probability: Infinity,
          scenario_analysis: Infinity,
          portfolio_rebalance: Infinity,
          api_request: Infinity,
        },
      });
    });
  });
});
