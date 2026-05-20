# Dhanam Stability Wrap-Up - 2026-05-20

This is the concise end-state from the production-stability push on
2026-05-20. Read it with [Roadmap](ROADMAP.md),
[Stability Audit 2026-05-19](STABILITY_AUDIT_2026-05-19.md),
[Deployment Guide](DEPLOYMENT.md), and [Tech Debt Register](TECH_DEBT.md).

## Recorded Verification Git State

- Verified deployment base before this documentation wrap-up:
  `28d42fcb deploy(staging): update digests to 71f0351`
- Stability implementation: `71f03516 fix(stability): harden production queue remediation`
- This document is maintained as a status snapshot; `main` may advance through
  documentation-only commits or staging digest bot commits after the snapshot.

## What Is Done

- Added safe failed-job inspection and failed-job-only cleanup for BullMQ queues.
- Updated admin/web queue controls to clear failed jobs only.
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
- The new queue-safe production remediation path is implemented in `71f03516`,
  but it is not live until the current build is promoted after green staging
  smoke, or through a documented break-glass promotion.

## Next Order Of Work

1. Create namespace-aware Cloudflare tunnel routes through Enclii for
   `staging-api.dhan.am`, `staging.dhan.am`, and `staging-admin.dhan.am`.
2. Register/sync `infra/argocd/dhanam-staging-application.yaml` and populate
   staging Vault/ESO values.
3. Re-run `deploy-staging.yml` until the smoke job passes.
4. Promote `71f03516` through `promote-to-prod.yml` with the successful staging
   smoke run id, or record an explicit break-glass bypass if the queue incident
   requires earlier production remediation.
5. Inspect, retry, and only then clear retained production queue failures
   through the audited admin queue path.

## Stability Estimate

Overall full-system stability remains about 87 percent. The remaining gap is
operational: staging routing, production queue cleanup, production rollout truth
alignment, and Enclii adapter coverage.
