import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { Prisma } from '@db';

import { PrismaService } from '../../../core/prisma/prisma.service';

/**
 * Product Catalog Service
 *
 * Centralized product registry for the MADFAM ecosystem. Provides:
 * - Public catalog query (all products, tiers, prices, features, credit costs)
 * - Single-product lookup by slug
 * - Credit cost lookup for metering pre-flight checks
 * - Admin upsert operations (used by sync-catalog.ts script)
 *
 * Response data is cached in-memory for 5 minutes to avoid repeated DB hits
 * on the public catalog endpoint (fetched by every pricing page in the ecosystem).
 */

interface CachedCatalog {
  data: CatalogProduct[];
  expiresAt: number;
}

export interface CatalogProduct {
  slug: string;
  name: string;
  description: string | null;
  category: string;
  iconUrl: string | null;
  websiteUrl: string | null;
  tiers: CatalogTier[];
  creditCosts: CatalogCreditCost[];
}

export interface CatalogTier {
  tierSlug: string;
  dhanamTier: string;
  displayName: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  prices: Record<string, CatalogPrice>; // keyed by currency
  features: string[];
}

export interface CatalogPrice {
  monthly: number | null;
  yearly: number | null;
}

export interface CatalogCreditCost {
  operation: string;
  credits: number;
  label: string | null;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class ProductCatalogService {
  private readonly logger = new Logger(ProductCatalogService.name);
  private cache: CachedCatalog | null = null;

  constructor(private prisma: PrismaService) {}

  /**
   * Get the full product catalog with all active products.
   * Cached in-memory for 5 minutes.
   */
  async getFullCatalog(): Promise<CatalogProduct[]> {
    if (this.cache && Date.now() < this.cache.expiresAt) {
      return this.cache.data;
    }

    const products = await this.prisma.product.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        prices: { where: { status: 'active' }, orderBy: { amountCents: 'asc' } },
        features: { orderBy: { sortOrder: 'asc' } },
        creditCosts: { orderBy: { operation: 'asc' } },
      },
    });

    const catalog = products.map((p) => this.mapProduct(p));

    this.cache = { data: catalog, expiresAt: Date.now() + CACHE_TTL_MS };
    return catalog;
  }

  /**
   * Get a single product by slug.
   */
  async getProductBySlug(slug: string): Promise<CatalogProduct> {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        prices: { where: { status: 'active' }, orderBy: { amountCents: 'asc' } },
        features: { orderBy: { sortOrder: 'asc' } },
        creditCosts: { orderBy: { operation: 'asc' } },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product not found: ${slug}`);
    }

    return this.mapProduct(product);
  }

  /**
   * Get credit costs for a product (for metering pre-flight checks).
   */
  async getCreditCosts(slug: string): Promise<CatalogCreditCost[]> {
    const costs = await this.prisma.productCreditCost.findMany({
      where: { product: { slug } },
      orderBy: { operation: 'asc' },
    });

    return costs.map((c) => ({
      operation: c.operation,
      credits: c.credits,
      label: c.label,
    }));
  }

  /**
   * Look up the credit cost for a specific operation on a specific product.
   * Returns null if not found (caller should use a default).
   */
  async getCreditCostForOperation(slug: string, operation: string): Promise<number | null> {
    const cost = await this.prisma.productCreditCost.findFirst({
      where: { product: { slug }, operation },
    });
    return cost?.credits ?? null;
  }

  /**
   * Upsert a product (used by sync-catalog.ts).
   */
  async upsertProduct(data: {
    slug: string;
    name: string;
    description?: string;
    category?: string;
    iconUrl?: string;
    websiteUrl?: string;
    stripeProductId?: string;
    metadata?: Record<string, unknown>;
    sortOrder?: number;
  }) {
    const result = await this.prisma.product.upsert({
      where: { slug: data.slug },
      create: {
        slug: data.slug,
        name: data.name,
        description: data.description,
        category: (data.category as any) || 'platform',
        iconUrl: data.iconUrl,
        websiteUrl: data.websiteUrl,
        stripeProductId: data.stripeProductId,
        metadata: data.metadata as Prisma.InputJsonValue,
        sortOrder: data.sortOrder ?? 0,
      },
      update: {
        name: data.name,
        description: data.description,
        ...(data.category && { category: data.category as any }),
        ...(data.iconUrl !== undefined && { iconUrl: data.iconUrl }),
        ...(data.websiteUrl !== undefined && { websiteUrl: data.websiteUrl }),
        ...(data.stripeProductId && { stripeProductId: data.stripeProductId }),
        ...(data.metadata && { metadata: data.metadata as Prisma.InputJsonValue }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      },
    });

    this.invalidateCache();
    return result;
  }

  /**
   * Upsert a price for a product (used by sync-catalog.ts).
   */
  async upsertPrice(
    productId: string,
    data: {
      tierSlug: string;
      dhanamTier: string;
      currency: string;
      interval: string;
      amountCents: number;
      stripePriceId?: string;
      displayName?: string;
      description?: string;
      metadata?: Record<string, unknown>;
    }
  ) {
    const result = await this.prisma.productPrice.upsert({
      where: {
        productId_tierSlug_currency_interval: {
          productId,
          tierSlug: data.tierSlug,
          currency: data.currency,
          interval: data.interval as any,
        },
      },
      create: {
        productId,
        tierSlug: data.tierSlug,
        dhanamTier: data.dhanamTier as any,
        currency: data.currency,
        interval: data.interval as any,
        amountCents: data.amountCents,
        stripePriceId: data.stripePriceId,
        displayName: data.displayName,
        description: data.description,
        metadata: data.metadata as Prisma.InputJsonValue,
      },
      update: {
        amountCents: data.amountCents,
        ...(data.stripePriceId && { stripePriceId: data.stripePriceId }),
        ...(data.displayName !== undefined && { displayName: data.displayName }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.metadata && { metadata: data.metadata as Prisma.InputJsonValue }),
      },
    });

    this.invalidateCache();
    return result;
  }

  /**
   * Upsert a feature for a product tier (used by sync-catalog.ts).
   */
  async upsertFeature(
    productId: string,
    data: { tierSlug: string; feature: string; label: string; sortOrder?: number }
  ) {
    return this.prisma.productFeature.upsert({
      where: {
        productId_tierSlug_feature: {
          productId,
          tierSlug: data.tierSlug,
          feature: data.feature,
        },
      },
      create: {
        productId,
        tierSlug: data.tierSlug,
        feature: data.feature,
        label: data.label,
        sortOrder: data.sortOrder ?? 0,
      },
      update: {
        label: data.label,
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      },
    });
  }

  /**
   * Upsert a credit cost for a product (used by sync-catalog.ts).
   */
  async upsertCreditCost(
    productId: string,
    data: { operation: string; credits: number; label?: string; description?: string }
  ) {
    return this.prisma.productCreditCost.upsert({
      where: {
        productId_operation: { productId, operation: data.operation },
      },
      create: {
        productId,
        operation: data.operation,
        credits: data.credits,
        label: data.label,
        description: data.description,
      },
      update: {
        credits: data.credits,
        ...(data.label !== undefined && { label: data.label }),
        ...(data.description !== undefined && { description: data.description }),
      },
    });
  }

  private invalidateCache(): void {
    this.cache = null;
  }

  private mapProduct(p: any): CatalogProduct {
    // Group prices by tier and currency
    const tierMap = new Map<string, CatalogTier>();

    for (const price of p.prices) {
      let tier = tierMap.get(price.tierSlug);
      if (!tier) {
        tier = {
          tierSlug: price.tierSlug,
          dhanamTier: price.dhanamTier,
          displayName: price.displayName,
          description: price.description,
          metadata: price.metadata as Record<string, unknown> | null,
          prices: {},
          features: [],
        };
        tierMap.set(price.tierSlug, tier);
      }

      if (!tier.prices[price.currency]) {
        tier.prices[price.currency] = { monthly: null, yearly: null };
      }
      tier.prices[price.currency][price.interval as 'monthly' | 'yearly'] = price.amountCents;
    }

    // Add features to their respective tiers
    for (const feature of p.features) {
      const tier = tierMap.get(feature.tierSlug);
      if (tier) {
        tier.features.push(feature.label);
      }
    }

    return {
      slug: p.slug,
      name: p.name,
      description: p.description,
      category: p.category,
      iconUrl: p.iconUrl,
      websiteUrl: p.websiteUrl,
      tiers: Array.from(tierMap.values()),
      creditCosts: p.creditCosts.map((c: any) => ({
        operation: c.operation,
        credits: c.credits,
        label: c.label,
      })),
    };
  }
}
