import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuditService } from '../../../core/audit/audit.service';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { PostHogService } from '../../analytics/posthog.service';
import { JanuaBillingService } from '../janua-billing.service';
import { StripeService } from '../stripe.service';

import { CheckoutRoutingPolicyService } from './checkout-routing-policy.service';
import { OperatorCheckoutStatusService } from './operator-checkout-status.service';
import { PriceResolverService } from './price-resolver.service';
import { tryHybridSubscriptionCheckout } from './subscription-hybrid-checkout';
import { SubscriptionJanuaNotifierService } from './subscription-janua-notifier.service';
import { WebhookDlqService } from './webhook-dlq.service';

/**
 * Options for premium upgrade.
 * Used for external app integration (e.g., Enclii).
 */
export interface UpgradeOptions {
  orgId?: string;
  plan?: string;
  product?: string;
  successUrl?: string;
  cancelUrl?: string;
  countryCode?: string;
  source?: string;
  operatorId?: string;
  /** Preferred payment instrument — routes to lowest-fee provider/method when set. */
  paymentMethod?: string;
  amountMinor?: number;
  currency?: string;
}

export interface OperatorCheckoutOptions extends UpgradeOptions {
  plan: string;
}

export interface CheckoutResult {
  checkoutUrl: string;
  provider: string;
  sessionId?: string;
}

export interface OperatorCheckoutStatus {
  sessionId: string;
  provider: string;
  status: string | null;
  paymentStatus: string | null;
  customerId: string | null;
  subscriptionId: string | null;
  paymentIntentId: string | null;
  userId: string | null;
  product: string | null;
  plan: string | null;
  source: string | null;
  amountTotal: number | null;
  currency: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  checkoutUrl: string | null;
  billingEvents: Array<{
    id: string;
    type: string;
    status: string;
    amount: string;
    currency: string;
    createdAt: Date;
    metadata: unknown;
  }>;
}

/** Map plan slugs to subscription tiers */
export const PLAN_TIER_MAP: Record<string, string> = {
  essentials: 'essentials',
  essentials_yearly: 'essentials',
  pro: 'pro',
  pro_yearly: 'pro',
  premium: 'premium',
  premium_yearly: 'premium',
};

/**
 * Subscription Lifecycle Service
 *
 * Manages the full subscription lifecycle: checkout creation, portal access,
 * plan changes, Janua role synchronization, and billing history.
 * Extracted from BillingService to isolate checkout / subscription orchestration.
 *
 * ## Responsibilities
 * - Initiate upgrades (via Janua or direct Stripe)
 * - Create billing portal sessions
 * - External and federated checkout flows
 * - Dispatch Janua role upgrades on tier change
 * - Notify Janua identity system of org-level tier changes
 * - Query billing history
 *
 * @see WebhookProcessorService - handles inbound webhook events
 * @see UsageTrackingService - metering and limits
 */
@Injectable()
export class SubscriptionLifecycleService {
  private readonly logger = new Logger(SubscriptionLifecycleService.name);

  constructor(
    private prisma: PrismaService,
    private stripe: StripeService,
    private januaBilling: JanuaBillingService,
    private audit: AuditService,
    private config: ConfigService,
    private posthog: PostHogService,
    // Optional so existing call sites that build this service manually
    // (older specs) don't have to construct a DLQ stub. When absent,
    // the legacy "log + forget" failure path is preserved.
    @Optional() private dlq?: WebhookDlqService,
    @Optional() private priceResolver?: PriceResolverService,
    @Optional() private checkoutRouting?: CheckoutRoutingPolicyService,
    @Optional() private operatorCheckoutStatus?: OperatorCheckoutStatusService,
    @Optional() private januaNotifier?: SubscriptionJanuaNotifierService
  ) {}

  // ─── Upgrade flows ───────────────────────────────────────────────────

  /**
   * Initiate upgrade to premium subscription.
   * Uses Janua multi-provider billing when available, falls back to direct Stripe.
   */
  async upgradeToPremium(userId: string, options: UpgradeOptions = {}): Promise<CheckoutResult> {
    const countryCode = options.countryCode || 'US';
    const product = options.product ?? 'dhanam';
    const normalizedOptions: UpgradeOptions = { ...options, product, countryCode };

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
    const tierRank = { community: 0, essentials: 1, pro: 2, premium: 3 };
    const currentRank = tierRank[currentUser?.subscriptionTier as keyof typeof tierRank] ?? 0;
    const requestedRank = tierRank[requestedPlan as keyof typeof tierRank] ?? 2;

    if (currentRank >= requestedRank) {
      throw new Error(`User is already on ${currentUser?.subscriptionTier} tier`);
    }

    const webUrl = this.config.get<string>('WEB_URL', 'http://localhost:3000');

    // Track upgrade initiation
    await this.posthog.capture({
      distinctId: user.id,
      event: 'upgrade_initiated',
      properties: {
        product: options.product || 'dhanam',
        plan: requestedPlan,
        current_tier: currentUser?.subscriptionTier || 'community',
        country_code: countryCode,
        provider: this.januaBilling.isEnabled() ? 'janua' : 'stripe',
      },
    });

    // Try Janua multi-provider billing first
    if (this.januaBilling.isEnabled()) {
      return this.upgradeToPremiumViaJanua(user, countryCode, webUrl, normalizedOptions);
    }

    const hybrid = await tryHybridSubscriptionCheckout(
      this.checkoutRouting,
      this.audit,
      this.logger,
      user.id,
      countryCode,
      webUrl,
      normalizedOptions
    );
    if (hybrid) {
      return hybrid;
    }

    // Fallback to direct Stripe
    return this.upgradeToPremiumViaStripe(user, webUrl, normalizedOptions);
  }

  /**
   * Upgrade via Janua (multi-provider: Conekta for MX, Polar for international).
   */
  private async upgradeToPremiumViaJanua(
    user: { id: string; email: string; name: string; januaCustomerId?: string | null },
    countryCode: string,
    webUrl: string,
    options: UpgradeOptions = {}
  ): Promise<CheckoutResult> {
    let customerId = user.januaCustomerId;

    if (!customerId) {
      const result = await this.januaBilling.createCustomer({
        email: user.email,
        name: user.name,
        countryCode,
        orgId: options.orgId,
        metadata: { userId: user.id },
      });

      customerId = result.customerId;
      const provider = result.provider;

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
    if (options.product) {
      metadata.product = options.product;
    }
    if (options.source) {
      metadata.source = options.source;
    }
    if (options.operatorId) {
      metadata.operatorId = options.operatorId;
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
        product: options.product,
        source: options.source,
        operatorId: options.operatorId,
      },
    });

    this.logger.log(
      `Upgrade initiated via Janua (${result.provider}) for user ${user.id}${options.orgId ? ` (org: ${options.orgId})` : ''}`
    );

    return {
      checkoutUrl: result.checkoutUrl,
      provider: result.provider,
      sessionId: result.sessionId,
    };
  }

  /**
   * Upgrade via direct Stripe (fallback).
   */
  private async upgradeToPremiumViaStripe(
    user: { id: string; email: string; name: string; stripeCustomerId?: string | null },
    webUrl: string,
    options: UpgradeOptions = {}
  ): Promise<CheckoutResult> {
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

    const plan = options.plan || 'pro';
    const priceId = await this.resolveStripePriceId(
      plan,
      options.product ?? 'dhanam',
      options.countryCode
    );

    // Build metadata including orgId for external app linking
    const metadata: Record<string, string> = { userId: user.id, plan };
    if (options.orgId) {
      metadata.orgId = options.orgId;
    }
    if (options.product) {
      metadata.product = options.product;
    }
    if (options.source) {
      metadata.source = options.source;
    }
    if (options.operatorId) {
      metadata.operatorId = options.operatorId;
    }

    // Apply intro coupon if configured (e.g., $0.99/mo for first 3 months)
    const introCouponId = this.config.get<string>('STRIPE_INTRO_COUPON_ID');

    const session = await this.stripe.createCheckoutSession({
      customerId,
      priceId,
      successUrl:
        options.successUrl || `${webUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: options.cancelUrl || `${webUrl}/billing/cancel`,
      metadata,
      couponId: introCouponId,
    });

    await this.audit.log({
      userId: user.id,
      action: 'BILLING_UPGRADE_INITIATED',
      severity: 'medium',
      metadata: {
        sessionId: session.id,
        provider: 'stripe',
        orgId: options.orgId,
        product: options.product,
        source: options.source,
        operatorId: options.operatorId,
      },
    });

    this.logger.log(`Upgrade initiated via Stripe for user ${user.id}, session: ${session.id}`);

    return { checkoutUrl: session.url || '', provider: 'stripe', sessionId: session.id };
  }

  // ─── Portal ──────────────────────────────────────────────────────────

  /**
   * Create billing portal session for subscription management.
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

  // ─── External / federated checkout ───────────────────────────────────

  /**
   * Create a checkout session for an external (unauthenticated) caller.
   * Returns the Stripe/Janua checkout URL.
   */
  async createExternalCheckout(
    userId: string,
    plan: string,
    returnUrl: string,
    product?: string
  ): Promise<string> {
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

    // Try Janua first, fall back to hybrid router or direct Stripe
    if (this.januaBilling.isEnabled()) {
      const result = await this.upgradeToPremiumViaJanua(user as any, countryCode, webUrl, {
        plan,
        product,
        successUrl: returnUrl,
        cancelUrl: returnUrl,
        source: 'external',
      });
      return result.checkoutUrl;
    }

    const hybrid = await tryHybridSubscriptionCheckout(
      this.checkoutRouting,
      this.audit,
      this.logger,
      user.id,
      countryCode,
      webUrl,
      {
        plan,
        product,
        successUrl: returnUrl,
        cancelUrl: returnUrl,
        source: 'external',
      }
    );
    if (hybrid) {
      return hybrid.checkoutUrl;
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

    const priceId = await this.resolveStripePriceId(plan, product, countryCode);

    const session = await this.stripe.createCheckoutSession({
      customerId,
      priceId,
      successUrl: returnUrl,
      cancelUrl: returnUrl,
      metadata: {
        janua_user_id: userId,
        plan,
        source: 'external',
        ...(product && { product }),
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'BILLING_UPGRADE_INITIATED',
      severity: 'medium',
      metadata: {
        sessionId: session.id,
        provider: 'stripe',
        plan,
        source: 'external',
        ...(product && { product }),
      },
    });

    return session.url || '';
  }

  /**
   * Create a checkout session on behalf of a federated service (e.g., PhyndCRM).
   */
  async createFederatedCheckout(
    userId: string,
    planId: string,
    options?: { successUrl?: string; cancelUrl?: string }
  ): Promise<{ checkoutUrl: string; sessionId: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        stripeCustomerId: true,
        countryCode: true,
      },
    });

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    const countryCode = user.countryCode || 'US';
    const defaultSuccessUrl = this.config.get<string>('FRONTEND_URL', 'https://app.dhan.am');
    const successUrl =
      options?.successUrl ||
      `${defaultSuccessUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = options?.cancelUrl || `${defaultSuccessUrl}/billing`;
    const webUrl = this.config.get<string>('WEB_URL', defaultSuccessUrl);

    if (this.januaBilling.isEnabled()) {
      const result = await this.upgradeToPremiumViaJanua(
        user as { id: string; email: string; name: string },
        countryCode,
        webUrl,
        {
          plan: planId,
          successUrl,
          cancelUrl,
          source: 'federation',
        }
      );
      return { checkoutUrl: result.checkoutUrl, sessionId: result.sessionId || '' };
    }

    const hybrid = await tryHybridSubscriptionCheckout(
      this.checkoutRouting,
      this.audit,
      this.logger,
      user.id,
      countryCode,
      webUrl,
      {
        plan: planId,
        successUrl,
        cancelUrl,
        source: 'federation',
      }
    );
    if (hybrid) {
      return { checkoutUrl: hybrid.checkoutUrl, sessionId: hybrid.sessionId || '' };
    }

    const priceId = await this.resolveStripePriceId(planId, undefined, countryCode);

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripe.createCustomer({
        email: user.email,
        name: user.name || undefined,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await this.stripe.createCheckoutSession({
      customerId,
      priceId,
      successUrl,
      cancelUrl,
      metadata: {
        userId: user.id,
        source: 'federation',
        planId,
      },
    });

    return {
      checkoutUrl: session.url || '',
      sessionId: session.id,
    };
  }

  /**
   * Create an operator-initiated checkout link for MADFAM internal POS use.
   *
   * This intentionally bypasses the self-service "already on this tier" guard
   * in `upgradeToPremium()`: operators may need to sell a product-specific
   * plan to an existing Dhanam customer. Provider/customer creation and price
   * resolution still flow through the same lifecycle paths as normal checkout.
   */
  async createOperatorCheckout(
    userId: string,
    options: OperatorCheckoutOptions
  ): Promise<CheckoutResult> {
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

    const webUrl = this.config.get<string>('WEB_URL', 'http://localhost:3000');
    const countryCode = options.countryCode || user.countryCode || 'US';
    const checkoutOptions: OperatorCheckoutOptions = {
      ...options,
      countryCode,
      source: options.source || 'internal_pos',
      successUrl:
        options.successUrl || `${webUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: options.cancelUrl || `${webUrl}/billing/cancel`,
    };

    if (this.januaBilling.isEnabled()) {
      return this.upgradeToPremiumViaJanua(user as any, countryCode, webUrl, checkoutOptions);
    }

    const hybrid = await tryHybridSubscriptionCheckout(
      this.checkoutRouting,
      this.audit,
      this.logger,
      user.id,
      countryCode,
      webUrl,
      checkoutOptions
    );
    if (hybrid) {
      return hybrid;
    }

    return this.upgradeToPremiumViaStripe(user, webUrl, checkoutOptions);
  }

  async getOperatorCheckoutStatus(sessionId: string): Promise<OperatorCheckoutStatus> {
    if (!this.operatorCheckoutStatus) {
      throw new Error('Operator checkout status service is not available');
    }
    return this.operatorCheckoutStatus.getOperatorCheckoutStatus(sessionId);
  }

  private normalizeCatalogPlanId(plan: string, product?: string): string {
    const normalizedPlan = plan.toLowerCase();
    const normalizedProduct = product?.toLowerCase();
    if (!normalizedProduct || normalizedPlan.startsWith(`${normalizedProduct}_`)) {
      return normalizedPlan;
    }
    return `${normalizedProduct}_${normalizedPlan}`;
  }

  private getSupportedTierSlug(catalogPlanId: string): string | undefined {
    const corePlan = catalogPlanId.replace(/_(yearly|annual|monthly)$/, '');
    const parts = corePlan.split('_');
    const tierSlug = parts.length >= 2 ? parts.slice(1).join('_') : corePlan;
    return PLAN_TIER_MAP[tierSlug] ? tierSlug : undefined;
  }

  private legacyEnvPriceId(plan: string): string | undefined {
    const tierSlug = this.getSupportedTierSlug(plan);

    switch (plan) {
      case 'essentials':
      case 'essentials_yearly':
        return this.config.get<string>('STRIPE_ESSENTIALS_PRICE_ID');
      case 'premium':
      case 'premium_yearly':
        return this.config.get<string>('STRIPE_PREMIUM_PLAN_PRICE_ID');
      case 'pro':
      case 'pro_yearly':
        return this.config.get<string>('STRIPE_PREMIUM_PRICE_ID');
      default:
        if (tierSlug === 'essentials') {
          return this.config.get<string>('STRIPE_ESSENTIALS_PRICE_ID');
        }
        if (tierSlug === 'premium') {
          return this.config.get<string>('STRIPE_PREMIUM_PLAN_PRICE_ID');
        }
        if (tierSlug === 'pro') {
          return this.config.get<string>('STRIPE_PREMIUM_PRICE_ID');
        }
        return undefined;
    }
  }

  private regionForCountry(countryCode?: string): number {
    return (countryCode || 'US').toUpperCase() === 'MX' ? 3 : 1;
  }

  private async resolveStripePriceId(
    plan: string,
    product?: string,
    countryCode?: string
  ): Promise<string> {
    const catalogPlanId = this.normalizeCatalogPlanId(plan, product);
    const region = this.regionForCountry(countryCode);

    if (this.priceResolver) {
      const resolved = await this.priceResolver.resolve(catalogPlanId, region, false);
      return resolved.priceId;
    }

    const priceId = this.legacyEnvPriceId(catalogPlanId);
    if (!priceId) {
      throw new Error(`No Stripe price configured for plan: ${catalogPlanId}`);
    }
    return priceId;
  }

  // ─── Billing history ─────────────────────────────────────────────────

  /**
   * Get billing history for a user.
   */
  async getBillingHistory(userId: string, limit = 20) {
    return this.prisma.billingEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ─── Janua role sync (used by WebhookProcessorService too) ───────────

  async dispatchJanuaRoleUpgrade(januaUserId: string, productId?: string): Promise<void> {
    if (!this.januaNotifier) {
      return;
    }
    return this.januaNotifier.dispatchJanuaRoleUpgrade(januaUserId, productId);
  }

  async notifyJanuaOfTierChange(orgId: string, customerId: string, planId: string): Promise<void> {
    if (!this.januaNotifier) {
      return;
    }
    return this.januaNotifier.notifyJanuaOfTierChange(orgId, customerId, planId);
  }

  async notifyProductWebhooks(
    orgId: string,
    customerId: string,
    planId: string,
    eventType: string,
    subscriptionId?: string
  ): Promise<void> {
    if (!this.januaNotifier) {
      return;
    }
    return this.januaNotifier.notifyProductWebhooks(
      orgId,
      customerId,
      planId,
      eventType,
      subscriptionId
    );
  }
}
