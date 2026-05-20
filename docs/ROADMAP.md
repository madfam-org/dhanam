# Dhanam Roadmap

Last updated: 2026-05-20

This roadmap tracks the current path to a defensible 100 percent stable Dhanam
codebase and production implementation across `dhan.am`, `www.dhan.am`,
`app.dhan.am`, `admin.dhan.am`, and `api.dhan.am`.

Read this with:

- [Stability Audit 2026-05-19](STABILITY_AUDIT_2026-05-19.md)
- [Stability Wrap-Up 2026-05-20](STABILITY_WRAP_UP_2026-05-20.md)
- [Tech Debt Register](TECH_DEBT.md)
- [Deployment Guide](DEPLOYMENT.md)
- [Testing Overview](testing/TEST_SUMMARY.md)

## Definition Of 100 Percent Stability

Dhanam is considered fully stable only when all of these are true:

- Public production routes pass DNS, TLS, redirect, liveness, and app health
  checks.
- `https://api.dhan.am/v1/monitoring/health` returns `status: "healthy"`.
- API, web, and admin production images are signed, digest-pinned, and match
  the intended release.
- Staging deploy builds, signs, patches digests, reconciles, and passes API,
  web, and admin smoke checks before production promotion.
- Production rollout proof is authoritative through one documented control
  plane.
- Routine production operations are Enclii-first, with raw infrastructure
  access limited to documented break-glass.
- CI, coverage, build, Prisma, and Playwright gates are green for the release.
- Current docs, agent context, and runbooks match the source and live system.

## Current Position

| Area                      | Current estimate | Status                                                                                         |
| ------------------------- | ---------------- | ---------------------------------------------------------------------------------------------- |
| Codebase and CI           | 98%              | Hosted CI, lint/typecheck, coverage, and staging deploy are green for latest pushed source.    |
| Public production surface | 99%              | Public DNS, TLS, redirects, app/admin/API liveness, and full API health are green.             |
| API runtime health        | 99%              | DB, Redis, queues, Belvo, and optional external checks are up; failed queue count is zero.     |
| Release and staging path  | 91%              | API staging smoke is green; source now adds web/admin smoke and env proof, pending hosted run. |
| Ops control plane         | 88%              | ArgoCD production truth is healthy; Enclii still lacks key routine operation adapters.         |
| Overall stability         | 94%              | Production is healthy; remaining gap is staging breadth, Enclii coverage, and repeated proof.  |

## Current Verification Snapshot

As of 2026-05-20:

- Current deployment base is
  `6717d0fb deploy(staging): update digests to 3acdeea`.
- Latest source commit before this roadmap update is
  `3acdeea4 fix(catalog): prune stale sync rows`.
- Hosted `CI` (`26189667372`), `Lint & Type Check` (`26189667024`), and
  `Test Coverage` (`26189667253`) passed for `3acdeea4`.
- `Deploy to Staging` (`26189667025`) built and signed API, web, and admin
  images, committed staging digests, and passed the API smoke.
- `https://staging-api.dhan.am/health` returns HTTP 200 / healthy.
- `https://staging.dhan.am` and `https://staging-admin.dhan.am` are reachable,
  and this follow-up source adds explicit web/admin smoke plus staging admin
  API/env proof to `deploy-staging.yml`; the next hosted run must prove it.
- `scripts/production-preflight.sh` passes for production DNS, liveness, app,
  admin, apex, and `www -> apex` redirect checks.
- `scripts/production-rollout-proof.js` passes: ArgoCD `dhanam-services` is
  Healthy/Synced at revision `6717d0fb`, and live production images match
  `infra/k8s/production/kustomization.yaml`.
- Full production health returns `status: "healthy"` with `failedJobs: 0`.
- The retained failed queue jobs were inspected and removed with a narrow
  break-glass BullMQ failed-only cleanup because Enclii does not yet expose a
  queue remediation adapter.
- The failed `20260520000000_add_product_tiers` production migration was
  repaired and resolved with a narrow break-glass Prisma recovery because
  Enclii does not yet expose a database migration repair adapter. Source now
  makes that migration type-adaptive for future drifted environments.

## Priority Roadmap

### P0: Protect Current Production

Goal: keep the current public production surface stable while remediation
continues.

Work:

- Keep API, web, and admin production pods serving.
- Keep `scripts/production-preflight.sh` as the public route check before and
  after promotion.
- Preserve current rollback digests for API, web, and admin.
- Avoid raw Kubernetes/provider mutation except documented break-glass.

Acceptance:

- `dhan.am`, `www.dhan.am`, `app.dhan.am`, `admin.dhan.am`, and `api.dhan.am`
  remain publicly reachable.
- ArgoCD `dhanam-services` remains Healthy/Synced until the production control
  plane is formally changed.

### P1: Make Production API Full Health Green

Status: complete as of 2026-05-20. Keep this as the runbook for future queue
incidents.

Goal: remove production runtime degradation without discarding active work.

Work:

- Ensure the recurring-job cleanup source remains live so invalid generic
  `{ allSpaces: true }` / `{ syncAll: true }` repeatable jobs are removed and
  no new concrete-ID-free queue failures are generated.
- Inspect failed BullMQ jobs through the audited admin queue endpoints when an
  admin token is available; use direct BullMQ access only as recorded
  break-glass while the Enclii queue adapter is missing.
- Retry safe failures first:
  - `POST /v1/admin/queues/sync-transactions/retry-failed`
  - `POST /v1/admin/queues/categorize-transactions/retry-failed`
- Clear only confirmed stale failures with
  `POST /v1/admin/queues/:name/clear-failed` and `{ "confirm": true }`.
- Reserve whole-queue `clear` for documented break-glass because it removes
  waiting, active, completed, failed, and delayed jobs.
- Verify the health endpoint after each queue action.

Acceptance:

- `https://api.dhan.am/v1/monitoring/health` returns `status: "healthy"`.
- Failed queue count is zero.
- No production jobs are silently discarded without an audit trail.

### P2: Make Staging Real

Goal: turn staging into a reliable promotion gate for API, web, and admin.

Work:

- Ensure the staging namespace exists.
- Populate staging Vault/ExternalSecrets values.
- Register and sync `infra/argocd/dhanam-staging-application.yaml`.
- Keep namespace-aware Cloudflare tunnel routing healthy for:
  - `staging.dhan.am`
  - `staging-api.dhan.am`
  - `staging-admin.dhan.am`
- Keep the staging DNS CNAMEs created through Enclii on 2026-05-20 in place.
- Keep the new `deploy-staging.yml` web/admin route smoke and API-origin checks
  green after this follow-up source lands.
- Keep staging production-safe: API/web overlays must override production
  webhook fan-out, PhyndCRM, `WEB_URL`, `NEXTAUTH_URL`, and Paddle production
  values.
- Keep `deploy-staging.yml` from rebuilding on its own
  `infra/k8s/overlays/staging/kustomization.yaml` digest commits.
- Verify `staging-admin.dhan.am` uses staging API/env values through the new
  hosted smoke before accepting staging as a complete promotion proof.

Acceptance:

- `Deploy to Staging` succeeds on `main`.
- Staging API, web, and admin public smoke checks pass.
- Production promotion requires a successful staging smoke run id unless a
  break-glass reason is explicitly recorded.

### P3: Establish Authoritative Production Rollout Truth

Goal: make one control plane prove what is live in production.

Work:

- Choose one authoritative production rollout model:
  - Preferred: repair Enclii `prod` so it targets the live `dhanam` namespace.
  - Alternative: formally document ArgoCD `dhanam-services` as the production
    controller and make Enclii feed that path.
- Keep `scripts/production-rollout-proof.js` as the current post-deploy
  assertion comparing intended production digests with live ArgoCD images.
- Fail clearly when release readiness does not equal public rollout.

Acceptance:

- `scripts/production-rollout-proof.js` or its successor proves live production
  equals the intended release.
- Enclii deployment records and public production truth no longer disagree.
- Raw direct rollout remains break-glass only.

### P4: Close Enclii Adapter Gaps

Goal: keep production operations Enclii-first in practice, not just policy.

Work:

- Wire `enclii ops policy waiver-plan --apply`.
- Add a namespace-aware Cloudflare tunnel route apply operation for staging
  hosts.
- Add Enclii queue inspection/retry/failed-cleanup operations or an adapter to
  call Dhanam's audited admin queue API.
- Add idempotency and audit records for policy remediation.
- Record operator, reason, target, result, and follow-up adapter gap for any
  break-glass operation.

Acceptance:

- Policy remediation can be planned and applied through Enclii.
- Staging tunnel routes can be reconciled through Enclii without direct
  Cloudflare mutation.
- Failed production queues can be inspected and remediated through Enclii or
  the audited Dhanam admin API.
- No routine runbook requires raw `kubectl`, `helm`, SSH, provider CLI/API, or
  direct container access.

### P5: Clarify Provider Health Semantics

Goal: make provider health explainable and actionable.

Work:

- Decide whether Banxico, Plaid, and Bitso are required, optional, or not yet
  launched in production.
- Encode those semantics in health output and runbooks.
- Keep Belvo health verified after API deploys.
- Use feature-specific staging smoke tests for providers that do not have
  dedicated connectivity checks.

Acceptance:

- Health reports distinguish `up`, `down`, and `unconfigured` states and expose
  `required` / `mode` where provider readiness affects production.
- Optional provider states do not imply instability.
- Required provider failures degrade or fail health intentionally.

### P6: Preserve And Tighten Release Gates

Goal: keep the codebase stable while the operational path is repaired.

Work:

- Keep these required gates:
  - format
  - lint
  - typecheck
  - unit tests
  - coverage
  - build
  - Prisma validation
  - Playwright web/admin
  - staging smoke before promotion
- Keep production image signature and digest checks.
- Keep docs and agent context updated when stability posture changes.

Acceptance:

- Every production candidate has green local and hosted gates.
- Promotion cannot accidentally use unsigned or non-staging digests.
- Documentation reflects the actual release path.

### P7: Close Lower-Severity Codebase Debt

Goal: remove the remaining issues that limit long-term maintainability.

Work:

- Expand mobile test coverage beyond the current foundation set.
- Track and eventually remove the React 18 global pin when Expo/mobile can move
  safely.
- Reduce recurring lint warnings where practical.
- Continue archiving or labeling historical docs that mention old AWS/Fargate,
  ports, hosts, or test counts.

Acceptance:

- Mobile coverage covers auth, API hooks, key cards, and transaction filters.
- React 19 migration is unblocked or explicitly deferred with current evidence.
- Current docs remain indexed from [docs/README.md](README.md).

## Execution Order

1. Run and pass the new full staging web/admin smoke and staging admin API/env
   proof.
2. Repair or formalize production rollout truth under one authoritative control
   plane.
3. Wire Enclii migration repair, queue remediation, policy waiver apply, and
   namespace-aware tunnel-route apply.
4. Encode provider health semantics and tighten lower-severity code/docs debt.
5. Collect repeated clean deploy/rollback evidence with no undocumented manual
   path.

## Stability Milestones

| Milestone | Target state                                                                                   | Expected stability |
| --------- | ---------------------------------------------------------------------------------------------- | ------------------ |
| M1        | Production queue health green; public routes still pass.                                       | Complete           |
| M2        | Staging API, web, admin routes and smoke are all passing with staging env proof.               | 94-96%             |
| M3        | Production rollout truth is authoritative and post-deploy digest assertions pass.              | 97-98%             |
| M4        | Enclii adapter gaps closed; provider health semantics encoded; lower-severity debt controlled. | 99%+               |

The final 1 percent is operational proof over repeated clean deploys, clean
health windows, and absence of undocumented manual paths.
