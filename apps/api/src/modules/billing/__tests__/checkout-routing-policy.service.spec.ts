import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { JanuaBillingService } from '../janua-billing.service';

import {
  CheckoutRoutingPolicyService,
  CheckoutRoutingContext,
} from '../services/checkout-routing-policy.service';
import { PaddleService } from '../services/paddle.service';
import { PaymentRouterService } from '../services/payment-router.service';
import { PriceResolverService } from '../services/price-resolver.service';
import { StripeMxService } from '../services/stripe-mx.service';

describe('CheckoutRoutingPolicyService', () => {
  let service: CheckoutRoutingPolicyService;
  let januaBilling: jest.Mocked<JanuaBillingService>;
  let paymentRouter: jest.Mocked<PaymentRouterService>;
  let stripeMx: jest.Mocked<StripeMxService>;
  let paddle: jest.Mocked<PaddleService>;
  let priceResolver: jest.Mocked<PriceResolverService>;

  const baseContext: CheckoutRoutingContext = {
    userId: 'user-1',
    plan: 'pro',
    product: 'dhanam',
    countryCode: 'MX',
    successUrl: 'https://app.dhan.am/billing/success',
    cancelUrl: 'https://app.dhan.am/billing/cancel',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutRoutingPolicyService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'FEATURE_UNIFIED_CHECKOUT_ROUTING') return 'true';
              if (key === 'STRIPE_SECRET_KEY') return 'sk_test';
              if (key === 'STRIPE_PREMIUM_PRICE_ID') return 'price_pro';
              return defaultValue;
            }),
          },
        },
        {
          provide: JanuaBillingService,
          useValue: { isEnabled: jest.fn().mockReturnValue(false) },
        },
        {
          provide: PaymentRouterService,
          useValue: {
            getProviderForCountry: jest.fn((country: string) =>
              country === 'MX'
                ? {
                    provider: 'stripe_mx',
                    currency: 'MXN',
                    paymentMethods: ['card', 'oxxo', 'customer_balance'],
                    taxHandling: 'automatic',
                  }
                : {
                    provider: 'paddle',
                    currency: 'USD',
                    paymentMethods: ['card', 'paypal'],
                    taxHandling: 'automatic',
                  }
            ),
            createCheckout: jest.fn().mockResolvedValue({
              checkoutUrl: 'https://checkout.example/mx',
              sessionId: 'cs_mx',
              provider: 'stripe_mx',
              currency: 'MXN',
            }),
          },
        },
        {
          provide: StripeMxService,
          useValue: { isConfigured: jest.fn().mockReturnValue(true) },
        },
        {
          provide: PaddleService,
          useValue: { isConfigured: jest.fn().mockReturnValue(true) },
        },
        {
          provide: PriceResolverService,
          useValue: {
            resolve: jest.fn().mockResolvedValue({ priceId: 'price_dhanam_pro' }),
          },
        },
      ],
    }).compile();

    service = module.get(CheckoutRoutingPolicyService);
    januaBilling = module.get(JanuaBillingService);
    paymentRouter = module.get(PaymentRouterService);
    stripeMx = module.get(StripeMxService);
    paddle = module.get(PaddleService);
    priceResolver = module.get(PriceResolverService);
  });

  describe('resolveProvider', () => {
    it('routes MX to stripe_mx when Janua is disabled', () => {
      const decision = service.resolveProvider(baseContext);
      expect(decision.provider).toBe('stripe_mx');
      expect(decision.reason).toBe('hybrid_router_mx');
    });

    it('routes US to paddle when hybrid router is available', () => {
      const decision = service.resolveProvider({ ...baseContext, countryCode: 'US' });
      expect(decision.provider).toBe('paddle');
    });

    it('prefers Janua when enabled', () => {
      januaBilling.isEnabled.mockReturnValue(true);
      const decision = service.resolveProvider(baseContext);
      expect(decision.provider).toBe('janua');
    });

    it('falls back to legacy Stripe when hybrid router unavailable', () => {
      stripeMx.isConfigured.mockReturnValue(false);
      paddle.isConfigured.mockReturnValue(false);
      const decision = service.resolveProvider({ ...baseContext, countryCode: 'US' });
      expect(decision.provider).toBe('legacy_stripe');
    });
  });

  describe('preview', () => {
    it('returns resolvable price metadata for MX checkout', async () => {
      const preview = await service.preview(baseContext);
      expect(preview.provider).toBe('stripe_mx');
      expect(preview.currency).toBe('MXN');
      expect(preview.priceIdResolvable).toBe(true);
      expect(preview.catalogPlanId).toBe('dhanam_pro');
    });
  });

  describe('tryHybridCheckout', () => {
    it('creates checkout through PaymentRouterService for MX', async () => {
      const result = await service.tryHybridCheckout(baseContext);
      expect(result).toEqual({
        checkoutUrl: 'https://checkout.example/mx',
        provider: 'stripe_mx',
        sessionId: 'cs_mx',
        currency: 'MXN',
      });
      expect(paymentRouter.createCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          priceId: 'price_dhanam_pro',
          countryCode: 'MX',
        })
      );
    });

    it('returns null when unified routing is disabled', async () => {
      const config = service['config'] as ConfigService;
      (config.get as jest.Mock).mockImplementation((key: string, defaultValue?: string) => {
        if (key === 'FEATURE_UNIFIED_CHECKOUT_ROUTING') return 'false';
        return defaultValue;
      });

      const result = await service.tryHybridCheckout(baseContext);
      expect(result).toBeNull();
    });

    it('returns null when price id cannot be resolved', async () => {
      priceResolver.resolve.mockRejectedValue(new Error('missing price'));
      const result = await service.tryHybridCheckout(baseContext);
      expect(result).toBeNull();
    });
  });
});
