#!/usr/bin/env npx tsx
/**
 * Compare repo `catalog.yaml` with the public Dhanam catalog endpoint.
 *
 * This is an operational truth gate: API/runtime health is not enough if the
 * catalog served to Tulana/Selva/customers is stale or missing tiers.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

type PriceBlock = Record<string, { monthly?: number | null; yearly?: number | null }>;

interface YamlTier {
  dhanam_tier?: string;
  display_name?: string;
  prices?: PriceBlock;
}

interface YamlProduct {
  name: string;
  tiers?: Record<string, YamlTier>;
}

interface CatalogYaml {
  products: Record<string, YamlProduct>;
}

interface LiveTier {
  tierSlug: string;
  dhanamTier?: string;
  displayName?: string | null;
  prices?: PriceBlock;
}

interface LiveProduct {
  slug: string;
  tiers?: LiveTier[];
}

interface LiveCatalog {
  products: LiveProduct[];
  updatedAt?: string;
}

const args = new Set(process.argv.slice(2));
const jsonOutput = args.has('--json');
const liveFileArg = process.argv.find((arg) => arg.startsWith('--live-file='));
const catalogPath = path.resolve(__dirname, '..', 'catalog.yaml');
const catalogUrl = process.env.DHANAM_CATALOG_URL ?? 'https://api.dhan.am/v1/billing/catalog';

function loadYamlCatalog(): CatalogYaml {
  const raw = fs.readFileSync(catalogPath, 'utf-8');
  const parsed = yaml.load(raw) as CatalogYaml;
  if (!parsed?.products) {
    throw new Error(`catalog.yaml has no products map: ${catalogPath}`);
  }
  return parsed;
}

async function loadLiveCatalog(): Promise<LiveCatalog> {
  if (liveFileArg) {
    const filePath = liveFileArg.replace('--live-file=', '');
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as LiveCatalog;
  }

  const response = await fetch(catalogUrl);
  if (!response.ok) {
    throw new Error(`catalog endpoint returned HTTP ${response.status}: ${catalogUrl}`);
  }
  return (await response.json()) as LiveCatalog;
}

function expectedPricePoints(tier: YamlTier): string[] {
  const prices = tier.prices ?? {};
  const points: string[] = [];
  for (const [currency, intervals] of Object.entries(prices)) {
    for (const interval of ['monthly', 'yearly'] as const) {
      const amount = intervals[interval];
      if (amount !== null && amount !== undefined) {
        points.push(`${currency}.${interval}:${amount}`);
      }
    }
  }
  return points.sort();
}

function livePricePoints(tier: LiveTier | undefined): string[] {
  const prices = tier?.prices ?? {};
  const points: string[] = [];
  for (const [currency, intervals] of Object.entries(prices)) {
    for (const interval of ['monthly', 'yearly'] as const) {
      const amount = intervals[interval];
      if (amount !== null && amount !== undefined) {
        points.push(`${currency}.${interval}:${amount}`);
      }
    }
  }
  return points.sort();
}

async function main(): Promise<void> {
  const source = loadYamlCatalog();
  const live = await loadLiveCatalog();
  const diffs: string[] = [];
  const liveBySlug = new Map(live.products.map((product) => [product.slug, product]));

  const sourceProducts = Object.keys(source.products).sort();
  const liveProducts = live.products.map((product) => product.slug).sort();

  for (const slug of sourceProducts) {
    if (!liveBySlug.has(slug)) diffs.push(`missing live product: ${slug}`);
  }
  for (const slug of liveProducts) {
    if (!source.products[slug]) diffs.push(`unexpected live product: ${slug}`);
  }

  for (const [productSlug, product] of Object.entries(source.products)) {
    const liveProduct = liveBySlug.get(productSlug);
    if (!liveProduct) continue;

    const expectedTiers = product.tiers ?? {};
    const liveTiers = new Map((liveProduct.tiers ?? []).map((tier) => [tier.tierSlug, tier]));

    for (const [tierSlug, tier] of Object.entries(expectedTiers)) {
      const liveTier = liveTiers.get(tierSlug);
      if (!liveTier) {
        diffs.push(`missing live tier: ${productSlug}/${tierSlug}`);
        continue;
      }

      const expectedPrices = expectedPricePoints(tier);
      const actualPrices = livePricePoints(liveTier);
      if (JSON.stringify(expectedPrices) !== JSON.stringify(actualPrices)) {
        diffs.push(
          `price drift: ${productSlug}/${tierSlug} expected=${expectedPrices.join(',') || '{}'} live=${
            actualPrices.join(',') || '{}'
          }`
        );
      }

      if (tier.dhanam_tier && liveTier.dhanamTier && tier.dhanam_tier !== liveTier.dhanamTier) {
        diffs.push(
          `tier mapping drift: ${productSlug}/${tierSlug} expected=${tier.dhanam_tier} live=${liveTier.dhanamTier}`
        );
      }
    }

    for (const tierSlug of liveTiers.keys()) {
      if (!expectedTiers[tierSlug]) diffs.push(`unexpected live tier: ${productSlug}/${tierSlug}`);
    }
  }

  const summary = {
    ok: diffs.length === 0,
    source: {
      products: sourceProducts.length,
      tiers: Object.values(source.products).reduce(
        (count, product) => count + Object.keys(product.tiers ?? {}).length,
        0
      ),
    },
    live: {
      url: liveFileArg ? liveFileArg.replace('--live-file=', '') : catalogUrl,
      updatedAt: live.updatedAt ?? null,
      products: liveProducts.length,
      tiers: live.products.reduce((count, product) => count + (product.tiers ?? []).length, 0),
    },
    diffs,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(summary, null, 2));
  } else if (summary.ok) {
    console.log(
      `Catalog OK: ${summary.live.products} products, ${summary.live.tiers} tiers match ${catalogPath}`
    );
  } else {
    console.error(
      `Catalog drift: ${summary.diffs.length} mismatch(es) between ${catalogPath} and ${summary.live.url}`
    );
    for (const diff of summary.diffs) console.error(`- ${diff}`);
  }

  if (!summary.ok) process.exit(1);
}

main().catch((error) => {
  console.error(`Catalog drift check failed: ${error instanceof Error ? error.message : error}`);
  process.exit(2);
});
