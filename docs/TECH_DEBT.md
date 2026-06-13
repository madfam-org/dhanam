# Dhanam Tech Debt Register

Last updated: 2026-06-13

This is the current technical-debt register for Dhanam. It tracks debt that
still affects stability, operations, development velocity, or release safety.
Historical implementation logs are preserved under [reports](reports/).

For full production and staging context, read this with
[Stability Audit 2026-05-19](STABILITY_AUDIT_2026-05-19.md).
For execution order and milestone targets, read the
[GA Remediation Roadmap](GA_REMEDIATION_ROADMAP.md) and [Roadmap](ROADMAP.md).

## Operating Rules

- Production operations are Enclii-first.
- Raw `kubectl`, `helm`, SSH, provider CLIs/APIs, `docker exec`, or direct
  container access are bootstrap or documented break-glass only.
- Record missing Enclii adapter gaps instead of normalizing raw production
  access.
- Keep this file focused on current debt. Move resolved historical narratives
  to `docs/reports/`.

## Active Debt

| ID      | Area                           | Severity | Status   | Current impact                                                                                                                                                                                       | Primary reference                                                       |
| ------- | ------------------------------ | -------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| TD-1002 | Staging activation             | Medium   | Active   | Staging API/web/admin smoke is green; remaining debt is repeated proof and Enclii-owned namespace-aware route apply.                                                                                 | [Deployment Guide](DEPLOYMENT.md)                                       |
| TD-1003 | Production rollout truth       | High     | Active   | `production-rollout-proof.js` proves ArgoCD live digests, but Enclii `prod` records still do not own public rollout truth.                                                                           | [Stability Wrap-Up](STABILITY_WRAP_UP_2026-05-20.md)                    |
| TD-1004 | Enclii adapter coverage        | Medium   | Active   | Migration repair, policy waiver apply, staging tunnel route apply, and queue remediation adapters are not fully wired.                                                                               | [Stability Wrap-Up](STABILITY_WRAP_UP_2026-05-20.md)                    |
| TD-1005 | Provider health semantics      | Medium   | Active   | Plaid/Bitso/Banxico intentional unconfigured states need explicit operational classification.                                                                                                        | [Credential Onboarding](CREDENTIAL_ONBOARDING.md)                       |
| TD-1006 | React 18 global pin            | Low      | Deferred | Root pnpm overrides keep web/admin on React 18 until Expo/mobile can move safely.                                                                                                                    | [package.json](../package.json)                                         |
| TD-1007 | Mobile test depth              | Low      | Active   | Mobile still has a small foundation test set relative to app surface area.                                                                                                                           | [Mobile Guide](MOBILE.md)                                               |
| TD-1008 | Historical docs cleanup        | Low      | Active   | Phase summaries archived under `docs/reports/historical/`; GA banners on guides; OpenAPI export script verified locally. Long-term: generate `API.md` sections from OpenAPI.                         | [Documentation Audit](DOCUMENTATION_AUDIT_2026-05-22.md)                |
| TD-1009 | Billing router unification     | Medium   | Active   | Fee-aware routing + schedule maintenance shipped in source. Remaining: production staging smoke proof and close legacy bypass audit.                                                                 | [Commercial GA Execution](COMMERCIAL_GA_EXECUTION.md)                   |
| TD-1010 | Internal POS completeness      | Medium   | Active   | Charge, refund, timeline, reconciliation, route override, fee schedule admin, SDK, and golden probe CI are source-landed. Remaining: staging Karafiel CFDI proof, DLQ drill, G2 sign-off.            | [Commercial GA Execution](COMMERCIAL_GA_EXECUTION.md)                   |
| TD-1011 | Janua commercial readiness     | High     | Active   | Janua billing secrets were present with zero length in production proof; Janua-routed billing must not be claimed live.                                                                              | [Stability Wrap-Up](STABILITY_WRAP_UP_2026-05-20.md)                    |
| TD-1012 | Public repo security hygiene   | High     | Active   | ~48%: P0 + A6 + DEPLOYMENT redaction + PR checklist. AGENTS diet (P2) remains.                                                                                                                       | [Public Repo Security Remediation](PUBLIC_REPO_SECURITY_REMEDIATION.md) |
| TD-1013 | MADFAM operator prod slice     | High     | Active   | ~65%: ledger + budget metadata + admin MADFAM Import UI. Belvo + prod PlatformConfig seed remain.                                                                                                    | [Full Remediation Plan](FULL_REMEDIATION_PLAN_G4_AND_OPERATOR_SLICE.md) |
| TD-1014 | Production catalog sync ops    | High     | Active   | GitHub Production environment lacks `DATABASE_URL`/Stripe secrets; live catalog drift (e.g. missing `voxa`) until `sync-catalog.ts` runs. Weekly drift workflow + hardened operator runbook shipped. | [Catalog Truth](CATALOG_TRUTH_2026-05-20.md)                            |
| TD-1015 | Prod public surface URL drift  | High     | Closed   | Staging-built web on prod hostnames fixed via hostname-aware URLs, prod web rebuild on promote, PR #513 rollout, preflight green on `dhan.am` / `app.dhan.am`.                                       | `scripts/production-preflight.sh`                                       |
| TD-1016 | Vault extended secret backfill | High     | Active   | `vault-store` cannot read `secret/dhanam`; git ES removed from kustomization. Platform ES + retained keys interim. Re-enable after Lockbox backfill.                                                 | `infra/k8s/production/external-secret.yaml`                             |

## Remediation Notes

### Closed TD-1001: Production Queue Health

Production queue health is green as of 2026-05-20. Full health returns
`status: "healthy"` with `failedJobs: 0`.

The retained failures were inspected before cleanup:

- `sync-transactions`: 50 retained failures from the earlier Prisma schema
  drift.
- `categorize-transactions`: 50 retained failures from legacy rule-condition
  shape before normalization.

Because Enclii does not yet expose a queue remediation adapter and no admin
bearer token was available in-session, cleanup used a narrow break-glass BullMQ
script from an API pod. It removed only failed jobs from those two queues;
waiting, active, delayed, and completed jobs were preserved.

For future incidents, use the audited admin queue endpoints when possible:

- `GET /v1/admin/queues`
- `GET /v1/admin/queues/:name/failed?limit=25`
- `POST /v1/admin/queues/:name/retry-failed`
- `POST /v1/admin/queues/:name/clear-failed` with `{ "confirm": true }` after
  stale retained failures are confirmed
- `POST /v1/admin/queues/:name/clear` with `{ "confirm": true }` only after a
  deliberate whole-queue destructive-cleanup decision

Prefer `clear-failed` over whole-queue `clear`; whole-queue clear removes
waiting, active, completed, failed, and delayed jobs.

### TD-1002: Staging Activation

Staging now passes the full API, web, admin, and staging API-origin smoke path.
The remaining debt is operational ownership and repeated evidence:

- Keep staging Vault/ESO values populated and synced.
- Keep `infra/argocd/dhanam-staging-application.yaml` registered and synced.
- Keep the `enclii-dhanam-staging` namespace healthy.
- Keep namespace-aware Cloudflare tunnel routes healthy for staging hosts. DNS
  CNAMEs were restored through Enclii on 2026-05-20; tunnel route apply remains
  an Enclii adapter gap.
- `Deploy to Staging` run `26196989053` passed build/sign, digest patch, API
  smoke, web route/API-origin smoke, and admin route/API-origin smoke for
  source commit `dd58fb39`, then committed staging refresh `7f7a0248`.
- Preserve hosted evidence that `staging-admin.dhan.am` uses staging API/env
  values before treating it as a promotion proof.

Current source hardening:

- `deploy-staging.yml` ignores its own staging digest patch file so bot commits
  do not self-trigger another staging build.
- `deploy-staging.yml` now smokes API, web, and admin, including API-origin
  assertions for web/admin routes.
- Staging API/web overlays override production-only `WEB_URL`,
  `PRODUCT_WEBHOOK_URLS`, `PHYNDCRM_API_URL`, `NEXTAUTH_URL`, and Paddle
  environment values.

### TD-1003: Production Rollout Truth

Production currently needs live verification through ArgoCD and public probes.
Close this by making Enclii `prod` target the live production namespace or by
migrating public routes cleanly to an Enclii-managed namespace.

Mitigations shipped on main:

- `infra/k8s/production/kyverno-policy-exception.yaml` — scoped PolicyException
  so Kyverno `verify-image-signatures` no longer blocks routine GitOps digest
  rollouts for Dhanam pods.
- Optional SMTP/Banxico `secretKeyRef`s on `dhanam-api` — pods start when ESO
  partial sync omits non-critical keys.
- `promote-to-prod.yml` rebases on `main` before push and runs
  `scripts/production-preflight.sh` after promotion (informational until cluster
  reconciles).

Until Enclii owns live rollout, run `scripts/production-rollout-proof.js`
after promotion to prove `dhanam-services` is Healthy/Synced and live images
match `infra/k8s/production/kustomization.yaml`.

### TD-1004: Enclii Adapter Coverage

Wire Enclii-first apply paths for database migration repair, policy waivers,
namespace-aware Cloudflare tunnel routes, and audited queue remediation. Until
then, direct provider, policy, database, Redis, or BullMQ mutation remains
break-glass only. Manual raw production deploy workflows now require an
incident/change reference and `break_glass_ack=true`, but the underlying Enclii
adapter gaps still need to be closed.

### TD-1005: Provider Health Semantics

Keep provider activation records in [Credential Onboarding](CREDENTIAL_ONBOARDING.md).
If a provider is intentionally not launched, health should report it as
`unconfigured` with the correct `required` / `mode` metadata rather than
failed.

### TD-1009: Billing Router Unification

`CheckoutRoutingPolicyService` and `tryHybridSubscriptionCheckout()` now route
self-service upgrade, external checkout, operator checkout, and federated
checkout through `PaymentRouterService` when Janua billing is disabled
(`FEATURE_UNIFIED_CHECKOUT_ROUTING=true`, production default).

Staging commercial smoke now asserts MX/US provider matrix and route
override set/clear when admin credentials are supplied.

Close this debt by:

- setting repo variable `STAGING_COMMERCIAL_STRICT=true` once GitHub secrets are configured;
- keeping [`scripts/staging-commercial-smoke.sh`](../scripts/staging-commercial-smoke.sh)
  green on every staging deploy;
- recording production route-preview samples after API promote;
- confirming legacy Stripe fallback only fires when hybrid router is unavailable (logged).

### TD-1010: Internal POS Completeness

The admin POS console at `/pos` and `AdminPosBillingService` now expose checkout
link creation, route preview, **operator route override UI**, PaymentIntent
charge/refund (including partial `amountMinor`), correlation timelines with
CFDI display, and reconciliation summary.

`@dhanam/billing-sdk` exports `DhanamPosClient` for trusted internal callers.

Remaining G2 gaps (see [Commercial GA Execution](COMMERCIAL_GA_EXECUTION.md)):

- Karafiel CFDI / egreso **staging proof** on live timeline after charge smoke;
- Conekta operator charge/refund when Scope B is selected;
- golden Dhanam → product **live** probes per launched product (CI envelope probe shipped);
- production DLQ drill execution record (G2-3).

### TD-1011: Janua Commercial Readiness

Janua-routed billing remains blocked until production Janua billing secrets are
non-empty and a complete Janua checkout/webhook/product-fan-out test is
recorded. Source now fails closed by default unless `JANUA_BILLING_ENABLED` is
truthy, and production manifests set the flag to `"false"`. Keep Janua docs
framed as an integration path, not a live commercial payment path, until proof
exists.

### TD-1012: Public Repository Security Hygiene

Phase 0 shipped (~48% of G4). A6 bootstrap env-only and partial P1 (DEPLOYMENT redaction, PR checklist) done. Remaining: P2 AGENTS diet, P1 runbook relocation, P4–P5 per
[Full Remediation Plan](FULL_REMEDIATION_PLAN_G4_AND_OPERATOR_SLICE.md) and
[PUBLIC_REPO_SECURITY_REMEDIATION.md](PUBLIC_REPO_SECURITY_REMEDIATION.md).

### TD-1013: MADFAM Operator Prod Slice

**Severity:** High  
**Status:** Active (~65%)

Prod baseline: operator account has 124 CSV import txs; import continuity verified;
budget metadata backfilled on all three CSV spaces; admin **MADFAM Import** panel
at `admin.dhan.am/madfam-import` + PlatformConfig API shipped. Gaps: prod
`platform_config` migration deploy + seed (D5), Aldo Personal empty, no Belvo
proof, personal routing re-import (OP-L5).

100% DoD: [Full Remediation Plan — Operator slice](FULL_REMEDIATION_PLAN_G4_AND_OPERATOR_SLICE.md#100-definition-of-done--operator-prod-slice-adminmadfamio).

### TD-1006: React 18 Global Pin

The root pnpm overrides pin `react`, `react-dom`, and their types to React 18.
Remove this only after the mobile/Expo stack can safely support React 19 and
the mobile compatibility shims are no longer needed.

### TD-1007: Mobile Test Depth

Current mobile tests cover only the foundation slice. Priority additions:
`AuthContext`, `useAccounts`, `useTransactions`, `useBudgets`, API service,
`BudgetCard`, `ChartCard`, `GoalCard`, and transaction filtering.

### TD-1008: Historical Docs Cleanup

Phase summaries (`PHASE2-SUMMARY`, `IMPLEMENTATION_SUMMARY`, `PHASE3-PLAN`),
dogfooding quick wins, audit summary, and `architecture/IMPLEMENTATION_PROGRESS`
now live under `docs/reports/historical/` with GA-linked banners. Remaining
low-priority work: long-term `API.md` generation from OpenAPI export.

### TD-1014: Production Catalog Sync Ops

Close this by configuring GitHub **Production** environment secrets from Enclii
Lockbox (`DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_MX_SECRET_KEY`), then:

1. Run **Sync production catalog** with `dry_run=false`.
2. Confirm `pnpm catalog:drift -- --json` returns `"ok": true`.
3. Keep the weekly **Production catalog drift** workflow green.

Production API now sets `DHANAM_PUBLIC_CATALOG_SOURCE=db` so public catalog and
checkout share one reconciled store. Image-only `catalog.yaml` updates without
DB sync will not surface new products (e.g. `voxa`).

### TD-1015: Prod Public Surface URL Drift

**Status:** Closed (2026-06-13)

Root cause: `promote-to-prod` reused staging web/admin digests whose
`NEXT_PUBLIC_*` values are baked at build time with staging hostnames.

Fixes shipped:

1. Hostname-aware `resolvePublicAppUrl()` / `resolvePublicApiUrl()` and runtime CSP.
2. `promote-to-prod.yml` rebuilds web/admin with production build-args.
3. PR #513 removed unused `dhanam-secrets` mounts blocking web rollout.
4. `./scripts/production-preflight.sh` green on `dhan.am` and `app.dhan.am`.

### TD-1016: Vault Extended Secret Backfill

**Status:** Active

The git-managed `dhanam-secrets` ExternalSecret is **deferred from kustomization**
because `vault-store` cannot read `secret/dhanam` (`SecretSyncedError`). Until
Enclii Lockbox backfill restores Vault read access:

- `dhanam-ecosystem-service-auth` (platform ES) continues merging into
  `dhanam-secrets`.
- Retained secret keys from the last good sync remain in the cluster.
- `external-secret.yaml` (core) and `external-secret-extended.yaml` (integration
  keys) stay in-repo as the target contract; re-add to `kustomization.yaml` after
  Vault proof.

## Recently Closed Debt

| Area                           | Closed by                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------ |
| Production queue health        | 2026-05-20 failed-only break-glass cleanup after audited route rollout         |
| Product-tier migration drift   | 2026-05-20 production repair plus type-adaptive migration source fix           |
| Admin queue remediation stubs  | `fcbceed8 fix(admin): wire queue remediation to bullmq`                        |
| Safer queue cleanup API/UI     | `71f03516 fix(stability): harden production queue remediation`                 |
| Final queue rollout docs       | `ef5cb7c8 docs: record final queue remediation rollout`                        |
| Production promotion hardening | `3c8e4116 ci: harden production promotion gates`                               |
| Prod public surface URL drift  | 2026-06-13 PR #502–#513 + preflight green on prod hostnames                    |
| March enterprise-hardening log | Archived as [reports/TECH_DEBT_2026-03-21.md](reports/TECH_DEBT_2026-03-21.md) |

## Historical Archive

- [March 2026 enterprise-hardening log](reports/TECH_DEBT_2026-03-21.md)
