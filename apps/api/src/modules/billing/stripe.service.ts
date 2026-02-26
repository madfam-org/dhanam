import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private stripe: Stripe;
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

  /**
   * Create a new Stripe customer
   */
  async createCustomer(params: {
    email: string;
    name?: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Customer> {
    this.logger.log(`Creating Stripe customer for email: ${params.email}`);

    return await this.stripe.customers.create({
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

    return await this.stripe.checkout.sessions.create({
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
    return await this.stripe.checkout.sessions.retrieve(sessionId, params);
  }

  /**
   * Create a billing portal session for subscription management
   */
  async createPortalSession(params: {
    customerId: string;
    returnUrl: string;
  }): Promise<Stripe.BillingPortal.Session> {
    this.logger.log(`Creating portal session for customer: ${params.customerId}`);

    return await this.stripe.billingPortal.sessions.create({
      customer: params.customerId,
      return_url: params.returnUrl,
    });
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    this.logger.log(`Cancelling subscription: ${subscriptionId}`);

    return await this.stripe.subscriptions.cancel(subscriptionId);
  }

  /**
   * Update a subscription
   */
  async updateSubscription(
    subscriptionId: string,
    params: Stripe.SubscriptionUpdateParams
  ): Promise<Stripe.Subscription> {
    this.logger.log(`Updating subscription: ${subscriptionId}`);

    return await this.stripe.subscriptions.update(subscriptionId, params);
  }

  /**
   * Retrieve a subscription
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await this.stripe.subscriptions.retrieve(subscriptionId);
  }

  /**
   * Retrieve a customer
   */
  async getCustomer(customerId: string): Promise<Stripe.Customer> {
    return (await this.stripe.customers.retrieve(customerId)) as Stripe.Customer;
  }

  /**
   * Construct webhook event from raw payload
   */
  constructWebhookEvent(payload: string | Buffer, signature: string, secret: string): Stripe.Event {
    try {
      return this.stripe.webhooks.constructEvent(payload, signature, secret);
    } catch (error) {
      this.logger.error(`Webhook signature verification failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get upcoming invoice for customer
   */
  async getUpcomingInvoice(customerId: string): Promise<Stripe.Invoice> {
    return await (this.stripe.invoices as any).upcoming({
      customer: customerId,
    });
  }

  /**
   * List customer invoices
   */
  async listInvoices(customerId: string, limit = 10): Promise<Stripe.ApiList<Stripe.Invoice>> {
    return await this.stripe.invoices.list({
      customer: customerId,
      limit,
    });
  }

  /**
   * Check if Stripe is configured
   */
  isConfigured(): boolean {
    return !!this.stripe;
  }
}
