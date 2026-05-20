# Dhanam Stability Wrap-Up - 2026-05-20

This is the concise end-state from the production-stability push on
2026-05-20. Read it with [Roadmap](ROADMAP.md),
[Stability Audit 2026-05-19](STABILITY_AUDIT_2026-05-19.md),
[Deployment Guide](DEPLOYMENT.md), and [Tech Debt Register](TECH_DEBT.md).

## Recorded Verification Git State

- Verified deployment base before this documentation wrap-up:
  `28d42fcb deploy(staging): update digests to 71f0351`
- Stability implementation: `71f03516 fix(stability): harden production queue remediation`
- Current staging digest base observed during this follow-up:
  `43ff639e deploy(staging): update digests to 12375bc`
- This document is maintained as a status snapshot; `main` may advance through
  documentation-only commits or staging digest bot commits after the snapshot.

## What Is Done

- Added safe failed-job inspection and failed-job-only cleanup for BullMQ queues.
- Updated admin/web queue controls to clear failed jobs only.
- Hardened platform-admin authorization so space `owner` / `admin` membership
  no longer grants global admin API access.
- Removed obsolete generic BullMQ repeatable schedules on startup; the existing
  cron dispatchers now enqueue concrete per-space/per-connection jobs with
  stable IDs to avoid duplicate work across API replicas.
- Hardened staging overlays so staging does not inherit production webhook
  fan-out, PhyndCRM, `WEB_URL`, NextAuth, or Paddle production values.
- Prevented staging digest bot commits from self-triggering another staging
  deploy workflow.
- Seeded the product catalog in API E2E app startup so billing/catalog-backed
  tests do not depend on out-of-band database state.
- Reconciled `ProductCategory` with the canonical catalog by adding the
  `travel` enum value required by Routecraft.
- Reconciled the admin E2E fixture with the hardened platform-admin model:
  admin journey tests now create `User.isAdmin=true` instead of relying on
  space ownership.
- Hardened the Stripe SDK wrapper to fail closed with a service-unavailable
  error when Stripe is intentionally unconfigured, instead of surfacing a raw
  `undefined.customers` TypeError in E2E and runtime paths.
- Clarified provider health semantics for required, optional, and unconfigured
  providers.
- Fixed the API chaos test command.
- Added `scripts/production-rollout-proof.js` to compare live ArgoCD images
  with the production manifest.
- Updated primary stability, deployment, roadmap, tech debt, testing, and
  module docs.

## Verified Green

- Local pre-push hook passed format, typecheck, lint, tests, build, and Prisma
  validation.
- Full local `pnpm test` passed across 13 monorepo tasks.
- Full local `pnpm build` passed across 8 monorepo tasks.
- Local Prisma client generation, API typecheck, and repo formatting passed
  after the `ProductCategory.travel` schema migration.
- API admin operations E2E passed locally against disposable Postgres/Redis:
  18 tests passed.
- API Stripe/admin auth targeted Jest passed: 4 suites, 51 tests.
- Hosted `CI` run `26146547824` passed.
- Hosted `Lint & Type Check` run `26146547856` passed.
- Hosted `Test Coverage` run `26146547825` passed.
- `scripts/production-preflight.sh` passed for production DNS, liveness, app,
  admin, apex, and `www -> apex`.
- `scripts/production-rollout-proof.js` passed with ArgoCD
  `dhanam-services` Healthy/Synced at revision `28d42fcb`.

## Still Blocked

- `Deploy to Staging` run `26146547918` built and signed API, web, and admin
  images and committed staging digests, but failed smoke because
  `https://staging-api.dhan.am/health` returned HTTP 404 on all six attempts.
- Enclii tunnel inspection operation `op_1779260970221167708` showed no routes
  for `staging-api.dhan.am` or `staging.dhan.am`, and showed
  `staging-admin.dhan.am` routed to production.
- Full production health is HTTP 200 but `status: "degraded"` because 100
  retained failed jobs remain: 50 in `sync-transactions` and 50 in
  `categorize-transactions`.
- The new queue-safe production remediation path and the recurring-job source
  fix are in current source, but production still needs a new build/promotion
  and a failed-job cleanup. The live API currently returns 401 for
  `GET /v1/admin/queues` and `POST /v1/admin/queues/:name/retry-failed`, but
  404 for the safer `failed` and `clear-failed` endpoints, proving those
  endpoints are not live yet.

## Next Order Of Work

1. Create namespace-aware Cloudflare tunnel routes through Enclii for
   `staging-api.dhan.am`, `staging.dhan.am`, and `staging-admin.dhan.am`.
2. Register/sync `infra/argocd/dhanam-staging-application.yaml` and populate
   staging Vault/ESO values.
3. Re-run `deploy-staging.yml` until the smoke job passes.
4. Build and promote the current source through staging with the successful
   smoke run id, or record an explicit break-glass bypass if the queue incident
   requires earlier production remediation.
5. Inspect, retry, and only then clear retained production queue failures
   through the audited admin queue path.

## Stability Estimate

Overall full-system stability remains about 88 percent. The remaining gap is
operational: staging routing, production queue cleanup, production rollout truth
alignment, and Enclii adapter coverage.
