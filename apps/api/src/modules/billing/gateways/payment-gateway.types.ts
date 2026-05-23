/**
 * Shared types for {@link PaymentGatewayPort} adapters and checkout routing.
 *
 * Canonical payment envelopes for ecosystem fan-out remain defined in
 * `stripe-mx-spei-relay.service.ts` (`DhanamPaymentEnvelope`). Gateway adapters
 * produce provider-native events; relay services map them to that envelope.
 */

/** Checkout route targets aligned with operator audit logs and POS providers. */
export type PaymentGatewayId = 'stripe_mx' | 'paddle' | 'conekta' | 'janua' | 'legacy_stripe';

export interface PaymentGatewayCapabilities {
  subscriptionCheckout: boolean;
  oneOffPosCharge: boolean;
  refunds: boolean;
  webhookVerification: boolean;
}

export interface GatewayProviderConfig {
  currency: string;
  paymentMethods: string[];
  taxHandling: 'automatic' | 'manual' | 'merchant-of-record' | 'none';
}

export interface GatewayCheckoutInput {
  customerId?: string;
  customerEmail: string;
  customerName?: string;
  priceId: string;
  countryCode: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
  /** Janua-only: organization correlation. */
  orgId?: string;
}

export interface GatewayCheckoutResult {
  checkoutUrl: string;
  sessionId: string;
  currency: string;
}

export interface GatewayPosChargeInput {
  amountMinor: number;
  currency: string;
  customerEmail: string;
  customerName?: string;
  customerId?: string;
  description: string;
  paymentMethod?: 'card' | 'oxxo' | 'customer_balance' | 'spei';
  metadata: Record<string, string>;
}

export interface GatewayPosChargeResult {
  paymentIntentId: string;
  clientSecret: string | null;
  status: string;
  currency: string;
  amountMinor: number;
  /** Conekta-only auxiliary id when present. */
  chargeId?: string;
  /** SPEI/OXXO reference when present. */
  paymentReference?: string | null;
}

export interface GatewayRefundInput {
  paymentIntentId: string;
  amountMinor?: number;
  reason?: string;
  metadata?: Record<string, string>;
}

export interface GatewayRefundResult {
  refundId: string;
  status: string | null;
  amountMinor: number;
  currency: string;
  metadata?: Record<string, unknown>;
}

/** Normalized payment lifecycle event type for inbound webhook processing. */
export type CanonicalPaymentEventType = 'payment.succeeded' | 'payment.failed' | 'payment.refunded';

export interface CanonicalPaymentEvent {
  type: CanonicalPaymentEventType;
  gatewayId: PaymentGatewayId;
  externalEventId: string;
  paymentId: string;
  amountMinor: number;
  currency: string;
  livemode: boolean;
  customerId?: string;
  metadata?: Record<string, string>;
  raw: unknown;
}
