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

## Current Status

Snapshot originally taken on 2026-05-19 and refreshed on 2026-05-20 after
production/staging domain checks, Enclii route remediation attempts, staging
promotion hardening, API GitOps deployment verification, and queue remediation
path hardening.

| Area                      | Status               | Evidence                                                                                                                                                          |
| ------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code build and unit gates | Improved             | Local pre-push ran format, typecheck, lint, tests, build, and Prisma validation successfully; queue/admin remediation targeted Jest passed.                       |
| API Docker build          | Improved             | API Enclii build issue was remediated by aligning Dockerfiles to repo `pnpm@9.15.0` and pruning Docker context noise.                                             |
| Web Playwright            | Improved             | Auth helpers now use the current `/auth/guest` flow and seed the app stores/cookies expected by Next.js.                                                          |
| Web accessibility gates   | Stable locally       | Chromium slice passed 41/41 after fixing settings switches, report download buttons, transaction rows, and dashboard/report action controls.                      |
| Admin Playwright          | Improved             | CI defaults to synthetic admin auth and context-level mocks for admin API reads.                                                                                  |
| API production build      | Improved             | Nest now copies email templates into `dist`, and the duplicate Swagger `UpdatePreferencesDto` runtime model warning was removed.                                  |
| Staging image pipeline    | Improved             | API, web, and admin images build, sign with cosign, and patch the staging overlay; signed digests were refreshed in `ed6466b7`.                                   |
| Staging smoke             | Blocked              | Enclii has a `staging` environment record for `enclii-dhanam-staging`, but the ArgoCD Application/namespace are absent and tunnel routes are not namespace-aware. |
| Production API health     | Improved/degraded    | Signed API digest `sha256:480faa10194f...` was committed in `906916e6` and ArgoCD synced it. Full health now returns HTTP 200 with queue-only `degraded` status.  |
| Production domain routing | Fixed and verified   | `scripts/production-preflight.sh` passes; `www.dhan.am` redirects to `https://dhan.am/` without leaking `:4200`.                                                  |
| Enclii production rollout | Blocked/inconsistent | Enclii `prod` can build web releases, but the live public route still serves the ArgoCD `dhanam` namespace and the Enclii `prod` namespace is absent.             |
| Enclii policy remediation | Adapter gap          | `enclii ops policy waiver-plan` is planned only; apply is blocked because adapter execution is not wired.                                                         |

## Shortcomings Blocking Full Stability

1. Staging DNS is now present, but staging is not live: the ArgoCD Application,
   `enclii-dhanam-staging` namespace, staging Vault/ESO values, and
   namespace-aware tunnel routes are still missing.
2. Enclii can produce ready releases, but the public production route currently
   follows the ArgoCD `dhanam-services` Application in the `dhanam` namespace,
   while Enclii `prod` reports deployment state for an absent
   `enclii-dhanam-prod` namespace.
3. The Enclii policy waiver contract exists but cannot apply, so operators do
   not have an Enclii-first remediation path for the Kyverno block.
4. Production health is no longer HTTP 503 after deploying the current signed
   API digest, but it is not green: 100 retained failed BullMQ jobs remain in
   `sync-transactions` and `categorize-transactions`. Banxico is now reported
   as optional/unconfigured and Belvo connectivity is up.
5. The staging promotion safety gap is closed in code and verified in CI:
   `deploy-staging.yml` signs staging image digests, `promote-to-prod.yml`
   verifies the deploy-staging keyless signature before writing production
   digests, requires an explicit successful `Deploy to Staging` smoke run id
   unless break-glass is selected, and the staging overlay was refreshed with
   signed digests in `ed6466b7`. Promotion still needs a real staging
   smoke/soak signal.
6. Live production rollout proof still comes from the ArgoCD `dhanam-services`
   Application, not Enclii `prod` deployment records, until the Enclii namespace
   mapping gap is repaired.
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
  no Application and `kubectl get ns enclii-dhanam-staging` confirms the
  namespace is not live yet.
- Populate staging Vault/ESO paths under `secret/dhanam/staging*`.
- Register and sync `infra/argocd/dhanam-staging-application.yaml` into the
  Enclii-registered `enclii-dhanam-staging` namespace.
- Add namespace-aware Cloudflare tunnel routes from staging hosts to the
  `enclii-dhanam-staging` services. `enclii junctions add` is not sufficient
  today because it routes to the production `dhanam` namespace.
- Re-run `deploy-staging.yml` until image build, digest patch, ArgoCD
  reconcile, and smoke all pass.

Priority 3 - fix production health:

- Use the audited admin queue endpoints to inspect and retry failed jobs:
  `GET /v1/admin/queues` and
  `POST /v1/admin/queues/:name/retry-failed`. The admin implementation now
  calls `QueueService` directly instead of returning placeholder zero counts.
- Use `POST /v1/admin/queues/:name/clear` only for deliberate destructive
  cleanup, and only with request body `{ "confirm": true }`.
- Confirm the 100 retained production failures are stale/retryable before
  clearing; retry first when the underlying provider/configuration issue is
  resolved.
- Banxico health now treats absent Banxico credentials as optional
  `unconfigured`; add a real token only if FX pulls require it in production.
- Confirm Belvo credentials/network health remains up after each API deploy.
- Decide whether Plaid/Bitso are intentionally unconfigured; if so, health
  should report degraded/disabled rather than down.

Priority 4 - keep public routing clean:

- Keep `scripts/production-preflight.sh` required around production web
  promotions. As of 2026-05-20, `www.dhan.am` redirects to
  `https://dhan.am/` without `:4200`, and apex/app/admin/API public checks pass.

Priority 5 - harden the stable baseline:

- Keep CI, coverage, and Playwright gates required for merges.
- Preserve the Docker context guardrails and pnpm version alignment.
- Keep shared UI package artifacts rebuilt whenever accessibility primitives
  change; the web app consumes `@dhanam/ui` from `dist`.
- Add post-deploy assertions that compare intended git SHA/digest with the
  Enclii deployment image and fail clearly if release readiness does not equal
  rollout success.

## Stability Assessment

The codebase is significantly closer to stable after the CI, Docker, E2E,
documentation, production-build, API GitOps, and admin queue remediation work.
The production implementation is not close to 100 percent stable yet because
staging is unreachable, production queue health is degraded, and the Enclii
rollout path is blocked for API/admin.

Working estimate after this audit:

- Codebase and CI stability: about 94 percent after local typecheck, unit,
  build, admin Playwright, and targeted web Playwright gates passed.
- Staging and release pipeline stability: about 75 percent because images build,
  sign, digests patch, and Enclii has a staging environment record, but
  ArgoCD/namespace/secrets/tunnel routing are not live.
- Production implementation stability: about 82 percent because live web/admin
  surfaces respond, API full health returns HTTP 200, provider health is clean,
  and public routing is clean, but queue health and rollout control-plane state
  are not fully clean.
- Overall full-system stability: about 84 percent. The remaining gap is mostly
  operational control-plane, domain, and runtime-health remediation rather than
  ordinary application code.

## 2026-05-20 Staging Operations Note

Enclii custom domains were added and verified for the three staging hostnames,
and Cloudflare DNS CNAMEs were created through
`enclii providers cloudflare dns-apply`.

`enclii junctions add` was tested for all three hostnames and then immediately
reverted. The resulting tunnel routes pointed to:

- `http://dhanam-api.dhanam.svc.cluster.local:80`
- `http://dhanam-web.dhanam.svc.cluster.local:80`
- `http://dhanam-admin.dhanam.svc.cluster.local:80`

Those are production namespace services, so leaving them active would make
staging traffic hit production. The missing Enclii adapter is a
namespace-aware tunnel route operation that can target
`*.enclii-dhanam-staging.svc.cluster.local`.

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
reaching ArgoCD/Kyverno again. The latest signed staging build refreshed the
staging overlay in `ed6466b7`; live promotion remains blocked by missing
staging runtime infrastructure and smoke evidence.

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
ArgoCD reconcile from Git. Workflow run `26140806721` succeeded, committed
`906916e6`, and ArgoCD synced `dhanam-services` to API digest
`sha256:480faa10194ff0e47c74ea312cbd044860fc26af8394b314fc08ad662cb9b22d`.

Verified after ArgoCD sync:

- `scripts/production-preflight.sh` passed.
- `https://api.dhan.am/v1/monitoring/health/live` returned HTTP 200.
- `https://api.dhan.am/v1/monitoring/health` returned HTTP 200 with
  `status: "degraded"` because `sync-transactions` and
  `categorize-transactions` retain 50 failed jobs each.
- Banxico now reports optional `unconfigured`; Belvo reports `up`.

Raw `kubectl set image` remains disabled unless explicitly selected. The
remaining API health work is queue remediation through the audited admin
queue endpoints or a future Enclii queue adapter.
