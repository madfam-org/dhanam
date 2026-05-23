import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { AuditService } from '../../../core/audit/audit.service';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { PostHogService } from '../../analytics/posthog.service';
import { JanuaBillingService } from '../janua-billing.service';
import { OperatorCheckoutStatusService } from '../services/operator-checkout-status.service';
import { SubscriptionJanuaNotifierService } from '../services/subscription-janua-notifier.service';
import {
  SubscriptionLifecycleService,
  PLAN_TIER_MAP,
} from '../services/subscription-lifecycle.service';
import { StripeService } from '../stripe.service';

describe('SubscriptionLifecycleService', () => {
  let service: SubscriptionLifecycleService;
  let prisma: jest.Mocked<PrismaService>;
  let stripe: jest.Mocked<StripeService>;
  let januaBilling: jest.Mocked<JanuaBillingService>;
  let audit: jest.Mocked<AuditService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    stripeCustomerId: null,
    januaCustomerId: null,
    billingProvider: null,
    subscriptionTier: 'community',
    countryCode: 'US',
  };

  const mockProUser = {
    ...mockUser,
    id: 'user-pro',
    stripeCustomerId: 'cus_pro123',
    subscriptionTier: 'pro',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionLifecycleService,
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
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: StripeService,
          useValue: {
            createCustomer: jest.fn(),
            createCheckoutSession: jest.fn(),
            retrieveCheckoutSession: jest.fn(),
            createPortalSession: jest.fn(),
          },
        },
        {
          provide: JanuaBillingService,
          useValue: {
            isEnabled: jest.fn().mockReturnValue(false),
            getProviderForCountry: jest.fn().mockReturnValue('stripe'),
            createCustomer: jest.fn(),
            createCheckoutSession: jest.fn(),
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
              if (key === 'STRIPE_ESSENTIALS_PRICE_ID') return 'price_essentials123';
              if (key === 'STRIPE_PREMIUM_PLAN_PRICE_ID') return 'price_premium_plan123';
              if (key === 'WEB_URL') return 'http://localhost:3000';
              if (key === 'FRONTEND_URL') return 'https://app.dhan.am';
              return defaultValue;
            }),
          },
        },
        {
          provide: PostHogService,
          useValue: {
            capture: jest.fn(),
          },
        },
        {
          provide: SubscriptionJanuaNotifierService,
          useValue: {
            dispatchJanuaRoleUpgrade: jest.fn(),
            notifyJanuaOfTierChange: jest.fn(),
            notifyProductWebhooks: jest.fn(),
          },
        },
        OperatorCheckoutStatusService,
      ],
    }).compile();

    service = module.get<SubscriptionLifecycleService>(SubscriptionLifecycleService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    stripe = module.get(StripeService) as jest.Mocked<StripeService>;
    januaBilling = module.get(JanuaBillingService) as jest.Mocked<JanuaBillingService>;
    audit = module.get(AuditService) as jest.Mocked<AuditService>;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('PLAN_TIER_MAP', () => {
    it('should map plan slugs to tier names', () => {
      expect(PLAN_TIER_MAP.essentials).toBe('essentials');
      expect(PLAN_TIER_MAP.essentials_yearly).toBe('essentials');
      expect(PLAN_TIER_MAP.pro).toBe('pro');
      expect(PLAN_TIER_MAP.pro_yearly).toBe('pro');
      expect(PLAN_TIER_MAP.premium).toBe('premium');
      expect(PLAN_TIER_MAP.premium_yearly).toBe('premium');
    });
  });

  describe('upgradeToPremium', () => {
    it('should throw if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.upgradeToPremium('missing')).rejects.toThrow('User not found');
    });

    it('should throw if user is already on requested tier', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(mockProUser as any)
        .mockResolvedValueOnce(mockProUser as any);

      await expect(service.upgradeToPremium('user-pro')).rejects.toThrow(
        'User is already on pro tier'
      );
    });

    it('should create Stripe customer and checkout when no stripeCustomerId', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(mockUser as any) // user lookup
        .mockResolvedValueOnce(mockUser as any); // tier check

      stripe.createCustomer.mockResolvedValue({ id: 'cus_new' } as any);
      stripe.createCheckoutSession.mockResolvedValue({
        id: 'cs_123',
        url: 'https://checkout.stripe.com/cs_123',
      } as any);
      prisma.user.update.mockResolvedValue({} as any);

      const result = await service.upgradeToPremium('user-123');

      expect(stripe.createCustomer).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'Test User',
        metadata: { userId: 'user-123' },
      });
      expect(result).toEqual({
        checkoutUrl: 'https://checkout.stripe.com/cs_123',
        provider: 'stripe',
        sessionId: 'cs_123',
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'BILLING_UPGRADE_INITIATED' })
      );
    });

    it('should use Janua when enabled', async () => {
      januaBilling.isEnabled.mockReturnValue(true);
      januaBilling.getProviderForCountry.mockReturnValue('conekta' as any);
      januaBilling.createCustomer.mockResolvedValue({
        customerId: 'janua_cus_1',
        provider: 'conekta' as any,
      });
      januaBilling.createCheckoutSession.mockResolvedValue({
        checkoutUrl: 'https://checkout.janua.dev/abc',
        sessionId: 'sess_janua_1',
        provider: 'conekta' as any,
      });

      prisma.user.findUnique
        .mockResolvedValueOnce(mockUser as any)
        .mockResolvedValueOnce(mockUser as any);
      prisma.user.update.mockResolvedValue({} as any);

      const result = await service.upgradeToPremium('user-123');

      expect(result.checkoutUrl).toBe('https://checkout.janua.dev/abc');
      expect(result.provider).toBe('conekta');
      expect(result.sessionId).toBe('sess_janua_1');
    });
  });

  describe('createPortalSession', () => {
    it('should create portal session for user with stripeCustomerId', async () => {
      prisma.user.findUnique.mockResolvedValue({
        stripeCustomerId: 'cus_existing',
      } as any);

      stripe.createPortalSession.mockResolvedValue({
        url: 'https://billing.stripe.com/portal/sess_123',
      } as any);

      const result = await service.createPortalSession('user-123');

      expect(result).toEqual({
        portalUrl: 'https://billing.stripe.com/portal/sess_123',
      });
    });

    it('should throw when user has no stripeCustomerId', async () => {
      prisma.user.findUnique.mockResolvedValue({ stripeCustomerId: null } as any);

      await expect(service.createPortalSession('user-123')).rejects.toThrow(
        'No Stripe customer found for this user'
      );
    });
  });

  describe('createExternalCheckout', () => {
    it('should throw NotFoundException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createExternalCheckout('missing', 'pro', 'https://app.dhan.am')
      ).rejects.toThrow('User not found');
    });

    it('should return checkout URL for valid user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        countryCode: 'US',
      } as any);

      stripe.createCustomer.mockResolvedValue({ id: 'cus_ext' } as any);
      stripe.createCheckoutSession.mockResolvedValue({
        id: 'cs_ext',
        url: 'https://checkout.stripe.com/cs_ext',
      } as any);
      prisma.user.update.mockResolvedValue({} as any);

      const result = await service.createExternalCheckout(
        'user-123',
        'pro',
        'https://app.dhan.am/billing'
      );

      expect(result).toBe('https://checkout.stripe.com/cs_ext');
    });

    it('should resolve product-specific catalog plans before legacy env fallback', async () => {
      const priceResolver = {
        resolve: jest.fn().mockResolvedValue({ priceId: 'price_karafiel_contador' }),
      };
      (service as any).priceResolver = priceResolver;

      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        countryCode: 'MX',
      } as any);

      stripe.createCustomer.mockResolvedValue({ id: 'cus_catalog' } as any);
      stripe.createCheckoutSession.mockResolvedValue({
        id: 'cs_catalog',
        url: 'https://checkout.stripe.com/cs_catalog',
      } as any);
      prisma.user.update.mockResolvedValue({} as any);

      const result = await service.createExternalCheckout(
        'user-123',
        'contador',
        'https://karafiel.mx/billing',
        'karafiel'
      );

      expect(priceResolver.resolve).toHaveBeenCalledWith('karafiel_contador', 1, false);
      expect(stripe.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({ priceId: 'price_karafiel_contador' })
      );
      expect(result).toBe('https://checkout.stripe.com/cs_catalog');
    });
  });

  describe('createFederatedCheckout', () => {
    it('should throw for missing user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.createFederatedCheckout('missing', 'pro')).rejects.toThrow(
        'User not found: missing'
      );
    });

    it('should throw for unknown plan', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'u@e.com',
        stripeCustomerId: 'cus_1',
        countryCode: 'US',
      } as any);

      await expect(service.createFederatedCheckout('user-1', 'unknown_plan')).rejects.toThrow(
        'No Stripe price configured for plan: unknown_plan'
      );
    });
  });

  describe('getBillingHistory', () => {
    it('should query billing events with default limit', async () => {
      const mockEvents = [{ id: 'evt-1' }, { id: 'evt-2' }];
      prisma.billingEvent.findMany.mockResolvedValue(mockEvents as any);

      const result = await service.getBillingHistory('user-123');

      expect(prisma.billingEvent.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      expect(result).toEqual(mockEvents);
    });

    it('should respect custom limit', async () => {
      prisma.billingEvent.findMany.mockResolvedValue([]);

      await service.getBillingHistory('user-123', 5);

      expect(prisma.billingEvent.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });
    });
  });

  describe('getOperatorCheckoutStatus', () => {
    it('retrieves Stripe checkout status with recent billing events', async () => {
      stripe.retrieveCheckoutSession.mockResolvedValue({
        id: 'cs_pos_123',
        status: 'complete',
        payment_status: 'paid',
        customer: 'cus_123',
        subscription: 'sub_123',
        payment_intent: null,
        metadata: {
          userId: 'user-123',
          product: 'karafiel',
          plan: 'pro',
          source: 'internal_pos',
        },
        amount_total: 1199,
        currency: 'usd',
        created: 1770000000,
        expires_at: 1770003600,
        url: 'https://checkout.stripe.com/c/pay/cs_pos_123',
      } as any);
      prisma.billingEvent.findMany.mockResolvedValue([
        {
          id: 'evt_1',
          type: 'payment_succeeded',
          status: 'succeeded',
          amount: { toString: () => '11.99' },
          currency: 'USD',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          metadata: { sessionId: 'cs_pos_123' },
        },
      ] as any);

      const result = await service.getOperatorCheckoutStatus('cs_pos_123');

      expect(stripe.retrieveCheckoutSession).toHaveBeenCalledWith('cs_pos_123', {
        expand: ['subscription', 'payment_intent'],
      });
      expect(prisma.billingEvent.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      expect(result).toEqual(
        expect.objectContaining({
          sessionId: 'cs_pos_123',
          provider: 'stripe',
          status: 'complete',
          paymentStatus: 'paid',
          customerId: 'cus_123',
          subscriptionId: 'sub_123',
          userId: 'user-123',
          product: 'karafiel',
          plan: 'pro',
          source: 'internal_pos',
          amountTotal: 1199,
          currency: 'usd',
          billingEvents: [
            expect.objectContaining({
              id: 'evt_1',
              type: 'payment_succeeded',
              amount: '11.99',
            }),
          ],
        })
      );
    });
  });

  describe('dispatchJanuaRoleUpgrade', () => {
    it('should skip when Janua config is missing', async () => {
      // config.get returns undefined for JANUA_API_URL and JANUA_ADMIN_KEY
      // (default mock behavior)
      await service.dispatchJanuaRoleUpgrade('janua-user-1', 'prod_abc');

      // No fetch should be attempted; no error thrown
      // This is a non-blocking operation by design
    });

    it('should skip when productId has no role mapping', async () => {
      // Even with valid config, unknown product should be skipped
      await service.dispatchJanuaRoleUpgrade('janua-user-1', 'prod_unknown');

      // Should complete without error
    });
  });

  describe('notifyJanuaOfTierChange', () => {
    it('should skip when Janua config is missing', async () => {
      await service.notifyJanuaOfTierChange('org-1', 'cus-1', 'pro');

      // Should complete without error; no external call attempted
    });
  });
});
