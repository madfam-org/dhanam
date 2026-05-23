# Dhanam Stability Wrap-Up - 2026-05-20

This is the current production-stability snapshot for `dhan.am`,
`www.dhan.am`, `app.dhan.am`, `admin.dhan.am`, and `api.dhan.am`.
Read it with [Roadmap](ROADMAP.md), [Tech Debt Register](TECH_DEBT.md),
[Deployment Guide](DEPLOYMENT.md), and
[Verification Snapshot](testing/TEST_RESULTS.md).

## Current Verified State

- Production ArgoCD app `dhanam-services` is `Healthy` / `Synced` on `main`.
  The production image-manifest base was last changed by
  `7d0acfc7 deploy(prod): promote e37125d`.
- Live production images match `infra/k8s/production/kustomization.yaml`:
  - API `sha256:75cbde8ac70b58544e0ab0e2b500996dc670ec22932891e303006be420814ae2`
  - Web `sha256:d8258c3df3ed28b7fbd0c377c6bfac29e1f4a2087f082fbb5a6844ac0e5a6b42`
  - Admin `sha256:349904cde052194c6e544c01618bba581ba4f25758cff7676e59625970cb22bf`
- Production full health is `status: "healthy"`:
  database up, Redis up, queues up, `failedJobs: 0`, Belvo up, Banxico/Plaid/Bitso
  intentionally unconfigured or optional.
- Production catalog drift is clean: 7 products, 24 tiers, live
  `/v1/billing/catalog` updated at `2026-05-21T01:30:15.436Z`.
- Production liveness returns `{"alive":true}`.
- Admin queue remediation routes are live and auth-gated. Unauthenticated
  `GET /v1/admin/queues/sync-transactions/failed?limit=1` returns HTTP 401,
  proving the route exists and is protected.
- Catalog-backed checkout resolution is live in production: the compiled API
  resolves normalized catalog plan IDs through `PriceResolver` before legacy
  env fallback and fails closed when no Stripe price exists.
- Janua identity/email relay is being brought under Enclii ExternalSecrets
  ownership. Janua-routed checkout must still be reported as disabled:
  `JANUA_BILLING_ENABLED=false` is intentional until the Dhanam Janua billing
  client route/auth contract matches Janua production and an end-to-end Janua
  checkout is verified.
- Commercial POS source now includes unified checkout routing, admin charge/refund,
  timeline/reconciliation views, and staging commercial smoke
  (`scripts/staging-commercial-smoke.sh` in `deploy-staging.yml`). G2
  proof/sign-off (CFDI timeline, golden probes, prod promote evidence) remains
  open — see [Commercial GA Execution](COMMERCIAL_GA_EXECUTION.md).

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
- Catalog-backed product checkout plan slugs now resolve through
  `PriceResolver`, so ecosystem products can use catalog-managed plan slugs
  without being rejected by Dhanam's legacy local tier allowlist.
- The staging workflow now records the digest-proof gap explicitly. Hosted
  public smoke remains the routine gate; live Argo digest proof is best-effort
  unless `STAGING_STRICT_DIGEST_PROOF=true`, because hosted runners cannot
  reliably reach the cluster API. Manual cluster proof is required until the
  Enclii proof adapter exists.
- Product-catalog sync now prunes stale rows when catalog entries are removed.
- `scripts/production-rollout-proof.js` verifies live ArgoCD images against the
  production manifest.
- The `product_tiers` migration now derives `product_id` type from
  `products.id`, so clean text-backed databases and historically drifted
  UUID-backed production databases both migrate safely.
- Admin commercial operations include the internal POS console at `/pos`:
  subscription checkout, route preview, charge/refund, timeline, and
  reconciliation. Janua billing stays off until checkout proof exists.
- Janua billing is now fail-closed by default: `JANUA_BILLING_ENABLED` must be
  explicitly truthy, and production manifests set it to `"false"` until Janua
  billing secrets and checkout proof are complete.
- Admin API pagination normalization was corrected so paginated `{ data, meta }`
  responses keep their metadata in the admin client.
- `@dhanam/billing-sdk` now normalizes the current billing-history array
  response and includes `stripe_mx` / `paddle` in provider types.

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
namespace-aware staging route apply. Manual raw production deploy workflows now
require an incident/change reference and `break_glass_ack=true` before they
build, write production digests, or mutate Kubernetes.

## Verified Green

- Hosted `CI` for `d1f8ccf0`: run `26194485015`, success.
- Hosted `Lint & Type Check` for `d1f8ccf0`: run `26194485017`, success.
- Hosted `Test Coverage` for `d1f8ccf0`: run `26194484988`, success.
- Hosted `Check Database Migrations` for `d1f8ccf0`: run `26194484989`,
  success.
- Hosted `Deploy to Staging` for `d1f8ccf0`: run `26194485016`, success,
  including build/sign for API, web, admin, staging digest patch, API smoke,
  web route/API-origin smoke, and admin route/API-origin smoke.
- Hosted `CI` for `dd58fb39`: run `26196989052`, success.
- Hosted `Lint & Type Check` for `dd58fb39`: run `26196989035`, success.
- Hosted `Test Coverage` for `dd58fb39`: run `26196989033`, success.
- Hosted `Deploy to Staging` for `dd58fb39`: run `26196989053`, success,
  including build/sign for API, web, admin, staging digest patch `7f7a0248`,
  API smoke, web route/API-origin smoke, and admin route/API-origin smoke.
- Hosted `Deploy to Staging` for `720fb6a3`: run `26198344080`, success,
  including public API/web/admin smoke. The workflow correctly warned that
  hosted cluster access was unavailable and skipped best-effort live digest
  proof; manual Argo/live digest proof moved staging to `e37125d0` and API
  digest `sha256:75cbde8ac70b58544e0ab0e2b500996dc670ec22932891e303006be420814ae2`.
- Manual API `Promote staging -> prod`: run `26195552704`, success after the
  30-minute soak gate elapsed; committed `593953ca`.
- Manual API `Promote staging -> prod`: run `26199879634`, success after the
  30-minute soak gate elapsed; committed `7d0acfc7`.
- Production Argo initially still reported source `e37125d0` and old API digest
  `sha256:d8d36df2c84a41263210a6dc845cb6bc51ab17b230c9c53d879f22ceaf1a1e4e`
  after the promotion workflow completed. A hard Argo refresh was required;
  after refresh the app reported `7d0acfc7`, `Synced Healthy`, and live API
  digest `sha256:75cbde8ac70b58544e0ab0e2b500996dc670ec22932891e303006be420814ae2`.
- Scheduled `Promote staging -> prod` validation: run `26190740392`, success;
  write job skipped because there was no digest change to write.
- Production rollout proof passed: live images match the production manifest on
  `main`.
- Production full health passed with `status: "healthy"`.

## Remaining Roadmap

1. Make Enclii the complete routine operation plane for migration repair,
   queue remediation, and namespace-aware tunnel route apply.
2. Unify billing routing and complete the internal POS commercial workflow:
   one-time charges, refunds, settlement/reconciliation, CFDI proof, and SDK
   contracts. Status lookup is source-landed for Stripe checkout sessions, and
   direct Conekta webhooks now source-land linked ledger writes, canonical
   `payment.*` fan-out, and DLQ capture. Admin product-webhook recovery now
   has a source-level `/webhook-dlq` page for listing, replaying, and resolving
   failed deliveries.
3. Decide and encode final provider launch semantics for Plaid, Bitso, and
   Banxico in runbooks and product readiness.
4. Keep production green over repeated deploy/rollback cycles with no
   undocumented manual path.
5. Expand lower-risk coverage, especially mobile and end-to-end provider
   journeys.

## Stability Estimate

Current expert estimate: about 95 percent production-stable.

Production is healthy and the codebase gates are green for the latest pushed
source, and staging now proves API, web, and admin route health. The system is
not 100 percent stable until Enclii adapter coverage, provider launch
semantics, and repeated clean deploy/rollback evidence are complete.
