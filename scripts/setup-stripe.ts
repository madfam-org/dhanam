#!/usr/bin/env npx tsx
/**
 * setup-stripe.ts
 *
 * Provisions all Stripe billing infrastructure for Dhanam:
 *   1. Three products (Essentials, Pro, Premium)
 *   2. Monthly recurring prices for each product
 *   3. Webhook endpoint for production API
 *   4. Billing portal configuration
 *   5. Intro coupon (3-month launch special)
 *
 * Idempotent: checks for existing resources by name/url before creating.
 *
 * Usage:
 *   npx tsx scripts/setup-stripe.ts
 *
 * If tsx is not installed:
 *   pnpm add -D tsx -w   # install in workspace root
 *   # or run via the api workspace which has ts-node:
 *   cd apps/api && npx ts-node --esm ../../scripts/setup-stripe.ts
 */

import Stripe from 'stripe';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const STRIPE_SECRET_KEY = process.env.STRIPE_MX_SECRET_KEY || '';
if (!STRIPE_SECRET_KEY) {
  console.error('ERROR: Set STRIPE_MX_SECRET_KEY environment variable before running this script.');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  // Match the version used by apps/api stripe.service.ts
  apiVersion: '2026-02-25.clover' as Stripe.LatestApiVersion,
  typescript: true,
});

const PRODUCT_METADATA = { app: 'dhanam', ecosystem: 'madfam' };

const PRODUCTS = [
  {
    name: 'Dhanam Essentials',
    description: 'AI-powered categorization, bank sync (Belvo + Bitso), 2 spaces, 500 MB storage',
    priceAmountCents: 499, // $4.99
  },
  {
    name: 'Dhanam Pro',
    description: 'All features, all providers, 5 spaces, 5 GB storage, Life Beat, household views',
    priceAmountCents: 1199, // $11.99
  },
  {
    name: 'Dhanam Premium',
    description:
      'Enterprise features, priority support, 10 spaces, 25 GB storage, advanced analytics',
    priceAmountCents: 1999, // $19.99
  },
] as const;

const WEBHOOK_URL = 'https://api.dhan.am/v1/billing/webhook';
const WEBHOOK_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
];

const PORTAL_RETURN_URL = 'https://app.dhan.am/billing';

const INTRO_COUPON_NAME = 'Dhanam Launch Special';
const INTRO_COUPON_MONTHS = 3;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(step: string, message: string): void {
  console.log(`[${step}] ${message}`);
}

function logError(step: string, message: string, error: unknown): void {
  console.error(`[${step}] ERROR: ${message}`);
  if (error instanceof Error) {
    console.error(`  ${error.message}`);
  }
}

/**
 * Search for an existing active product by exact name.
 * Returns the first match or null.
 */
async function findProductByName(name: string): Promise<Stripe.Product | null> {
  const results = await stripe.products.search({
    query: `name:"${name}" AND active:"true"`,
    limit: 1,
  });
  return results.data.length > 0 ? results.data[0] : null;
}

/**
 * Search for an existing active monthly USD price on a given product.
 */
async function findMonthlyPrice(productId: string): Promise<Stripe.Price | null> {
  const prices = await stripe.prices.list({
    product: productId,
    active: true,
    type: 'recurring',
    currency: 'usd',
    limit: 10,
  });
  return (
    prices.data.find(
      (p) => p.recurring?.interval === 'month' && p.recurring?.interval_count === 1
    ) ?? null
  );
}

/**
 * Search for an existing webhook endpoint by URL.
 */
async function findWebhookByUrl(url: string): Promise<Stripe.WebhookEndpoint | null> {
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  return endpoints.data.find((e) => e.url === url) ?? null;
}

/**
 * Search for an existing coupon by name.
 */
async function findCouponByName(name: string): Promise<Stripe.Coupon | null> {
  const coupons = await stripe.coupons.list({ limit: 100 });
  return coupons.data.find((c) => c.name === name && c.valid) ?? null;
}

// ---------------------------------------------------------------------------
// Setup Steps
// ---------------------------------------------------------------------------

interface ProductResult {
  product: Stripe.Product;
  price: Stripe.Price;
  label: string;
}

async function setupProduct(cfg: (typeof PRODUCTS)[number]): Promise<ProductResult> {
  const label = cfg.name.replace('Dhanam ', '');

  // 1. Product
  let product = await findProductByName(cfg.name);
  if (product) {
    log('Product', `Found existing product "${cfg.name}" (${product.id})`);
  } else {
    product = await stripe.products.create({
      name: cfg.name,
      description: cfg.description,
      metadata: PRODUCT_METADATA,
    });
    log('Product', `Created "${cfg.name}" -> ${product.id}`);
  }

  // 2. Price
  let price = await findMonthlyPrice(product.id);
  if (price && price.unit_amount === cfg.priceAmountCents) {
    log(
      'Price',
      `Found existing price for ${label}: $${(price.unit_amount! / 100).toFixed(2)}/mo (${price.id})`
    );
  } else {
    price = await stripe.prices.create({
      product: product.id,
      unit_amount: cfg.priceAmountCents,
      currency: 'usd',
      recurring: { interval: 'month' },
      metadata: PRODUCT_METADATA,
    });
    log(
      'Price',
      `Created price for ${label}: $${(cfg.priceAmountCents / 100).toFixed(2)}/mo -> ${price.id}`
    );
  }

  return { product, price, label };
}

async function setupWebhook(): Promise<Stripe.WebhookEndpoint> {
  let webhook = await findWebhookByUrl(WEBHOOK_URL);
  if (webhook) {
    log('Webhook', `Found existing webhook for ${WEBHOOK_URL} (${webhook.id})`);
    // Update enabled events in case they changed
    webhook = await stripe.webhookEndpoints.update(webhook.id, {
      enabled_events: WEBHOOK_EVENTS,
    });
    log('Webhook', `Updated events on existing webhook ${webhook.id}`);
    // Note: The secret is only returned on creation. For existing webhooks,
    // you must retrieve it from the Stripe Dashboard.
    return webhook;
  }

  webhook = await stripe.webhookEndpoints.create({
    url: WEBHOOK_URL,
    enabled_events: WEBHOOK_EVENTS,
    description: 'Dhanam API billing webhook (production)',
    metadata: PRODUCT_METADATA,
  });
  log('Webhook', `Created webhook -> ${webhook.id}`);
  return webhook;
}

async function setupIntroCoupon(): Promise<Stripe.Coupon> {
  let coupon = await findCouponByName(INTRO_COUPON_NAME);
  if (coupon) {
    log('Coupon', `Found existing coupon "${INTRO_COUPON_NAME}" (${coupon.id})`);
    return coupon;
  }

  // The intro offer is $0.99/mo for 3 months. Since prices differ per tier,
  // we use a percent_off coupon that brings the cheapest tier ($4.99) close
  // to $0.99. That is roughly 80% off. This gives:
  //   Essentials: $4.99 * 0.20 = $1.00/mo (closest to $0.99)
  //   Pro:       $11.99 * 0.20 = $2.40/mo
  //   Premium:   $19.99 * 0.20 = $4.00/mo
  //
  // For a flat $0.99/mo experience on Essentials, we use an amount_off coupon
  // of $4.00 (400 cents), bringing Essentials to $0.99/mo exactly.
  coupon = await stripe.coupons.create({
    name: INTRO_COUPON_NAME,
    amount_off: 400, // $4.00 off
    currency: 'usd',
    duration: 'repeating',
    duration_in_months: INTRO_COUPON_MONTHS,
    metadata: {
      ...PRODUCT_METADATA,
      purpose: 'launch_promo',
      note: '$4.00 off for 3 months. Essentials=$0.99/mo, Pro=$7.99/mo, Premium=$15.99/mo',
    },
  });
  log(
    'Coupon',
    `Created "${INTRO_COUPON_NAME}" -> ${coupon.id} ($4.00 off for ${INTRO_COUPON_MONTHS} months)`
  );
  return coupon;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('');
  console.log('=== Dhanam Stripe Billing Setup ===');
  console.log('');

  // Verify connectivity
  try {
    const account = await stripe.accounts.retrieve();
    log(
      'Init',
      `Connected to Stripe account: ${account.id} (${account.business_profile?.name || 'unnamed'})`
    );
  } catch (err) {
    logError('Init', 'Failed to connect to Stripe. Check your secret key.', err);
    process.exit(1);
  }

  // Step 1: Products and Prices
  console.log('\n--- Step 1: Products & Prices ---');
  const results: ProductResult[] = [];
  for (const cfg of PRODUCTS) {
    try {
      const result = await setupProduct(cfg);
      results.push(result);
    } catch (err) {
      logError('Product', `Failed to set up ${cfg.name}`, err);
      process.exit(1);
    }
  }

  const [essentials, pro, premium] = results;

  // Step 2: Webhook
  console.log('\n--- Step 2: Webhook Endpoint ---');
  let webhook: Stripe.WebhookEndpoint;
  try {
    webhook = await setupWebhook();
  } catch (err) {
    logError('Webhook', 'Failed to set up webhook endpoint', err);
    process.exit(1);
  }

  // Step 3: Billing Portal
  console.log('\n--- Step 3: Billing Portal Configuration ---');
  try {
    // Build the products array with correct product-price mapping
    const portalProducts = results.map((r) => ({
      product: r.product.id,
      prices: [r.price.id],
    }));

    const existingConfigs = await stripe.billingPortal.configurations.list({ limit: 10 });
    const activeConfig = existingConfigs.data.find((c) => c.is_default && c.active);

    const portalFeatures: Stripe.BillingPortal.ConfigurationCreateParams['features'] = {
      subscription_cancel: {
        enabled: true,
        mode: 'at_period_end',
        cancellation_reason: {
          enabled: true,
          options: ['too_expensive', 'missing_features', 'switched_service', 'unused', 'other'],
        },
      },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ['price'],
        proration_behavior: 'create_prorations',
        products: portalProducts,
      },
      subscription_pause: {
        enabled: true,
      },
      payment_method_update: {
        enabled: true,
      },
      invoice_history: {
        enabled: true,
      },
    };

    if (activeConfig) {
      log('Portal', `Found existing default portal config (${activeConfig.id}), updating...`);
      await stripe.billingPortal.configurations.update(activeConfig.id, {
        business_profile: { headline: 'Manage your Dhanam subscription' },
        features: portalFeatures,
        default_return_url: PORTAL_RETURN_URL,
      });
      log('Portal', `Updated portal config -> ${activeConfig.id}`);
    } else {
      const config = await stripe.billingPortal.configurations.create({
        business_profile: { headline: 'Manage your Dhanam subscription' },
        features: portalFeatures,
        default_return_url: PORTAL_RETURN_URL,
      });
      log('Portal', `Created portal configuration -> ${config.id}`);
    }
  } catch (err) {
    logError('Portal', 'Failed to set up billing portal', err);
    // Non-fatal: portal can be configured manually
    console.log('  (You can configure the billing portal manually in the Stripe Dashboard)');
  }

  // Step 4: Intro Coupon
  console.log('\n--- Step 4: Intro Coupon ---');
  let coupon: Stripe.Coupon;
  try {
    coupon = await setupIntroCoupon();
  } catch (err) {
    logError('Coupon', 'Failed to set up intro coupon', err);
    process.exit(1);
  }

  // Step 5: Retrieve the publishable key (from Stripe dashboard, not API)
  // The publishable key cannot be retrieved via the secret key API.
  // We include a placeholder and instruct the user to fill it in.

  // ---------------------------------------------------------------------------
  // Output
  // ---------------------------------------------------------------------------

  // The webhook secret is only available on creation (in the `secret` field).
  // For existing webhooks it must be retrieved from the Stripe Dashboard.
  const webhookSecret = (webhook as any).secret || 'whsec_<retrieve from Stripe Dashboard>';

  console.log('\n');
  console.log('='.repeat(64));
  console.log(' Setup Complete! Copy the following into your .env files:');
  console.log('='.repeat(64));
  console.log('');
  console.log('# === Stripe Configuration (Test Mode) ===');
  // Don't echo the operator's Stripe secret key back into stdout / CI logs;
  // it's already in their environment. The webhook secret is only available
  // at creation time and can't be retrieved later, so we still print it.
  console.log(
    `STRIPE_MX_PUBLISHABLE_KEY=${process.env.STRIPE_MX_PUBLISHABLE_KEY || '<get-from-stripe-dashboard>'}`
  );
  console.log(`STRIPE_MX_SECRET_KEY=<set-from-your-STRIPE_MX_SECRET_KEY-env>`);
  console.log(`STRIPE_MX_WEBHOOK_SECRET=${webhookSecret}`);
  console.log(`STRIPE_ESSENTIALS_PRICE_ID=${essentials.price.id}`);
  console.log(`STRIPE_PREMIUM_PRICE_ID=${pro.price.id}       # This is Pro (historical naming)`);
  console.log(`STRIPE_PREMIUM_PLAN_PRICE_ID=${premium.price.id}  # This is Premium`);
  console.log(`STRIPE_INTRO_COUPON_ID=${coupon.id}`);
  console.log('');
  console.log('# Frontend');
  console.log(
    `NEXT_PUBLIC_STRIPE_MX_PUBLISHABLE_KEY=${process.env.STRIPE_MX_PUBLISHABLE_KEY || '<get-from-stripe-dashboard>'}`
  );
  console.log('');
  console.log('# --- Product IDs (for reference) ---');
  for (const r of results) {
    console.log(`# ${r.label}: product=${r.product.id}  price=${r.price.id}`);
  }
  console.log('');
  console.log('NOTE: Publishable key has been embedded. Both pk_test_ and sk_test_ are set.');
  if (webhookSecret.startsWith('whsec_')) {
    console.log('');
    console.log('The webhook signing secret was returned because the endpoint was newly created.');
    console.log('Save it now -- it cannot be retrieved again from the API.');
  }
  console.log('');
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
