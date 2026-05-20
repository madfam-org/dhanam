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

| Area                      | Current estimate | Status                                                                                            |
| ------------------------- | ---------------- | ------------------------------------------------------------------------------------------------- |
| Codebase and CI           | 96%              | Hosted lint/typecheck, coverage, CI, build, and Playwright are green.                             |
| Public production surface | 90%              | Public DNS and health checks pass for apex, `www`, app, admin, and API liveness.                  |
| API runtime health        | 82%              | DB, Redis, Belvo, and optional external checks are up; production queue health remains degraded.  |
| Release and staging path  | 74%              | Images build/sign and staging overlay patches; latest staging smoke fails 404 due tunnel routing. |
| Ops control plane         | 80%              | ArgoCD production app is Healthy/Synced; Enclii `prod` is not yet live rollout truth.             |
| Overall stability         | 87%              | Mostly stable production with unresolved operational debt, not a finished stability mission.      |

## Current Verification Snapshot

As of 2026-05-20:

- Verified deployment base before the 2026-05-20 documentation wrap-up was
  `28d42fcb deploy(staging): update digests to 71f0351`. `main` may advance
  through documentation-only commits or staging digest bot commits after this
  snapshot.
- The implementation commit is `71f03516 fix(stability): harden production queue remediation`.
- Hosted `CI` (`26146547824`), `Lint & Type Check` (`26146547856`), and
  `Test Coverage` (`26146547825`) passed for `71f03516`.
- `Deploy to Staging` (`26146547918`) built and signed API, web, and admin
  images and committed staging digests, but failed the API smoke because
  `https://staging-api.dhan.am/health` returned HTTP 404 on all six attempts.
- `scripts/production-preflight.sh` passes for production DNS, liveness, app,
  admin, apex, and `www -> apex` redirect checks.
- `scripts/production-rollout-proof.js` passes: ArgoCD `dhanam-services` is
  Healthy/Synced at revision `28d42fcb`, and live production images match
  `infra/k8s/production/kustomization.yaml`.
- Full production health still returns `status: "degraded"` because there are
  100 retained failed jobs: 50 in `sync-transactions` and 50 in
  `categorize-transactions`.

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

Goal: remove the remaining production runtime degradation.

Work:

- Promote the `71f03516` API/admin/web build after staging smoke passes, or use
  an explicitly recorded break-glass bypass if an incident requires it.
- Inspect failed BullMQ jobs through the audited admin queue endpoints after the
  current queue-hardening build is live.
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
- Failed queue count is zero or explicitly excluded from health with a
  documented product/ops decision.
- No production jobs are silently discarded without an audit trail.

### P2: Make Staging Real

Goal: turn staging into a reliable promotion gate.

Work:

- Ensure the staging namespace exists.
- Populate staging Vault/ExternalSecrets values.
- Register and sync `infra/argocd/dhanam-staging-application.yaml`.
- Repair namespace-aware Cloudflare tunnel routing for:
  - `staging.dhan.am`
  - `staging-api.dhan.am`
  - `staging-admin.dhan.am`
- Keep the staging DNS CNAMEs created through Enclii on 2026-05-20 in place.
- Re-run `deploy-staging.yml` until build, signature, overlay patch, reconcile,
  smoke, and soak all pass.
- Fix the confirmed 2026-05-20 route state:
  - `staging-api.dhan.am` has no tunnel route and returns 404.
  - `staging.dhan.am` has no tunnel route and returns 404.
  - `staging-admin.dhan.am` points at the production admin service and is not a
    valid staging proof.

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

1. Make staging smoke pass for the signed `71f03516` images.
2. Promote the current queue-hardening build through the manual gate, or record
   an explicit break-glass bypass if production queue remediation is urgent.
3. Drain, retry, or deliberately clear production queue failures through the
   audited admin path.
4. Repair or formalize production rollout truth.
5. Wire Enclii policy waiver apply and namespace-aware tunnel-route apply.
6. Encode provider health semantics and tighten lower-severity code/docs debt.

## Stability Milestones

| Milestone | Target state                                                                                   | Expected stability |
| --------- | ---------------------------------------------------------------------------------------------- | ------------------ |
| M1        | Production queue health green; public routes still pass.                                       | 90-92%             |
| M2        | Staging namespace, secrets, routes, Argo app, and smoke are passing.                           | 94-96%             |
| M3        | Production rollout truth is authoritative and post-deploy digest assertions pass.              | 97-98%             |
| M4        | Enclii adapter gaps closed; provider health semantics encoded; lower-severity debt controlled. | 99%+               |

The final 1 percent is operational proof over repeated clean deploys, clean
health windows, and absence of undocumented manual paths.
