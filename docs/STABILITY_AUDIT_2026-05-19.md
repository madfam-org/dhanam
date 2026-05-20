# Dhanam Stability Audit - 2026-05-19

## Purpose, Mission, And Vision

Dhanam is MADFAM's billing and financial ledger boundary. It serves consumer
budgeting and wealth workflows while also acting as the ecosystem billing
platform for Stripe MX, SPEI, Paddle, referral rewards, usage metering, and
signed payment events to downstream products.

The mission is to provide a reliable LATAM-first money operating layer: secure
personal and business finance, resilient provider ingestion, transparent billing
events, and stable operational tooling for MADFAM products.

The stability vision is a boring production system: every merge is tested,
staging is reachable and smoke-tested, promotion is manual and auditable,
runtime health is explainable, Enclii is the primary production control plane,
and break-glass raw Kubernetes/provider access is exceptional and recorded.

The execution roadmap for closing the remaining gap is maintained in
[Roadmap](ROADMAP.md).

## Current Status

Snapshot originally taken on 2026-05-19 and refreshed on 2026-05-20 after
production/staging domain checks, Enclii route remediation attempts, staging
promotion hardening, API GitOps deployment verification, queue remediation path
hardening, production migration recovery, and failed-job cleanup.

| Area                      | Status             | Evidence                                                                                                                                                      |
| ------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code build and unit gates | Improved           | Local pre-push ran format, typecheck, lint, tests, build, and Prisma validation successfully; latest admin/auth/job targeted Jest passed 5 suites / 71 tests. |
| API Docker build          | Improved           | API Enclii build issue was remediated by aligning Dockerfiles to repo `pnpm@9.15.0` and pruning Docker context noise.                                         |
| Web Playwright            | Improved           | Auth helpers now use the current `/auth/guest` flow and seed the app stores/cookies expected by Next.js.                                                      |
| Web accessibility gates   | Stable locally     | Chromium slice passed 41/41 after fixing settings switches, report download buttons, transaction rows, and dashboard/report action controls.                  |
| Admin Playwright          | Improved           | CI defaults to synthetic admin auth and context-level mocks for admin API reads.                                                                              |
| API production build      | Improved           | Nest now copies email templates into `dist`, and the duplicate Swagger `UpdatePreferencesDto` runtime model warning was removed.                              |
| Staging image pipeline    | Improved           | API, web, and admin images build, sign with cosign, and patch the staging overlay; latest refresh is `7a848a2c` for source `d1f8ccf0`.                        |
| Staging smoke             | Improved           | Deploy run `26194485016` passed API, web, admin, and staging API-origin smoke.                                                                                |
| Production API health     | Healthy            | Full production health returns HTTP 200 with `status: "healthy"` and `failedJobs: 0`.                                                                         |
| Production domain routing | Fixed and verified | `scripts/production-preflight.sh` passes; `www.dhan.am` redirects to `https://dhan.am/` without leaking `:4200`.                                              |
| Enclii production rollout | Inconsistent       | `scripts/production-rollout-proof.js` proves ArgoCD live digests at revision `7a848a2c`, but Enclii `prod` still does not own public rollout truth.           |
| Enclii policy remediation | Adapter gap        | `enclii ops policy waiver-plan` is planned only; apply is blocked because adapter execution is not wired.                                                     |

## Shortcomings Blocking Full Stability

1. Staging API, web, and admin smoke now pass, including staging API-origin
   proof for web/admin routes. The remaining staging risk is repeated evidence
   and Enclii-owned namespace-aware tunnel route apply.
2. Enclii can produce ready releases, but the public production route currently
   follows the ArgoCD `dhanam-services` Application in the `dhanam` namespace,
   while Enclii `prod` reports deployment state for an absent
   `enclii-dhanam-prod` namespace.
3. The Enclii policy waiver contract exists but cannot apply, so operators do
   not have an Enclii-first remediation path for the Kyverno block.
4. Production full health is green after a failed-only BullMQ cleanup removed
   50 retained `sync-transactions` failures and 50 retained
   `categorize-transactions` failures. Banxico is reported as
   optional/unconfigured and Belvo connectivity is up.
5. The staging promotion safety gap is closed in code and verified in CI:
   `deploy-staging.yml` signs staging image digests, `promote-to-prod.yml`
   verifies the deploy-staging keyless signature before writing production
   digests, requires an explicit successful `Deploy to Staging` smoke run id
   unless break-glass is selected, and the staging overlay is refreshed by
   signed `deploy(staging)` bot commits. Current source also ignores the
   staging overlay digest file for the staging workflow, so those bot commits
   do not retrigger the workflow. API, web, admin, and staging API-origin smoke
   now pass in hosted `Deploy to Staging`.
6. Live production rollout proof still comes from the ArgoCD `dhanam-services`
   Application via `scripts/production-rollout-proof.js`, not Enclii `prod`
   deployment records, until the Enclii namespace mapping gap is repaired.
7. Web Docker builds must not depend on external font downloads; the app now
   uses a local system font stack instead of `next/font/google`.
8. Local test startup still warns when optional local SMTP/PostHog/Sentry and
   provider credentials are absent; production should treat required
   observability and email credentials as deploy-time checks.

## Remediation Plan

Priority 0 - protect the current user surface:

- Keep API, web, and admin existing healthy pods serving while rollout blockers
  are investigated.
- Avoid raw Kubernetes/provider mutation except documented break-glass. Use
  Enclii CLI/API first and record missing adapter gaps.

Priority 1 - restore deployability:

- Fix Enclii deployment reconciliation so it does not attempt to mutate the
  protected `kyverno.io/verify-images` annotation.
- Fix Enclii production environment reconciliation so `enclii deploy --env prod`
  targets the live `dhanam` production namespace, or migrate the public route
  cleanly to an existing Enclii-managed namespace before treating Enclii
  deployment records as live production truth.
- Keep staging images signed before production promotion. `deploy-staging.yml`
  now signs images and `promote-to-prod.yml` rejects unsigned or non-staging
  workflow digests before any production commit is written. The promotion gate
  now also requires a successful staging smoke run id unless the operator
  records an explicit break-glass bypass reason.
- Wire the Enclii `ops policy waiver-plan --apply` adapter or provide an
  Enclii-first policy exception workflow with idempotency and audit records.
- Re-run Enclii release/deployment checks for `dhanam-api`, `dhanam-web`, and
  `dhanam-admin` and verify the deployed image SHAs match the intended release.

Priority 2 - make staging real:

- DNS/custom-domain verification is complete for `staging-api.dhan.am`,
  `staging.dhan.am`, and `staging-admin.dhan.am`.
- Enclii project metadata has a `staging` environment mapped to
  `enclii-dhanam-staging`; `dhanam-staging` is registered and Healthy/Synced.
- Staging ExternalSecrets are synced in `enclii-dhanam-staging`.
- Keep namespace-aware Cloudflare tunnel routes from staging hosts to the
  `enclii-dhanam-staging` services healthy. `enclii junctions add` alone is not
  sufficient because it can route to the production `dhanam` namespace.
- Keep `deploy-staging.yml` API, web, admin, and staging API-origin smoke green
  and require a hosted run to pass before promotion.

Priority 3 - preserve production health:

- Use the audited admin queue endpoints to inspect and retry failed jobs:
  `GET /v1/admin/queues`, `GET /v1/admin/queues/:name/failed?limit=25`, and
  `POST /v1/admin/queues/:name/retry-failed`.
- Prefer `POST /v1/admin/queues/:name/clear-failed` for confirmed stale
  retained failures, and only with request body `{ "confirm": true }`.
- Use `POST /v1/admin/queues/:name/clear` only for deliberate whole-queue
  destructive cleanup, and only with request body `{ "confirm": true }`.
- Confirm retained production failures are stale/retryable before clearing;
  retry first when the underlying provider/configuration issue is resolved.
- Banxico health now treats absent Banxico credentials as optional
  `unconfigured`; add a real token only if FX pulls require it in production.
- Confirm Belvo credentials/network health remains up after each API deploy.
- Decide whether Plaid/Bitso are intentionally unconfigured; if so, health
  should keep reporting `unconfigured` with optional `required` / `mode`
  metadata rather than down.

Priority 4 - keep public routing clean:

- Keep `scripts/production-preflight.sh` required around production web
  promotions. As of 2026-05-20, `www.dhan.am` redirects to
  `https://dhan.am/` without `:4200`, and apex/app/admin/API public checks pass.

Priority 5 - harden the stable baseline:

- Keep CI, coverage, and Playwright gates required for merges.
- Preserve the Docker context guardrails and pnpm version alignment.
- Keep shared UI package artifacts rebuilt whenever accessibility primitives
  change; the web app consumes `@dhanam/ui` from `dist`.
- Keep `scripts/production-rollout-proof.js` as the post-deploy assertion that
  compares intended production digests with live ArgoCD images and fails
  clearly if release readiness does not equal rollout success.

## Stability Assessment

The codebase is significantly closer to stable after the CI, Docker, E2E,
documentation, production-build, API GitOps, migration recovery, and admin
queue remediation work. The production implementation is not 100 percent stable
yet because Enclii adapter coverage, provider launch semantics, and repeated
clean deploy/rollback evidence remain.

Working estimate after this audit:

- Codebase and CI stability: about 98 percent after hosted CI, lint/typecheck,
  coverage, migration checks, and staging deploy passed for latest pushed
  source.
- Staging and release pipeline stability: about 96 percent because images build,
  sign, digests patch, and API/web/admin smoke with staging API-origin proof
  passes.
- Production implementation stability: about 96 percent because public routes,
  rollout proof, and full health are green, but Enclii is not yet complete
  production rollout truth.
- Overall full-system stability: about 95 percent. The remaining gap is mostly
  operational control-plane coverage and repeated proof rather than ordinary
  application code.

## 2026-05-20 Wrap-Up Verification

Final evidence from the latest stabilization pass:

- `d1f8ccf0 fix(stability): harden staging smoke and migration drift` was
  pushed to `main`.
- The staging digest bot committed `7a848a2c` for `d1f8ccf0`.
- Local `main` is fast-forwarded to that commit.
- Hosted `CI` for `d1f8ccf0`: run `26194485015`, success.
- Hosted `Lint & Type Check` for `d1f8ccf0`: run `26194485017`, success.
- Hosted `Test Coverage` for `d1f8ccf0`: run `26194484988`, success.
- Hosted `Check Database Migrations` for `d1f8ccf0`: run `26194484989`,
  success.
- Hosted `Deploy to Staging` run `26194485016` built and signed API, web, and
  admin images, patched `infra/k8s/overlays/staging/kustomization.yaml`, passed
  the public API smoke step at `https://staging-api.dhan.am/health`, and
  passed web/admin route checks that prove the staging API origin.
- `scripts/production-preflight.sh` passed for production.
- `scripts/production-rollout-proof.js` passed for production with ArgoCD
  health `Healthy`, sync `Synced`, revision `7a848a2c`, and live images matching
  the production manifest.
- `https://api.dhan.am/v1/monitoring/health` returns HTTP 200 with
  `status: "healthy"` and `failedJobs: 0`.

## 2026-05-20 Staging Operations Note

Cloudflare DNS CNAMEs were created through
`enclii providers cloudflare dns-apply` for the three staging hostnames:

- `staging-api.dhan.am`: `op_1779257813300087561`
- `staging.dhan.am`: `op_1779257813545470869`
- `staging-admin.dhan.am`: `op_1779257813344430551`

`enclii junctions add` was tested for all three hostnames and then immediately
reverted. The resulting tunnel routes pointed to:

- `http://dhanam-api.dhanam.svc.cluster.local:80`
- `http://dhanam-web.dhanam.svc.cluster.local:80`
- `http://dhanam-admin.dhanam.svc.cluster.local:80`

Those are production namespace services, so leaving them active would make
staging traffic hit production. The missing Enclii adapter is a
namespace-aware tunnel route operation that can target
`*.enclii-dhanam-staging.svc.cluster.local`.

After the DNS apply, public checks and the latest staging workflow showed
`staging-api.dhan.am` and `staging.dhan.am` resolving to Cloudflare but
returning 404 due missing tunnel routes. `staging-admin.dhan.am` returned 200
because the current tunnel route points at
`http://dhanam-admin.dhanam.svc.cluster.local:80`; that is not a valid staging
proof.

An earlier Enclii read-only tunnel inspection,
`enclii providers cloudflare tunnels --project dhanam --json`, returned
operation `op_1779260970221167708`. It showed no routes for
`staging-api.dhan.am` or `staging.dhan.am`, and showed
`staging-admin.dhan.am` routed to production:
`http://dhanam-admin.dhanam.svc.cluster.local:80`.

Updated Enclii read-only checks on 2026-05-20 show staging is now registered:
`dhanam-staging` is Healthy/Synced in ArgoCD at revision `7a848a2c`, the
`enclii-dhanam-staging` namespace exists, four ExternalSecrets report
`SecretSynced`, and hosted API/web/admin smoke with staging API-origin proof
passes.

## 2026-05-20 Production Rollout Note

`enclii deploy --env prod` built `dhanam-web` at git `502dbc18` and Enclii
reported a healthy deployment record for image
`ghcr.io/madfam-org/enclii/dhanam-web:502dbc18`, but read-only cluster
inspection showed no `enclii-dhanam-prod` namespace. Public `dhan.am` traffic
continues to be served by the ArgoCD `dhanam-services` Application in the
`dhanam` namespace, pinned by `infra/k8s/production/kustomization.yaml`.

Until Enclii's production reconciler/namespace mapping is repaired, the
auditable production path is GitOps digest promotion into
`infra/k8s/production/kustomization.yaml` and ArgoCD reconciliation. Raw
`kubectl set image` remains break-glass only when Enclii/GitOps promotion is
unavailable, and the missing Enclii adapter gap must be recorded.
Run `scripts/production-rollout-proof.js` after promotions to prove
`dhanam-services` is Healthy/Synced and the live API, web, and admin images
match the intended production digests.

### Web Routing Closure

The first GitOps promotion attempt used the unsigned staging web image digest
`sha256:cdb413adb0ef876d8f3162b0b48b63cc44c3ee0647fca00d260ebd9816a901b8` and
was correctly rejected by Kyverno image-signature verification.

The signed-image break-glass workflow then built and signed web digest
`sha256:126661e221a67a335eddaf885c142464f82c50f2edb7c6730f79f801548bf054` and
committed it to production as `68caffde`. The workflow's direct
`kubectl set image` step failed because the GitHub runner could not reach the
cluster API, but ArgoCD reconciled the signed digest successfully into the live
`dhanam` namespace. The manual K8s workflows now skip raw Kubernetes rollout
by default and require `direct_k8s_deploy=true` for the break-glass direct
step, so the default path remains signed digest commit plus ArgoCD
reconciliation.

Verified after ArgoCD sync:

- `dhanam-services` synced to `68caffde` and reported Healthy.
- `dhanam-web` runs
  `ghcr.io/madfam-org/dhanam/web@sha256:126661e221a67a335eddaf885c142464f82c50f2edb7c6730f79f801548bf054`
  with 2/2 replicas ready.
- `scripts/production-preflight.sh` passed.
- `https://www.dhan.am/` returns `301 Location: https://dhan.am/`.

### Promotion Safety Closure

`deploy-staging.yml` now signs API, web, and admin staging images with GitHub
Actions keyless cosign signatures. `promote-to-prod.yml` verifies that each
candidate digest has a valid signature from
`deploy-staging.yml@refs/heads/main` before it checks soak time or commits a
production digest. This prevents the unsigned-staging-digest failure class from
reaching ArgoCD/Kyverno again. Signed staging builds now refresh the staging
overlay through `deploy(staging)` bot commits; the latest observed during this
audit was `7a848a2c`, generated for source commit `d1f8ccf0`. API, web, admin,
and staging API-origin smoke pass, so the promotion signal covers all three
public staging surfaces.

The promotion workflow now also enforces the smoke policy declared in
`.enclii.yml`: operators must provide a successful `Deploy to Staging` run id
whose `Staging smoke test` job passed for the source commit that wrote the
staging digest, unless they select the explicit break-glass smoke bypass.
The manual break-glass digest workflows no longer depend on the upstream
`install_kustomize.sh` helper; they patch the production kustomization with a
local Python stdlib edit after signing the image.

## 2026-05-20 API Health GitOps Closure

The live production API image was previously pinned to the May 13 digest commit
`b340d64b`, before the health-drift fix in `ec783b9d`, so full public API health
reported HTTP 503 even though database, Redis, and liveness were up.

Before staging recovered, manual `deploy-k8s.yml` was used with
`direct_k8s_deploy=false` to build and sign current API images, commit only
production digests, and let ArgoCD reconcile from Git. Later, the signed
staging/promotion path moved production to API digest
`sha256:73676d24e60f3da055757efb1a1ff36d34fcd3be4c47f1057bb506a131f5d665`.

The admin client change was deployed by `deploy-admin-k8s.yml` run
`26141639932`, which committed `f97ae247` and synced admin digest
`sha256:252948253a410ce1fbf1829513ca73f694ae97097568294746dafe162f6f0d36`.

Verified after ArgoCD sync:

- `scripts/production-preflight.sh` passed.
- `https://api.dhan.am/v1/monitoring/health/live` returned HTTP 200.
- `https://api.dhan.am/v1/monitoring/health` returned HTTP 200 with
  `status: "healthy"` and `failedJobs: 0`.
- Banxico now reports optional `unconfigured`; Belvo reports `up`.

Raw `kubectl set image` remains disabled unless explicitly selected. The
remaining API operations work is to expose queue remediation through Enclii or
always use the audited admin queue endpoints with an admin token. Direct BullMQ
access remains break-glass only.
