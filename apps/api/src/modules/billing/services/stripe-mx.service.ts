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
      throw new Error('Stripe MX not configured');
    }

    this.logger.log(`Creating Stripe MX customer: ${params.email}`);

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
      throw new Error('Stripe MX not configured');
    }

    this.logger.log(`Creating Stripe MX checkout for: ${params.customerEmail}`);

    // Default payment methods for Mexico
    const paymentMethods = params.paymentMethods || ['card', 'oxxo'];

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
      throw new Error('Stripe MX not configured');
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
   * Create billing portal session
   */
  async createPortalSession(params: {
    customerId: string;
    returnUrl: string;
  }): Promise<Stripe.BillingPortal.Session> {
    if (!this.stripe) {
      throw new Error('Stripe MX not configured');
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
      throw new Error('Stripe MX not configured');
    }

    if (!this.webhookSecret) {
      throw new Error('STRIPE_MX_WEBHOOK_SECRET not configured');
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
      throw new Error('Stripe MX not configured');
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
      throw new Error('Stripe MX not configured');
    }

    return await this.stripe.subscriptions.retrieve(subscriptionId);
  }

  /**
   * Get customer details
   */
  async getCustomer(customerId: string): Promise<Stripe.Customer> {
    if (!this.stripe) {
      throw new Error('Stripe MX not configured');
    }

    return (await this.stripe.customers.retrieve(customerId)) as Stripe.Customer;
  }
}
