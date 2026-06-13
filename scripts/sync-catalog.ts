#!/usr/bin/env npx tsx
/**
 * sync-catalog.ts
 *
 * Syncs the MADFAM product catalog from catalog.yaml to:
 *   1. Dhanam database (Product, ProductPrice, ProductFeature, ProductCreditCost)
 *   2. Stripe (Products + Prices, using metadata for idempotent lookups)
 *
 * Idempotent: safe to run repeatedly. Uses Stripe metadata and DB upserts.
 *
 * Usage:
 *   npx tsx scripts/sync-catalog.ts              # full sync
 *   npx tsx scripts/sync-catalog.ts --dry-run    # preview only
 *
 * Environment:
 *   DATABASE_URL          — Prisma connection string (required)
 *   STRIPE_MX_SECRET_KEY  — Stripe API key for MXN prices (optional)
 *   STRIPE_SECRET_KEY     — Stripe API key for USD prices (optional)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import Stripe from 'stripe';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../apps/api/generated/prisma';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DRY_RUN = process.argv.includes('--dry-run');
const CATALOG_PATH = path.resolve(__dirname, '..', 'catalog.yaml');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: Set DATABASE_URL environment variable.');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Initialize Stripe clients (MXN and/or USD)
const stripeMx = process.env.STRIPE_MX_SECRET_KEY
  ? new Stripe(process.env.STRIPE_MX_SECRET_KEY, { typescript: true })
  : null;

const stripeGlobal = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { typescript: true })
  : null;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CatalogYaml {
  products: Record<string, YamlProduct>;
  coupons?: Record<string, YamlCoupon>;
}

interface YamlProduct {
  name: string;
  description?: string;
  category?: string;
  website?: string;
  sort_order?: number;
  tiers: Record<string, YamlTier>;
  credit_costs?: Record<string, number>;
}

interface YamlTier {
  dhanam_tier: string;
  display_name?: string;
  description?: string;
  prices: Record<string, { monthly?: number; yearly?: number; annual?: number }>;
  metadata?: Record<string, unknown>;
  features?: string[];
}

function normalizeBillingInterval(interval: string): 'monthly' | 'yearly' {
  if (interval === 'annual') {
    return 'yearly';
  }
  if (interval === 'monthly' || interval === 'yearly') {
    return interval;
  }
  throw new Error(`Unsupported billing interval in catalog.yaml: ${interval}`);
}

function priceEntries(priceConfig: {
  monthly?: number;
  yearly?: number;
  annual?: number;
}): Array<['monthly' | 'yearly', number]> {
  const entries: Array<['monthly' | 'yearly', number]> = [];
  if (priceConfig.monthly) {
    entries.push(['monthly', priceConfig.monthly]);
  }
  const yearlyAmount = priceConfig.yearly ?? priceConfig.annual;
  if (yearlyAmount) {
    entries.push(['yearly', yearlyAmount]);
  }
  return entries;
}

interface YamlCoupon {
  name: string;
  percent_off?: number;
  amount_off_cents?: number;
  currency?: string;
  duration: string;
  duration_months?: number;
  products: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(step: string, msg: string): void {
  const prefix = DRY_RUN ? '[DRY RUN]' : '[SYNC]';
  console.log(`${prefix} [${step}] ${msg}`);
}

function getStripeForCurrency(currency: string): Stripe | null {
  if (currency.toUpperCase() === 'MXN') return stripeMx;
  // Non-MXN (USD, etc.): use the dedicated global account when configured,
  // otherwise fall back to the MX account. The Mexico account settles to MXN
  // (BBVA) but can present USD/other currencies — single-account, multi-currency
  // global selling. Drop the fallback once a dedicated global Stripe entity exists.
  return stripeGlobal ?? stripeMx;
}

async function findStripeProduct(stripe: Stripe, slug: string): Promise<Stripe.Product | null> {
  const results = await stripe.products.search({
    query: `metadata["madfam_slug"]:"${slug}" AND active:"true"`,
    limit: 1,
  });
  return results.data[0] ?? null;
}

async function findStripePrice(
  stripe: Stripe,
  productId: string,
  currency: string,
  interval: string,
  tierSlug: string
): Promise<Stripe.Price | null> {
  const prices = await stripe.prices.list({
    product: productId,
    active: true,
    type: 'recurring',
    currency: currency.toLowerCase(),
    limit: 50,
  });
  return (
    prices.data.find(
      (p) =>
        p.recurring?.interval === (interval === 'yearly' ? 'year' : 'month') &&
        p.recurring?.interval_count === 1 &&
        p.metadata?.madfam_tier === tierSlug &&
        p.metadata?.madfam_currency === currency &&
        p.metadata?.madfam_interval === interval
    ) ?? null
  );
}

function catalogPriceKey(tierSlug: string, currency: string, interval: string): string {
  return [tierSlug, currency, interval].join('\u0000');
}

function catalogFeatureKey(tierSlug: string, feature: string): string {
  return [tierSlug, feature].join('\u0000');
}

function slugifyFeature(feature: string): string {
  return feature
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
}

// ---------------------------------------------------------------------------
// Sync Logic
// ---------------------------------------------------------------------------

async function syncProduct(slug: string, config: YamlProduct): Promise<void> {
  log('Product', `--- ${slug}: ${config.name} ---`);
  const desiredTierSlugs = new Set(Object.keys(config.tiers));
  const desiredPriceKeys = new Set<string>();
  const desiredFeatureKeys = new Set<string>();
  const desiredCreditOps = new Set(Object.keys(config.credit_costs ?? {}));

  // 1. Upsert DB Product
  const dbProduct = DRY_RUN
    ? { id: `dry-run-${slug}`, slug }
    : await prisma.product.upsert({
        where: { slug },
        create: {
          slug,
          name: config.name,
          description: config.description,
          category: (config.category as any) || 'platform',
          websiteUrl: config.website,
          sortOrder: config.sort_order ?? 0,
        },
        update: {
          name: config.name,
          description: config.description,
          ...(config.category && { category: config.category as any }),
          ...(config.website !== undefined && { websiteUrl: config.website }),
          ...(config.sort_order !== undefined && { sortOrder: config.sort_order }),
        },
      });

  log('Product', `DB upsert: ${slug} -> ${dbProduct.id}`);

  // 2. Create/find Stripe Products per currency account
  const stripeProductIds: Record<string, string> = {}; // currency -> stripeProductId

  for (const [tierSlug, tier] of Object.entries(config.tiers)) {
    for (const [currency, prices] of Object.entries(tier.prices)) {
      const stripe = getStripeForCurrency(currency);
      if (!stripe || stripeProductIds[currency]) continue;

      if (DRY_RUN) {
        log('Stripe', `Would create/find product "${config.name}" in ${currency} account`);
        continue;
      }

      let stripeProduct = await findStripeProduct(stripe, slug);
      if (stripeProduct) {
        log('Stripe', `Found product "${config.name}" (${stripeProduct.id})`);
      } else {
        stripeProduct = await stripe.products.create({
          name: config.name,
          description: config.description,
          metadata: { madfam_slug: slug, ecosystem: 'madfam' },
        });
        log('Stripe', `Created product "${config.name}" -> ${stripeProduct.id}`);
      }

      stripeProductIds[currency] = stripeProduct.id;

      // Update DB with Stripe product ID (use first one found)
      if (!(dbProduct as any).stripeProductId) {
        await prisma.product.update({
          where: { slug },
          data: { stripeProductId: stripeProduct.id },
        });
      }
    }
  }

  // 3. Sync tiers (prices + features)
  for (const [tierIndex, [tierSlug, tier]] of Object.entries(config.tiers).entries()) {
    if (!DRY_RUN) {
      await prisma.productTier.upsert({
        where: {
          productId_tierSlug: {
            productId: dbProduct.id,
            tierSlug,
          },
        },
        create: {
          productId: dbProduct.id,
          tierSlug,
          dhanamTier: tier.dhanam_tier as any,
          displayName: tier.display_name,
          description: tier.description,
          metadata: tier.metadata,
          sortOrder: tierIndex,
        },
        update: {
          dhanamTier: tier.dhanam_tier as any,
          displayName: tier.display_name,
          description: tier.description,
          metadata: tier.metadata,
          sortOrder: tierIndex,
        },
      });
    }
    log('Tier', `${slug}/${tierSlug}: ${tier.display_name ?? tierSlug}`);

    // Sync prices
    for (const [currency, priceConfig] of Object.entries(tier.prices)) {
      for (const [interval, amount] of priceEntries(priceConfig)) {
        if (!amount || amount === 0) continue;
        const billingInterval = normalizeBillingInterval(interval);
        desiredPriceKeys.add(catalogPriceKey(tierSlug, currency, billingInterval));

        // DB upsert
        if (!DRY_RUN) {
          const dbPrice = await prisma.productPrice.upsert({
            where: {
              productId_tierSlug_currency_interval: {
                productId: dbProduct.id,
                tierSlug,
                currency,
                interval: billingInterval as any,
              },
            },
            create: {
              productId: dbProduct.id,
              tierSlug,
              dhanamTier: tier.dhanam_tier as any,
              currency,
              interval: billingInterval as any,
              amountCents: amount,
              displayName: tier.display_name,
              metadata: tier.metadata,
            },
            update: {
              amountCents: amount,
              dhanamTier: tier.dhanam_tier as any,
              displayName: tier.display_name,
              metadata: tier.metadata,
              status: 'active' as any,
            },
          });

          // Create/find Stripe Price
          const stripe = getStripeForCurrency(currency);
          const stripeProductId = stripeProductIds[currency];
          if (stripe && stripeProductId && !dbPrice.stripePriceId) {
            let stripePrice = await findStripePrice(
              stripe,
              stripeProductId,
              currency,
              billingInterval,
              tierSlug
            );

            if (stripePrice) {
              log(
                'Price',
                `Found ${slug}/${tierSlug} ${currency} ${billingInterval}: ${stripePrice.id}`
              );
            } else {
              stripePrice = await stripe.prices.create({
                product: stripeProductId,
                unit_amount: amount,
                currency: currency.toLowerCase(),
                recurring: { interval: billingInterval === 'yearly' ? 'year' : 'month' },
                metadata: {
                  madfam_slug: slug,
                  madfam_tier: tierSlug,
                  madfam_currency: currency,
                  madfam_interval: billingInterval,
                },
              });
              log(
                'Price',
                `Created ${slug}/${tierSlug} ${currency} ${billingInterval}: ${stripePrice.id}`
              );
            }

            // Store Stripe price ID back in DB
            await prisma.productPrice.update({
              where: { id: dbPrice.id },
              data: { stripePriceId: stripePrice.id },
            });
          }
        } else {
          log(
            'Price',
            `Would sync ${slug}/${tierSlug} ${currency} ${billingInterval}: ${amount} centavos`
          );
        }
      }
    }

    // Sync features
    if (tier.features) {
      for (let i = 0; i < tier.features.length; i++) {
        const feature = tier.features[i];
        const featureSlug = slugifyFeature(feature);
        desiredFeatureKeys.add(catalogFeatureKey(tierSlug, featureSlug));

        if (!DRY_RUN) {
          await prisma.productFeature.upsert({
            where: {
              productId_tierSlug_feature: {
                productId: dbProduct.id,
                tierSlug,
                feature: featureSlug,
              },
            },
            create: {
              productId: dbProduct.id,
              tierSlug,
              feature: featureSlug,
              label: feature,
              sortOrder: i,
            },
            update: { label: feature, sortOrder: i },
          });
        }
      }
      log('Feature', `${slug}/${tierSlug}: ${tier.features.length} features`);
    }
  }

  // 4. Sync credit costs
  if (config.credit_costs) {
    for (const [operation, credits] of Object.entries(config.credit_costs)) {
      if (!DRY_RUN) {
        await prisma.productCreditCost.upsert({
          where: {
            productId_operation: { productId: dbProduct.id, operation },
          },
          create: {
            productId: dbProduct.id,
            operation,
            credits,
            label: operation.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          },
          update: { credits },
        });
      }
      log('Credit', `${slug}/${operation}: ${credits} credits`);
    }
  }

  if (!DRY_RUN) {
    await pruneProductCatalogRows(
      dbProduct.id,
      desiredTierSlugs,
      desiredPriceKeys,
      desiredFeatureKeys,
      desiredCreditOps
    );
  } else {
    log('Prune', `${slug}: would archive/delete rows absent from catalog.yaml`);
  }
}

async function pruneProductCatalogRows(
  productId: string,
  desiredTierSlugs: Set<string>,
  desiredPriceKeys: Set<string>,
  desiredFeatureKeys: Set<string>,
  desiredCreditOps: Set<string>
): Promise<void> {
  const activePrices = await prisma.productPrice.findMany({
    where: { productId, status: 'active' as any },
    select: { id: true, tierSlug: true, currency: true, interval: true },
  });
  const stalePriceIds = activePrices
    .filter(
      (price) =>
        !desiredPriceKeys.has(catalogPriceKey(price.tierSlug, price.currency, price.interval))
    )
    .map((price) => price.id);
  if (stalePriceIds.length > 0) {
    await prisma.productPrice.updateMany({
      where: { id: { in: stalePriceIds } },
      data: { status: 'archived' as any },
    });
    log('Prune', `Archived ${stalePriceIds.length} stale price rows`);
  }

  const features = await prisma.productFeature.findMany({
    where: { productId },
    select: { id: true, tierSlug: true, feature: true },
  });
  const staleFeatureIds = features
    .filter(
      (feature) => !desiredFeatureKeys.has(catalogFeatureKey(feature.tierSlug, feature.feature))
    )
    .map((feature) => feature.id);
  if (staleFeatureIds.length > 0) {
    await prisma.productFeature.deleteMany({ where: { id: { in: staleFeatureIds } } });
    log('Prune', `Deleted ${staleFeatureIds.length} stale feature rows`);
  }

  const tiers = await prisma.productTier.findMany({
    where: { productId },
    select: { id: true, tierSlug: true },
  });
  const staleTierIds = tiers
    .filter((tier) => !desiredTierSlugs.has(tier.tierSlug))
    .map((tier) => tier.id);
  if (staleTierIds.length > 0) {
    await prisma.productTier.deleteMany({ where: { id: { in: staleTierIds } } });
    log('Prune', `Deleted ${staleTierIds.length} stale tier rows`);
  }

  const creditCosts = await prisma.productCreditCost.findMany({
    where: { productId },
    select: { id: true, operation: true },
  });
  const staleCreditCostIds = creditCosts
    .filter((cost) => !desiredCreditOps.has(cost.operation))
    .map((cost) => cost.id);
  if (staleCreditCostIds.length > 0) {
    await prisma.productCreditCost.deleteMany({ where: { id: { in: staleCreditCostIds } } });
    log('Prune', `Deleted ${staleCreditCostIds.length} stale credit-cost rows`);
  }
}

async function syncCoupons(coupons: Record<string, YamlCoupon>): Promise<void> {
  for (const [id, coupon] of Object.entries(coupons)) {
    log('Coupon', `--- ${id}: ${coupon.name} ---`);

    // Try each Stripe account
    for (const stripe of [stripeMx, stripeGlobal].filter(Boolean) as Stripe[]) {
      if (DRY_RUN) {
        log('Coupon', `Would create/find coupon "${coupon.name}"`);
        continue;
      }

      // Search by name
      const existing = await stripe.coupons.list({ limit: 100 });
      const found = existing.data.find((c) => c.name === coupon.name && c.valid);

      if (found) {
        log('Coupon', `Found existing coupon "${coupon.name}" (${found.id})`);
        continue;
      }

      const params: Stripe.CouponCreateParams = {
        name: coupon.name,
        duration: coupon.duration as Stripe.CouponCreateParams.Duration,
        ...(coupon.duration_months && { duration_in_months: coupon.duration_months }),
        ...(coupon.percent_off && { percent_off: coupon.percent_off }),
        ...(coupon.amount_off_cents && {
          amount_off: coupon.amount_off_cents,
          currency: coupon.currency || 'usd',
        }),
        metadata: { madfam_coupon_id: id },
      };

      const created = await stripe.coupons.create(params);
      log('Coupon', `Created coupon "${coupon.name}" -> ${created.id}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(DRY_RUN ? '\n=== DRY RUN MODE ===' : '\n=== CATALOG SYNC ===');
  console.log(`Reading: ${CATALOG_PATH}\n`);

  if (!fs.existsSync(CATALOG_PATH)) {
    console.error(`ERROR: catalog.yaml not found at ${CATALOG_PATH}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(CATALOG_PATH, 'utf-8');
  const catalog = yaml.load(raw) as CatalogYaml;

  if (!catalog.products) {
    console.error('ERROR: catalog.yaml has no products section');
    process.exit(1);
  }

  if (!stripeMx && !stripeGlobal) {
    console.warn(
      'WARNING: No Stripe API keys set. DB sync only (no Stripe products/prices created).'
    );
  }

  // Sync products
  const slugs = Object.keys(catalog.products);
  log('Catalog', `Found ${slugs.length} products: ${slugs.join(', ')}`);

  for (const [slug, config] of Object.entries(catalog.products)) {
    await syncProduct(slug, config);
    console.log();
  }

  // Sync coupons
  if (catalog.coupons) {
    log('Coupons', `Found ${Object.keys(catalog.coupons).length} coupons`);
    await syncCoupons(catalog.coupons);
  }

  console.log('\n=== SYNC COMPLETE ===\n');
}

main()
  .catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
