import {
  CanonicalPaymentEvent,
  GatewayCheckoutInput,
  GatewayCheckoutResult,
  GatewayPosChargeInput,
  GatewayPosChargeResult,
  GatewayProviderConfig,
  GatewayRefundInput,
  GatewayRefundResult,
  PaymentGatewayCapabilities,
  PaymentGatewayId,
} from './payment-gateway.types';

/**
 * Adapter contract for all payment service providers used by Dhanam's billing
 * boundary. See ADR-008 and `PaymentGatewayRegistry`.
 *
 * Not every gateway implements every method — callers must check
 * {@link PaymentGatewayCapabilities} before dispatching.
 */
export interface PaymentGatewayPort {
  readonly id: PaymentGatewayId;
  readonly capabilities: PaymentGatewayCapabilities;

  isConfigured(): boolean;

  /** Geography hint for hybrid checkout (optional). */
  supportsCountry?(countryCode: string): boolean;

  getProviderConfig?(countryCode: string): GatewayProviderConfig;

  createSubscriptionCheckout?(input: GatewayCheckoutInput): Promise<GatewayCheckoutResult>;

  createPosCharge?(input: GatewayPosChargeInput): Promise<GatewayPosChargeResult>;

  createRefund?(input: GatewayRefundInput): Promise<GatewayRefundResult>;

  verifyWebhook?(body: string, signature: string): Promise<CanonicalPaymentEvent | null>;
}

export class PaymentGatewayCapabilityError extends Error {
  constructor(
    public readonly gatewayId: PaymentGatewayId,
    public readonly capability: keyof PaymentGatewayCapabilities
  ) {
    super(
      `Payment gateway "${gatewayId}" does not support "${capability}". ` +
        `Choose a gateway whose capabilities.${capability} is true.`
    );
    this.name = 'PaymentGatewayCapabilityError';
  }
}

export function assertGatewayCapability(
  gateway: PaymentGatewayPort,
  capability: keyof PaymentGatewayCapabilities
): void {
  if (!gateway.capabilities[capability]) {
    throw new PaymentGatewayCapabilityError(gateway.id, capability);
  }
}
