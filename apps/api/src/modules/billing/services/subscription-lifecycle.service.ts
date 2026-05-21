import * as crypto from 'crypto';

import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import { AuditService } from '../../../core/audit/audit.service';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { PostHogService } from '../../analytics/posthog.service';
import { JanuaBillingService } from '../janua-billing.service';
import { StripeService } from '../stripe.service';

import { PriceResolverService } from './price-resolver.service';
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
    @Optional() private priceResolver?: PriceResolverService
  ) {}

  // ─── Upgrade flows ───────────────────────────────────────────────────

  /**
   * Initiate upgrade to premium subscription.
   * Uses Janua multi-provider billing when available, falls back to direct Stripe.
   */
  async upgradeToPremium(userId: string, options: UpgradeOptions = {}): Promise<CheckoutResult> {
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
      return this.upgradeToPremiumViaJanua(user, countryCode, webUrl, options);
    }

    // Fallback to direct Stripe
    return this.upgradeToPremiumViaStripe(user, webUrl, options);
  }

  /**
   * Upgrade via Janua (multi-provider: Conekta for MX, Polar for international).
   */
  private async upgradeToPremiumViaJanua(
    user: { id: string; email: string; name: string; januaCustomerId?: string },
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
    user: { id: string; email: string; name: string; stripeCustomerId?: string },
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
    const priceId = await this.resolveStripePriceId(plan, options.product);

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

    // Try Janua first, fall back to direct Stripe
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

    const priceId = await this.resolveStripePriceId(plan, product);

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

    return session.url;
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
      select: { id: true, email: true, stripeCustomerId: true, countryCode: true },
    });

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    const priceId = await this.resolveStripePriceId(planId);

    const defaultSuccessUrl = this.config.get<string>('FRONTEND_URL', 'https://app.dhan.am');
    const session = await this.stripe.createCheckoutSession({
      customerId: user.stripeCustomerId || undefined,
      priceId,
      successUrl:
        options?.successUrl ||
        `${defaultSuccessUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: options?.cancelUrl || `${defaultSuccessUrl}/billing`,
      metadata: {
        userId: user.id,
        source: 'federation',
        planId,
      },
      // customerEmail is passed via the spread when no stripeCustomerId exists
      ...(!user.stripeCustomerId && { customerEmail: user.email }),
    } as any);

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

    return this.upgradeToPremiumViaStripe(user, webUrl, checkoutOptions);
  }

  async getOperatorCheckoutStatus(sessionId: string): Promise<OperatorCheckoutStatus> {
    const session = await this.stripe.retrieveCheckoutSession(sessionId, {
      expand: ['subscription', 'payment_intent'],
    });

    const metadata = session.metadata || {};
    const userId = metadata.userId || metadata.janua_user_id || null;
    const billingEvents = userId
      ? await this.prisma.billingEvent.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 10,
        })
      : [];

    return {
      sessionId: session.id,
      provider: 'stripe',
      status: session.status || null,
      paymentStatus: session.payment_status || null,
      customerId: this.stripeObjectId(session.customer),
      subscriptionId: this.stripeObjectId(session.subscription),
      paymentIntentId: this.stripeObjectId(session.payment_intent),
      userId,
      product: metadata.product || null,
      plan: metadata.plan || metadata.planId || null,
      source: metadata.source || null,
      amountTotal: session.amount_total ?? null,
      currency: session.currency || null,
      createdAt: this.unixToIso(session.created),
      expiresAt: this.unixToIso(session.expires_at),
      checkoutUrl: session.url || null,
      billingEvents: billingEvents.map((event) => ({
        id: event.id,
        type: event.type,
        status: event.status,
        amount: event.amount.toString(),
        currency: event.currency,
        createdAt: event.createdAt,
        metadata: event.metadata,
      })),
    };
  }

  private stripeObjectId(
    value:
      | string
      | Stripe.Customer
      | Stripe.Subscription
      | Stripe.PaymentIntent
      | Stripe.DeletedCustomer
      | null
      | undefined
  ): string | null {
    if (!value) {
      return null;
    }

    if (typeof value === 'string') {
      return value;
    }

    return value.id || null;
  }

  private unixToIso(value?: number | null): string | null {
    return value ? new Date(value * 1000).toISOString() : null;
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

  private async resolveStripePriceId(plan: string, product?: string): Promise<string> {
    const catalogPlanId = this.normalizeCatalogPlanId(plan, product);

    if (this.priceResolver) {
      const resolved = await this.priceResolver.resolve(catalogPlanId, 1, false);
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

  /**
   * Dispatch a role-upgrade call to the Janua Admin API.
   * Maps Stripe product IDs to Janua role names via STRIPE_FOUNDRY_PRODUCT_ID config.
   * Non-blocking -- errors are logged, not thrown.
   */
  async dispatchJanuaRoleUpgrade(januaUserId: string, productId?: string): Promise<void> {
    const januaApiUrl = this.config.get<string>('JANUA_API_URL');
    const januaAdminKey = this.config.get<string>('JANUA_ADMIN_KEY');

    if (!januaApiUrl || !januaAdminKey) {
      this.logger.warn(
        'Cannot dispatch Janua role upgrade: missing JANUA_API_URL or JANUA_ADMIN_KEY'
      );
      return;
    }

    // Build product -> role map from config
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

  /**
   * Notify Janua identity system of subscription tier change.
   * This updates the organization's subscription_tier, enabling
   * the Enclii -> Dhanam -> Janua payment loop.
   */
  async notifyJanuaOfTierChange(orgId: string, customerId: string, planId: string): Promise<void> {
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

  /**
   * Notify product-specific webhook endpoints of subscription changes.
   *
   * URLs are configured via PRODUCT_WEBHOOK_URLS env var (zero-touch:
   * new products add their URL without Dhanam code changes).
   * Format: "karafiel:https://api.karafiel.mx/api/v1/webhooks/dhanam,tezca:https://..."
   */
  async notifyProductWebhooks(
    orgId: string,
    customerId: string,
    planId: string,
    eventType: string,
    subscriptionId?: string
  ): Promise<void> {
    const urlConfig = this.config.get<string>('PRODUCT_WEBHOOK_URLS');
    const secret = this.config.get<string>('DHANAM_WEBHOOK_SECRET');

    if (!urlConfig || !secret) return;

    // Parse product from planId (e.g., "karafiel_pro" -> "karafiel")
    const product = planId?.split('_')[0];
    if (!product) return;

    // Parse URL map from env var
    const urlMap: Record<string, string> = {};
    for (const entry of urlConfig.split(',')) {
      const colonIdx = entry.indexOf(':');
      if (colonIdx > 0) {
        const key = entry.slice(0, colonIdx).trim();
        const url = entry.slice(colonIdx + 1).trim();
        urlMap[key] = url;
      }
    }

    const targetUrl = urlMap[product];
    if (!targetUrl) return;

    const envelope = {
      type: eventType,
      id: crypto.randomUUID(),
      data: {
        customer_id: customerId,
        subscription_id: subscriptionId,
        plan_id: planId,
        organization_id: orgId,
        status: eventType.includes('.') ? eventType.split('.')[1] : 'created',
      },
      timestamp: new Date().toISOString(),
    };
    const payload = JSON.stringify(envelope);

    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    let statusCode: number | undefined;
    let errorMessage: string | undefined;
    let ok = false;

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Dhanam-Signature': signature,
        },
        body: payload,
      });

      statusCode = response.status;
      ok = response.ok;
      if (!ok) {
        try {
          errorMessage = `consumer responded ${response.status}: ${(await response.text()).slice(
            0,
            500
          )}`;
        } catch {
          errorMessage = `consumer responded ${response.status}`;
        }
        this.logger.warn(`Product webhook to ${product} failed: ${response.status}`);
      } else {
        this.logger.log(`Product webhook dispatched to ${product} for ${eventType}`);
      }
    } catch (error) {
      errorMessage = `network/timeout: ${error.message}`;
      this.logger.error(`Product webhook dispatch to ${product} failed: ${error.message}`);
    }

    // Persist non-2xx / network errors to the DLQ so the auto-retry job
    // (and the admin manual-replay endpoint) can re-deliver later.
    // Best-effort — a DLQ insert failure cannot break the original
    // billing flow; the consumer remains the source of idempotency.
    if (!ok && this.dlq) {
      try {
        await this.dlq.recordFailure({
          eventId: envelope.id,
          consumer: product,
          consumerUrl: targetUrl,
          eventType,
          payload: envelope,
          signatureHeader: signature,
          statusCode,
          errorMessage: errorMessage ?? 'unknown',
        });
      } catch (dlqErr) {
        this.logger.error(
          `Failed to persist DLQ row for ${product} subscription event ${eventType}: ${
            (dlqErr as Error).message
          }`
        );
      }
    }
  }
}
