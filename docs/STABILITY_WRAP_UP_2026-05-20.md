# Dhanam Stability Wrap-Up - 2026-05-20

This is the current production-stability snapshot for `dhan.am`,
`www.dhan.am`, `app.dhan.am`, `admin.dhan.am`, and `api.dhan.am`.
Read it with [Roadmap](ROADMAP.md), [Tech Debt Register](TECH_DEBT.md),
[Deployment Guide](DEPLOYMENT.md), and
[Verification Snapshot](testing/TEST_RESULTS.md).

## Current Verified State

- Production ArgoCD app `dhanam-services` is `Healthy` / `Synced` on `main`.
  The production image-manifest base was last changed by
  `593953ca deploy(prod): promote ccd6c8f`; later docs-only commits can advance
  the Argo sync revision without changing live images.
- Live production images match `infra/k8s/production/kustomization.yaml`:
  - API `sha256:d8d36df2c84a41263210a6dc845cb6bc51ab17b230c9c53d879f22ceaf1a1e4e`
  - Web `sha256:d8258c3df3ed28b7fbd0c377c6bfac29e1f4a2087f082fbb5a6844ac0e5a6b42`
  - Admin `sha256:349904cde052194c6e544c01618bba581ba4f25758cff7676e59625970cb22bf`
- Production full health is `status: "healthy"`:
  database up, Redis up, queues up, `failedJobs: 0`, Belvo up, Banxico/Plaid/Bitso
  intentionally unconfigured or optional.
- Production liveness returns `{"alive":true}`.
- Admin queue remediation routes are live and auth-gated. Unauthenticated
  `GET /v1/admin/queues/sync-transactions/failed?limit=1` returns HTTP 401,
  proving the route exists and is protected.
- Staging API, web, and admin smoke are green. `Deploy to Staging` run
  `26194485016` built and signed API, web, and admin images for `d1f8ccf0`,
  committed staging digest refresh `7a848a2c`, passed API health, and proved
  the web/admin routes use the staging API origin.

## Implementation Landed

- Platform-admin authorization now requires `User.isAdmin=true` or verified
  Janua platform-admin claims.
- BullMQ recurring work no longer uses obsolete generic repeat schedules;
  schedulers enqueue concrete per-space/per-connection jobs with stable IDs.
- Admin queue operations support failed-job inspection, failed-job retry, and
  failed-only cleanup. Whole-queue clear remains break-glass.
- Staging overlays isolate production-only webhook fan-out, PhyndCRM, `WEB_URL`,
  NextAuth, and Paddle values.
- Staging digest bot commits no longer self-trigger the staging deploy workflow.
- API E2E startup seeds the product catalog, including `ProductCategory.travel`.
- Admin E2E fixtures create true platform admins.
- Stripe integration fails closed when unconfigured.
- Stripe checkout price resolution fails closed for unknown plan slugs instead
  of silently defaulting to premium pricing.
- Product-catalog sync now prunes stale rows when catalog entries are removed.
- `scripts/production-rollout-proof.js` verifies live ArgoCD images against the
  production manifest.
- The `product_tiers` migration now derives `product_id` type from
  `products.id`, so clean text-backed databases and historically drifted
  UUID-backed production databases both migrate safely.

## Production Break-Glass Actions

Routine production operations remain Enclii-first. Two narrow break-glass
actions were required because Enclii does not yet expose database migration
repair or BullMQ failed-job remediation adapters:

- Repaired the failed production Prisma migration
  `20260520000000_add_product_tiers` after PostgreSQL rejected a `TEXT` to
  `UUID` foreign key. The table was created with `product_id UUID`, 10 tiers
  were backfilled from `product_prices`, and Prisma migration state was
  resolved as applied.
- Removed only retained failed jobs from BullMQ:
  50 from `sync-transactions` and 50 from `categorize-transactions`. Waiting,
  active, delayed, and completed jobs were left untouched.

Required Enclii adapter gaps are tracked in [Tech Debt](TECH_DEBT.md):
database migration repair, queue inspection/retry/failed-cleanup, and
namespace-aware staging route apply.

## Verified Green

- Hosted `CI` for `d1f8ccf0`: run `26194485015`, success.
- Hosted `Lint & Type Check` for `d1f8ccf0`: run `26194485017`, success.
- Hosted `Test Coverage` for `d1f8ccf0`: run `26194484988`, success.
- Hosted `Check Database Migrations` for `d1f8ccf0`: run `26194484989`,
  success.
- Hosted `Deploy to Staging` for `d1f8ccf0`: run `26194485016`, success,
  including build/sign for API, web, admin, staging digest patch, API smoke,
  web route/API-origin smoke, and admin route/API-origin smoke.
- Manual API `Promote staging -> prod`: run `26195552704`, success after the
  30-minute soak gate elapsed; committed `593953ca`.
- Scheduled `Promote staging -> prod` validation: run `26190740392`, success;
  write job skipped because there was no digest change to write.
- Production rollout proof passed: live images match the production manifest on
  `main`.
- Production full health passed with `status: "healthy"`.

## Remaining Roadmap

1. Make Enclii the complete routine operation plane for migration repair,
   queue remediation, and namespace-aware tunnel route apply.
2. Decide and encode final provider launch semantics for Plaid, Bitso, and
   Banxico in runbooks and product readiness.
3. Keep production green over repeated deploy/rollback cycles with no
   undocumented manual path.
4. Expand lower-risk coverage, especially mobile and end-to-end provider
   journeys.

## Stability Estimate

Current expert estimate: about 95 percent production-stable.

Production is healthy and the codebase gates are green for the latest pushed
source, and staging now proves API, web, and admin route health. The system is
not 100 percent stable until Enclii adapter coverage, provider launch
semantics, and repeated clean deploy/rollback evidence are complete.
