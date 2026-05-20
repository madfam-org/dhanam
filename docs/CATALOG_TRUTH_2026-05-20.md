# Dhanam Catalog Truth - 2026-05-20

Status: production DB/catalog drift remediated; Stripe price sync still gated

## Evidence

- Repo catalogue source: `catalog.yaml`
- Expected public catalogue shape: 7 products, 24 tiers, 42 active price rows.
- Live endpoint checked: `https://api.dhan.am/v1/billing/catalog`
- Before remediation, the live endpoint was stale: 6 products and 10 tiers,
  missing `routecraft` and multiple free/custom tiers.
- Before remediation, live Dhanam prices also drifted from repo truth for
  Dhanam Pro/Premium and Karafiel yearly prices.
- 2026-05-20 production verification: `pnpm catalog:drift -- --json` returned
  `"ok": true` for `https://api.dhan.am/v1/billing/catalog` with 7 products,
  24 tiers, and no diffs.

## Fix Implemented

- Added `product_tiers` so tiers without Stripe-backed prices survive the DB
  sync and public catalog mapping.
- Updated `sync-catalog.ts` to upsert every YAML tier before prices/features.
- Updated `sync-catalog.ts` to archive/delete stale DB catalogue rows that are
  no longer present in `catalog.yaml`.
- Updated `ProductCatalogService` to return tier rows even when `prices` is
  empty.
- Updated `PricingEngineService` to read Dhanam prices from the catalog service
  and refuse static fallback pricing.
- Added `pnpm catalog:drift -- --json` as the production truth gate.

## Health Rule

Dhanam pricing/catalog health is not green until all of these are true:

1. Production migrations are deployed, including `product_tiers`.
2. `sync-catalog.ts` has run against production DB.
3. `pnpm catalog:drift -- --json` returns `"ok": true`.
4. Tulana consumes the refreshed Dhanam catalog before proposal generation.

Stripe product/price ID sync is tracked separately because unsafe Stripe writes
can create durable billing artifacts. API/catalog truth is green when the DB
and public endpoint match `catalog.yaml`; checkout truth additionally requires
verified Stripe price IDs for the tiers exposed to checkout.

## Runbook

Use [`scripts/sync-catalog-prod.md`](../scripts/sync-catalog-prod.md) for the
production migration, sync, and drift verification sequence.
