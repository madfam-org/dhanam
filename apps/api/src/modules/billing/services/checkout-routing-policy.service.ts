import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { JanuaBillingService } from '../janua-billing.service';

import { CheckoutRouteOverrideService } from './checkout-route-override.service';
import { PaddleService } from './paddle.service';
import { PaymentRouterService } from './payment-router.service';
import { PriceResolverService } from './price-resolver.service';
import { StripeMxService } from './stripe-mx.service';

/** Canonical checkout route targets exposed to operators and audit logs. */
export type CheckoutRouteProvider = 'janua' | 'stripe_mx' | 'paddle' | 'legacy_stripe';

export interface CheckoutRoutingContext {
  userId: string;
  plan: string;
  product?: string;
  countryCode: string;
  successUrl: string;
  cancelUrl: string;
  orgId?: string;
  source?: string;
  operatorId?: string;
  /** Operator-only override for dry-run or forced routing. */
  providerOverride?: CheckoutRouteProvider;
  /** Distinguishes preview dry-run vs persisted operator override. */
  overrideKind?: 'stored' | 'preview';
}

export interface CheckoutRoutingPreview {
  provider: CheckoutRouteProvider;
  routeReason: string;
  countryCode: string;
  currency: string;
  paymentMethods: string[];
  januaEnabled: boolean;
  unifiedRoutingEnabled: boolean;
  hybridRouterAvailable: boolean;
  legacyStripeAvailable: boolean;
  priceIdResolvable: boolean;
  catalogPlanId: string;
}

export interface HybridCheckoutResult {
  checkoutUrl: string;
  provider: string;
  sessionId: string;
  currency: string;
}

/**
 * Centralizes geography-aware checkout routing decisions.
 *
 * When Janua billing is disabled (production default), eligible checkouts
 * route through {@link PaymentRouterService} (MX → Stripe MX, global → Paddle)
 * instead of the legacy US Stripe account path.
 */
@Injectable()
export class CheckoutRoutingPolicyService {
  private readonly logger = new Logger(CheckoutRoutingPolicyService.name);

  constructor(
    private config: ConfigService,
    private januaBilling: JanuaBillingService,
    private paymentRouter: PaymentRouterService,
    private stripeMx: StripeMxService,
    private paddle: PaddleService,
    @Optional() private priceResolver?: PriceResolverService,
    @Optional() private routeOverride?: CheckoutRouteOverrideService
  ) {}

  isUnifiedRoutingEnabled(): boolean {
    return this.config.get<string>('FEATURE_UNIFIED_CHECKOUT_ROUTING', 'true') === 'true';
  }

  isLegacyStripeConfigured(): boolean {
    return Boolean(this.config.get<string>('STRIPE_SECRET_KEY'));
  }

  isHybridRouterAvailable(countryCode: string): boolean {
    const normalized = countryCode.toUpperCase();
    if (normalized === 'MX') {
      return this.stripeMx.isConfigured();
    }
    return this.paddle.isConfigured();
  }

  normalizeCatalogPlanId(plan: string, product?: string): string {
    const normalizedPlan = plan.toLowerCase();
    const normalizedProduct = product?.toLowerCase();
    if (!normalizedProduct || normalizedPlan.startsWith(`${normalizedProduct}_`)) {
      return normalizedPlan;
    }
    return `${normalizedProduct}_${normalizedPlan}`;
  }

  async resolvePriceId(plan: string, product?: string): Promise<string | null> {
    const catalogPlanId = this.normalizeCatalogPlanId(plan, product);

    if (this.priceResolver) {
      try {
        const resolved = await this.priceResolver.resolve(catalogPlanId, 1, false);
        return resolved.priceId;
      } catch {
        return null;
      }
    }

    return this.legacyEnvPriceId(catalogPlanId) ?? null;
  }

  async preview(context: CheckoutRoutingContext): Promise<CheckoutRoutingPreview> {
    const resolvedContext = await this.applyStoredOverride(context);
    const countryCode = resolvedContext.countryCode.toUpperCase();
    const { provider, reason } = this.resolveProvider(resolvedContext);
    const providerConfig =
      provider === 'stripe_mx' || provider === 'paddle'
        ? this.paymentRouter.getProviderForCountry(countryCode)
        : null;
    const priceId = await this.resolvePriceId(resolvedContext.plan, resolvedContext.product);

    return {
      provider,
      routeReason: reason,
      countryCode,
      currency:
        provider === 'legacy_stripe'
          ? 'USD'
          : provider === 'janua'
            ? countryCode === 'MX'
              ? 'MXN'
              : 'USD'
            : (providerConfig?.currency ?? 'USD'),
      paymentMethods:
        provider === 'legacy_stripe'
          ? ['card']
          : provider === 'janua'
            ? countryCode === 'MX'
              ? ['card', 'spei', 'oxxo']
              : ['card']
            : (providerConfig?.paymentMethods ?? []),
      januaEnabled: this.januaBilling.isEnabled(),
      unifiedRoutingEnabled: this.isUnifiedRoutingEnabled(),
      hybridRouterAvailable: this.isHybridRouterAvailable(countryCode),
      legacyStripeAvailable: this.isLegacyStripeConfigured(),
      priceIdResolvable: Boolean(priceId),
      catalogPlanId: this.normalizeCatalogPlanId(resolvedContext.plan, resolvedContext.product),
    };
  }

  private async applyStoredOverride(
    context: CheckoutRoutingContext
  ): Promise<CheckoutRoutingContext> {
    if (context.providerOverride || !this.routeOverride) {
      return context;
    }

    const stored = await this.routeOverride.getActiveOverride(context.userId, context.product);
    if (!stored) {
      return context;
    }

    return {
      ...context,
      providerOverride: stored.provider,
      overrideKind: 'stored',
    };
  }

  resolveProvider(context: CheckoutRoutingContext): {
    provider: CheckoutRouteProvider;
    reason: string;
  } {
    if (context.providerOverride) {
      return {
        provider: context.providerOverride,
        reason:
          context.overrideKind === 'preview' ? 'operator_override' : 'operator_stored_override',
      };
    }

    if (this.januaBilling.isEnabled()) {
      return { provider: 'janua', reason: 'janua_billing_enabled' };
    }

    const countryCode = context.countryCode.toUpperCase();

    if (this.isUnifiedRoutingEnabled() && this.isHybridRouterAvailable(countryCode)) {
      const providerConfig = this.paymentRouter.getProviderForCountry(countryCode);
      return {
        provider: providerConfig.provider,
        reason: `hybrid_router_${countryCode.toLowerCase()}`,
      };
    }

    return { provider: 'legacy_stripe', reason: 'legacy_stripe_fallback' };
  }

  /**
   * Attempt hybrid-router checkout. Returns null when the caller should fall
   * back to Janua or legacy Stripe orchestration in SubscriptionLifecycleService.
   */
  async tryHybridCheckout(context: CheckoutRoutingContext): Promise<HybridCheckoutResult | null> {
    const resolvedContext = await this.applyStoredOverride(context);
    const { provider, reason } = this.resolveProvider(resolvedContext);

    if (provider === 'janua' || provider === 'legacy_stripe') {
      return null;
    }

    if (!this.isUnifiedRoutingEnabled()) {
      return null;
    }

    const priceId = await this.resolvePriceId(resolvedContext.plan, resolvedContext.product);
    if (!priceId) {
      this.logger.warn(
        `Hybrid checkout skipped for user ${resolvedContext.userId}: no price for ${resolvedContext.plan}`
      );
      return null;
    }

    const metadata: Record<string, string> = {
      userId: resolvedContext.userId,
      plan: resolvedContext.plan,
    };
    if (resolvedContext.product) metadata.product = resolvedContext.product;
    if (resolvedContext.orgId) metadata.orgId = resolvedContext.orgId;
    if (resolvedContext.source) metadata.source = resolvedContext.source;
    if (resolvedContext.operatorId) metadata.operatorId = resolvedContext.operatorId;

    const result = await this.paymentRouter.createCheckout({
      userId: resolvedContext.userId,
      priceId,
      countryCode: resolvedContext.countryCode.toUpperCase(),
      successUrl: resolvedContext.successUrl,
      cancelUrl: resolvedContext.cancelUrl,
      metadata,
    });

    this.logger.log(
      `Hybrid checkout routed user ${resolvedContext.userId} to ${result.provider} (${reason})`
    );

    return {
      checkoutUrl: result.checkoutUrl,
      provider: result.provider,
      sessionId: result.sessionId,
      currency: result.currency,
    };
  }

  private legacyEnvPriceId(plan: string): string | undefined {
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
        return undefined;
    }
  }
}
