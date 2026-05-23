import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private stripe?: Stripe;
  private readonly logger = new Logger(StripeService.name);

  constructor(private config: ConfigService) {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY');

    if (!secretKey) {
      this.logger.warn('STRIPE_SECRET_KEY not configured - Stripe integration disabled');
      return;
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2026-02-25.clover',
      typescript: true,
    });

    this.logger.log('Stripe service initialized');
  }

  private client(): Stripe {
    if (!this.stripe) {
      throw new ServiceUnavailableException('Stripe integration is not configured');
    }

    return this.stripe;
  }

  /**
   * Create a new Stripe customer
   */
  async createCustomer(params: {
    email: string;
    name?: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Customer> {
    this.logger.log('Creating Stripe customer');

    return await this.client().customers.create({
      email: params.email,
      name: params.name,
      metadata: params.metadata || {},
    });
  }

  /**
   * Create a checkout session for subscription
   */
  async createCheckoutSession(params: {
    customerId: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
    couponId?: string;
  }): Promise<Stripe.Checkout.Session> {
    this.logger.log(`Creating checkout session for customer: ${params.customerId}`);

    return await this.client().checkout.sessions.create({
      customer: params.customerId,
      mode: 'subscription',
      line_items: [
        {
          price: params.priceId,
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata || {},
      billing_address_collection: 'auto',
      allow_promotion_codes: !params.couponId, // disable promo codes when coupon is applied
      discounts: params.couponId ? [{ coupon: params.couponId }] : undefined,
      subscription_data: {
        metadata: params.metadata || {},
      },
    });
  }

  /**
   * Retrieve a checkout session by ID with optional expansions
   */
  async retrieveCheckoutSession(
    sessionId: string,
    params?: Stripe.Checkout.SessionRetrieveParams
  ): Promise<Stripe.Checkout.Session> {
    return await this.client().checkout.sessions.retrieve(sessionId, params);
  }

  /**
   * Create a billing portal session for subscription management
   */
  async createPortalSession(params: {
    customerId: string;
    returnUrl: string;
  }): Promise<Stripe.BillingPortal.Session> {
    this.logger.log(`Creating portal session for customer: ${params.customerId}`);

    return await this.client().billingPortal.sessions.create({
      customer: params.customerId,
      return_url: params.returnUrl,
    });
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    this.logger.log(`Cancelling subscription: ${subscriptionId}`);

    return await this.client().subscriptions.cancel(subscriptionId);
  }

  /**
   * Update a subscription
   */
  async updateSubscription(
    subscriptionId: string,
    params: Stripe.SubscriptionUpdateParams
  ): Promise<Stripe.Subscription> {
    this.logger.log(`Updating subscription: ${subscriptionId}`);

    return await this.client().subscriptions.update(subscriptionId, params);
  }

  /**
   * Retrieve a subscription
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await this.client().subscriptions.retrieve(subscriptionId);
  }

  /**
   * Retrieve a customer
   */
  async getCustomer(customerId: string): Promise<Stripe.Customer> {
    return (await this.client().customers.retrieve(customerId)) as Stripe.Customer;
  }

  /**
   * Construct webhook event from raw payload
   */
  constructWebhookEvent(payload: string | Buffer, signature: string, secret: string): Stripe.Event {
    try {
      return this.client().webhooks.constructEvent(payload, signature, secret);
    } catch (error) {
      this.logger.error(`Webhook signature verification failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get upcoming invoice for customer
   */
  async getUpcomingInvoice(customerId: string): Promise<Stripe.Invoice> {
    return await (this.client().invoices as any).upcoming({
      customer: customerId,
    });
  }

  /**
   * List customer invoices
   */
  async listInvoices(customerId: string, limit = 10): Promise<Stripe.ApiList<Stripe.Invoice>> {
    return await this.client().invoices.list({
      customer: customerId,
      limit,
    });
  }

  // ─── Cancellation & Pause ────────────────────────────────────────

  /** Pause subscription billing for a period. User retains access but isn't charged. */
  async pauseSubscription(subscriptionId: string, resumesAt: number): Promise<Stripe.Subscription> {
    return this.client().subscriptions.update(subscriptionId, {
      pause_collection: { behavior: 'void', resumes_at: resumesAt },
    });
  }

  /** Resume a paused subscription. */
  async resumeSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.client().subscriptions.update(subscriptionId, {
      pause_collection: '' as any, // clears pause
    });
  }

  /** Cancel subscription at the end of the current billing period (never immediate). */
  async cancelAtPeriodEnd(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.client().subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }

  /** Apply a coupon/discount to an existing subscription (retention offer). */
  async applyCouponToSubscription(
    subscriptionId: string,
    couponId: string
  ): Promise<Stripe.Subscription> {
    // Modern Stripe SDK removed the `coupon` shortcut on SubscriptionUpdateParams.
    // Use the `discounts` array instead (single coupon mirrors prior behaviour).
    return this.client().subscriptions.update(subscriptionId, {
      discounts: [{ coupon: couponId }],
    });
  }

  // ─── Invoice Creation (for overage billing) ────────────────────

  /** Create a one-off invoice item on a customer (for overage charges). */
  async createInvoiceItem(params: {
    customerId: string;
    amount: number;
    currency: string;
    description: string;
  }): Promise<Stripe.InvoiceItem> {
    return this.client().invoiceItems.create({
      customer: params.customerId,
      amount: Math.round(params.amount * 100), // convert to cents
      currency: params.currency,
      description: params.description,
    });
  }

  /** Create and auto-advance an invoice for pending invoice items. */
  async createInvoice(customerId: string): Promise<Stripe.Invoice> {
    return this.client().invoices.create({
      customer: customerId,
      auto_advance: true, // auto-finalize and attempt payment
    });
  }

  /**
   * Create a one-time PaymentIntent (operator POS / ad-hoc charges).
   */
  async createPaymentIntent(params: {
    amount: number;
    currency: string;
    customerEmail: string;
    customerId?: string;
    description: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.PaymentIntent> {
    return await this.client().paymentIntents.create({
      amount: params.amount,
      currency: params.currency,
      customer: params.customerId,
      receipt_email: params.customerEmail,
      description: params.description,
      metadata: params.metadata || {},
      automatic_payment_methods: { enabled: true },
    });
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
    return await this.client().refunds.create({
      payment_intent: params.paymentIntentId,
      amount: params.amountMinor,
      reason: params.reason as Stripe.RefundCreateParams.Reason | undefined,
      metadata: params.metadata || {},
    });
  }

  /**
   * Check if Stripe is configured
   */
  isConfigured(): boolean {
    return !!this.stripe;
  }
}
