import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import Stripe from 'stripe';

import { BillingController } from '../billing.controller';
import { BillingService } from '../billing.service';
import { StripeService } from '../stripe.service';
import { JanuaBillingService } from '../janua-billing.service';

describe('BillingController', () => {
  let controller: BillingController;
  let billingService: jest.Mocked<BillingService>;
  let stripeService: jest.Mocked<StripeService>;
  let configService: jest.Mocked<ConfigService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    subscriptionTier: 'community',
    subscriptionStartedAt: null,
    subscriptionExpiresAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }])],
      controllers: [BillingController],
      providers: [
        {
          provide: BillingService,
          useValue: {
            upgradeToPremium: jest.fn(),
            createPortalSession: jest.fn(),
            getUserUsage: jest.fn(),
            getBillingHistory: jest.fn(),
            handleSubscriptionCreated: jest.fn(),
            handleSubscriptionUpdated: jest.fn(),
            handleSubscriptionCancelled: jest.fn(),
            handlePaymentSucceeded: jest.fn(),
            handlePaymentFailed: jest.fn(),
            handleCheckoutCompleted: jest.fn(),
            createExternalCheckout: jest.fn(),
          },
        },
        {
          provide: StripeService,
          useValue: {
            constructWebhookEvent: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_test_secret';
              return null;
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

    controller = module.get<BillingController>(BillingController);
    billingService = module.get(BillingService) as jest.Mocked<BillingService>;
    stripeService = module.get(StripeService) as jest.Mocked<StripeService>;
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /billing/upgrade', () => {
    it('should initiate upgrade to pro', async () => {
      const mockRequest = { user: mockUser };
      const mockCheckoutUrl = 'https://checkout.stripe.com/pay/cs_test123';

      billingService.upgradeToPremium.mockResolvedValue({ checkoutUrl: mockCheckoutUrl });

      const result = await controller.upgradeToPremium(mockRequest, {});

      expect(billingService.upgradeToPremium).toHaveBeenCalledWith('user-123', {
        orgId: undefined,
        plan: undefined,
        product: undefined,
        successUrl: undefined,
        cancelUrl: undefined,
        countryCode: undefined,
      });
      expect(result).toEqual({ checkoutUrl: mockCheckoutUrl });
    });

    it('should pass external app options to billing service', async () => {
      const mockRequest = { user: mockUser };
      const mockCheckoutUrl = 'https://checkout.stripe.com/pay/cs_test123';
      const dto = {
        orgId: 'org_enclii_123',
        plan: 'enclii_sovereign',
        successUrl: 'https://app.enclii.dev/billing/callback?status=success',
        cancelUrl: 'https://app.enclii.dev/billing/callback?status=cancel',
        countryCode: 'MX',
      };

      billingService.upgradeToPremium.mockResolvedValue({ checkoutUrl: mockCheckoutUrl });

      const result = await controller.upgradeToPremium(mockRequest, dto);

      expect(billingService.upgradeToPremium).toHaveBeenCalledWith('user-123', {
        orgId: 'org_enclii_123',
        plan: 'enclii_sovereign',
        product: undefined,
        successUrl: 'https://app.enclii.dev/billing/callback?status=success',
        cancelUrl: 'https://app.enclii.dev/billing/callback?status=cancel',
        countryCode: 'MX',
      });
      expect(result).toEqual({ checkoutUrl: mockCheckoutUrl });
    });

    it('should pass product field to billing service', async () => {
      const mockRequest = { user: mockUser };
      const mockCheckoutUrl = 'https://checkout.stripe.com/pay/cs_test123';
      const dto = {
        plan: 'enclii_pro',
        product: 'enclii' as const,
      };

      billingService.upgradeToPremium.mockResolvedValue({ checkoutUrl: mockCheckoutUrl });

      const result = await controller.upgradeToPremium(mockRequest, dto);

      expect(billingService.upgradeToPremium).toHaveBeenCalledWith('user-123', {
        orgId: undefined,
        plan: 'enclii_pro',
        product: 'enclii',
        successUrl: undefined,
        cancelUrl: undefined,
        countryCode: undefined,
      });
      expect(result).toEqual({ checkoutUrl: mockCheckoutUrl });
    });
  });

  describe('POST /billing/portal', () => {
    it('should create billing portal session', async () => {
      const mockRequest = { user: mockUser };
      const mockPortalUrl = 'https://billing.stripe.com/session/test123';

      billingService.createPortalSession.mockResolvedValue({ portalUrl: mockPortalUrl });

      const result = await controller.createPortalSession(mockRequest);

      expect(billingService.createPortalSession).toHaveBeenCalledWith('user-123');
      expect(result).toEqual({ portalUrl: mockPortalUrl });
    });
  });

  describe('GET /billing/usage', () => {
    it('should return user usage metrics', async () => {
      const mockRequest = { user: mockUser };
      const mockUsage = {
        date: new Date('2024-01-15'),
        tier: 'community',
        usage: {
          esg_calculation: { used: 5, limit: 10 },
          monte_carlo_simulation: { used: 1, limit: 3 },
        },
      };

      billingService.getUserUsage.mockResolvedValue(mockUsage as any);

      const result = await controller.getUsage(mockRequest);

      expect(billingService.getUserUsage).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(mockUsage);
    });
  });

  describe('GET /billing/history', () => {
    it('should return billing history', async () => {
      const mockRequest = { user: mockUser };
      const mockHistory = [
        {
          id: 'event-1',
          userId: 'user-123',
          type: 'payment_succeeded',
          amount: 19.99,
          currency: 'USD',
          status: 'succeeded',
          createdAt: new Date(),
        },
      ];

      billingService.getBillingHistory.mockResolvedValue(mockHistory as any);

      const result = await controller.getBillingHistory(mockRequest);

      expect(billingService.getBillingHistory).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(mockHistory);
    });
  });

  describe('GET /billing/status', () => {
    it('should return subscription status for community user', async () => {
      const mockRequest = { user: mockUser };

      const result = await controller.getSubscriptionStatus(mockRequest);

      expect(result).toEqual({
        tier: 'community',
        startedAt: null,
        expiresAt: null,
        isActive: false,
      });
    });

    it('should return subscription status for active pro user', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const premiumUser = {
        ...mockUser,
        subscriptionTier: 'pro',
        subscriptionStartedAt: new Date('2024-01-01'),
        subscriptionExpiresAt: futureDate,
      };

      const mockRequest = { user: premiumUser };

      const result = await controller.getSubscriptionStatus(mockRequest);

      expect(result).toEqual({
        tier: 'pro',
        startedAt: premiumUser.subscriptionStartedAt,
        expiresAt: futureDate,
        isActive: true,
      });
    });

    it('should return subscription status for expired pro user', async () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);

      const expiredUser = {
        ...mockUser,
        subscriptionTier: 'pro',
        subscriptionStartedAt: new Date('2023-01-01'),
        subscriptionExpiresAt: pastDate,
      };

      const mockRequest = { user: expiredUser };

      const result = await controller.getSubscriptionStatus(mockRequest);

      expect(result.isActive).toBe(false);
    });
  });

  describe('POST /billing/webhook', () => {
    const createMockRequest = (body: any = {}) => ({
      rawBody: Buffer.from(JSON.stringify(body)),
      body,
    });

    it('should handle subscription.created webhook', async () => {
      const mockEvent = {
        id: 'evt_test123',
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_test123',
            customer: 'cus_test123',
          },
        },
      } as Stripe.Event;

      const mockRequest = createMockRequest(mockEvent);
      const signature = 'valid_signature';

      stripeService.constructWebhookEvent.mockReturnValue(mockEvent);
      billingService.handleSubscriptionCreated.mockResolvedValue(undefined);

      const result = await controller.handleWebhook(mockRequest as any, signature);

      expect(stripeService.constructWebhookEvent).toHaveBeenCalledWith(
        mockRequest.rawBody,
        signature,
        'whsec_test_secret'
      );
      expect(billingService.handleSubscriptionCreated).toHaveBeenCalledWith(mockEvent);
      expect(result).toEqual({ received: true });
    });

    it('should handle subscription.updated webhook', async () => {
      const mockEvent = {
        id: 'evt_test123',
        type: 'customer.subscription.updated',
        data: { object: {} },
      } as Stripe.Event;

      const mockRequest = createMockRequest(mockEvent);
      const signature = 'valid_signature';

      stripeService.constructWebhookEvent.mockReturnValue(mockEvent);
      billingService.handleSubscriptionUpdated.mockResolvedValue(undefined);

      const result = await controller.handleWebhook(mockRequest as any, signature);

      expect(billingService.handleSubscriptionUpdated).toHaveBeenCalledWith(mockEvent);
      expect(result).toEqual({ received: true });
    });

    it('should handle subscription.deleted webhook', async () => {
      const mockEvent = {
        id: 'evt_test123',
        type: 'customer.subscription.deleted',
        data: { object: {} },
      } as Stripe.Event;

      const mockRequest = createMockRequest(mockEvent);
      const signature = 'valid_signature';

      stripeService.constructWebhookEvent.mockReturnValue(mockEvent);
      billingService.handleSubscriptionCancelled.mockResolvedValue(undefined);

      const result = await controller.handleWebhook(mockRequest as any, signature);

      expect(billingService.handleSubscriptionCancelled).toHaveBeenCalledWith(mockEvent);
      expect(result).toEqual({ received: true });
    });

    it('should handle invoice.payment_succeeded webhook', async () => {
      const mockEvent = {
        id: 'evt_test123',
        type: 'invoice.payment_succeeded',
        data: { object: {} },
      } as Stripe.Event;

      const mockRequest = createMockRequest(mockEvent);
      const signature = 'valid_signature';

      stripeService.constructWebhookEvent.mockReturnValue(mockEvent);
      billingService.handlePaymentSucceeded.mockResolvedValue(undefined);

      const result = await controller.handleWebhook(mockRequest as any, signature);

      expect(billingService.handlePaymentSucceeded).toHaveBeenCalledWith(mockEvent);
      expect(result).toEqual({ received: true });
    });

    it('should handle invoice.payment_failed webhook', async () => {
      const mockEvent = {
        id: 'evt_test123',
        type: 'invoice.payment_failed',
        data: { object: {} },
      } as Stripe.Event;

      const mockRequest = createMockRequest(mockEvent);
      const signature = 'valid_signature';

      stripeService.constructWebhookEvent.mockReturnValue(mockEvent);
      billingService.handlePaymentFailed.mockResolvedValue(undefined);

      const result = await controller.handleWebhook(mockRequest as any, signature);

      expect(billingService.handlePaymentFailed).toHaveBeenCalledWith(mockEvent);
      expect(result).toEqual({ received: true });
    });

    it('should log and ignore unhandled webhook types', async () => {
      const mockEvent = {
        id: 'evt_test123',
        type: 'customer.created',
        data: { object: {} },
      } as Stripe.Event;

      const mockRequest = createMockRequest(mockEvent);
      const signature = 'valid_signature';

      stripeService.constructWebhookEvent.mockReturnValue(mockEvent);

      const result = await controller.handleWebhook(mockRequest as any, signature);

      expect(result).toEqual({ received: true });
      expect(billingService.handleSubscriptionCreated).not.toHaveBeenCalled();
    });

    it('should return error when webhook secret is not configured', async () => {
      configService.get.mockReturnValue(null);

      const mockRequest = createMockRequest({});
      const signature = 'test_signature';

      const result = await controller.handleWebhook(mockRequest as any, signature);

      expect(result).toEqual({
        received: false,
        error: 'Webhook secret not configured',
      });
    });

    it('should return error for invalid signature', async () => {
      const mockRequest = createMockRequest({});
      const signature = 'invalid_signature';

      stripeService.constructWebhookEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const result = await controller.handleWebhook(mockRequest as any, signature);

      expect(result).toEqual({
        received: false,
        error: 'Invalid signature',
      });
    });

    it('should return error when webhook processing fails', async () => {
      const mockEvent = {
        id: 'evt_test123',
        type: 'customer.subscription.created',
        data: { object: {} },
      } as Stripe.Event;

      const mockRequest = createMockRequest(mockEvent);
      const signature = 'valid_signature';

      stripeService.constructWebhookEvent.mockReturnValue(mockEvent);
      billingService.handleSubscriptionCreated.mockRejectedValue(new Error('Database error'));

      const result = await controller.handleWebhook(mockRequest as any, signature);

      expect(result).toEqual({
        received: false,
        error: 'Database error',
      });
    });

    it('should handle checkout.session.completed webhook', async () => {
      const mockEvent = {
        id: 'evt_test123',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test123',
            metadata: { janua_user_id: 'user-123', plan: 'pro' },
          },
        },
      } as Stripe.Event;

      const mockRequest = createMockRequest(mockEvent);
      const signature = 'valid_signature';

      stripeService.constructWebhookEvent.mockReturnValue(mockEvent);
      billingService.handleCheckoutCompleted.mockResolvedValue(undefined);

      const result = await controller.handleWebhook(mockRequest as any, signature);

      expect(billingService.handleCheckoutCompleted).toHaveBeenCalledWith(mockEvent);
      expect(result).toEqual({ received: true });
    });
  });

  describe('GET /billing/checkout', () => {
    const mockReply = {
      status: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis(),
    } as any;

    it('should redirect to checkout URL for valid request', async () => {
      billingService.createExternalCheckout.mockResolvedValue(
        'https://checkout.stripe.com/pay/cs_test123'
      );

      await controller.publicCheckout(
        { user_id: 'user-123', plan: 'pro', return_url: 'https://app.dhan.am/billing' } as any,
        mockReply
      );

      expect(billingService.createExternalCheckout).toHaveBeenCalledWith(
        'user-123',
        'pro',
        'https://app.dhan.am/billing',
        undefined
      );
      expect(mockReply.status).toHaveBeenCalledWith(302);
      expect(mockReply.redirect).toHaveBeenCalledWith(
        'https://checkout.stripe.com/pay/cs_test123'
      );
    });

    it('should pass product query param to billing service', async () => {
      billingService.createExternalCheckout.mockResolvedValue(
        'https://checkout.stripe.com/pay/cs_test456'
      );

      await controller.publicCheckout(
        {
          user_id: 'user-123',
          plan: 'enclii_pro',
          return_url: 'https://app.enclii.dev/billing',
          product: 'enclii',
        } as any,
        mockReply
      );

      expect(billingService.createExternalCheckout).toHaveBeenCalledWith(
        'user-123',
        'enclii_pro',
        'https://app.enclii.dev/billing',
        'enclii'
      );
    });

    it('should reject return_url with disallowed host', async () => {
      await expect(
        controller.publicCheckout(
          { user_id: 'user-123', plan: 'pro', return_url: 'https://evil.com/phish' } as any,
          mockReply
        )
      ).rejects.toThrow('return_url host is not allowed');
    });

    it('should reject invalid return_url', async () => {
      await expect(
        controller.publicCheckout(
          { user_id: 'user-123', plan: 'pro', return_url: 'not-a-url' } as any,
          mockReply
        )
      ).rejects.toThrow('return_url is not a valid URL');
    });
  });
});
