import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import { UsageMetricType } from '@db';

import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { PostHogService } from '../analytics/posthog.service';

import { JanuaWebhookPayloadDto } from './dto/janua-webhook.dto';
import { JanuaBillingService } from './janua-billing.service';
import { PriceResolverService } from './services/price-resolver.service';
import { SubscriptionLifecycleService } from './services/subscription-lifecycle.service';
import { UsageTrackingService } from './services/usage-tracking.service';
import { WebhookProcessorService } from './services/webhook-processor.service';
import { StripeService } from './stripe.service';

// Re-export so existing callers that import { UpgradeOptions } from './billing.service' keep working
export type { UpgradeOptions } from './services/subscription-lifecycle.service';

/**
 * Billing Service — Facade
 *
 * Thin orchestration layer that delegates to focused sub-services:
 *
 * | Concern                | Service                      |
 * |------------------------|------------------------------|
 * | Usage metering & gates | UsageTrackingService         |
 * | Checkout & lifecycle   | SubscriptionLifecycleService |
 * | Webhook processing     | WebhookProcessorService      |
 *
 * All public method signatures are preserved so that controllers, guards,
 * interceptors, and external consumers (SimulationsService, etc.) continue
 * to work without changes.
 *
 * ### Backward-compatible DI
 * For test modules that provide the raw dependencies (PrismaService,
 * StripeService, etc.) directly without the sub-services, the facade
 * constructs the sub-services internally. In production the module
 * registers everything and DI supplies the pre-built instances.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private billingDisabled = false;

  private readonly usageTracking: UsageTrackingService;
  private readonly lifecycle: SubscriptionLifecycleService;
  private readonly webhooks: WebhookProcessorService;

  /**
   * Expose tierLimits on the facade so guards that read
   * `billing.tierLimits` directly continue to compile.
   */
  get tierLimits() {
    return this.usageTracking.tierLimits;
  }

  constructor(
    // --- raw deps (always available in tests; also available in prod) ---
    private prisma: PrismaService,
    private stripeService: StripeService,
    private januaBilling: JanuaBillingService,
    private audit: AuditService,
    private config: ConfigService,
    private posthog: PostHogService,
    // --- pre-built sub-services (available when module registers them) ---
    @Optional() usageTracking?: UsageTrackingService,
    @Optional() lifecycle?: SubscriptionLifecycleService,
    @Optional() webhooks?: WebhookProcessorService
  ) {
    // Build sub-services from raw deps if not provided via DI (test compat)
    this.usageTracking = usageTracking ?? new UsageTrackingService(this.prisma);
    this.lifecycle =
      lifecycle ??
      new SubscriptionLifecycleService(
        this.prisma,
        this.stripeService,
        this.januaBilling,
        this.audit,
        this.config,
        this.posthog,
        undefined,
        new PriceResolverService(this.config, this.prisma)
      );
    this.webhooks =
      webhooks ??
      new WebhookProcessorService(
        this.prisma,
        this.stripeService,
        this.audit,
        this.posthog,
        this.lifecycle
      );

    // Validate billing secrets on startup
    const billingSecretKeys = [
      'STRIPE_MX_WEBHOOK_SECRET',
      'PADDLE_VENDOR_ID',
      'PADDLE_API_KEY',
      'PADDLE_CLIENT_TOKEN',
      'PADDLE_WEBHOOK_SECRET',
    ];

    const isProduction = this.config.get<string>('NODE_ENV') === 'production';

    for (const key of billingSecretKeys) {
      const value = this.config.get<string>(key);
      if (
        value &&
        (value.toLowerCase().includes('placeholder') ||
          value.startsWith('your_') ||
          value.startsWith('your-'))
      ) {
        if (isProduction) {
          this.logger.error(
            `CRITICAL: Billing secret ${key} contains placeholder value. Billing endpoints are disabled.`
          );
          this.billingDisabled = true;
        } else {
          this.logger.warn(
            `Billing secret ${key} contains placeholder value. Billing features may not work.`
          );
        }
      }
    }
  }

  // =========================================================================
  // Usage Tracking  (delegates to UsageTrackingService)
  // =========================================================================

  async recordUsage(userId: string, metricType: UsageMetricType): Promise<void> {
    return this.usageTracking.recordUsage(userId, metricType);
  }

  async checkUsageLimit(userId: string, metricType: UsageMetricType): Promise<boolean> {
    return this.usageTracking.checkUsageLimit(userId, metricType);
  }

  getUsageLimits() {
    return this.usageTracking.getUsageLimits();
  }

  getTierLimits(tier: string) {
    return this.usageTracking.getTierLimits(tier);
  }

  async getUserUsage(userId: string) {
    return this.usageTracking.getUserUsage(userId);
  }

  // =========================================================================
  // Subscription Lifecycle  (delegates to SubscriptionLifecycleService)
  // =========================================================================

  async upgradeToPremium(
    userId: string,
    options: import('./services/subscription-lifecycle.service').UpgradeOptions = {}
  ): Promise<{ checkoutUrl: string; provider: string }> {
    return this.lifecycle.upgradeToPremium(userId, options);
  }

  async createPortalSession(userId: string): Promise<{ portalUrl: string }> {
    return this.lifecycle.createPortalSession(userId);
  }

  async createExternalCheckout(
    userId: string,
    plan: string,
    returnUrl: string,
    product?: string
  ): Promise<string> {
    return this.lifecycle.createExternalCheckout(userId, plan, returnUrl, product);
  }

  async createFederatedCheckout(
    userId: string,
    planId: string,
    options?: { successUrl?: string; cancelUrl?: string }
  ): Promise<{ checkoutUrl: string; sessionId: string }> {
    return this.lifecycle.createFederatedCheckout(userId, planId, options);
  }

  async getBillingHistory(userId: string, limit = 20) {
    return this.lifecycle.getBillingHistory(userId, limit);
  }

  // =========================================================================
  // Stripe Webhooks  (delegates to WebhookProcessorService)
  // =========================================================================

  async handleSubscriptionCreated(event: Stripe.Event): Promise<void> {
    return this.webhooks.handleSubscriptionCreated(event);
  }

  async handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
    return this.webhooks.handleSubscriptionUpdated(event);
  }

  async handleSubscriptionCancelled(event: Stripe.Event): Promise<void> {
    return this.webhooks.handleSubscriptionCancelled(event);
  }

  async handlePaymentSucceeded(event: Stripe.Event): Promise<void> {
    return this.webhooks.handlePaymentSucceeded(event);
  }

  async handlePaymentFailed(event: Stripe.Event): Promise<void> {
    return this.webhooks.handlePaymentFailed(event);
  }

  async handleCheckoutCompleted(event: Stripe.Event): Promise<void> {
    return this.webhooks.handleCheckoutCompleted(event);
  }

  // =========================================================================
  // Janua Webhooks  (delegates to WebhookProcessorService)
  // =========================================================================

  async handleJanuaSubscriptionCreated(payload: JanuaWebhookPayloadDto): Promise<void> {
    return this.webhooks.handleJanuaSubscriptionCreated(payload);
  }

  async handleJanuaSubscriptionUpdated(payload: JanuaWebhookPayloadDto): Promise<void> {
    return this.webhooks.handleJanuaSubscriptionUpdated(payload);
  }

  async handleJanuaSubscriptionCancelled(payload: JanuaWebhookPayloadDto): Promise<void> {
    return this.webhooks.handleJanuaSubscriptionCancelled(payload);
  }

  async handleJanuaSubscriptionPaused(payload: JanuaWebhookPayloadDto): Promise<void> {
    return this.webhooks.handleJanuaSubscriptionPaused(payload);
  }

  async handleJanuaSubscriptionResumed(payload: JanuaWebhookPayloadDto): Promise<void> {
    return this.webhooks.handleJanuaSubscriptionResumed(payload);
  }

  async handleJanuaPaymentSucceeded(payload: JanuaWebhookPayloadDto): Promise<void> {
    return this.webhooks.handleJanuaPaymentSucceeded(payload);
  }

  async handleJanuaPaymentFailed(payload: JanuaWebhookPayloadDto): Promise<void> {
    return this.webhooks.handleJanuaPaymentFailed(payload);
  }

  async handleJanuaPaymentRefunded(payload: JanuaWebhookPayloadDto): Promise<void> {
    return this.webhooks.handleJanuaPaymentRefunded(payload);
  }
}
