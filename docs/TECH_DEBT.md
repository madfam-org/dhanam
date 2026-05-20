# Dhanam Tech Debt Register

Last updated: 2026-05-20

This is the current technical-debt register for Dhanam. It tracks debt that
still affects stability, operations, development velocity, or release safety.
Historical implementation logs are preserved under [reports](reports/).

For full production and staging context, read this with
[Stability Audit 2026-05-19](STABILITY_AUDIT_2026-05-19.md).

## Operating Rules

- Production operations are Enclii-first.
- Raw `kubectl`, `helm`, SSH, provider CLIs/APIs, `docker exec`, or direct
  container access are bootstrap or documented break-glass only.
- Record missing Enclii adapter gaps instead of normalizing raw production
  access.
- Keep this file focused on current debt. Move resolved historical narratives
  to `docs/reports/`.

## Active Debt

| ID      | Area                         | Severity | Status   | Current impact                                                                                 | Primary reference                                        |
| ------- | ---------------------------- | -------- | -------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| TD-1001 | Production queue health      | High     | Active   | API full health is HTTP 200 but `degraded` because retained BullMQ failures still need action. | [Stability Audit](STABILITY_AUDIT_2026-05-19.md)         |
| TD-1002 | Staging activation           | High     | Active   | Staging DNS exists, but ArgoCD app, namespace, secrets, and namespace-aware tunnel routes lag. | [Deployment Guide](DEPLOYMENT.md)                        |
| TD-1003 | Production rollout truth     | High     | Active   | Public production proof comes from ArgoCD `dhanam-services`, not Enclii `prod` records.        | [Stability Audit](STABILITY_AUDIT_2026-05-19.md)         |
| TD-1004 | Enclii policy waiver adapter | Medium   | Active   | `enclii ops policy waiver-plan` can plan, but apply execution is not wired.                    | [Stability Audit](STABILITY_AUDIT_2026-05-19.md)         |
| TD-1005 | Provider health semantics    | Medium   | Active   | Plaid/Bitso/Banxico intentional unconfigured states need explicit operational classification.  | [Credential Onboarding](CREDENTIAL_ONBOARDING.md)        |
| TD-1006 | React 18 global pin          | Low      | Deferred | Root pnpm overrides keep web/admin on React 18 until Expo/mobile can move safely.              | [package.json](../package.json)                          |
| TD-1007 | Mobile test depth            | Low      | Active   | Mobile still has a small foundation test set relative to app surface area.                     | [Mobile Guide](MOBILE.md)                                |
| TD-1008 | Historical docs cleanup      | Low      | Active   | Some reports and secondary guides still mention old AWS/Fargate, ports, hosts, or test counts. | [Documentation Audit](DOCUMENTATION_AUDIT_2026-05-19.md) |

## Remediation Notes

### TD-1001: Production Queue Health

Use the audited admin queue endpoints to inspect and retry failed jobs:

- `GET /v1/admin/queues`
- `POST /v1/admin/queues/:name/retry-failed`
- `POST /v1/admin/queues/:name/clear` with `{ "confirm": true }` only after a
  deliberate destructive-cleanup decision

Do not clear retained production failures until an operator has determined
whether the jobs are stale or retryable.

### TD-1002: Staging Activation

Staging requires a real reconciled environment before promotion can be treated
as fully safe:

- Populate staging Vault/ESO values.
- Register and sync `infra/argocd/dhanam-staging-application.yaml`.
- Create or repair the staging namespace.
- Add namespace-aware Cloudflare tunnel routes for staging hosts.
- Re-run staging deploy until build, digest patch, sync, smoke, and soak all
  pass.

### TD-1003: Production Rollout Truth

Production currently needs live verification through ArgoCD and public probes.
Close this by making Enclii `prod` target the live production namespace or by
migrating public routes cleanly to an Enclii-managed namespace.

### TD-1004: Enclii Policy Waiver Adapter

Wire an Enclii-first apply path for policy waivers with idempotency and audit
records. Until then, raw policy mutation remains break-glass only.

### TD-1005: Provider Health Semantics

Keep provider activation records in [Credential Onboarding](CREDENTIAL_ONBOARDING.md).
If a provider is intentionally disabled, health should report it as disabled or
unconfigured rather than failed.

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
| Final queue rollout docs       | `ef5cb7c8 docs: record final queue remediation rollout`                        |
| Production promotion hardening | `3c8e4116 ci: harden production promotion gates`                               |
| March enterprise-hardening log | Archived as [reports/TECH_DEBT_2026-03-21.md](reports/TECH_DEBT_2026-03-21.md) |

## Historical Archive

- [March 2026 enterprise-hardening log](reports/TECH_DEBT_2026-03-21.md)
