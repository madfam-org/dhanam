import type { PaymentGatewayPort } from '../payment-gateway.port';
import type { PaymentGatewayId } from '../payment-gateway.types';
import { PaymentGatewayRegistry } from '../payment-gateway.registry';

function gateway(id: PaymentGatewayId, configured: boolean): PaymentGatewayPort {
  return { id, isConfigured: () => configured } as unknown as PaymentGatewayPort;
}

function makeRegistry(
  configured: Partial<Record<PaymentGatewayId, boolean>>
): PaymentGatewayRegistry {
  return new PaymentGatewayRegistry(
    gateway('stripe_mx', configured.stripe_mx ?? false),
    gateway('paddle', configured.paddle ?? false),
    gateway('conekta', configured.conekta ?? false),
    gateway('janua', configured.janua ?? false),
    gateway('legacy_stripe', configured.legacy_stripe ?? false)
  );
}

describe('PaymentGatewayRegistry.resolveHybridCheckoutGateway', () => {
  it('routes Mexico to stripe_mx when configured', () => {
    expect(makeRegistry({ stripe_mx: true }).resolveHybridCheckoutGateway('MX')).toBe('stripe_mx');
  });

  it('prefers Paddle (MoR) for international when configured', () => {
    const registry = makeRegistry({ stripe_mx: true, paddle: true });
    expect(registry.resolveHybridCheckoutGateway('US')).toBe('paddle');
    expect(registry.resolveHybridCheckoutGateway('DE')).toBe('paddle');
  });

  it('falls back international to stripe_mx when Paddle is not configured', () => {
    const registry = makeRegistry({ stripe_mx: true });
    expect(registry.resolveHybridCheckoutGateway('US')).toBe('stripe_mx');
    expect(registry.resolveHybridCheckoutGateway('CO')).toBe('stripe_mx');
  });

  it('returns null when no hybrid gateway is configured', () => {
    const registry = makeRegistry({});
    expect(registry.resolveHybridCheckoutGateway('US')).toBeNull();
    expect(registry.resolveHybridCheckoutGateway('MX')).toBeNull();
  });

  it('isHybridCheckoutAvailable reflects resolution', () => {
    expect(makeRegistry({ stripe_mx: true }).isHybridCheckoutAvailable('US')).toBe(true);
    expect(makeRegistry({}).isHybridCheckoutAvailable('US')).toBe(false);
  });
});
