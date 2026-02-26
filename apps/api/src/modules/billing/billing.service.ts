/* eslint-disable max-lines */
import * as crypto from 'crypto';

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import { UsageMetricType, SubscriptionTier, Currency } from '@db';

import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../core/prisma/prisma.service';

import { BillingProvider, JanuaBillingService } from './janua-billing.service';
import { StripeService } from './stripe.service';

/**
 * Options for premium upgrade
 * Used for external app integration (e.g., Enclii)
 */
export interface UpgradeOptions {
  orgId?: string;
  plan?: string;
  successUrl?: string;
  cancelUrl?: string;
  countryCode?: string;
}

/**
 * Billing Service
 *
 * Manages subscription lifecycle, usage tracking, and payment processing.
 * Supports multi-provider billing through Janua (MADFAM's SSO platform).
 *
 * ## Payment Providers (via Janua)
 * - **Conekta**: Mexico (MXN)
 * - **Polar**: International
 * - **Stripe**: Fallback/Direct integration
 *
 * ## Subscription Tiers
 * - **Community**: Self-hosted or free cloud trial (5 ESG calcs, 2 simulations/day)
 * - **Essentials**: $4.99/mo — AI categorization, bank sync, 10 simulations/day
 * - **Pro**: $11.99/mo — Unlimited usage, all features
 *
 * ## Usage Tracking
 * Daily usage metrics tracked per user:
 * - ESG calculations
 * - Monte Carlo simulations
 * - Goal probability calculations
 * - Scenario analyses
 * - API requests
 *
 * ## Webhook Handling
 * Handles events from both Stripe and Janua:
 * - subscription.created/updated/cancelled
 * - payment.succeeded/failed/refunded
 * - subscription.paused/resumed
 *
 * @example
 * ```typescript
 * // Initiate premium upgrade
 * const { checkoutUrl, provider } = await billingService.upgradeToPremium(
 *   userId,
 *   { countryCode: 'MX' }  // Will use Conekta
 * );
 *
 * // Check usage limit before operation
 * const canRun = await billingService.checkUsageLimit(userId, 'monte_carlo_simulation');
 * if (!canRun) {
 *   throw new Error('Daily simulation limit reached. Upgrade to Premium for unlimited.');
 * }
 *
 * // Record usage after operation
 * await billingService.recordUsage(userId, 'monte_carlo_simulation');
 * ```
 *
 * @see JanuaBillingService - Janua multi-provider integration
 * @see StripeService - Direct Stripe integration (fallback)
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  // Usage limits per tier
  private readonly usageLimits = {
    community: {
      esg_calculation: 5,
      monte_carlo_simulation: 2,
      goal_probability: 0,
      scenario_analysis: 0,
      portfolio_rebalance: 0,
      api_request: 500,
    },
    essentials: {
      esg_calculation: 20,
      monte_carlo_simulation: 10,
      goal_probability: 5,
      scenario_analysis: 3,
      portfolio_rebalance: 0,
      api_request: 5_000,
    },
    pro: {
      esg_calculation: Infinity,
      monte_carlo_simulation: Infinity,
      goal_probability: Infinity,
      scenario_analysis: Infinity,
      portfolio_rebalance: Infinity,
      api_request: Infinity,
    },
  };

  // Feature limits per tier
  readonly tierLimits = {
    community: {
      maxSpaces: 1,
      maxProviderConnections: 0, // cloud-hosted: 0. Self-hosted: unlimited (BYOK)
      allowedProviders: [] as string[],
      mlCategorization: false,
      monteCarloMaxIterations: 1_000,
      monteCarloMaxScenarios: 3,
      storageBytes: 0,
      lifeBeat: false,
      householdViews: false,
      collectiblesValuation: false,
    },
    essentials: {
      maxSpaces: 2,
      maxProviderConnections: 3, // 2 Belvo + 1 Bitso
      allowedProviders: ['belvo', 'bitso'],
      mlCategorization: true,
      monteCarloMaxIterations: 5_000,
      monteCarloMaxScenarios: 6,
      storageBytes: 500 * 1024 * 1024, // 500 MB
      lifeBeat: false,
      householdViews: false,
      collectiblesValuation: false,
    },
    pro: {
      maxSpaces: 5,
      maxProviderConnections: Infinity,
      allowedProviders: 'all' as const,
      mlCategorization: true,
      monteCarloMaxIterations: 10_000,
      monteCarloMaxScenarios: 12,
      storageBytes: 5 * 1024 * 1024 * 1024, // 5 GB
      lifeBeat: true,
      householdViews: true,
      collectiblesValuation: true,
    },
  };

  constructor(
    private prisma: PrismaService,
    private stripe: StripeService,
    private januaBilling: JanuaBillingService,
    private audit: AuditService,
    private config: ConfigService
  ) {}

  /**
   * Initiate upgrade to premium subscription
   * Uses Janua multi-provider billing when available, falls back to direct Stripe
   *
   * @param userId - The user initiating the upgrade
   * @param options - Optional parameters for external app integration
   */
  async upgradeToPremium(
    userId: string,
    options: UpgradeOptions = {}
  ): Promise<{ checkoutUrl: string; provider: string }> {
    const countryCode = options.countryCode || 'US';

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        stripeCustomerId: true,
        januaCustomerId: true,
        billingProvider: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if already on the requested tier (or higher)
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionTier: true },
    });

    const requestedPlan = options.plan || 'pro';
    const tierRank = { community: 0, essentials: 1, pro: 2 };
    const currentRank = tierRank[currentUser?.subscriptionTier as keyof typeof tierRank] ?? 0;
    const requestedRank = tierRank[requestedPlan as keyof typeof tierRank] ?? 2;

    if (currentRank >= requestedRank) {
      throw new Error(`User is already on ${currentUser?.subscriptionTier} tier`);
    }

    const webUrl = this.config.get<string>('WEB_URL', 'http://localhost:3000');

    // Try Janua multi-provider billing first
    if (this.januaBilling.isEnabled()) {
      return this.upgradeToPremiumViaJanua(user, countryCode, webUrl, options);
    }

    // Fallback to direct Stripe
    return this.upgradeToPremiumViaStripe(user, webUrl, options);
  }

  /**
   * Upgrade via Janua (multi-provider: Conekta for MX, Polar for international)
   */
  private async upgradeToPremiumViaJanua(
    user: { id: string; email: string; name: string; januaCustomerId?: string },
    countryCode: string,
    webUrl: string,
    options: UpgradeOptions = {}
  ): Promise<{ checkoutUrl: string; provider: BillingProvider }> {
    let customerId = user.januaCustomerId;
    let provider: BillingProvider = this.januaBilling.getProviderForCountry(countryCode);

    if (!customerId) {
      const result = await this.januaBilling.createCustomer({
        email: user.email,
        name: user.name,
        countryCode,
        orgId: options.orgId,
        metadata: { userId: user.id },
      });

      customerId = result.customerId;
      provider = result.provider;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          januaCustomerId: customerId,
          billingProvider: provider,
        },
      });
    }

    // Build metadata including orgId for Janua organization linking
    const metadata: Record<string, string> = { userId: user.id };
    if (options.orgId) {
      metadata.orgId = options.orgId;
    }

    const result = await this.januaBilling.createCheckoutSession({
      customerId,
      customerEmail: user.email,
      priceId: options.plan || 'pro',
      countryCode,
      successUrl:
        options.successUrl || `${webUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: options.cancelUrl || `${webUrl}/billing/cancel`,
      orgId: options.orgId,
      metadata,
    });

    await this.audit.log({
      userId: user.id,
      action: 'BILLING_UPGRADE_INITIATED',
      severity: 'medium',
      metadata: {
        sessionId: result.sessionId,
        provider: result.provider,
        orgId: options.orgId,
        plan: options.plan,
      },
    });

    this.logger.log(
      `Upgrade initiated via Janua (${result.provider}) for user ${user.id}${options.orgId ? ` (org: ${options.orgId})` : ''}`
    );

    return { checkoutUrl: result.checkoutUrl, provider: result.provider };
  }

  /**
   * Upgrade via direct Stripe (fallback)
   */
  private async upgradeToPremiumViaStripe(
    user: { id: string; email: string; name: string; stripeCustomerId?: string },
    webUrl: string,
    options: UpgradeOptions = {}
  ): Promise<{ checkoutUrl: string; provider: BillingProvider }> {
    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await this.stripe.createCustomer({
        email: user.email,
        name: user.name,
        metadata: { userId: user.id },
      });

      customerId = customer.id;

      await this.prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // Route to correct Stripe price based on plan
    const plan = options.plan || 'pro';
    const priceId =
      plan === 'essentials'
        ? this.config.get<string>('STRIPE_ESSENTIALS_PRICE_ID')
        : this.config.get<string>('STRIPE_PREMIUM_PRICE_ID');

    if (!priceId) {
      throw new Error(`No Stripe price configured for plan: ${plan}`);
    }

    // Build metadata including orgId for external app linking
    const metadata: Record<string, string> = { userId: user.id, plan };
    if (options.orgId) {
      metadata.orgId = options.orgId;
    }

    const session = await this.stripe.createCheckoutSession({
      customerId,
      priceId,
      successUrl:
        options.successUrl || `${webUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: options.cancelUrl || `${webUrl}/billing/cancel`,
      metadata,
    });

    await this.audit.log({
      userId: user.id,
      action: 'BILLING_UPGRADE_INITIATED',
      severity: 'medium',
      metadata: { sessionId: session.id, provider: 'stripe', orgId: options.orgId },
    });

    this.logger.log(`Upgrade initiated via Stripe for user ${user.id}, session: ${session.id}`);

    return { checkoutUrl: session.url, provider: 'stripe' };
  }

  /**
   * Create billing portal session for subscription management
   */
  async createPortalSession(userId: string): Promise<{ portalUrl: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      throw new Error('No Stripe customer found for this user');
    }

    const webUrl = this.config.get<string>('WEB_URL', 'http://localhost:3000');

    const session = await this.stripe.createPortalSession({
      customerId: user.stripeCustomerId,
      returnUrl: `${webUrl}/billing`,
    });

    return { portalUrl: session.url };
  }

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

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionTier: 'pro',
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
        tier: 'pro',
        subscriptionId: subscription.id,
      },
    });

    // Dispatch Janua role upgrade if janua_user_id metadata is present
    if ((subscription as any).metadata?.janua_user_id) {
      const rawProduct = subscription.items.data[0]?.price?.product;
      const subProductId = typeof rawProduct === 'string' ? rawProduct : (rawProduct as any)?.id;
      this.dispatchJanuaRoleUpgrade(
        (subscription as any).metadata.janua_user_id,
        subProductId
      ).catch((err) =>
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

    this.logger.warn(`Payment failed for user ${user.id}, amount: ${invoice.amount_due / 100}`);
  }

  /**
   * Record usage metric for a user
   *
   * Increments the daily usage counter for the specified metric type.
   * Counters reset daily at midnight UTC.
   *
   * @param userId - User to record usage for
   * @param metricType - Type of metric (e.g., 'monte_carlo_simulation')
   *
   * @example
   * ```typescript
   * await billingService.recordUsage(userId, 'esg_calculation');
   * ```
   */
  async recordUsage(userId: string, metricType: UsageMetricType): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await this.prisma.usageMetric.upsert({
      where: {
        userId_metricType_date: {
          userId,
          metricType,
          date: today,
        },
      },
      create: {
        userId,
        metricType,
        date: today,
        count: 1,
      },
      update: {
        count: { increment: 1 },
      },
    });
  }

  /**
   * Check if user can perform an operation based on usage limits
   *
   * Returns true if the user has not exceeded their daily limit for the metric.
   * Premium users always return true (unlimited usage).
   *
   * @param userId - User to check
   * @param metricType - Type of metric to check
   * @returns true if operation is allowed, false if limit exceeded
   *
   * @example
   * ```typescript
   * if (!await billingService.checkUsageLimit(userId, 'monte_carlo_simulation')) {
   *   throw new HttpException('Daily limit exceeded', HttpStatus.PAYMENT_REQUIRED);
   * }
   * ```
   */
  async checkUsageLimit(userId: string, metricType: UsageMetricType): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionTier: true },
    });

    if (!user) {
      return false;
    }

    // Pro users have unlimited usage
    if (user.subscriptionTier === 'pro') {
      return true;
    }

    const tier = (user.subscriptionTier as keyof typeof this.usageLimits) || 'community';
    const limit = this.usageLimits[tier]?.[metricType] ?? this.usageLimits.community[metricType];

    // Infinity limit means unlimited for this tier
    if (limit === Infinity) {
      return true;
    }

    // 0 limit means feature is not available for this tier
    if (limit === 0) {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const usage = await this.prisma.usageMetric.findUnique({
      where: {
        userId_metricType_date: {
          userId,
          metricType,
          date: today,
        },
      },
    });

    const currentCount = usage?.count || 0;
    return currentCount < limit;
  }

  /**
   * Get usage limits configuration
   */
  getUsageLimits() {
    return this.usageLimits;
  }

  /**
   * Get feature limits for a specific tier
   */
  getTierLimits(tier: string) {
    return this.tierLimits[tier as keyof typeof this.tierLimits] || this.tierLimits.community;
  }

  /**
   * Get user's current usage metrics for today
   *
   * Returns usage counts and limits for all metric types.
   * Limit of -1 indicates unlimited (Premium tier).
   *
   * @param userId - User to get usage for
   * @returns Usage object with counts and limits by metric type
   *
   * @example
   * ```typescript
   * const usage = await billingService.getUserUsage(userId);
   * // Returns: { tier: 'free', usage: { monte_carlo_simulation: { used: 2, limit: 3 } } }
   * ```
   */
  async getUserUsage(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionTier: true },
    });

    const metrics = await this.prisma.usageMetric.findMany({
      where: {
        userId,
        date: today,
      },
    });

    const usageByType: Record<string, { used: number; limit: number }> = {};

    for (const metricType of Object.keys(this.usageLimits.community) as UsageMetricType[]) {
      const metric = metrics.find((m) => m.metricType === metricType);
      const tier = (user?.subscriptionTier as keyof typeof this.usageLimits) || 'community';
      const limit = this.usageLimits[tier]?.[metricType] ?? this.usageLimits.community[metricType];

      usageByType[metricType] = {
        used: metric?.count || 0,
        limit: limit === Infinity ? -1 : limit, // -1 represents unlimited
      };
    }

    return {
      date: today,
      tier: user?.subscriptionTier || 'community',
      usage: usageByType,
    };
  }

  /**
   * Get billing history for a user
   */
  async getBillingHistory(userId: string, limit = 20) {
    return this.prisma.billingEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ==========================================
  // External Checkout & Checkout Webhook
  // ==========================================

  /** Map plan slugs to subscription tiers */
  private readonly PLAN_TIER_MAP: Record<string, string> = {
    essentials: 'essentials',
    essentials_yearly: 'essentials',
    pro: 'pro',
    pro_yearly: 'pro',
  };

  /**
   * Create a checkout session for an external (unauthenticated) caller.
   * Returns the Stripe/Janua checkout URL.
   */
  async createExternalCheckout(userId: string, plan: string, returnUrl: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        stripeCustomerId: true,
        januaCustomerId: true,
        billingProvider: true,
        countryCode: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const countryCode = user.countryCode || 'US';
    const webUrl = this.config.get<string>('WEB_URL', 'http://localhost:3000');

    // Try Janua first, fall back to direct Stripe
    if (this.januaBilling.isEnabled()) {
      const result = await this.upgradeToPremiumViaJanua(user as any, countryCode, webUrl, {
        plan,
        successUrl: returnUrl,
        cancelUrl: returnUrl,
      });
      return result.checkoutUrl;
    }

    // Direct Stripe path
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripe.createCustomer({
        email: user.email,
        name: user.name,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // Route to correct Stripe price based on plan
    const priceId =
      plan === 'essentials'
        ? this.config.get<string>('STRIPE_ESSENTIALS_PRICE_ID')
        : this.config.get<string>('STRIPE_PREMIUM_PRICE_ID');

    const session = await this.stripe.createCheckoutSession({
      customerId,
      priceId,
      successUrl: returnUrl,
      cancelUrl: returnUrl,
      metadata: {
        janua_user_id: userId,
        plan,
        source: 'external',
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'BILLING_UPGRADE_INITIATED',
      severity: 'medium',
      metadata: { sessionId: session.id, provider: 'stripe', plan, source: 'external' },
    });

    return session.url;
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

    const tier = (plan && this.PLAN_TIER_MAP[plan]) || 'pro';

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
    this.dispatchJanuaRoleUpgrade(januaUserId, productId).catch((err) =>
      this.logger.error(`Janua role dispatch failed: ${err.message}`)
    );

    this.logger.log(`Checkout completed for user ${user.id}, tier: ${tier}`);
  }

  /**
   * Dispatch a role-upgrade call to the Janua Admin API.
   * Maps Stripe product IDs to Janua role names via STRIPE_FOUNDRY_PRODUCT_ID config.
   * Non-blocking — errors are logged, not thrown.
   */
  private async dispatchJanuaRoleUpgrade(januaUserId: string, productId?: string): Promise<void> {
    const januaApiUrl = this.config.get<string>('JANUA_API_URL');
    const januaAdminKey = this.config.get<string>('JANUA_ADMIN_KEY');

    if (!januaApiUrl || !januaAdminKey) {
      this.logger.warn(
        'Cannot dispatch Janua role upgrade: missing JANUA_API_URL or JANUA_ADMIN_KEY'
      );
      return;
    }

    // Build product → role map from config
    const foundryProductId = this.config.get<string>('STRIPE_FOUNDRY_PRODUCT_ID', 'prod_foundry');
    const productRoleMap: Record<string, string> = {
      [foundryProductId]: 'foundry_tier',
    };

    const role = productId ? productRoleMap[productId] : undefined;
    if (!role) {
      this.logger.log(
        `No Janua role mapping for product ${productId ?? 'unknown'}, skipping dispatch`
      );
      return;
    }

    try {
      const response = await fetch(`${januaApiUrl}/internal/users/${januaUserId}/roles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${januaAdminKey}`,
        },
        body: JSON.stringify({ add_role: role }),
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.error(`Janua role upgrade failed: ${response.status} - ${text}`);
      } else {
        this.logger.log(`Janua role upgraded for user ${januaUserId}: ${role}`);
      }
    } catch (error) {
      this.logger.error(`Janua role upgrade request error: ${error.message}`);
    }
  }

  // ==========================================
  // Janua Webhook Handlers
  // ==========================================

  /**
   * Handle Janua subscription created event
   */
  async handleJanuaSubscriptionCreated(payload: any): Promise<void> {
    const { customer_id, subscription_id, plan_id, provider, metadata } = payload.data;

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
        subscriptionTier: 'pro',
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
        currency: payload.data.currency || 'USD',
        metadata: { subscription_id, plan_id, provider },
      },
    });

    this.logger.log(`Janua subscription created for user ${user.id} via ${provider}`);

    // Notify Janua identity system if this subscription is linked to an organization
    // This enables the Enclii → Dhanam → Janua payment loop
    if (metadata?.orgId) {
      await this.notifyJanuaOfTierChange(metadata.orgId, customer_id, plan_id);
    }
  }

  /**
   * Handle Janua subscription updated event
   */
  async handleJanuaSubscriptionUpdated(payload: any): Promise<void> {
    const { customer_id, plan_id: _plan_id, status, provider: _provider } = payload.data;

    const user = await this.prisma.user.findFirst({
      where: { januaCustomerId: customer_id },
    });

    if (!user) {
      this.logger.warn(`User not found for Janua customer: ${customer_id}`);
      return;
    }

    const tier = status === 'active' ? 'pro' : 'community';

    await this.prisma.user.update({
      where: { id: user.id },
      data: { subscriptionTier: tier as SubscriptionTier },
    });

    this.logger.log(`Janua subscription updated for user ${user.id}: ${status}`);
  }

  /**
   * Handle Janua subscription cancelled event
   */
  async handleJanuaSubscriptionCancelled(payload: any): Promise<void> {
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
        currency: payload.data.currency || 'USD',
        metadata: { provider },
      },
    });

    this.logger.log(`Janua subscription cancelled for user ${user.id}`);
  }

  /**
   * Handle Janua subscription paused event
   */
  async handleJanuaSubscriptionPaused(payload: any): Promise<void> {
    const { customer_id } = payload.data;

    const user = await this.prisma.user.findFirst({
      where: { januaCustomerId: customer_id },
    });

    if (!user) {
      return;
    }

    // Keep premium tier but mark as paused in metadata
    this.logger.log(`Janua subscription paused for user ${user.id}`);
  }

  /**
   * Handle Janua subscription resumed event
   */
  async handleJanuaSubscriptionResumed(payload: any): Promise<void> {
    const { customer_id } = payload.data;

    const user = await this.prisma.user.findFirst({
      where: { januaCustomerId: customer_id },
    });

    if (!user) {
      return;
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { subscriptionTier: 'pro' },
    });

    this.logger.log(`Janua subscription resumed for user ${user.id}`);
  }

  /**
   * Handle Janua payment succeeded event
   */
  async handleJanuaPaymentSucceeded(payload: any): Promise<void> {
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
        type: 'payment_succeeded',
        status: 'succeeded',
        stripeEventId: payload.id,
        amount: amount || 0,
        currency: currency || 'USD',
        metadata: { provider },
      },
    });

    // Ensure subscription is active
    await this.prisma.user.update({
      where: { id: user.id },
      data: { subscriptionTier: 'pro' },
    });

    this.logger.log(`Janua payment succeeded for user ${user.id}: ${currency} ${amount}`);
  }

  /**
   * Handle Janua payment failed event
   */
  async handleJanuaPaymentFailed(payload: any): Promise<void> {
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
        currency: currency || 'USD',
        metadata: { provider },
      },
    });

    this.logger.warn(`Janua payment failed for user ${user.id}`);
    // Note: Don't immediately downgrade - Janua/provider will retry
  }

  /**
   * Handle Janua payment refunded event
   */
  async handleJanuaPaymentRefunded(payload: any): Promise<void> {
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
        currency: currency || 'USD',
        metadata: { provider },
      },
    });

    this.logger.log(`Janua refund processed for user ${user.id}: ${currency} ${amount}`);
  }

  // ==========================================
  // Janua Identity System Notification
  // ==========================================

  /**
   * Notify Janua identity system of subscription tier change
   * This updates the organization's subscription_tier, enabling
   * the Enclii → Dhanam → Janua payment loop
   *
   * @param orgId - Janua organization ID
   * @param customerId - Billing customer ID
   * @param planId - The plan that was activated
   */
  private async notifyJanuaOfTierChange(
    orgId: string,
    customerId: string,
    planId: string
  ): Promise<void> {
    const januaApiUrl = this.config.get<string>('JANUA_API_URL');
    const dhanamWebhookSecret = this.config.get<string>('DHANAM_WEBHOOK_SECRET');

    if (!januaApiUrl || !dhanamWebhookSecret) {
      this.logger.warn('Cannot notify Janua: missing JANUA_API_URL or DHANAM_WEBHOOK_SECRET');
      return;
    }

    const payload = JSON.stringify({
      type: 'subscription.created',
      data: {
        customer_id: customerId,
        plan_id: planId,
        organization_id: orgId,
      },
      timestamp: new Date().toISOString(),
    });

    // Sign the payload using HMAC-SHA256
    const signature = crypto
      .createHmac('sha256', dhanamWebhookSecret)
      .update(payload)
      .digest('hex');

    try {
      const response = await fetch(`${januaApiUrl}/api/v1/webhooks/dhanam/subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Dhanam-Signature': signature,
        },
        body: payload,
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Failed to notify Janua of tier change: ${response.status} - ${errorText}`
        );
      } else {
        this.logger.log(`Notified Janua of tier change for org ${orgId} (plan: ${planId})`);
      }
    } catch (error) {
      this.logger.error(`Error notifying Janua of tier change: ${error.message}`);
    }
  }
}
