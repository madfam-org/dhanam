# Dhanam Catalog Truth - 2026-05-20

Status: remediation implemented, production sync still required

## Evidence

- Repo catalogue source: `catalog.yaml`
- Expected public catalogue shape: 7 products, 24 tiers, 48 price rows.
- Live endpoint checked: `https://api.dhan.am/v1/billing/catalog`
- Live endpoint was stale: 6 products and 10 tiers, missing `routecraft` and
  multiple free/custom tiers.
- Live Dhanam prices also drifted from repo truth for Dhanam Pro/Premium and
  Karafiel yearly prices.

## Fix Implemented

- Added `product_tiers` so tiers without Stripe-backed prices survive the DB
  sync and public catalog mapping.
- Updated `sync-catalog.ts` to upsert every YAML tier before prices/features.
- Updated `ProductCatalogService` to return tier rows even when `prices` is
  empty.
- Updated `PricingEngineService` to read Dhanam prices from the catalog service
  and refuse static fallback pricing.
- Added `pnpm catalog:drift -- --json` as the production truth gate.

## Health Rule

Dhanam pricing/catalog health is not green until all of these are true:

1. Production migrations are deployed, including `product_tiers`.
2. `sync-catalog.ts` has run against production DB and both Stripe accounts.
3. `pnpm catalog:drift -- --json` returns `"ok": true`.
4. Tulana consumes the refreshed Dhanam catalog before proposal generation.

Until then, runtime health can only be called API health, not pricing truth.

## Runbook

Use [`scripts/sync-catalog-prod.md`](../scripts/sync-catalog-prod.md) for the
production migration, sync, and drift verification sequence.
