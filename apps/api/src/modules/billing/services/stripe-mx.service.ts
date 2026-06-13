/**
 * =============================================================================
 * Stripe Mexico Service
 * =============================================================================
 * Handles payments for Mexican market:
 * - Credit/Debit Cards (Visa, Mastercard, Amex)
 * - OXXO Cash Payments
 * - SPEI Bank Transfers
 * - Mexican Pesos (MXN) native pricing
 *
 * Credentials from dhanam-secrets K8s Secret:
 * - STRIPE_MX_PUBLISHABLE_KEY
 * - STRIPE_MX_SECRET_KEY
 * - STRIPE_MX_WEBHOOK_SECRET
 * =============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import { InfrastructureException } from '../../../core/exceptions/domain-exceptions';

export interface StripeMxCheckoutParams {
  customerId?: string;
  customerEmail: string;
  customerName?: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
  paymentMethods?: ('card' | 'oxxo' | 'customer_balance')[];
}

export interface StripeMxCustomerParams {
  email: string;
  name?: string;
  phone?: string;
  metadata?: Record<string, string>;
}

@Injectable()
export class StripeMxService {
  private stripe: Stripe | null = null;
  private readonly logger = new Logger(StripeMxService.name);
  private readonly webhookSecret: string;

  constructor(private config: ConfigService) {
    const secretKey = this.config.get<string>('STRIPE_MX_SECRET_KEY');
    this.webhookSecret = this.config.get<string>('STRIPE_MX_WEBHOOK_SECRET', '');

    if (!secretKey) {
      this.logger.warn('STRIPE_MX_SECRET_KEY not configured - Stripe MX integration disabled');
      return;
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2026-02-25.clover',
      typescript: true,
      appInfo: {
        name: 'Dhanam',
        version: '1.0.0',
        url: 'https://dhanam.io',
      },
    });

    this.logger.log('Stripe Mexico service initialized');
  }

  /**
   * Check if Stripe MX is configured and available
   */
  isConfigured(): boolean {
    return this.stripe !== null;
  }

  /**
   * Create a Stripe customer for Mexico
   */
  async createCustomer(params: StripeMxCustomerParams): Promise<Stripe.Customer> {
    if (!this.stripe) {
      throw InfrastructureException.configurationError('STRIPE_MX_SECRET_KEY');
    }

    this.logger.log('Creating Stripe MX customer');

    return await this.stripe.customers.create({
      email: params.email,
      name: params.name,
      phone: params.phone,
      metadata: {
        ...params.metadata,
        region: 'MX',
        source: 'dhanam',
      },
      preferred_locales: ['es-MX'],
    });
  }

  /**
   * Create a checkout session with Mexican payment methods
   */
  async createCheckoutSession(params: StripeMxCheckoutParams): Promise<Stripe.Checkout.Session> {
    if (!this.stripe) {
      throw InfrastructureException.configurationError('STRIPE_MX_SECRET_KEY');
    }

    this.logger.log('Creating Stripe MX checkout session');

    // Default payment methods for Mexico.
    // Note: SPEI is surfaced as `customer_balance` by modern Stripe SDK
    // (the `spei_transfer` literal was removed from PaymentMethodType).
    const paymentMethods = params.paymentMethods || ['card', 'oxxo', 'customer_balance'];

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      customer_email: params.customerId ? undefined : params.customerEmail,
      customer: params.customerId,
      line_items: [
        {
          price: params.priceId,
          quantity: 1,
        },
      ],
      payment_method_types: paymentMethods,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      locale: 'es-419', // Latin American Spanish
      currency: 'mxn',
      billing_address_collection: 'required',
      metadata: {
        ...params.metadata,
        region: 'MX',
        provider: 'stripe_mx',
      },
      subscription_data: {
        metadata: {
          ...params.metadata,
          region: 'MX',
        },
      },
      // Mexican tax configuration
      automatic_tax: {
        enabled: true,
      },
      tax_id_collection: {
        enabled: true, // Collect RFC for Mexican invoicing
      },
    };

    return await this.stripe.checkout.sessions.create(sessionParams);
  }

  /**
   * Create a one-time payment (useful for OXXO)
   */
  async createPaymentIntent(params: {
    amount: number; // Amount in centavos
    customerId?: string;
    customerEmail: string;
    description: string;
    metadata?: Record<string, string>;
    paymentMethod?: 'card' | 'oxxo' | 'customer_balance';
  }): Promise<Stripe.PaymentIntent> {
    if (!this.stripe) {
      throw InfrastructureException.configurationError('STRIPE_MX_SECRET_KEY');
    }

    return await this.stripe.paymentIntents.create({
      amount: params.amount,
      currency: 'mxn',
      customer: params.customerId,
      receipt_email: params.customerEmail,
      description: params.description,
      payment_method_types: [params.paymentMethod || 'card'],
      metadata: {
        ...params.metadata,
        region: 'MX',
      },
    });
  }

  /**
   * Create an MXN PaymentIntent for SPEI bank-transfer settlement via
   * Stripe's `customer_balance` payment method.
   *
   * Returns the raw PaymentIntent; callers read the SPEI instructions
   * off `next_action.display_bank_transfer_instructions` (CLABE +
   * reference + Stripe's `hosted_instructions_url`). The CLABE is
   * issued per-customer by Stripe's Citibanamex rail — do not cache
   * it client-side.
   *
   * Currency is hard-coded `mxn`; callers passing anything else will
   * hit a InfrastructureException before the PI is created. This is a
   * hard guardrail because Stripe happily accepts non-MXN
   * customer_balance requests and we'd silently break the CFDI path
   * downstream (IVA math assumes MXN).
   *
   * `paymentRequestId` is required and is used as Stripe's idempotency
   * key so retries from our side can't double-charge. Stripe retains
   * idempotency responses for 24h — pick a stable id derived from the
   * user's intent, not a timestamp.
   *
   * RFC 0003 Gotcha #1: settlement is T+3 via Citibanamex → BBVA; the
   * PaymentIntent `amount_received` will not reflect spendable funds
   * until Stripe's payout cycle clears.
   */
  async createSpeiPaymentIntent(params: {
    amount: number; // centavos (minor units)
    currency?: string; // must be 'mxn' — enforced
    customerId?: string;
    customerEmail: string;
    description: string;
    paymentRequestId: string; // internal idempotency key
    metadata?: Record<string, string>;
  }): Promise<Stripe.PaymentIntent> {
    if (!this.stripe) {
      throw InfrastructureException.configurationError('STRIPE_MX_SECRET_KEY');
    }

    const currency = (params.currency || 'mxn').toLowerCase();
    if (currency !== 'mxn') {
      throw InfrastructureException.configurationError(
        `Stripe MX SPEI PaymentIntent requires MXN (got "${params.currency}")`
      );
    }

    if (!params.paymentRequestId) {
      throw InfrastructureException.configurationError(
        'Stripe MX SPEI PaymentIntent requires paymentRequestId for idempotency'
      );
    }

    if (!Number.isInteger(params.amount) || params.amount <= 0) {
      throw InfrastructureException.configurationError(
        'Stripe MX SPEI PaymentIntent requires positive integer amount (centavos)'
      );
    }

    return this.stripe.paymentIntents.create(
      {
        amount: params.amount,
        currency: 'mxn',
        customer: params.customerId,
        receipt_email: params.customerEmail,
        description: params.description,
        payment_method_types: ['customer_balance'],
        payment_method_data: {
          type: 'customer_balance',
        },
        payment_method_options: {
          customer_balance: {
            funding_type: 'bank_transfer',
            bank_transfer: {
              type: 'mx_bank_transfer',
            },
          },
        },
        confirm: true,
        metadata: {
          ...params.metadata,
          region: 'MX',
          payment_request_id: params.paymentRequestId,
          settlement_rail: 'spei',
        },
      },
      {
        idempotencyKey: params.paymentRequestId,
      }
    );
  }

  /**
   * Create billing portal session
   */
  async createPortalSession(params: {
    customerId: string;
    returnUrl: string;
  }): Promise<Stripe.BillingPortal.Session> {
    if (!this.stripe) {
      throw InfrastructureException.configurationError('STRIPE_MX_SECRET_KEY');
    }

    return await this.stripe.billingPortal.sessions.create({
      customer: params.customerId,
      return_url: params.returnUrl,
      locale: 'es-419',
    });
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string | Buffer, signature: string): Stripe.Event {
    if (!this.stripe) {
      throw InfrastructureException.configurationError('STRIPE_MX_SECRET_KEY');
    }

    if (!this.webhookSecret) {
      throw InfrastructureException.configurationError('STRIPE_MX_WEBHOOK_SECRET');
    }

    return this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    immediate: boolean = false
  ): Promise<Stripe.Subscription> {
    if (!this.stripe) {
      throw InfrastructureException.configurationError('STRIPE_MX_SECRET_KEY');
    }

    if (immediate) {
      return await this.stripe.subscriptions.cancel(subscriptionId);
    }

    // Cancel at period end
    return await this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    if (!this.stripe) {
      throw InfrastructureException.configurationError('STRIPE_MX_SECRET_KEY');
    }

    return await this.stripe.subscriptions.retrieve(subscriptionId);
  }

  /**
   * Get customer details
   */
  async getCustomer(customerId: string): Promise<Stripe.Customer> {
    if (!this.stripe) {
      throw InfrastructureException.configurationError('STRIPE_MX_SECRET_KEY');
    }

    return (await this.stripe.customers.retrieve(customerId)) as Stripe.Customer;
  }

  /**
   * Refund a PaymentIntent (full or partial).
   */
  async createRefund(params: {
    paymentIntentId: string;
    amountMinor?: number;
    reason?: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Refund> {
    if (!this.stripe) {
      throw InfrastructureException.configurationError('STRIPE_MX_SECRET_KEY');
    }

    return await this.stripe.refunds.create({
      payment_intent: params.paymentIntentId,
      amount: params.amountMinor,
      reason: params.reason as Stripe.RefundCreateParams.Reason | undefined,
      metadata: params.metadata || {},
    });
  }
}
