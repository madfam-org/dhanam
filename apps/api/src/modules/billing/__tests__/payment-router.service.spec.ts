import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../core/prisma/prisma.service';
import { PaddleService } from '../services/paddle.service';
import { PaymentRouterService, PaymentProvider } from '../services/payment-router.service';
import { StripeMxService } from '../services/stripe-mx.service';

describe('PaymentRouterService', () => {
  let service: PaymentRouterService;
  let prisma: jest.Mocked<PrismaService>;
  let stripeMx: jest.Mocked<StripeMxService>;
  let paddle: jest.Mocked<PaddleService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    stripeCustomerId: null,
    paddleCustomerId: null,
    billingCountry: null,
    billingProvider: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentRouterService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: StripeMxService,
          useValue: {
            isConfigured: jest.fn().mockReturnValue(true),
            createCustomer: jest.fn(),
            createCheckoutSession: jest.fn(),
            createPortalSession: jest.fn(),
            cancelSubscription: jest.fn(),
          },
        },
        {
          provide: PaddleService,
          useValue: {
            isConfigured: jest.fn().mockReturnValue(true),
            createCustomer: jest.fn(),
            createTransaction: jest.fn(),
            cancelSubscription: jest.fn(),
            getClientToken: jest.fn().mockReturnValue('test_client_token'),
            getEnvironment: jest.fn().mockReturnValue('sandbox'),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentRouterService>(PaymentRouterService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    stripeMx = module.get(StripeMxService) as jest.Mocked<StripeMxService>;
    paddle = module.get(PaddleService) as jest.Mocked<PaddleService>;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProviderForCountry', () => {
    it('should route Mexico to stripe_mx', () => {
      const config = service.getProviderForCountry('MX');

      expect(config).toEqual({
        provider: 'stripe_mx',
        currency: 'MXN',
        paymentMethods: ['card', 'oxxo', 'customer_balance'],
        taxHandling: 'automatic',
      });
    });

    it('should route US to paddle', () => {
      const config = service.getProviderForCountry('US');

      expect(config).toEqual({
        provider: 'paddle',
        currency: 'USD',
        paymentMethods: ['card', 'paypal', 'apple_pay', 'google_pay'],
        taxHandling: 'automatic',
      });
    });

    it('should route other countries to paddle', () => {
      const countries = ['DE', 'FR', 'GB', 'JP', 'BR'];

      countries.forEach((country) => {
        const config = service.getProviderForCountry(country);
        expect(config.provider).toBe('paddle');
        expect(config.currency).toBe('USD');
      });
    });
  });

  describe('createCheckout', () => {
    it('should create Stripe MX checkout for Mexican users', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.user.update.mockResolvedValue({ ...mockUser, stripeCustomerId: 'cus_mx_123' } as any);

      stripeMx.createCustomer.mockResolvedValue({ id: 'cus_mx_123' } as any);
      stripeMx.createCheckoutSession.mockResolvedValue({
        id: 'cs_mx_test123',
        url: 'https://checkout.stripe.com/pay/cs_mx_test123',
      } as any);

      const result = await service.createCheckout({
        userId: 'user-123',
        priceId: 'price_premium_mx',
        countryCode: 'MX',
        successUrl: 'https://app.dhanam.com/success',
        cancelUrl: 'https://app.dhanam.com/cancel',
      });

      expect(result).toEqual({
        checkoutUrl: 'https://checkout.stripe.com/pay/cs_mx_test123',
        sessionId: 'cs_mx_test123',
        provider: 'stripe_mx',
        currency: 'MXN',
      });

      expect(stripeMx.createCustomer).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'Test User',
        metadata: { dhanam_user_id: 'user-123' },
      });
    });

    it('should create Paddle checkout for non-Mexican users', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.user.update.mockResolvedValue({ ...mockUser, paddleCustomerId: 'ctm_123' } as any);

      paddle.createCustomer.mockResolvedValue({
        customerId: 'ctm_123',
        email: 'test@example.com',
      });
      paddle.createTransaction.mockResolvedValue({
        transactionId: 'txn_123',
        checkoutUrl: 'https://checkout.paddle.com/checkout/txn_123',
      });

      const result = await service.createCheckout({
        userId: 'user-123',
        priceId: 'price_premium_usd',
        countryCode: 'US',
        successUrl: 'https://app.dhanam.com/success',
        cancelUrl: 'https://app.dhanam.com/cancel',
      });

      expect(result).toEqual({
        checkoutUrl: 'https://checkout.paddle.com/checkout/txn_123',
        sessionId: 'txn_123',
        provider: 'paddle',
        currency: 'USD',
      });

      expect(paddle.createCustomer).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'Test User',
        countryCode: 'US',
        metadata: { dhanam_user_id: 'user-123' },
      });
    });

    it('should use existing Stripe customer ID if available', async () => {
      const userWithStripe = { ...mockUser, stripeCustomerId: 'cus_existing_mx' };
      prisma.user.findUnique.mockResolvedValue(userWithStripe as any);

      stripeMx.createCheckoutSession.mockResolvedValue({
        id: 'cs_mx_test123',
        url: 'https://checkout.stripe.com/pay/cs_mx_test123',
      } as any);

      await service.createCheckout({
        userId: 'user-123',
        priceId: 'price_premium_mx',
        countryCode: 'MX',
        successUrl: 'https://app.dhanam.com/success',
        cancelUrl: 'https://app.dhanam.com/cancel',
      });

      expect(stripeMx.createCustomer).not.toHaveBeenCalled();
      expect(stripeMx.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: 'cus_existing_mx' })
      );
    });

    it('should use existing Paddle customer ID if available', async () => {
      const userWithPaddle = { ...mockUser, paddleCustomerId: 'ctm_existing' };
      prisma.user.findUnique.mockResolvedValue(userWithPaddle as any);

      paddle.createTransaction.mockResolvedValue({
        transactionId: 'txn_123',
        checkoutUrl: 'https://checkout.paddle.com/checkout/txn_123',
      });

      await service.createCheckout({
        userId: 'user-123',
        priceId: 'price_premium_usd',
        countryCode: 'US',
        successUrl: 'https://app.dhanam.com/success',
        cancelUrl: 'https://app.dhanam.com/cancel',
      });

      expect(paddle.createCustomer).not.toHaveBeenCalled();
      expect(paddle.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: 'ctm_existing' })
      );
    });

    it('should throw error if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createCheckout({
          userId: 'nonexistent',
          priceId: 'price_123',
          countryCode: 'MX',
          successUrl: 'https://app.dhanam.com/success',
          cancelUrl: 'https://app.dhanam.com/cancel',
        })
      ).rejects.toThrow('User not found');
    });

    it('should throw error if Stripe MX not configured for MX checkout', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      stripeMx.isConfigured.mockReturnValue(false);

      await expect(
        service.createCheckout({
          userId: 'user-123',
          priceId: 'price_123',
          countryCode: 'MX',
          successUrl: 'https://app.dhanam.com/success',
          cancelUrl: 'https://app.dhanam.com/cancel',
        })
      ).rejects.toThrow('Stripe MX not configured');
    });

    it('should throw error if Paddle not configured for non-MX checkout', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      paddle.isConfigured.mockReturnValue(false);

      await expect(
        service.createCheckout({
          userId: 'user-123',
          priceId: 'price_123',
          countryCode: 'US',
          successUrl: 'https://app.dhanam.com/success',
          cancelUrl: 'https://app.dhanam.com/cancel',
        })
      ).rejects.toThrow('Paddle not configured');
    });
  });

  describe('createPortalSession', () => {
    it('should create Stripe portal session for Stripe MX users', async () => {
      const userWithStripe = {
        ...mockUser,
        stripeCustomerId: 'cus_mx_123',
        billingProvider: 'stripe_mx',
      };
      prisma.user.findUnique.mockResolvedValue(userWithStripe as any);

      stripeMx.createPortalSession.mockResolvedValue({
        url: 'https://billing.stripe.com/session/test123',
      } as any);

      const result = await service.createPortalSession(
        'user-123',
        'https://app.dhanam.com/billing'
      );

      expect(result).toEqual({
        portalUrl: 'https://billing.stripe.com/session/test123',
        provider: 'stripe_mx',
      });

      expect(stripeMx.createPortalSession).toHaveBeenCalledWith({
        customerId: 'cus_mx_123',
        returnUrl: 'https://app.dhanam.com/billing',
      });
    });

    it('should return manage URL for Paddle users', async () => {
      const userWithPaddle = {
        ...mockUser,
        paddleCustomerId: 'ctm_123',
        billingProvider: 'paddle',
      };
      prisma.user.findUnique.mockResolvedValue(userWithPaddle as any);

      const result = await service.createPortalSession(
        'user-123',
        'https://app.dhanam.com/billing'
      );

      expect(result).toEqual({
        portalUrl: 'https://app.dhanam.com/billing?manage=paddle',
        provider: 'paddle',
      });
    });

    it('should throw error if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createPortalSession('nonexistent', 'https://app.dhanam.com/billing')
      ).rejects.toThrow('User not found');
    });

    it('should throw error if user has no billing provider', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);

      await expect(
        service.createPortalSession('user-123', 'https://app.dhanam.com/billing')
      ).rejects.toThrow('User has no active billing provider');
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel Stripe MX subscription', async () => {
      const userWithStripe = {
        ...mockUser,
        stripeSubscriptionId: 'sub_mx_123',
        billingProvider: 'stripe_mx',
      };
      prisma.user.findUnique.mockResolvedValue(userWithStripe as any);

      await service.cancelSubscription('user-123', false);

      expect(stripeMx.cancelSubscription).toHaveBeenCalledWith('sub_mx_123', false);
    });

    it('should cancel Paddle subscription', async () => {
      const userWithPaddle = {
        ...mockUser,
        paddleSubscriptionId: 'sub_paddle_123',
        billingProvider: 'paddle',
      };
      prisma.user.findUnique.mockResolvedValue(userWithPaddle as any);

      await service.cancelSubscription('user-123', true);

      expect(paddle.cancelSubscription).toHaveBeenCalledWith('sub_paddle_123', true);
    });

    it('should throw error if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.cancelSubscription('nonexistent', false)).rejects.toThrow(
        'User not found'
      );
    });

    it('should throw error if no active subscription', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);

      await expect(service.cancelSubscription('user-123', false)).rejects.toThrow(
        'No active subscription found'
      );
    });
  });

  describe('getPlans', () => {
    it('should return MXN plans for Mexico', () => {
      const plans = service.getPlans('MX');

      expect(plans).toHaveLength(5);

      const freePlan = plans.find((p) => p.id === 'community');
      expect(freePlan).toMatchObject({
        price: 0,
        currency: 'MXN',
        name: 'Comunidad',
        provider: 'stripe_mx',
      });

      const premiumMonthly = plans.find((p) => p.id === 'pro_monthly');
      expect(premiumMonthly).toMatchObject({
        price: 199,
        currency: 'MXN',
        provider: 'stripe_mx',
      });

      const premiumYearly = plans.find((p) => p.id === 'pro_yearly');
      expect(premiumYearly).toMatchObject({
        price: 1999,
        currency: 'MXN',
        provider: 'stripe_mx',
      });
    });

    it('should return USD plans for US', () => {
      const plans = service.getPlans('US');

      expect(plans).toHaveLength(5);

      const freePlan = plans.find((p) => p.id === 'community');
      expect(freePlan).toMatchObject({
        price: 0,
        currency: 'USD',
        name: 'Community',
        provider: 'paddle',
      });

      const premiumMonthly = plans.find((p) => p.id === 'pro_monthly');
      expect(premiumMonthly).toMatchObject({
        price: 11.99,
        currency: 'USD',
        provider: 'paddle',
      });

      const premiumYearly = plans.find((p) => p.id === 'pro_yearly');
      expect(premiumYearly).toMatchObject({
        price: 119.99,
        currency: 'USD',
        provider: 'paddle',
      });
    });

    it('should return Spanish feature descriptions for Mexico', () => {
      const plans = service.getPlans('MX');
      const freePlan = plans.find((p) => p.id === 'community');

      expect(freePlan?.features).toContain('Simulaciones y ESG ilimitados');
    });

    it('should return English feature descriptions for other countries', () => {
      const plans = service.getPlans('US');
      const freePlan = plans.find((p) => p.id === 'community');

      expect(freePlan?.features).toContain('Unlimited simulations & ESG');
    });
  });

  describe('getPaddleClientConfig', () => {
    it('should return Paddle client config when configured', () => {
      paddle.isConfigured.mockReturnValue(true);

      const config = service.getPaddleClientConfig();

      expect(config).toEqual({
        clientToken: 'test_client_token',
        environment: 'sandbox',
      });
    });

    it('should return null when Paddle not configured', () => {
      paddle.isConfigured.mockReturnValue(false);

      const config = service.getPaddleClientConfig();

      expect(config).toBeNull();
    });
  });
});
