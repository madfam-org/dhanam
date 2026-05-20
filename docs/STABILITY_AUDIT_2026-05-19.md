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

Snapshot taken on 2026-05-19 after commits through `e1232f71` and the staging
digest commit `96435043`.

| Area                      | Status               | Evidence                                                                                                                                        |
| ------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Code build and unit gates | Improved             | Local pre-push ran format, typecheck, lint, tests, build, and Prisma validation successfully.                                                   |
| API Docker build          | Improved             | API Enclii build issue was remediated by aligning Dockerfiles to repo `pnpm@9.15.0` and pruning Docker context noise.                           |
| Web Playwright            | Improved             | Auth helpers now use the current `/auth/guest` flow and seed the app stores/cookies expected by Next.js.                                        |
| Web accessibility gates   | Stable locally       | Chromium slice passed 41/41 after fixing settings switches, report download buttons, transaction rows, and dashboard/report action controls.    |
| Admin Playwright          | Improved             | CI defaults to synthetic admin auth and context-level mocks for admin API reads.                                                                |
| API production build      | Improved             | Nest now copies email templates into `dist`, and the duplicate Swagger `UpdatePreferencesDto` runtime model warning was removed.                |
| Staging image pipeline    | Partially stable     | API, web, and admin images build and the staging overlay digest patch succeeds.                                                                 |
| Staging smoke             | Blocked              | `https://staging-api.dhan.am/health` fails DNS resolution: `curl: (6) Could not resolve host: staging-api.dhan.am`.                             |
| Production API health     | Unstable             | Public health reported DB/Redis up, but queues down, Banxico 404, Belvo 502, Plaid/Bitso unconfigured.                                          |
| Production domain routing | Unstable             | `https://www.dhan.am` redirects to `https://dhan.am:4200/`, exposing an internal port in the public redirect.                                   |
| Enclii production rollout | Blocked/inconsistent | Latest API/admin deployment records failed on Kyverno image-signature annotation mutation, while Enclii observe still reports old pods healthy. |
| Enclii policy remediation | Adapter gap          | `enclii ops policy waiver-plan` is planned only; apply is blocked because adapter execution is not wired.                                       |

## Shortcomings Blocking Full Stability

1. Staging DNS and tunnel routes are incomplete for `staging-api.dhan.am`,
   `staging.dhan.am`, and `staging-admin.dhan.am`.
2. Enclii can produce ready releases, but API/admin roll-forward is currently
   blocked by a Kyverno admission policy conflict.
3. The Enclii policy waiver contract exists but cannot apply, so operators do
   not have an Enclii-first remediation path for the Kyverno block.
4. Production health is not green: queue failures and external provider checks
   are surfacing as unhealthy.
5. Public domain behavior is not clean: `www.dhan.am` redirects to an internal
   `:4200` URL.
6. Production appears to be serving older releases than the latest pushed
   code and GitHub-built images.
7. Local test startup still warns when optional local SMTP/PostHog/Sentry and
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
- Wire the Enclii `ops policy waiver-plan --apply` adapter or provide an
  Enclii-first policy exception workflow with idempotency and audit records.
- Re-run Enclii release/deployment checks for `dhanam-api`, `dhanam-web`, and
  `dhanam-admin` and verify the deployed image SHAs match the intended release.

Priority 2 - make staging real:

- Provision DNS for `staging-api.dhan.am`, `staging.dhan.am`, and
  `staging-admin.dhan.am`.
- Add Cloudflare tunnel routes from those hosts to the `dhanam-staging`
  services.
- Confirm `dhanam-staging` ArgoCD is registered and synced.
- Re-run `deploy-staging.yml` until image build, digest patch, ArgoCD
  reconcile, and smoke all pass.

Priority 3 - fix production health:

- Inspect queue failure classes and drain or repair failed jobs safely.
- Correct Banxico health configuration or endpoint expectations.
- Confirm Belvo credentials/network health and distinguish outage from
  misconfiguration.
- Decide whether Plaid/Bitso are intentionally unconfigured; if so, health
  should report degraded/disabled rather than down.

Priority 4 - clean public routing:

- Fix `www.dhan.am` redirect behavior so it redirects to `https://dhan.am/`
  without `:4200`.
- Confirm `dhan.am`, `www.dhan.am`, `app.dhan.am`, `admin.dhan.am`, and
  `api.dhan.am` all have stable TLS, expected redirects, and health checks.

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
documentation, and production-build hardening work. The production
implementation is not close to 100 percent stable yet because staging is
unreachable, production health is unhealthy, and the Enclii rollout path is
blocked for API/admin.

Working estimate after this audit:

- Codebase and CI stability: about 93 percent after local typecheck, unit,
  build, admin Playwright, and targeted web Playwright gates passed.
- Staging and release pipeline stability: about 65 percent because images build
  and digests patch, but the smoke gate fails on DNS.
- Production implementation stability: about 60 percent because live web/admin
  surfaces respond, but API health, rollout state, and domain routing are not
  clean.
- Overall full-system stability: about 72 percent. The remaining gap is mostly
  operational control-plane, domain, and runtime-health remediation rather than
  ordinary application code.
