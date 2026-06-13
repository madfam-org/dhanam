# Production Catalog Sync — Runbook (public stub)

> **Operator-only:** Full Vault paths, live `DATABASE_URL` formats, and
> break-glass steps live in **`madfam-org/internal-devops`**
> (`runbooks/dhanam-catalog-sync-prod.md`). Do not copy production credentials
> into this public repository.

## When to run

Run after a merged change to `catalog.yaml` when Stripe prices and the
production Dhanam DB must be reconciled. Idempotent; safe to re-run.

Production serves `GET /v1/billing/catalog` from the **database catalog**
(`DHANAM_PUBLIC_CATALOG_SOURCE=db`). Checkout price resolution also reads the
DB. A catalog merge is not complete until `sync-catalog.ts` has run and
`pnpm catalog:drift -- --json` returns `"ok": true`.

## Prerequisites (Enclii-first)

1. Confirm production migrations are applied (`pnpm --filter @dhanam/api db:migrate:deploy`).
2. Configure GitHub **Settings → Environments → Production** secrets (from Enclii Lockbox):
   - `DATABASE_URL` (prod Postgres)
   - `STRIPE_SECRET_KEY` (USD)
   - `STRIPE_MX_SECRET_KEY` (Mexico)
3. Repo secret `NPM_MADFAM_TOKEN` must remain available for workflow installs.

## GitHub Actions (preferred)

1. **Sync production catalog** workflow — `dry_run=true` first, review logs.
2. Re-run with `dry_run=false` and an audit `reason`.
3. Workflow runs `pnpm catalog:drift -- --json` after live sync.

## Local fallback

```bash
cd apps/api
# Load DATABASE_URL + Stripe keys from Enclii Lockbox / Vault first.
pnpm exec tsx ../../scripts/sync-catalog.ts --dry-run
pnpm exec tsx ../../scripts/sync-catalog.ts
cd ../..
pnpm catalog:drift -- --json
```

## Monitoring

- **Production catalog drift** workflow runs weekly (Mondays 12:00 UTC) and on
  `workflow_dispatch`. It compares `catalog.yaml` to the live API without secrets.
- After **Promote staging → prod**, the promotion workflow runs an informational
  drift check. Drift after promote usually means catalog sync is still pending.

## Private runbook

For the full procedure (Vault `kv get`, digest verification, rollback), see
**internal-devops** `runbooks/dhanam-catalog-sync-prod.md`.

See also [Catalog Truth 2026-05-20](../docs/CATALOG_TRUTH_2026-05-20.md) and
[Public Repo Security Remediation](../docs/PUBLIC_REPO_SECURITY_REMEDIATION.md).
