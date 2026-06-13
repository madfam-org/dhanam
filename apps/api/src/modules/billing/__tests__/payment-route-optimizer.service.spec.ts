import { readFileSync } from 'fs';
import { join } from 'path';
import { Test, TestingModule } from '@nestjs/testing';

import { PaymentGatewayRegistry } from '../gateways/payment-gateway.registry';
import type { FeeScheduleFile } from '../config/payment-route-fee-schedule';

import { PaymentRouteOptimizerService } from '../services/payment-route-optimizer.service';
import { PaymentRouteFeeScheduleService } from '../services/payment-route-fee-schedule.service';

describe('PaymentRouteOptimizerService', () => {
  let service: PaymentRouteOptimizerService;

  const bundled: FeeScheduleFile = JSON.parse(
    readFileSync(join(__dirname, '..', 'config', 'payment-route-fee-schedule.json'), 'utf8')
  );

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentRouteOptimizerService,
        {
          provide: PaymentRouteFeeScheduleService,
          useValue: {
            getEntries: () => bundled.entries,
          },
        },
        {
          provide: PaymentGatewayRegistry,
          useValue: {
            isConfigured: jest.fn((id: string) =>
              ['stripe_mx', 'paddle', 'legacy_stripe', 'conekta'].includes(id)
            ),
          },
        },
      ],
    }).compile();

    service = module.get(PaymentRouteOptimizerService);
  });

  it('recommends SPEI over card for MX subscriptions (lower total cost)', () => {
    const recommendation = service.recommend({
      countryCode: 'MX',
      amountMinor: 19_900,
      currency: 'MXN',
      subscriptionCheckout: true,
    });

    expect(recommendation).not.toBeNull();
    expect(recommendation!.provider).toBe('stripe_mx');
    expect(['spei', 'customer_balance']).toContain(recommendation!.paymentMethod);
    expect(recommendation!.savingsVsCardMinor).toBeGreaterThan(0);
    expect(recommendation!.instrumentSuggestions[0].recommended).toBe(true);
  });

  it('honours explicit paymentMethod when ranking providers', () => {
    const recommendation = service.recommend({
      countryCode: 'MX',
      amountMinor: 19_900,
      currency: 'MXN',
      paymentMethod: 'oxxo',
      subscriptionCheckout: true,
    });

    expect(recommendation!.paymentMethod).toBe('oxxo');
    expect(recommendation!.routeReason).toContain('oxxo');
  });

  it('compares paddle vs legacy Stripe for US card checkout', () => {
    const recommendation = service.recommend({
      countryCode: 'US',
      amountMinor: 1_199,
      currency: 'USD',
      paymentMethod: 'card',
      subscriptionCheckout: true,
    });

    expect(recommendation!.provider).toBe('legacy_stripe');
    expect(recommendation!.totalEconomicCostMinor).toBeLessThan(
      Math.round((1_199 * 500) / 10_000) + 50
    );
  });

  it('includes POS-only conekta when subscriptionCheckout is false', () => {
    const recommendation = service.recommend({
      countryCode: 'MX',
      amountMinor: 5_000,
      currency: 'MXN',
      paymentMethod: 'spei',
      subscriptionCheckout: false,
    });

    expect(recommendation!.provider).toBe('stripe_mx');
    const conektaSuggestion = recommendation!.instrumentSuggestions.find(
      (s) => s.provider === 'conekta'
    );
    expect(conektaSuggestion).toBeDefined();
  });
});
