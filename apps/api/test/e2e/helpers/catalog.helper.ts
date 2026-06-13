import * as fs from 'fs';
import * as path from 'path';

import * as yaml from 'js-yaml';

import { PrismaService } from '../../../src/core/prisma/prisma.service';

interface CatalogYaml {
  products?: Record<string, YamlProduct>;
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

function findCatalogPath(): string {
  const candidates = [
    path.resolve(process.cwd(), '../../catalog.yaml'),
    path.resolve(process.cwd(), 'catalog.yaml'),
    path.resolve(__dirname, '../../../../../catalog.yaml'),
  ];

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(`catalog.yaml not found. Checked: ${candidates.join(', ')}`);
  }

  return found;
}

function featureSlug(feature: string): string {
  return feature
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
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

function priceAmountForInterval(
  prices: { monthly?: number; yearly?: number; annual?: number },
  interval: string
): number | undefined {
  if (interval === 'monthly') {
    return prices.monthly;
  }
  if (interval === 'yearly' || interval === 'annual') {
    return prices.yearly ?? prices.annual;
  }
  return undefined;
}

export async function seedCatalogForE2E(prisma: PrismaService): Promise<void> {
  const raw = fs.readFileSync(findCatalogPath(), 'utf-8');
  const catalog = yaml.load(raw) as CatalogYaml;

  if (!catalog.products) {
    throw new Error('catalog.yaml has no products section');
  }

  for (const [slug, productConfig] of Object.entries(catalog.products)) {
    const product = await prisma.product.upsert({
      where: { slug },
      create: {
        slug,
        name: productConfig.name,
        description: productConfig.description,
        category: (productConfig.category as any) || 'platform',
        websiteUrl: productConfig.website,
        sortOrder: productConfig.sort_order ?? 0,
      },
      update: {
        name: productConfig.name,
        description: productConfig.description,
        ...(productConfig.category && { category: productConfig.category as any }),
        ...(productConfig.website !== undefined && { websiteUrl: productConfig.website }),
        ...(productConfig.sort_order !== undefined && { sortOrder: productConfig.sort_order }),
      },
    });

    for (const [tierIndex, [tierSlug, tierConfig]] of Object.entries(
      productConfig.tiers
    ).entries()) {
      await prisma.productTier.upsert({
        where: {
          productId_tierSlug: {
            productId: product.id,
            tierSlug,
          },
        },
        create: {
          productId: product.id,
          tierSlug,
          dhanamTier: tierConfig.dhanam_tier as any,
          displayName: tierConfig.display_name,
          description: tierConfig.description,
          metadata: tierConfig.metadata as any,
          sortOrder: tierIndex,
        },
        update: {
          dhanamTier: tierConfig.dhanam_tier as any,
          displayName: tierConfig.display_name,
          description: tierConfig.description,
          metadata: tierConfig.metadata as any,
          sortOrder: tierIndex,
        },
      });

      for (const [currency, prices] of Object.entries(tierConfig.prices ?? {})) {
        for (const intervalKey of ['monthly', 'yearly'] as const) {
          const amount = priceAmountForInterval(prices, intervalKey);
          if (!amount || amount === 0) {
            continue;
          }

          const interval = normalizeBillingInterval(intervalKey);

          await prisma.productPrice.upsert({
            where: {
              productId_tierSlug_currency_interval: {
                productId: product.id,
                tierSlug,
                currency,
                interval,
              },
            },
            create: {
              productId: product.id,
              tierSlug,
              dhanamTier: tierConfig.dhanam_tier as any,
              currency,
              interval,
              amountCents: amount,
              displayName: tierConfig.display_name,
              metadata: tierConfig.metadata as any,
            },
            update: {
              amountCents: amount,
              dhanamTier: tierConfig.dhanam_tier as any,
              displayName: tierConfig.display_name,
              metadata: tierConfig.metadata as any,
            },
          });
        }
      }

      const features = tierConfig.features ?? [];
      for (let sortOrder = 0; sortOrder < features.length; sortOrder++) {
        const feature = features[sortOrder];
        await prisma.productFeature.upsert({
          where: {
            productId_tierSlug_feature: {
              productId: product.id,
              tierSlug,
              feature: featureSlug(feature),
            },
          },
          create: {
            productId: product.id,
            tierSlug,
            feature: featureSlug(feature),
            label: feature,
            sortOrder,
          },
          update: {
            label: feature,
            sortOrder,
          },
        });
      }
    }

    for (const [operation, credits] of Object.entries(productConfig.credit_costs ?? {})) {
      await prisma.productCreditCost.upsert({
        where: {
          productId_operation: {
            productId: product.id,
            operation,
          },
        },
        create: {
          productId: product.id,
          operation,
          credits,
          label: operation.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        },
        update: { credits },
      });
    }
  }
}
