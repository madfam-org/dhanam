# Dhanam Roadmap

Last updated: 2026-05-23

This roadmap tracks the current path to a defensible 100 percent stable Dhanam
codebase and production implementation across `dhan.am`, `www.dhan.am`,
`app.dhan.am`, `admin.dhan.am`, and `api.dhan.am`.

**GA program:** For the full phased implementation plan toward technical
stability GA, commercial GA, and consumer product GA, read
[GA Remediation Roadmap](GA_REMEDIATION_ROADMAP.md). That document is the
canonical execution program; this file defines stability priorities P0–P8 and
milestones M1–M5.

**Implementation language:** All code, comments, commits, API contracts, and
technical documentation must be written in English. Product UI strings use the
existing i18n system (Spanish, Portuguese, etc.).

Read this with:

- [GA Remediation Roadmap](GA_REMEDIATION_ROADMAP.md)
- [Commercial Stability Roadmap](COMMERCIAL_STABILITY_ROADMAP.md)
- [Stability Audit 2026-05-19](STABILITY_AUDIT_2026-05-19.md)
- [Stability Wrap-Up 2026-05-20](STABILITY_WRAP_UP_2026-05-20.md)
- [Tech Debt Register](TECH_DEBT.md)
- [Full Remediation Plan](FULL_REMEDIATION_PLAN_G4_AND_OPERATOR_SLICE.md) (G4 + operator slice)
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
- Commercial billing flows have a single truthful provider-routing contract,
  catalog-backed pricing, idempotent money events, DLQ/replay coverage, and
  audited operator controls.
- The internal MADFAM POS supports checkout creation, refunds, status lookup,
  reconciliation, and settlement/CFDI proof before it is described as
  full-fledged.

## Current Position

| Area                      | Current estimate | Status                                                                                                                  |
| ------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Codebase and CI           | 98%              | Hosted CI, lint/typecheck, coverage, and staging deploy are green for latest pushed source.                             |
| Public production surface | 99%              | Public DNS, TLS, redirects, app/admin/API liveness, and full API health are green.                                      |
| API runtime health        | 99%              | DB, Redis, queues, Belvo, and optional external checks are up; failed queue count is zero.                              |
| Release and staging path  | 96%              | Staging deploy now passes API, web, admin, and staging API-origin smoke.                                                |
| Ops control plane         | 88%              | ArgoCD production truth is healthy; Enclii still lacks key routine operation adapters.                                  |
| Commercial/POS stability  | ~75%             | Unified routing + internal POS charge/refund/timeline/reconcile landed; CFDI proof and prod promote evidence remain.    |
| Overall stability         | 95%              | Production and staging are healthy; remaining gap is Enclii coverage, commercial proof/sign-off, and repeated evidence. |

## Current Verification Snapshot

As of 2026-05-21:

- Current production image-manifest base was last changed by
  `7d0acfc7 deploy(prod): promote e37125d`.
- Current staging digest base is
  `e37125d0 deploy(staging): update digests to 720fb6a`.
- Latest production-proof documentation commit before this implementation pass
  is `63362965 docs(stability): record catalog checkout production proof`.
- Hosted `CI` for `720fb6a3`: run `26198344168`, success.
- Hosted `Lint & Type Check` for `720fb6a3`: run `26198344082`, success.
- Hosted `Test Coverage` for `720fb6a3`: run `26198344110`, success.
- Hosted `Deploy to Staging` for `720fb6a3`: run `26198344080`, success,
  including public API, web, and admin smoke. Hosted cluster access was
  unavailable, so live staging digest proof remained best-effort/manual until
  an Enclii adapter exists.
- Manual API `Promote staging -> prod` (`26199879634`) succeeded after the
  30-minute soak gate elapsed and committed `7d0acfc7`.
- `https://staging-api.dhan.am/health` returns HTTP 200 / healthy.
- `https://staging.dhan.am` and `https://staging-admin.dhan.am` are reachable
  and proved by hosted staging smoke.
- `scripts/production-preflight.sh` passes for production DNS, liveness, app,
  admin, apex, and `www -> apex` redirect checks.
- `scripts/production-rollout-proof.js` passes: ArgoCD `dhanam-services` is
  Healthy/Synced on `main`, and live production images match
  `infra/k8s/production/kustomization.yaml`. The live production digests are
  recorded in [Stability Wrap-Up 2026-05-20](STABILITY_WRAP_UP_2026-05-20.md).
- Full production health returns `status: "healthy"` with `failedJobs: 0`.
- The retained failed queue jobs were inspected and removed with a narrow
  break-glass BullMQ failed-only cleanup because Enclii does not yet expose a
  queue remediation adapter.
- The failed `20260520000000_add_product_tiers` production migration was
  repaired and resolved with a narrow break-glass Prisma recovery because
  Enclii does not yet expose a database migration repair adapter. Source now
  makes that migration type-adaptive for future drifted environments.
- Catalog-backed checkout plan slugs now route through `PriceResolver` instead
  of being rejected by the legacy local tier allowlist; unsupported generic
  slugs still fail closed rather than silently reusing premium pricing.
- Admin internal POS now includes unified checkout routing (when
  `FEATURE_UNIFIED_CHECKOUT_ROUTING=true`), one-time charge/refund, provider
  route preview, payment/refund timeline, and reconciliation views at `/pos`.
  Staging commercial smoke runs from `deploy-staging.yml` via
  `scripts/staging-commercial-smoke.sh`. G2 proof/sign-off (golden probes, DLQ
  drill, CFDI timeline, prod promote evidence) is tracked in
  [Commercial GA Execution](COMMERCIAL_GA_EXECUTION.md).

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
- Keep the `deploy-staging.yml` API, web, admin, and API-origin smoke checks
  green.
- Keep staging production-safe: API/web overlays must override production
  webhook fan-out, PhyndCRM, `WEB_URL`, `NEXTAUTH_URL`, and Paddle production
  values.
- Keep `deploy-staging.yml` from rebuilding on its own
  `infra/k8s/overlays/staging/kustomization.yaml` digest commits.
- Preserve hosted proof that `staging-admin.dhan.am` uses staging API/env
  values before accepting staging as a complete promotion proof.

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
- Keep manual raw deployment workflows gated behind an incident/change
  reference plus explicit break-glass acknowledgment.

Acceptance:

- `scripts/production-rollout-proof.js` or its successor proves live production
  equals the intended release.
- Enclii deployment records and public production truth no longer disagree.
- Raw direct rollout remains break-glass only and cannot start without a
  recorded incident/change reference.

### P4: Complete Commercial Billing And POS Stability

Goal: make Dhanam a full-fledged MADFAM internal billing router and POS, not
only a checkout/subscription backend.

Work:

- **Landed:** Unified checkout routing via `CheckoutRoutingPolicyService` and
  `FEATURE_UNIFIED_CHECKOUT_ROUTING`; admin POS charge/refund, route preview,
  timeline, and reconciliation at `/pos`; staging commercial smoke in
  `deploy-staging.yml`.
- Unify remaining callers on the routing policy path so country, provider,
  product, plan, currency, and price source decisions have one contract.
- Keep Janua-routed billing disabled in commercial claims until non-empty
  secrets and end-to-end Janua checkout proof exist.
- **Remaining POS/commercial depth:**
  - Karafiel CFDI/egreso proof on routine charge/refund paths;
  - audited provider override policy beyond route preview;
  - settlement/reconciliation evidence in production promote workflow.
- Bring Conekta direct to parity before treating it as commercially launched:
  webhook signature verification, event-id idempotency, linked `BillingEvent`
  writes, canonical `payment.*` fan-out, and DLQ coverage are source-landed;
  refund initiation/partial refunds, settlement reconciliation, provider
  timeline UI, and live-mode operator proof remain.
- Keep the admin Webhook DLQ as the routine product-webhook recovery path:
  source now includes `/webhook-dlq` for listing unresolved deliveries,
  replaying failures, and marking out-of-band resolutions without direct
  database access.
- Update `packages/billing-sdk` for trusted internal callers once POS contracts
  stabilize.

Acceptance:

- Every money event has a durable local correlation id, idempotency key,
  provider id, status, and replay path.
- Admin operators can create, inspect, refund, and reconcile payments without
  direct provider dashboard access for routine work.
- Product webhook failures can be inspected, replayed, and resolved from the
  admin surface before any break-glass access is considered.
- Product webhooks are versioned, signed, documented, and tested with golden
  Dhanam -> product probes.
- Docs clearly separate live production flows, source-landed flows, and planned
  commercial enhancements.

### P5: Close Enclii Adapter Gaps

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

### P6: Clarify Provider Health Semantics

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

### P7: Preserve And Tighten Release Gates

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

### P8: Close Lower-Severity Codebase Debt

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

Detailed phase breakdown, workstreams, risks, and GA sign-off checklist:
[GA Remediation Roadmap](GA_REMEDIATION_ROADMAP.md).

**Commercial GA execution (G2):** week-by-week runbook and CI smoke configuration:
[Commercial GA Execution](COMMERCIAL_GA_EXECUTION.md).

Summary:

1. Repair or formalize production rollout truth under one authoritative control
   plane (Phase 1, M3).
2. Complete commercial billing/POS stability: router unification, refund and
   reconciliation controls, and product webhook contract proof (Phase 3, M4, G2).
3. Wire Enclii migration repair, queue remediation, policy waiver apply, and
   namespace-aware tunnel-route apply (Phase 2, M5).
4. Encode provider health semantics and consumer product GA (Phases 4–5, G3).
5. Collect repeated clean deploy/rollback evidence with no undocumented manual
   path (Phase 6).

## Stability Milestones

| Milestone | Target state                                                                                   | Expected stability |
| --------- | ---------------------------------------------------------------------------------------------- | ------------------ |
| M1        | Production queue health green; public routes still pass.                                       | Complete           |
| M2        | Staging API, web, admin routes and smoke are all passing with staging env proof.               | Complete           |
| M3        | Production rollout truth is authoritative and post-deploy digest assertions pass.              | 97-98%             |
| M4        | Internal POS can charge, inspect, refund, reconcile, and prove product webhook delivery.       | 98% commercial     |
| M5        | Enclii adapter gaps closed; provider health semantics encoded; lower-severity debt controlled. | 99%+               |
| M6        | Consumer product GA per agreed scope (web and/or mobile).                                      | G3                 |
| M7        | Operational proof: drills, 30-day clean health, GA sign-off checklist complete.                | 100%               |

The final 1 percent is operational proof over repeated clean deploys, clean
health windows, and absence of undocumented manual paths. See
[GA Remediation Roadmap — Phase 6](GA_REMEDIATION_ROADMAP.md#phase-6--operational-proof-final-1).
