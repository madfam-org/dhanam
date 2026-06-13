# Production Catalog Sync — Runbook (public stub)

> **Operator-only:** Full Vault paths, live `DATABASE_URL` formats, and
> break-glass kubectl steps live in **`madfam-org/internal-devops`**
> (`runbooks/dhanam-catalog-sync-prod.md`). Do not copy production credentials
> into this public repository.

## When to run

Run after a merged change to `catalog.yaml` when Stripe prices and the
production Dhanam DB must be reconciled. Idempotent; safe to re-run.

## Prerequisites (Enclii-first)

1. Confirm production migrations are applied (`pnpm --filter @dhanam/api db:migrate:deploy`).
2. Load secrets from Enclii Lockbox / Vault — never from git:
   - `DATABASE_URL` (prod Postgres)
   - `STRIPE_SECRET_KEY` (USD)
   - `STRIPE_MX_SECRET_KEY` (Mexico)
3. Use admin.dhan.am or audited CLI from a trusted operator workstation.

## Dry-run first

```bash
cd apps/api
DRY_RUN=true pnpm tsx scripts/sync-catalog.ts
```

Review output, then run without `DRY_RUN`.

## Private runbook

For the full procedure (Vault `kv get`, digest verification, rollback), see
**internal-devops** `runbooks/dhanam-catalog-sync-prod.md`.

For the **Voxa activation path** (GitHub Production env secrets, Enclii break-glass,
Tulana bootstrap, WTP gates), see **internal-devops**
`runbooks/voxa-pricing-activation-2026-06.md`.

See also [Public Repo Security Remediation](../docs/PUBLIC_REPO_SECURITY_REMEDIATION.md).
