import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { PaymentGatewayRegistry } from '../gateways/payment-gateway.registry';

import {
  CheckoutRoutingPolicyService,
  CheckoutRoutingContext,
} from '../services/checkout-routing-policy.service';
import { PaymentRouterService } from '../services/payment-router.service';
import { PriceResolverService } from '../services/price-resolver.service';

describe('CheckoutRoutingPolicyService', () => {
  let service: CheckoutRoutingPolicyService;
  let gatewayRegistry: jest.Mocked<PaymentGatewayRegistry>;
  let paymentRouter: jest.Mocked<PaymentRouterService>;
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
          provide: PaymentGatewayRegistry,
          useValue: {
            isConfigured: jest.fn((id: string) => {
              if (id === 'janua') return false;
              if (id === 'legacy_stripe') return true;
              return true;
            }),
            isHybridCheckoutAvailable: jest.fn((country: string) => {
              if (country === 'MX') return true;
              return true;
            }),
            resolveHybridCheckoutGateway: jest.fn((country: string) =>
              country === 'MX' ? 'stripe_mx' : 'paddle'
            ),
            get: jest.fn((id: string) => ({
              id,
              getProviderConfig: jest.fn(() =>
                id === 'stripe_mx'
                  ? {
                      currency: 'MXN',
                      paymentMethods: ['card', 'oxxo', 'customer_balance'],
                      taxHandling: 'automatic',
                    }
                  : {
                      currency: 'USD',
                      paymentMethods: ['card', 'paypal'],
                      taxHandling: 'merchant-of-record',
                    }
              ),
            })),
            toGatewayId: jest.fn((provider: string) => provider),
          },
        },
        {
          provide: PaymentRouterService,
          useValue: {
            createCheckout: jest.fn().mockResolvedValue({
              checkoutUrl: 'https://checkout.example/mx',
              sessionId: 'cs_mx',
              provider: 'stripe_mx',
              currency: 'MXN',
            }),
          },
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
    gatewayRegistry = module.get(PaymentGatewayRegistry);
    paymentRouter = module.get(PaymentRouterService);
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
      gatewayRegistry.isConfigured.mockImplementation((id: string) => id === 'janua');
      const decision = service.resolveProvider(baseContext);
      expect(decision.provider).toBe('janua');
    });

    it('falls back to legacy Stripe when hybrid router unavailable', () => {
      gatewayRegistry.isHybridCheckoutAvailable.mockReturnValue(false);
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

  describe('routing matrix', () => {
    const matrix: Array<{
      label: string;
      context: Partial<CheckoutRoutingContext>;
      expectedProvider: string;
    }> = [
      {
        label: 'karafiel MX',
        context: { product: 'karafiel', countryCode: 'MX', plan: 'pro' },
        expectedProvider: 'stripe_mx',
      },
      {
        label: 'dhanam US',
        context: { product: 'dhanam', countryCode: 'US', plan: 'essentials' },
        expectedProvider: 'paddle',
      },
      {
        label: 'tezca CA',
        context: { product: 'tezca', countryCode: 'CA', plan: 'pro_yearly' },
        expectedProvider: 'paddle',
      },
      {
        label: 'dhanam BR',
        context: { product: 'dhanam', countryCode: 'BR', plan: 'premium' },
        expectedProvider: 'paddle',
      },
    ];

    it.each(matrix)(
      'resolveProvider routes $label to $expectedProvider',
      ({ context, expectedProvider }) => {
        const decision = service.resolveProvider({ ...baseContext, ...context });
        expect(decision.provider).toBe(expectedProvider);
      }
    );

    it.each(matrix)('preview returns resolvable metadata for $label', async ({ context }) => {
      const preview = await service.preview({ ...baseContext, ...context });
      expect(preview.priceIdResolvable).toBe(true);
      expect(preview.provider).toBeTruthy();
      expect(preview.routeReason).toBeTruthy();
    });
  });
});
