# Production Catalog Sync — Runbook

Run this when a Dhanam-repo change to `catalog.yaml` needs to
materialise into Stripe + the production Dhanam DB. Idempotent; safe
to re-run.

## When to run

- A price changed
- A new tier was added
- A new coupon was created (or a `duration` was tightened)
- A new product was added to `products:`
- You want to verify prod Stripe state matches this repo's catalog

## Prerequisites

Three env vars are required:

| Env var                | Source                | Notes                              |
| ---------------------- | --------------------- | ---------------------------------- |
| `DATABASE_URL`         | Dhanam prod Postgres  | `postgresql://...@...:5432/dhanam` |
| `STRIPE_SECRET_KEY`    | Stripe USD account    | `sk_live_...`                      |
| `STRIPE_MX_SECRET_KEY` | Stripe Mexico account | `sk_live_...`                      |

Keys in Vault under `secret/dhanam/prod`. Grab via:

```sh
vault kv get -format=json secret/dhanam/prod | jq -r '.data.data'
```

The production DB must also have the current Prisma migrations applied before
syncing. The catalogue endpoint now depends on `product_tiers` so free/custom
tiers with no Stripe price still appear in `/v1/billing/catalog`.

```sh
cd /Users/aldoruizluna/labspace/dhanam
pnpm --filter @dhanam/api db:migrate:deploy
```

## Dry-run first (always)

```sh
cd /Users/aldoruizluna/labspace/dhanam
DATABASE_URL="postgresql://dummy:dummy@localhost:9999/dummy" \
  ./node_modules/.pnpm/node_modules/.bin/tsx scripts/sync-catalog.ts --dry-run
```

Expected output: one `[DRY RUN]` line per price + feature + credit for
all 7 products, plus one `[Tier]` line for each of the 24 tiers in
`catalog.yaml`. No Stripe API calls. Confirm the numbers match what's
in `catalog.yaml`, including free/custom tiers whose `prices` object is empty.

## Production run

```sh
cd /Users/aldoruizluna/labspace/dhanam
export DATABASE_URL="<prod-dhanam-postgres-url>"
export STRIPE_SECRET_KEY="sk_live_..."
export STRIPE_MX_SECRET_KEY="sk_live_..."

./node_modules/.pnpm/node_modules/.bin/tsx scripts/sync-catalog.ts
```

Expected output: `[SYNC]` lines reporting Stripe product creation,
price creation, DB upserts. Re-runs are idempotent — Stripe products
with matching `metadata.madfam_slug` are updated in place rather
than duplicated.

## Verification after run

1. **Drift gate:**

   ```sh
   pnpm catalog:drift -- --json
   ```

   This must return `"ok": true`. API health is not enough: a healthy Dhanam
   process can still serve stale product/tier/price data.

2. **Stripe dashboard (USD + MXN accounts):** 7 products appear with
   `madfam_slug` metadata. Count prices per product matches the
   tier × currency × interval count in `catalog.yaml`.

3. **Dhanam DB:**

   ```sql
   SELECT slug, stripe_product_id FROM products ORDER BY sort_order;
   SELECT COUNT(*) FROM product_tiers;
   SELECT COUNT(*) FROM product_prices;
   ```

   Should show 7 products, 24 tiers, and 48 price rows.

4. **Public Dhanam catalog:** `https://api.dhan.am/v1/billing/catalog`
   returns all 7 products and 24 tiers, including custom/free tiers with
   empty `prices` objects.

## Rollback

The sync is additive — old Stripe prices/products stay in place even
if you revert the YAML. To genuinely roll back a price change:

1. Revert the `catalog.yaml` commit.
2. Re-run the sync. This creates new Stripe Prices at the old values
   (new `stripe_price_id`s — old prices stay archived).
3. Manually update any live Subscriptions whose Price is on the
   now-undesired value, via the Stripe dashboard or the Dhanam
   admin API.

## Known gotchas

- **First-ever sync to prod:** no existing `stripe_product_id`
  metadata exists, so the script creates all products from scratch.
  Expect ~7 product creates + ~40+ price creates on the first run.
- **Coupon changes:** `sync-catalog.ts` creates new coupons but does
  NOT auto-migrate customers from an old coupon to the new one. For
  the `founding_member_mx` → year-1 reshape (commit 71d6345),
  existing founding-cohort subscriptions must be migrated via Stripe
  admin. No customers exist yet, so this is hypothetical today.
- **Currency mismatch:** prices in MXN land in the MX Stripe account,
  prices in USD in the global one. Both must be provided.
