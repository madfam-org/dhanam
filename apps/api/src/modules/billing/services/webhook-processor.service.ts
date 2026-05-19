import { Injectable, Logger } from '@nestjs/common';
import type Stripe from 'stripe';

import { Currency, SubscriptionTier } from '@db';

import { AuditService } from '../../../core/audit/audit.service';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { PostHogService } from '../../analytics/posthog.service';
import { JanuaWebhookPayloadDto } from '../dto/janua-webhook.dto';
import { StripeService } from '../stripe.service';

import { PLAN_TIER_MAP, SubscriptionLifecycleService } from './subscription-lifecycle.service';

/**
 * Webhook Processor Service
 *
 * Handles inbound webhook events from Stripe and Janua.
 * Extracted from BillingService to isolate event-handling logic.
 *
 * ## Stripe Events
 * - customer.subscription.created / updated / deleted
 * - invoice.payment_succeeded / payment_failed
 * - checkout.session.completed
 *
 * ## Janua Events
 * - subscription.created / updated / cancelled / paused / resumed
 * - payment.succeeded / failed / refunded
 *
 * @see SubscriptionLifecycleService - role-sync helpers used by webhook handlers
 */
@Injectable()
export class WebhookProcessorService {
  private readonly logger = new Logger(WebhookProcessorService.name);

  constructor(
    private prisma: PrismaService,
    private stripe: StripeService,
    private audit: AuditService,
    private posthog: PostHogService,
    private lifecycle: SubscriptionLifecycleService
  ) {}

  // =========================================================================
  // Stripe Webhook Handlers
  // =========================================================================

  /**
   * Handle Stripe webhook: subscription created
   */
  async handleSubscriptionCreated(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;

    const user = await this.prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
    });

    if (!user) {
      this.logger.error(`User not found for Stripe customer: ${customerId}`);
      return;
    }

    const plan = (subscription as any).metadata?.plan;
    const tier = (plan && PLAN_TIER_MAP[plan]) || 'pro';

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionTier: tier as SubscriptionTier,
        subscriptionStartedAt: new Date((subscription as any).current_period_start * 1000),
        subscriptionExpiresAt: new Date((subscription as any).current_period_end * 1000),
        stripeSubscriptionId: subscription.id,
      },
    });

    await this.prisma.billingEvent.create({
      data: {
        userId: user.id,
        type: 'subscription_created',
        amount: (subscription.items.data[0].price.unit_amount || 0) / 100,
        currency: (subscription.currency.toUpperCase() as any) || 'USD',
        status: 'succeeded',
        stripeEventId: event.id,
        metadata: { subscriptionId: subscription.id },
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'SUBSCRIPTION_ACTIVATED',
      severity: 'high',
      metadata: {
        tier,
        subscriptionId: subscription.id,
      },
    });

    // Track subscription creation in PostHog
    await this.posthog.capture({
      distinctId: user.id,
      event: 'subscription_created',
      properties: {
        product: 'dhanam',
        plan: tier,
        amount: (subscription.items.data[0].price.unit_amount || 0) / 100,
        currency: subscription.currency.toUpperCase(),
        provider: 'stripe',
      },
    });

    // Dispatch Janua role upgrade if janua_user_id metadata is present
    if ((subscription as any).metadata?.janua_user_id) {
      const rawProduct = subscription.items.data[0]?.price?.product;
      const subProductId = typeof rawProduct === 'string' ? rawProduct : (rawProduct as any)?.id;
      this.lifecycle
        .dispatchJanuaRoleUpgrade((subscription as any).metadata.janua_user_id, subProductId)
        .catch((err) =>
          this.logger.error(`Janua role dispatch from subscription.created failed: ${err.message}`)
        );
    }

    this.logger.log(`Subscription created for user ${user.id}`);
  }

  /**
   * Handle Stripe webhook: subscription updated
   */
  async handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;

    const user = await this.prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
    });

    if (!user) {
      this.logger.error(`User not found for Stripe customer: ${customerId}`);
      return;
    }

    // Update subscription details
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionExpiresAt: new Date((subscription as any).current_period_end * 1000),
      },
    });

    this.logger.log(`Subscription updated for user ${user.id}`);
  }

  /**
   * Handle Stripe webhook: subscription cancelled
   */
  async handleSubscriptionCancelled(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;
    const cancellationReason = (subscription as any).cancellation_details?.reason;
    const cancellationFeedback = (subscription as any).cancellation_details?.feedback;

    const user = await this.prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
    });

    if (!user) {
      this.logger.error(`User not found for Stripe customer: ${customerId}`);
      return;
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionTier: 'community',
        subscriptionExpiresAt: null,
        stripeSubscriptionId: null,
        cancelledAt: new Date(),
        cancellationReason: cancellationFeedback || cancellationReason || null,
      },
    });

    await this.prisma.billingEvent.create({
      data: {
        userId: user.id,
        type: 'subscription_cancelled',
        amount: 0,
        currency: 'USD',
        status: 'succeeded',
        stripeEventId: event.id,
        metadata: { subscriptionId: subscription.id },
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'SUBSCRIPTION_CANCELLED',
      severity: 'medium',
      metadata: { subscriptionId: subscription.id },
    });

    // Track cancellation in PostHog
    await this.posthog.capture({
      distinctId: user.id,
      event: 'subscription_cancelled',
      properties: {
        product: 'dhanam',
        provider: 'stripe',
        subscription_id: subscription.id,
        cancellation_reason: cancellationFeedback || cancellationReason || 'unknown',
      },
    });

    this.logger.log(`Subscription cancelled for user ${user.id}`);
  }

  /**
   * Handle Stripe webhook: payment succeeded
   */
  async handlePaymentSucceeded(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId = invoice.customer as string;

    const user = await this.prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
    });

    if (!user) {
      this.logger.error(`User not found for Stripe customer: ${customerId}`);
      return;
    }

    await this.prisma.billingEvent.create({
      data: {
        userId: user.id,
        type: 'payment_succeeded',
        amount: (invoice.amount_paid || 0) / 100,
        currency: (invoice.currency.toUpperCase() as any) || 'USD',
        status: 'succeeded',
        stripeEventId: event.id,
        metadata: {
          invoiceId: invoice.id,
          subscriptionId: (invoice as any).subscription as string,
        },
      },
    });

    this.logger.log(`Payment succeeded for user ${user.id}, amount: ${invoice.amount_paid / 100}`);
  }

  /**
   * Handle Stripe webhook: payment failed
   */
  async handlePaymentFailed(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId = invoice.customer as string;

    const user = await this.prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
    });

    if (!user) {
      this.logger.error(`User not found for Stripe customer: ${customerId}`);
      return;
    }

    await this.prisma.billingEvent.create({
      data: {
        userId: user.id,
        type: 'payment_failed',
        amount: (invoice.amount_due || 0) / 100,
        currency: (invoice.currency.toUpperCase() as any) || 'USD',
        status: 'failed',
        stripeEventId: event.id,
        metadata: {
          invoiceId: invoice.id,
          subscriptionId: (invoice as any).subscription as string,
        },
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'PAYMENT_FAILED',
      severity: 'high',
      metadata: {
        amount: invoice.amount_due / 100,
        invoiceId: invoice.id,
      },
    });

    // Track payment failure in PostHog
    await this.posthog.capture({
      distinctId: user.id,
      event: 'payment_failed',
      properties: {
        product: 'dhanam',
        amount: invoice.amount_due / 100,
        currency: invoice.currency.toUpperCase(),
        provider: 'stripe',
        invoice_id: invoice.id,
      },
    });

    this.logger.warn(`Payment failed for user ${user.id}, amount: ${invoice.amount_due / 100}`);
  }

  /**
   * Handle Stripe checkout.session.completed event.
   * Captures metadata.janua_user_id before a subscription object may exist.
   */
  async handleCheckoutCompleted(event: Stripe.Event): Promise<void> {
    const session = event.data.object as Stripe.Checkout.Session;
    const januaUserId = session.metadata?.janua_user_id;
    const plan = session.metadata?.plan;

    if (!januaUserId) {
      this.logger.log('checkout.session.completed without janua_user_id metadata, skipping');
      return;
    }

    const user = await this.prisma.user.findUnique({ where: { id: januaUserId } });
    if (!user) {
      this.logger.error(`User not found for janua_user_id: ${januaUserId}`);
      return;
    }

    const tier = (plan && PLAN_TIER_MAP[plan]) || 'pro';

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionTier: tier as SubscriptionTier,
        subscriptionStartedAt: new Date(),
        stripeCustomerId: (session.customer as string) || user.stripeCustomerId,
      },
    });

    await this.prisma.billingEvent.create({
      data: {
        userId: user.id,
        type: 'subscription_created',
        amount: (session.amount_total || 0) / 100,
        currency: (session.currency?.toUpperCase() || 'USD') as Currency,
        status: 'succeeded',
        stripeEventId: event.id,
        metadata: { plan, source: session.metadata?.source },
      },
    });

    // Retrieve session with line_items to get the product ID for Janua role mapping
    let productId: string | undefined;
    try {
      const fullSession = await this.stripe.retrieveCheckoutSession(session.id, {
        expand: ['line_items'],
      });
      const rawProduct = fullSession.line_items?.data?.[0]?.price?.product;
      productId = typeof rawProduct === 'string' ? rawProduct : rawProduct?.id;
    } catch (err) {
      this.logger.warn(`Failed to retrieve checkout session line_items: ${err.message}`);
    }

    // Dispatch Janua role upgrade (non-blocking)
    this.lifecycle
      .dispatchJanuaRoleUpgrade(januaUserId, productId)
      .catch((err) => this.logger.error(`Janua role dispatch failed: ${err.message}`));

    this.logger.log(`Checkout completed for user ${user.id}, tier: ${tier}`);
  }

  // =========================================================================
  // Janua Webhook Handlers
  // =========================================================================

  /**
   * Handle Janua subscription created event
   */
  async handleJanuaSubscriptionCreated(payload: JanuaWebhookPayloadDto): Promise<void> {
    const { customer_id, subscription_id, plan_id, provider, metadata } = payload.data;

    const user = await this.prisma.user.findFirst({
      where: { januaCustomerId: customer_id },
    });

    if (!user) {
      this.logger.warn(`User not found for Janua customer: ${customer_id}`);
      return;
    }

    const tier = (plan_id && PLAN_TIER_MAP[plan_id]) || 'pro';

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionTier: tier as SubscriptionTier,
        subscriptionStartedAt: new Date(),
        billingProvider: provider,
      },
    });

    await this.prisma.billingEvent.create({
      data: {
        userId: user.id,
        type: 'subscription_created',
        status: 'succeeded',
        stripeEventId: payload.id,
        amount: 0,
        currency: (payload.data.currency || 'USD') as Currency,
        metadata: { subscription_id, plan_id, provider },
      },
    });

    // Track in PostHog
    await this.posthog.capture({
      distinctId: user.id,
      event: 'subscription_created',
      properties: {
        product: metadata?.product || 'dhanam',
        plan: tier,
        provider: provider || 'janua',
        org_id: metadata?.orgId,
      },
    });

    this.logger.log(`Janua subscription created for user ${user.id} via ${provider}`);

    // Notify Janua identity system if this subscription is linked to an organization
    // This enables the Enclii -> Dhanam -> Janua payment loop
    if (metadata?.orgId) {
      await this.lifecycle.notifyJanuaOfTierChange(metadata.orgId, customer_id!, plan_id!);
    }

    // Notify product-specific webhooks (Karafiel, Tezca, etc.) — zero-touch via env var
    if (plan_id) {
      this.lifecycle
        .notifyProductWebhooks(
          metadata?.orgId || '',
          customer_id!,
          plan_id,
          'subscription.created',
          subscription_id
        )
        .catch((err) => this.logger.warn(`Product webhook dispatch failed: ${err.message}`));
    }
  }

  /**
   * Handle Janua subscription updated event
   */
  async handleJanuaSubscriptionUpdated(payload: JanuaWebhookPayloadDto): Promise<void> {
    const { customer_id, plan_id, status, provider: _provider } = payload.data;

    const user = await this.prisma.user.findFirst({
      where: { januaCustomerId: customer_id },
    });

    if (!user) {
      this.logger.warn(`User not found for Janua customer: ${customer_id}`);
      return;
    }

    const tier = status === 'active' ? (plan_id && PLAN_TIER_MAP[plan_id]) || 'pro' : 'community';

    await this.prisma.user.update({
      where: { id: user.id },
      data: { subscriptionTier: tier as SubscriptionTier },
    });

    this.logger.log(`Janua subscription updated for user ${user.id}: ${status}`);

    // Notify product-specific webhooks
    if (plan_id) {
      this.lifecycle
        .notifyProductWebhooks('', customer_id!, plan_id, 'subscription.updated')
        .catch((err) => this.logger.warn(`Product webhook dispatch failed: ${err.message}`));
    }
  }

  /**
   * Handle Janua subscription cancelled event
   */
  async handleJanuaSubscriptionCancelled(payload: JanuaWebhookPayloadDto): Promise<void> {
    const { customer_id, provider } = payload.data;

    const user = await this.prisma.user.findFirst({
      where: { januaCustomerId: customer_id },
    });

    if (!user) {
      this.logger.warn(`User not found for Janua customer: ${customer_id}`);
      return;
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionTier: 'community',
        subscriptionExpiresAt: new Date(),
      },
    });

    await this.prisma.billingEvent.create({
      data: {
        userId: user.id,
        type: 'subscription_cancelled',
        status: 'succeeded',
        stripeEventId: payload.id,
        amount: 0,
        currency: (payload.data.currency || 'USD') as Currency,
        metadata: { provider },
      },
    });

    await this.posthog.capture({
      distinctId: user.id,
      event: 'subscription_cancelled',
      properties: {
        product: 'dhanam',
        provider: provider || 'janua',
      },
    });

    this.logger.log(`Janua subscription cancelled for user ${user.id}`);

    // Notify product-specific webhooks
    this.lifecycle
      .notifyProductWebhooks('', customer_id!, '', 'subscription.cancelled')
      .catch((err) => this.logger.warn(`Product webhook dispatch failed: ${err.message}`));
  }

  /**
   * Handle Janua subscription paused event
   */
  async handleJanuaSubscriptionPaused(payload: JanuaWebhookPayloadDto): Promise<void> {
    const { customer_id } = payload.data;

    const user = await this.prisma.user.findFirst({
      where: { januaCustomerId: customer_id },
    });

    if (!user) {
      this.logger.warn(`User not found for Janua customer: ${customer_id}`);
      return;
    }

    const resumesAt = (payload.data as any).metadata?.resumes_at
      ? new Date((payload.data as any).metadata.resumes_at)
      : null;

    await this.prisma.user.update({
      where: { id: user.id },
      data: { subscriptionPausedUntil: resumesAt },
    });

    await this.prisma.billingEvent.create({
      data: {
        userId: user.id,
        type: 'subscription_paused',
        amount: 0,
        currency: 'USD',
        status: 'succeeded',
        stripeEventId: payload.id,
        metadata: { resumes_at: resumesAt?.toISOString() },
      },
    });

    await this.posthog.capture({
      distinctId: user.id,
      event: 'subscription_paused',
      properties: {
        product: 'dhanam',
        resumes_at: resumesAt?.toISOString(),
      },
    });

    this.lifecycle
      .notifyProductWebhooks('', customer_id!, '', 'subscription.paused')
      .catch((err) => this.logger.warn(`Product webhook dispatch failed: ${err.message}`));

    this.logger.log(
      `Subscription paused for user ${user.id}, resumes at ${resumesAt?.toISOString()}`
    );
  }

  /**
   * Handle Janua subscription resumed event
   */
  async handleJanuaSubscriptionResumed(payload: JanuaWebhookPayloadDto): Promise<void> {
    const { customer_id } = payload.data;
    const plan_id = payload.data?.plan_id;

    const user = await this.prisma.user.findFirst({
      where: { januaCustomerId: customer_id },
    });

    if (!user) {
      return;
    }

    const tier = (plan_id && PLAN_TIER_MAP[plan_id]) || 'pro';
    await this.prisma.user.update({
      where: { id: user.id },
      data: { subscriptionTier: tier as SubscriptionTier },
    });

    this.logger.log(`Janua subscription resumed for user ${user.id}`);
  }

  /**
   * Handle Janua payment succeeded event
   */
  async handleJanuaPaymentSucceeded(payload: JanuaWebhookPayloadDto): Promise<void> {
    const { customer_id, amount, currency, provider } = payload.data;
    const plan_id = payload.data.plan_id;

    const user = await this.prisma.user.findFirst({
      where: { januaCustomerId: customer_id },
    });

    if (!user) {
      this.logger.warn(`User not found for Janua customer: ${customer_id}`);
      return;
    }

    await this.prisma.billingEvent.create({
      data: {
        userId: user.id,
        type: 'payment_succeeded',
        status: 'succeeded',
        stripeEventId: payload.id,
        amount: amount || 0,
        currency: (currency || 'USD') as Currency,
        metadata: { provider },
      },
    });

    // Ensure subscription is active
    const tier = (plan_id && PLAN_TIER_MAP[plan_id]) || 'pro';
    await this.prisma.user.update({
      where: { id: user.id },
      data: { subscriptionTier: tier as SubscriptionTier },
    });

    await this.posthog.capture({
      distinctId: user.id,
      event: 'subscription_renewed',
      properties: {
        product: 'dhanam',
        plan: tier,
        amount: amount || 0,
        currency: (currency || 'USD') as Currency,
        provider: provider || 'janua',
      },
    });

    this.logger.log(`Janua payment succeeded for user ${user.id}: ${currency} ${amount}`);
  }

  /**
   * Handle Janua payment failed event
   */
  async handleJanuaPaymentFailed(payload: JanuaWebhookPayloadDto): Promise<void> {
    const { customer_id, amount, currency, provider } = payload.data;

    const user = await this.prisma.user.findFirst({
      where: { januaCustomerId: customer_id },
    });

    if (!user) {
      this.logger.warn(`User not found for Janua customer: ${customer_id}`);
      return;
    }

    await this.prisma.billingEvent.create({
      data: {
        userId: user.id,
        type: 'payment_failed',
        status: 'failed',
        stripeEventId: payload.id,
        amount: amount || 0,
        currency: (currency || 'USD') as Currency,
        metadata: { provider },
      },
    });

    await this.posthog.capture({
      distinctId: user.id,
      event: 'payment_failed',
      properties: {
        product: 'dhanam',
        amount: amount || 0,
        currency: (currency || 'USD') as Currency,
        provider: provider || 'janua',
      },
    });

    this.logger.warn(`Janua payment failed for user ${user.id}`);
    // Note: Don't immediately downgrade - Janua/provider will retry
  }

  /**
   * Handle Janua payment refunded event
   */
  async handleJanuaPaymentRefunded(payload: JanuaWebhookPayloadDto): Promise<void> {
    const { customer_id, amount, currency, provider } = payload.data;

    const user = await this.prisma.user.findFirst({
      where: { januaCustomerId: customer_id },
    });

    if (!user) {
      return;
    }

    await this.prisma.billingEvent.create({
      data: {
        userId: user.id,
        type: 'refund_issued',
        status: 'succeeded',
        stripeEventId: payload.id,
        amount: amount || 0,
        currency: (currency || 'USD') as Currency,
        metadata: { provider },
      },
    });

    this.logger.log(`Janua refund processed for user ${user.id}: ${currency} ${amount}`);
  }
}
