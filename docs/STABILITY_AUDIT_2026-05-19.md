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
promotion hardening, API GitOps deployment verification, and queue remediation
path hardening.

| Area                      | Status               | Evidence                                                                                                                                                         |
| ------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code build and unit gates | Improved             | Local pre-push ran format, typecheck, lint, tests, build, and Prisma validation successfully; queue/admin remediation targeted Jest passed.                      |
| API Docker build          | Improved             | API Enclii build issue was remediated by aligning Dockerfiles to repo `pnpm@9.15.0` and pruning Docker context noise.                                            |
| Web Playwright            | Improved             | Auth helpers now use the current `/auth/guest` flow and seed the app stores/cookies expected by Next.js.                                                         |
| Web accessibility gates   | Stable locally       | Chromium slice passed 41/41 after fixing settings switches, report download buttons, transaction rows, and dashboard/report action controls.                     |
| Admin Playwright          | Improved             | CI defaults to synthetic admin auth and context-level mocks for admin API reads.                                                                                 |
| API production build      | Improved             | Nest now copies email templates into `dist`, and the duplicate Swagger `UpdatePreferencesDto` runtime model warning was removed.                                 |
| Staging image pipeline    | Improved             | API, web, and admin images build, sign with cosign, and patch the staging overlay; latest refresh is `28d42fcb` for source `71f03516`.                           |
| Staging smoke             | Blocked              | Deploy run `26146547918` failed only at `https://staging-api.dhan.am/health`, which returned HTTP 404 on all six attempts.                                       |
| Production API health     | Improved/degraded    | Signed API digest `sha256:678c05963201...` was committed in `df5d30fc` and ArgoCD synced it. Full health now returns HTTP 200 with queue-only `degraded` status. |
| Production domain routing | Fixed and verified   | `scripts/production-preflight.sh` passes; `www.dhan.am` redirects to `https://dhan.am/` without leaking `:4200`.                                                 |
| Enclii production rollout | Blocked/inconsistent | `scripts/production-rollout-proof.js` proves ArgoCD live digests at revision `28d42fcb`, but Enclii `prod` still does not own public rollout truth.              |
| Enclii policy remediation | Adapter gap          | `enclii ops policy waiver-plan` is planned only; apply is blocked because adapter execution is not wired.                                                        |

## Shortcomings Blocking Full Stability

1. Staging DNS is now present, but staging is not live: `staging-api.dhan.am`
   and `staging.dhan.am` resolve to the tunnel and return Cloudflare 404,
   `staging-admin.dhan.am` currently points at the production admin service,
   and the ArgoCD Application, `enclii-dhanam-staging` namespace, staging
   Vault/ESO values, and namespace-aware tunnel routes are still missing.
2. Enclii can produce ready releases, but the public production route currently
   follows the ArgoCD `dhanam-services` Application in the `dhanam` namespace,
   while Enclii `prod` reports deployment state for an absent
   `enclii-dhanam-prod` namespace.
3. The Enclii policy waiver contract exists but cannot apply, so operators do
   not have an Enclii-first remediation path for the Kyverno block.
4. Production health is no longer HTTP 503 after deploying the current signed
   API digest, but it is not green: 100 retained failed BullMQ jobs remain in
   `sync-transactions` and `categorize-transactions`. Banxico is now reported
   as optional/unconfigured and Belvo connectivity is up. The safer failed-job
   inspection and `clear-failed` endpoints were implemented in `71f03516` and
   built into signed staging images, but they have not been promoted to
   production because staging smoke is still red.
5. The staging promotion safety gap is closed in code and verified in CI:
   `deploy-staging.yml` signs staging image digests, `promote-to-prod.yml`
   verifies the deploy-staging keyless signature before writing production
   digests, requires an explicit successful `Deploy to Staging` smoke run id
   unless break-glass is selected, and the staging overlay is refreshed by
   signed `deploy(staging)` bot commits. The latest refresh is `28d42fcb`,
   which records staging digests for source `71f03516`. Promotion still needs a
   real staging smoke/soak signal.
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
  `enclii-dhanam-staging`, but `enclii ops apps status dhanam-staging` returns
  no Application and Enclii read-only inspection confirms the namespace is not
  live yet.
- Populate staging Vault/ESO paths under `secret/dhanam/staging*`.
- Register and sync `infra/argocd/dhanam-staging-application.yaml` into the
  Enclii-registered `enclii-dhanam-staging` namespace.
- Add namespace-aware Cloudflare tunnel routes from staging hosts to the
  `enclii-dhanam-staging` services. `enclii junctions add` is not sufficient
  today because it routes to the production `dhanam` namespace.
- Re-run `deploy-staging.yml` until image build, digest patch, ArgoCD
  reconcile, and smoke all pass.

Priority 3 - fix production health:

- After the `71f03516` queue-hardening build is promoted, use the audited admin
  queue endpoints to inspect and retry failed jobs:
  `GET /v1/admin/queues`, `GET /v1/admin/queues/:name/failed?limit=25`, and
  `POST /v1/admin/queues/:name/retry-failed`.
- Prefer `POST /v1/admin/queues/:name/clear-failed` for confirmed stale
  retained failures, and only with request body `{ "confirm": true }`.
- Use `POST /v1/admin/queues/:name/clear` only for deliberate whole-queue
  destructive cleanup, and only with request body `{ "confirm": true }`.
- Confirm the 100 retained production failures are stale/retryable before
  clearing; retry first when the underlying provider/configuration issue is
  resolved.
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
documentation, production-build, API GitOps, and admin queue remediation work.
The production implementation is not close to 100 percent stable yet because
staging DNS is restored but tunnel routing is not correct, production queue
health is degraded, and the Enclii rollout path is blocked for API/admin.

Working estimate after this audit:

- Codebase and CI stability: about 96 percent after local typecheck, unit,
  build, hosted CI, coverage, and Playwright gates passed.
- Staging and release pipeline stability: about 74 percent because images build,
  sign, digests patch, and staging DNS now resolves, but
  ArgoCD/namespace/secrets/tunnel routing are not live.
- Production implementation stability: about 82 percent because live web/admin
  surfaces respond, API full health returns HTTP 200, provider health is clean,
  and public routing is clean, but queue health and rollout control-plane state
  are not fully clean.
- Overall full-system stability: about 87 percent. The remaining gap is mostly
  operational control-plane, domain, and runtime-health remediation rather than
  ordinary application code.

## 2026-05-20 Wrap-Up Verification

Final evidence from the latest stabilization pass:

- `71f03516 fix(stability): harden production queue remediation` was pushed to
  `main`.
- The staging digest bot committed `28d42fcb deploy(staging): update digests to
71f0351`; local `main` is fast-forwarded to that commit.
- Hosted `CI` run `26146547824`, `Lint & Type Check` run `26146547856`, and
  `Test Coverage` run `26146547825` passed for `71f03516`.
- Hosted `Deploy to Staging` run `26146547918` built and signed API, web, and
  admin images, patched `infra/k8s/overlays/staging/kustomization.yaml`, and
  failed only at the public API smoke step because
  `https://staging-api.dhan.am/health` returned HTTP 404 six times.
- `scripts/production-preflight.sh` passed for production.
- `scripts/production-rollout-proof.js` passed for production with ArgoCD
  health `Healthy`, sync `Synced`, revision `28d42fcb`, and live images matching
  the production manifest.
- `https://api.dhan.am/v1/monitoring/health` returns HTTP 200 with
  `status: "degraded"` because 100 retained queue failures remain.

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

The latest Enclii read-only tunnel inspection,
`enclii providers cloudflare tunnels --project dhanam --json`, returned
operation `op_1779260970221167708`. It showed no routes for
`staging-api.dhan.am` or `staging.dhan.am`, and showed
`staging-admin.dhan.am` routed to production:
`http://dhanam-admin.dhanam.svc.cluster.local:80`.

Enclii read-only checks on 2026-05-20 show the control-plane split clearly:
`enclii projects environments dhanam` lists `staging` with namespace
`enclii-dhanam-staging`, but `enclii ops apps status dhanam-staging --json`
returns zero applications and `enclii ops secrets external --namespace
enclii-dhanam-staging --json` returns zero ExternalSecrets because the staging
Application has not been registered.

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
audit was `28d42fcb`, generated for source commit `71f03516`. Live promotion
remains blocked by missing staging runtime infrastructure and smoke evidence.

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

Because staging is not externally live enough to produce a green smoke run, the
manual `deploy-k8s.yml` workflow was run with `direct_k8s_deploy=false` to
build and sign a current API image, commit only the production digest, and let
ArgoCD reconcile from Git. The first health-fix run `26140806721` restored full
health from HTTP 503 to HTTP 200/degraded. After the audited queue remediation
patch landed, run `26141540713` succeeded, committed `df5d30fc`, and ArgoCD
synced `dhanam-services` to API digest
`sha256:678c05963201abd31b749fa850308665b889c35ea3bbbd417c2febabaf26d975`.

The admin client change was deployed by `deploy-admin-k8s.yml` run
`26141639932`, which committed `f97ae247` and synced admin digest
`sha256:252948253a410ce1fbf1829513ca73f694ae97097568294746dafe162f6f0d36`.

Verified after ArgoCD sync:

- `scripts/production-preflight.sh` passed.
- `https://api.dhan.am/v1/monitoring/health/live` returned HTTP 200.
- `https://api.dhan.am/v1/monitoring/health` returned HTTP 200 with
  `status: "degraded"` because `sync-transactions` and
  `categorize-transactions` retain 50 failed jobs each.
- Banxico now reports optional `unconfigured`; Belvo reports `up`.

Raw `kubectl set image` remains disabled unless explicitly selected. The
remaining API health work is queue remediation through the audited admin
queue endpoints or a future Enclii queue adapter. The newest safer inspection
and failed-job-only clear path is in `71f03516`; it still needs a green staging
smoke and production promotion, or an explicitly recorded break-glass promotion,
before operators can use it on the live queue failures.
