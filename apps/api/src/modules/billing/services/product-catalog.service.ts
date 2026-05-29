import * as fs from 'node:fs';
import * as path from 'node:path';

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as yaml from 'js-yaml';

import { Currency, Prisma, SubscriptionTier } from '@db';

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

interface CatalogYaml {
  products?: Record<string, YamlProduct>;
}

interface YamlProduct {
  name: string;
  description?: string;
  category?: string;
  icon_url?: string;
  iconUrl?: string;
  website?: string;
  websiteUrl?: string;
  sort_order?: number;
  tiers?: Record<string, YamlTier>;
  credit_costs?: Record<string, number>;
}

interface YamlTier {
  dhanam_tier: string;
  display_name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  prices?: Record<string, { monthly?: number | null; yearly?: number | null }>;
  features?: string[];
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
  private fileCache: CachedCatalog | null = null;

  constructor(private prisma: PrismaService) {}

  /**
   * Get the full product catalog with all active products.
   * Cached in-memory for 5 minutes.
   */
  async getFullCatalog(): Promise<CatalogProduct[]> {
    if (this.shouldUseFileCatalog()) {
      const fileCatalog = this.loadFileCatalogOrNull();
      if (fileCatalog) {
        return fileCatalog;
      }
    }

    if (this.cache && Date.now() < this.cache.expiresAt) {
      return this.cache.data;
    }

    const products = await this.prisma.product.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        tiers: { orderBy: { sortOrder: 'asc' } },
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
    if (this.shouldUseFileCatalog()) {
      const fileCatalog = this.loadFileCatalogOrNull();
      if (fileCatalog) {
        const product = fileCatalog.find((item) => item.slug === slug);
        if (product) {
          return product;
        }
        throw new NotFoundException(`Product not found: ${slug}`);
      }
    }

    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        tiers: { orderBy: { sortOrder: 'asc' } },
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
    if (this.shouldUseFileCatalog()) {
      const fileCatalog = this.loadFileCatalogOrNull();
      if (fileCatalog) {
        const product = fileCatalog.find((item) => item.slug === slug);
        return product?.creditCosts ?? [];
      }
    }

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
    if (this.shouldUseFileCatalog()) {
      const fileCatalog = this.loadFileCatalogOrNull();
      if (fileCatalog) {
        const product = fileCatalog.find((item) => item.slug === slug);
        return product?.creditCosts.find((cost) => cost.operation === operation)?.credits ?? null;
      }
    }

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

  private resolveDhanamTier(tierSlug: string, override?: string): SubscriptionTier {
    if (override?.trim()) {
      return override.trim() as SubscriptionTier;
    }
    const key = tierSlug.toLowerCase();
    const essentialsLike = ['community', 'free', 'free_member', 'essentials'];
    if (essentialsLike.includes(key)) {
      return SubscriptionTier.essentials;
    }
    return SubscriptionTier.pro;
  }

  /**
   * Internal apply after Selva HITL: upsert product + price by ecosystem slugs.
   */
  async lookupPricesByIds(ids: string[]): Promise<
    Array<{
      id: string;
      productSlug: string;
      tierSlug: string;
      amountCents: number;
      currency: Currency;
      interval: string;
    }>
  > {
    const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    if (uniqueIds.length === 0) {
      return [];
    }

    const rows = await this.prisma.productPrice.findMany({
      where: { id: { in: uniqueIds } },
      include: { product: { select: { slug: true } } },
    });

    return rows.map((row) => ({
      id: row.id,
      productSlug: row.product.slug,
      tierSlug: row.tierSlug,
      amountCents: row.amountCents,
      currency: row.currency as Currency,
      interval: row.interval,
    }));
  }

  async applyApprovedCatalogPrice(input: {
    productSlug: string;
    tierSlug: string;
    amountCents: number;
    currency?: Currency;
    interval?: string;
    dhanamTier?: string;
    displayName?: string;
    metadata?: Record<string, unknown>;
    source?: string;
  }): Promise<{
    ok: true;
    product: { id: string; slug: string; name: string };
    price: {
      id: string;
      tierSlug: string;
      amountCents: number;
      currency: Currency;
      interval: string;
    };
    created: boolean;
  }> {
    const currency = input.currency ?? Currency.MXN;
    const interval = input.interval ?? 'month';
    const product = await this.upsertProduct({
      slug: input.productSlug,
      name: input.displayName ?? input.productSlug,
    });
    const dhanamTier = this.resolveDhanamTier(input.tierSlug, input.dhanamTier);
    const priceRow = await this.upsertPrice(product.id, {
      tierSlug: input.tierSlug,
      dhanamTier,
      amountCents: input.amountCents,
      currency: currency as string,
      interval,
      displayName: input.displayName,
      metadata: {
        ...(input.metadata || {}),
        applied_via: input.source || 'tulana_selva_hitl',
        tulana_tier_slug: input.tierSlug,
      },
    });
    return {
      ok: true,
      product: {
        id: product.id,
        slug: product.slug,
        name: product.name,
      },
      price: {
        id: priceRow.id,
        tierSlug: priceRow.tierSlug,
        amountCents: priceRow.amountCents,
        currency: priceRow.currency as Currency,
        interval: priceRow.interval,
      },
      created: true,
    };
  }

  /**
   * Upsert a tier even when it has no Stripe-backed prices.
   */
  async upsertTier(
    productId: string,
    data: {
      tierSlug: string;
      dhanamTier: string;
      displayName?: string;
      description?: string;
      metadata?: Record<string, unknown>;
      sortOrder?: number;
    }
  ) {
    const result = await this.prisma.productTier.upsert({
      where: {
        productId_tierSlug: {
          productId,
          tierSlug: data.tierSlug,
        },
      },
      create: {
        productId,
        tierSlug: data.tierSlug,
        dhanamTier: data.dhanamTier as any,
        displayName: data.displayName,
        description: data.description,
        metadata: data.metadata as Prisma.InputJsonValue,
        sortOrder: data.sortOrder ?? 0,
      },
      update: {
        dhanamTier: data.dhanamTier as any,
        displayName: data.displayName,
        description: data.description,
        metadata: data.metadata as Prisma.InputJsonValue,
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
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
    this.fileCache = null;
  }

  private shouldUseFileCatalog(): boolean {
    const source = process.env.DHANAM_PUBLIC_CATALOG_SOURCE?.trim().toLowerCase();
    if (source === 'db') {
      return false;
    }
    if (source === 'file') {
      return true;
    }
    return process.env.NODE_ENV === 'production';
  }

  private loadFileCatalogOrNull(): CatalogProduct[] | null {
    try {
      return this.loadFileCatalog();
    } catch (error) {
      this.logger.warn(
        `File-backed catalog unavailable; falling back to DB catalog: ${(error as Error).message}`
      );
      return null;
    }
  }

  private loadFileCatalog(): CatalogProduct[] {
    if (this.fileCache && Date.now() < this.fileCache.expiresAt) {
      return this.fileCache.data;
    }

    const catalogPath = this.resolveCatalogPath();
    const raw = fs.readFileSync(catalogPath, 'utf-8');
    const parsed = yaml.load(raw) as CatalogYaml;
    if (!parsed?.products || typeof parsed.products !== 'object') {
      throw new Error(`catalog.yaml has no products section: ${catalogPath}`);
    }

    const products = Object.entries(parsed.products)
      .map(([slug, config], index) => ({
        product: this.mapYamlProduct(slug, config),
        sortOrder: config.sort_order ?? index,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(({ product }) => product);

    this.fileCache = { data: products, expiresAt: Date.now() + CACHE_TTL_MS };
    return products;
  }

  private resolveCatalogPath(): string {
    const configured = process.env.DHANAM_CATALOG_YAML_PATH?.trim();
    const candidates = [
      configured,
      path.resolve(process.cwd(), '../../catalog.yaml'),
      path.resolve(process.cwd(), 'catalog.yaml'),
      path.resolve(__dirname, '../../../../../../catalog.yaml'),
      '/app/catalog.yaml',
    ].filter(Boolean) as string[];

    const found = candidates.find((candidate) => fs.existsSync(candidate));
    if (!found) {
      throw new Error(`catalog.yaml not found. Checked: ${candidates.join(', ')}`);
    }
    return found;
  }

  private mapYamlProduct(slug: string, config: YamlProduct): CatalogProduct {
    return {
      slug,
      name: config.name,
      description: config.description ?? null,
      category: config.category ?? 'platform',
      iconUrl: config.iconUrl ?? config.icon_url ?? null,
      websiteUrl: config.websiteUrl ?? config.website ?? null,
      tiers: Object.entries(config.tiers ?? {}).map(([tierSlug, tier]) => ({
        tierSlug,
        dhanamTier: tier.dhanam_tier as SubscriptionTier,
        displayName: tier.display_name ?? null,
        description: tier.description ?? null,
        metadata: tier.metadata ?? {},
        prices: Object.fromEntries(
          Object.entries(tier.prices ?? {}).map(([currency, price]) => [
            currency,
            {
              monthly: price.monthly ?? null,
              yearly: price.yearly ?? null,
            },
          ])
        ) as CatalogProduct['tiers'][number]['prices'],
        features: tier.features ?? [],
      })),
      creditCosts: Object.entries(config.credit_costs ?? {}).map(([operation, credits]) => ({
        operation,
        credits,
        label: this.humanizeOperation(operation),
      })),
    };
  }

  private humanizeOperation(operation: string): string {
    return operation.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private mapProduct(p: any): CatalogProduct {
    // Group prices by tier and currency
    const tierMap = new Map<string, CatalogTier>();

    for (const productTier of p.tiers ?? []) {
      tierMap.set(productTier.tierSlug, {
        tierSlug: productTier.tierSlug,
        dhanamTier: productTier.dhanamTier,
        displayName: productTier.displayName,
        description: productTier.description,
        metadata: productTier.metadata as Record<string, unknown> | null,
        prices: {},
        features: [],
      });
    }

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
