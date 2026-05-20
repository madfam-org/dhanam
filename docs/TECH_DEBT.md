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

| ID      | Area                      | Severity | Status   | Current impact                                                                                                                                          | Primary reference                                        |
| ------- | ------------------------- | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| TD-1001 | Production queue health   | High     | Active   | API full health is HTTP 200 but `degraded`: source now removes the invalid generic repeat schedules, but retained failures still need live cleanup.     | [Stability Audit](STABILITY_AUDIT_2026-05-19.md)         |
| TD-1002 | Staging activation        | High     | Active   | Staging DNS is restored; latest staging smoke failed 404 because tunnel routes are absent or point at production. Source now also isolates staging env. | [Deployment Guide](DEPLOYMENT.md)                        |
| TD-1003 | Production rollout truth  | High     | Active   | `production-rollout-proof.js` proves ArgoCD live digests, but Enclii `prod` records still do not own public rollout truth.                              | [Stability Audit](STABILITY_AUDIT_2026-05-19.md)         |
| TD-1004 | Enclii adapter coverage   | Medium   | Active   | Policy waiver apply, staging tunnel route apply, and queue remediation adapters are not fully wired.                                                    | [Stability Audit](STABILITY_AUDIT_2026-05-19.md)         |
| TD-1005 | Provider health semantics | Medium   | Active   | Plaid/Bitso/Banxico intentional unconfigured states need explicit operational classification.                                                           | [Credential Onboarding](CREDENTIAL_ONBOARDING.md)        |
| TD-1006 | React 18 global pin       | Low      | Deferred | Root pnpm overrides keep web/admin on React 18 until Expo/mobile can move safely.                                                                       | [package.json](../package.json)                          |
| TD-1007 | Mobile test depth         | Low      | Active   | Mobile still has a small foundation test set relative to app surface area.                                                                              | [Mobile Guide](MOBILE.md)                                |
| TD-1008 | Historical docs cleanup   | Low      | Active   | Some reports and secondary guides still mention old AWS/Fargate, ports, hosts, or test counts.                                                          | [Documentation Audit](DOCUMENTATION_AUDIT_2026-05-19.md) |

## Remediation Notes

### TD-1001: Production Queue Health

Use the audited admin queue endpoints to inspect and retry failed jobs:

- `GET /v1/admin/queues`
- `GET /v1/admin/queues/:name/failed?limit=25`
- `POST /v1/admin/queues/:name/retry-failed`
- `POST /v1/admin/queues/:name/clear-failed` with `{ "confirm": true }` after
  stale retained failures are confirmed
- `POST /v1/admin/queues/:name/clear` with `{ "confirm": true }` only after a
  deliberate whole-queue destructive-cleanup decision

Do not clear retained production failures until an operator has determined
whether the jobs are stale or retryable. Prefer `clear-failed` over whole-queue
`clear`; whole-queue clear removes waiting, active, completed, failed, and
delayed jobs.

Current status: the safer `failed` inspection and failed-job-only cleanup path
was implemented in `71f03516`, and current source also removes the obsolete
generic BullMQ repeatable schedules that were enqueueing `{ allSpaces: true }`
and `{ syncAll: true }` payloads into processors that require concrete
`spaceId` / `connectionId` values. The cron dispatchers now enqueue granular
jobs with stable IDs so multiple API replicas do not duplicate the same
hourly/four-hour work.

Live production still needs a new build/promotion plus failed-job cleanup:
the public API currently exposes retry and whole-queue clear, but not the
safer failed-job inspection and failed-only clear endpoints. Do not use
whole-queue `clear` unless the incident is explicitly break-glass and logs
prove no waiting, active, or delayed work would be discarded.

### TD-1002: Staging Activation

Staging requires a real reconciled environment before promotion can be treated
as fully safe:

- Populate staging Vault/ESO values.
- Register and sync `infra/argocd/dhanam-staging-application.yaml`.
- Create or repair the staging namespace.
- Add namespace-aware Cloudflare tunnel routes for staging hosts. DNS CNAMEs
  were restored through Enclii on 2026-05-20; tunnel route apply is the
  remaining Cloudflare adapter gap.
- Fix the current route state: `staging-api.dhan.am` and `staging.dhan.am`
  have no tunnel route and return 404; `staging-admin.dhan.am` points at the
  production admin service.
- Re-run staging deploy until build, digest patch, sync, smoke, and soak all
  pass.

Current source hardening:

- `deploy-staging.yml` ignores its own staging digest patch file so bot commits
  do not self-trigger another staging build.
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

Wire Enclii-first apply paths for policy waivers, namespace-aware Cloudflare
tunnel routes, and audited queue remediation. Until then, direct provider,
policy, Redis, or BullMQ mutation remains break-glass only.

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
| Admin queue remediation stubs  | `fcbceed8 fix(admin): wire queue remediation to bullmq`                        |
| Safer queue cleanup API/UI     | `71f03516 fix(stability): harden production queue remediation`                 |
| Final queue rollout docs       | `ef5cb7c8 docs: record final queue remediation rollout`                        |
| Production promotion hardening | `3c8e4116 ci: harden production promotion gates`                               |
| March enterprise-hardening log | Archived as [reports/TECH_DEBT_2026-03-21.md](reports/TECH_DEBT_2026-03-21.md) |

## Historical Archive

- [March 2026 enterprise-hardening log](reports/TECH_DEBT_2026-03-21.md)
