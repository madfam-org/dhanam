/**
 * =============================================================================
 * IPaymentProcessor — formal adapter contract for all billing processors
 * =============================================================================
 *
 * Every processor (Stripe, Stripe MX, Paddle, Conekta/Polar via Janua) must
 * conform to this interface. Marketplace methods are OPTIONAL and the
 * processor declares its marketplace capability via the `capabilities`
 * object — the router checks capabilities before dispatching, and throws
 * NotSupportedError if a caller asks for marketplace routing against a
 * processor that doesn't have it.
 *
 * Adding a new processor: implement this interface + register in
 * PaymentRouterService. No other changes required.
 *
 * See docs/rfcs/connect-marketplace.md (RFC-5) for the full design.
 * =============================================================================
 */

import { Currency } from '@db';

export type ProcessorId = 'stripe' | 'stripe_mx' | 'paddle' | 'conekta' | 'polar';

export interface ProcessorCapabilities {
  /** Handles recurring subscription billing. */
  subscriptions: boolean;
  /** Supports one-off (non-subscription) charges. */
  oneOffCharges: boolean;
  /**
   * Supports marketplace / Connect use cases: merchant accounts,
   * destination charges, transfers, payouts, disputes.
   */
  marketplace: boolean;
  /** Emits dispute/chargeback webhooks. */
  disputes: boolean;
  /** Can enforce 3D Secure on card transactions. */
  threeDSecure: boolean;
  /** How tax is handled for this processor. */
  taxCompliance: 'merchant-of-record' | 'automatic' | 'manual' | 'none';
}

// ---------------------------------------------------------------------------
// Customer primitives
// ---------------------------------------------------------------------------

export interface CreateCustomerInput {
  email: string;
  name?: string;
  phone?: string;
  countryCode?: string;
  metadata?: Record<string, string>;
}

export interface CustomerHandle {
  externalId: string;
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Subscription / checkout primitives
// ---------------------------------------------------------------------------

export interface CreateCheckoutInput {
  customerId?: string;
  customerEmail: string;
  customerName?: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface CheckoutSessionHandle {
  sessionId: string;
  url: string;
  mode: 'subscription' | 'payment' | 'setup';
}

export interface CancelOptions {
  /** If true, cancel immediately; otherwise at period end. */
  immediately?: boolean;
  /** Prorate refunds when immediate. */
  prorate?: boolean;
}

// ---------------------------------------------------------------------------
// Marketplace primitives (capability-gated)
// ---------------------------------------------------------------------------

export interface CreateMerchantInput {
  userId: string;
  email: string;
  country: string;
  defaultCurrency: Currency;
  businessType?: 'individual' | 'company';
  metadata?: Record<string, string>;
}

export interface MerchantAccountHandle {
  externalId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirements?: {
    currentlyDue: string[];
    pastDue: string[];
    disabledReason?: string | null;
  };
}

export interface OnboardingLink {
  url: string;
  expiresAt: Date;
}

export interface CreateDestinationChargeInput {
  amount: number;
  currency: Currency;
  merchantExternalId: string;
  applicationFeeAmount?: number;
  description?: string;
  customerId?: string;
  paymentMethodId?: string;
  metadata?: Record<string, string>;
  /**
   * If true, the charge is authorized but not captured. Caller must
   * capture within Stripe's 7-day window (or the auth expires).
   */
  captureMethod?: 'automatic' | 'manual';
}

export interface ChargeHandle {
  externalId: string;
  amount: number;
  currency: Currency;
  status: 'succeeded' | 'pending' | 'failed' | 'requires_action';
  applicationFeeId?: string;
  transferId?: string;
  clientSecret?: string;
}

export interface CreateTransferInput {
  amount: number;
  currency: Currency;
  merchantExternalId: string;
  sourceChargeId?: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface TransferHandle {
  externalId: string;
  amount: number;
  currency: Currency;
  status: 'pending' | 'paid' | 'failed' | 'reversed';
}

export interface CreatePayoutInput {
  amount: number;
  currency: Currency;
  merchantExternalId: string;
  method?: 'standard' | 'instant';
  description?: string;
  metadata?: Record<string, string>;
}

export interface PayoutHandle {
  externalId: string;
  amount: number;
  currency: Currency;
  status: 'pending' | 'in_transit' | 'paid' | 'failed' | 'canceled';
  arrivalDate?: Date;
}

export interface MerchantBalance {
  available: Array<{ amount: number; currency: Currency }>;
  pending: Array<{ amount: number; currency: Currency }>;
}

export interface DisputeEvidence {
  productDescription?: string;
  customerCommunication?: string;
  receipt?: string;
  shippingDocumentation?: string;
  uncategorizedText?: string;
  [key: string]: string | undefined;
}

export interface DisputeHandle {
  externalId: string;
  status: string;
  amount: number;
  currency: Currency;
  reason: string;
  evidenceDueBy?: Date;
}

// ---------------------------------------------------------------------------
// Webhook verification
// ---------------------------------------------------------------------------

export interface VerifiedEvent {
  id: string;
  type: string;
  livemode: boolean;
  data: unknown;
  created: number;
}

// ---------------------------------------------------------------------------
// The interface itself
// ---------------------------------------------------------------------------

export interface IPaymentProcessor {
  readonly id: ProcessorId;
  readonly capabilities: ProcessorCapabilities;

  // Customer (all processors)
  createCustomer(input: CreateCustomerInput): Promise<CustomerHandle>;
  getCustomer(externalId: string): Promise<CustomerHandle>;

  // Subscriptions — processors with capabilities.subscriptions === true
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSessionHandle>;
  cancelSubscription(externalId: string, opts?: CancelOptions): Promise<void>;
  pauseSubscription(externalId: string, until: Date): Promise<void>;
  resumeSubscription(externalId: string): Promise<void>;

  // Marketplace — optional; only present when capabilities.marketplace === true
  createMerchantAccount?(input: CreateMerchantInput): Promise<MerchantAccountHandle>;
  createMerchantOnboardingLink?(
    externalId: string,
    returnUrl: string,
    refreshUrl: string
  ): Promise<OnboardingLink>;
  getMerchantAccount?(externalId: string): Promise<MerchantAccountHandle>;
  createDestinationCharge?(input: CreateDestinationChargeInput): Promise<ChargeHandle>;
  createTransfer?(input: CreateTransferInput): Promise<TransferHandle>;
  createPayout?(input: CreatePayoutInput): Promise<PayoutHandle>;
  getMerchantBalance?(externalId: string): Promise<MerchantBalance>;
  submitDisputeEvidence?(externalId: string, evidence: DisputeEvidence): Promise<DisputeHandle>;

  // Webhooks
  verifyWebhookSignature(body: string, signature: string): Promise<VerifiedEvent>;
}

/**
 * Thrown when a caller asks a processor to do something its capabilities
 * block allows it from doing. Mapped to HTTP 501 Not Implemented at the
 * controller boundary.
 */
export class ProcessorCapabilityError extends Error {
  constructor(
    public readonly processorId: ProcessorId,
    public readonly capability: keyof ProcessorCapabilities
  ) {
    super(
      `Processor "${processorId}" does not support "${capability}". ` +
        `Choose a processor whose capabilities.${capability} === true.`
    );
    this.name = 'ProcessorCapabilityError';
  }
}
