import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../../core/prisma/prisma.service';

interface ResolvedPrice {
  priceId: string;
  couponId?: string;
}

/**
 * Maps (tier, region, isPromo) -> Stripe Price ID and optional coupon.
 *
 * Resolution order:
 *   1. Product catalog DB (ProductPrice.stripePriceId) — if populated by sync-catalog.ts
 *   2. Environment variables (STRIPE_*_PRICE_ID) — backwards-compatible fallback
 *
 * Strategy: Use a single Price ID per tier and apply regional discounts via
 * coupons. This avoids creating 24+ Price objects in Stripe.
 */
@Injectable()
export class PriceResolverService {
  private readonly logger = new Logger(PriceResolverService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService
  ) {}

  /**
   * Resolve the Stripe price ID and optional coupon for a given tier and region.
   */
  async resolve(tier: string, region: number, isPromo: boolean): Promise<ResolvedPrice> {
    const priceId = await this.getPriceIdForTier(tier);

    if (!priceId) {
      throw new Error(`No Stripe price configured for tier: ${tier}`);
    }

    // Mexico promo override
    if (isPromo && region === 3) {
      const promoCoupon = this.config.get<string>('STRIPE_PROMO_COUPON_MX');
      if (promoCoupon) {
        return { priceId, couponId: promoCoupon };
      }
    }

    // Regional discount coupon
    const regionalCoupon = this.getRegionalCoupon(region);
    if (regionalCoupon) {
      return { priceId, couponId: regionalCoupon };
    }

    return { priceId };
  }

  /**
   * Resolve price ID, checking the product catalog DB first, then env vars.
   */
  private async getPriceIdForTier(tier: string): Promise<string | undefined> {
    // 1. Try DB-backed catalog resolution
    const dbPrice = await this.resolveFromCatalog(tier);
    if (dbPrice) {
      return dbPrice;
    }

    // 2. Fall back to env var switch (backwards compatibility)
    return this.getPriceIdFromEnv(tier);
  }

  /**
   * Look up Stripe price ID from the ProductPrice catalog DB.
   *
   * Parses plan slugs like "karafiel_pro", "essentials", "pro_yearly" etc.
   * Returns null if no catalog entry or no stripePriceId stored.
   */
  private async resolveFromCatalog(tier: string): Promise<string | null> {
    const lower = tier.toLowerCase();

    // Strip billing period suffix for DB lookup
    let coreTier = lower;
    let interval: 'monthly' | 'yearly' = 'monthly';
    if (coreTier.endsWith('_yearly') || coreTier.endsWith('_annual')) {
      coreTier = coreTier.replace(/_yearly$|_annual$/, '');
      interval = 'yearly';
    }
    if (coreTier.endsWith('_monthly')) {
      coreTier = coreTier.replace(/_monthly$/, '');
    }

    // Parse "{product}_{tier}" vs bare "{tier}"
    const parts = coreTier.split('_');
    let productSlug: string | undefined;
    let tierSlug: string;

    if (parts.length >= 2) {
      // e.g., "karafiel_pro" -> product=karafiel, tier=pro
      productSlug = parts[0];
      tierSlug = parts.slice(1).join('_');
    } else {
      // Bare tier like "pro" -> default to dhanam product
      tierSlug = coreTier;
      productSlug = 'dhanam';
    }

    try {
      const price = await this.prisma.productPrice.findFirst({
        where: {
          product: { slug: productSlug },
          tierSlug,
          interval,
          status: 'active',
          stripePriceId: { not: null },
        },
        select: { stripePriceId: true },
      });

      if (price?.stripePriceId) {
        this.logger.debug(`Catalog resolution: ${tier} -> ${price.stripePriceId}`);
        return price.stripePriceId;
      }
    } catch (err) {
      // DB may not have the catalog tables yet (migration pending)
      this.logger.debug(`Catalog resolution skipped for ${tier}: ${(err as Error).message}`);
    }

    return null;
  }

  /**
   * Legacy env-var-based price resolution (backwards compatibility).
   */
  private getPriceIdFromEnv(tier: string): string | undefined {
    const coreTier = tier.toLowerCase().replace(/_(yearly|annual|monthly)$/, '');

    switch (coreTier) {
      case 'essentials':
        return this.config.get<string>('STRIPE_ESSENTIALS_PRICE_ID');
      case 'pro':
        return this.config.get<string>('STRIPE_PREMIUM_PRICE_ID');
      case 'premium':
        return this.config.get<string>('STRIPE_PREMIUM_PLAN_PRICE_ID');
      default:
        // Try product-prefixed plans (e.g., enclii_pro)
        if (coreTier.endsWith('_pro')) {
          return this.config.get<string>('STRIPE_PREMIUM_PRICE_ID');
        }
        if (coreTier.endsWith('_essentials')) {
          return this.config.get<string>('STRIPE_ESSENTIALS_PRICE_ID');
        }
        if (coreTier.endsWith('_premium')) {
          return this.config.get<string>('STRIPE_PREMIUM_PLAN_PRICE_ID');
        }
        return undefined;
    }
  }

  private getRegionalCoupon(region: number): string | undefined {
    switch (region) {
      case 2:
        return this.config.get<string>('STRIPE_REGIONAL_COUPON_T2');
      case 3:
        return this.config.get<string>('STRIPE_REGIONAL_COUPON_LATAM');
      case 4:
        return this.config.get<string>('STRIPE_REGIONAL_COUPON_EMERGING');
      default:
        return undefined; // Tier 1 - no discount
    }
  }
}
