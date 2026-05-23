import { PaymentGatewayRegistry } from '../gateways/payment-gateway.registry';
import { ConektaGateway } from '../gateways/conekta.gateway';
import { JanuaBillingGateway } from '../gateways/janua-billing.gateway';
import { LegacyStripeGateway } from '../gateways/legacy-stripe.gateway';
import { PaddleGateway } from '../gateways/paddle.gateway';
import { StripeMxGateway } from '../gateways/stripe-mx.gateway';

describe('PaymentGatewayRegistry', () => {
  const stripeMxGateway = {
    id: 'stripe_mx',
    isConfigured: jest.fn().mockReturnValue(true),
    getProviderConfig: jest.fn(),
  } as unknown as StripeMxGateway;

  const paddleGateway = {
    id: 'paddle',
    isConfigured: jest.fn().mockReturnValue(true),
    getProviderConfig: jest.fn(),
  } as unknown as PaddleGateway;

  const conektaGateway = {
    id: 'conekta',
    isConfigured: jest.fn().mockReturnValue(true),
  } as unknown as ConektaGateway;

  const januaGateway = {
    id: 'janua',
    isConfigured: jest.fn().mockReturnValue(false),
  } as unknown as JanuaBillingGateway;

  const legacyGateway = {
    id: 'legacy_stripe',
    isConfigured: jest.fn().mockReturnValue(true),
  } as unknown as LegacyStripeGateway;

  let registry: PaymentGatewayRegistry;

  beforeEach(() => {
    registry = new PaymentGatewayRegistry(
      stripeMxGateway,
      paddleGateway,
      conektaGateway,
      januaGateway,
      legacyGateway
    );
  });

  it('resolves hybrid checkout gateway by country', () => {
    expect(registry.resolveHybridCheckoutGateway('MX')).toBe('stripe_mx');
    expect(registry.resolveHybridCheckoutGateway('US')).toBe('paddle');
  });

  it('falls back POS to Conekta when Stripe MX is unavailable', () => {
    (stripeMxGateway.isConfigured as jest.Mock).mockReturnValue(false);
    expect(
      registry.resolvePosGateway({
        countryCode: 'MX',
        currency: 'mxn',
        providerChoice: 'auto',
      })
    ).toBe('conekta');
  });

  it('returns configured gateway by id', () => {
    expect(registry.require('paddle').id).toBe('paddle');
  });
});
