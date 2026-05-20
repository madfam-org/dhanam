# Dhanam Tech Debt Register

Last updated: 2026-05-20

This is the current technical-debt register for Dhanam. It tracks debt that
still affects stability, operations, development velocity, or release safety.
Historical implementation logs are preserved under [reports](reports/).

For full production and staging context, read this with
[Stability Audit 2026-05-19](STABILITY_AUDIT_2026-05-19.md).
For execution order and milestone targets, read the [Roadmap](ROADMAP.md).

## Operating Rules

- Production operations are Enclii-first.
- Raw `kubectl`, `helm`, SSH, provider CLIs/APIs, `docker exec`, or direct
  container access are bootstrap or documented break-glass only.
- Record missing Enclii adapter gaps instead of normalizing raw production
  access.
- Keep this file focused on current debt. Move resolved historical narratives
  to `docs/reports/`.

## Active Debt

| ID      | Area                      | Severity | Status   | Current impact                                                                                                             | Primary reference                                        |
| ------- | ------------------------- | -------- | -------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| TD-1002 | Staging activation        | Medium   | Active   | Staging API/web/admin smoke is green; remaining debt is repeated proof and Enclii-owned namespace-aware route apply.       | [Deployment Guide](DEPLOYMENT.md)                        |
| TD-1003 | Production rollout truth  | High     | Active   | `production-rollout-proof.js` proves ArgoCD live digests, but Enclii `prod` records still do not own public rollout truth. | [Stability Wrap-Up](STABILITY_WRAP_UP_2026-05-20.md)     |
| TD-1004 | Enclii adapter coverage   | Medium   | Active   | Migration repair, policy waiver apply, staging tunnel route apply, and queue remediation adapters are not fully wired.     | [Stability Wrap-Up](STABILITY_WRAP_UP_2026-05-20.md)     |
| TD-1005 | Provider health semantics | Medium   | Active   | Plaid/Bitso/Banxico intentional unconfigured states need explicit operational classification.                              | [Credential Onboarding](CREDENTIAL_ONBOARDING.md)        |
| TD-1006 | React 18 global pin       | Low      | Deferred | Root pnpm overrides keep web/admin on React 18 until Expo/mobile can move safely.                                          | [package.json](../package.json)                          |
| TD-1007 | Mobile test depth         | Low      | Active   | Mobile still has a small foundation test set relative to app surface area.                                                 | [Mobile Guide](MOBILE.md)                                |
| TD-1008 | Historical docs cleanup   | Low      | Active   | Some reports and secondary guides still mention old AWS/Fargate, ports, hosts, or test counts.                             | [Documentation Audit](DOCUMENTATION_AUDIT_2026-05-19.md) |

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
- `Deploy to Staging` run `26194485016` passed build/sign, digest patch, API
  smoke, web route/API-origin smoke, and admin route/API-origin smoke for
  source commit `d1f8ccf0`, then committed staging refresh `7a848a2c`.
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

Until that migration is complete, run `scripts/production-rollout-proof.js`
after promotion to prove `dhanam-services` is Healthy/Synced and live images
match `infra/k8s/production/kustomization.yaml`.

### TD-1004: Enclii Adapter Coverage

Wire Enclii-first apply paths for database migration repair, policy waivers,
namespace-aware Cloudflare tunnel routes, and audited queue remediation. Until
then, direct provider, policy, database, Redis, or BullMQ mutation remains
break-glass only.

### TD-1005: Provider Health Semantics

Keep provider activation records in [Credential Onboarding](CREDENTIAL_ONBOARDING.md).
If a provider is intentionally not launched, health should report it as
`unconfigured` with the correct `required` / `mode` metadata rather than
failed.

### TD-1006: React 18 Global Pin

The root pnpm overrides pin `react`, `react-dom`, and their types to React 18.
Remove this only after the mobile/Expo stack can safely support React 19 and
the mobile compatibility shims are no longer needed.

### TD-1007: Mobile Test Depth

Current mobile tests cover only the foundation slice. Priority additions:
`AuthContext`, `useAccounts`, `useTransactions`, `useBudgets`, API service,
`BudgetCard`, `ChartCard`, `GoalCard`, and transaction filtering.

### TD-1008: Historical Docs Cleanup

Historical reports are allowed to preserve old context, but they need a clear
historical banner if they mention superseded infrastructure, hosts, ports, or
test counts. Current docs should stay linked from [docs/README.md](README.md).

## Recently Closed Debt

| Area                           | Closed by                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------ |
| Production queue health        | 2026-05-20 failed-only break-glass cleanup after audited route rollout         |
| Product-tier migration drift   | 2026-05-20 production repair plus type-adaptive migration source fix           |
| Admin queue remediation stubs  | `fcbceed8 fix(admin): wire queue remediation to bullmq`                        |
| Safer queue cleanup API/UI     | `71f03516 fix(stability): harden production queue remediation`                 |
| Final queue rollout docs       | `ef5cb7c8 docs: record final queue remediation rollout`                        |
| Production promotion hardening | `3c8e4116 ci: harden production promotion gates`                               |
| March enterprise-hardening log | Archived as [reports/TECH_DEBT_2026-03-21.md](reports/TECH_DEBT_2026-03-21.md) |

## Historical Archive

- [March 2026 enterprise-hardening log](reports/TECH_DEBT_2026-03-21.md)
