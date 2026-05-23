# API Reference Index

Last updated: 2026-05-22

## Source of truth

| Source                     | Use                                                                    |
| -------------------------- | ---------------------------------------------------------------------- |
| **Swagger UI (dev)**       | `http://localhost:4010/docs` when API runs locally                     |
| **Generated OpenAPI JSON** | `docs/api/openapi.json` — run export script below                      |
| **[API.md](../API.md)**    | Narrative overview and examples (may drift; prefer Swagger)            |
| **Module READMEs**         | [apps/api/src/modules/README.md](../../apps/api/src/modules/README.md) |

Production does not expose Swagger by default (`NODE_ENV=production` in
`main.ts`). Use the export script or staging with non-production env for schema
generation.

## Export OpenAPI JSON

Prerequisites: PostgreSQL + Redis running, migrations applied.

```bash
pnpm dev:infra
pnpm db:push   # or db:migrate:dev
pnpm --filter @dhanam/api openapi:export
```

The export script boots the API through the Jest e2e harness (`test/e2e/openapi-export.e2e-spec.ts`)
so Nest decorator metadata is preserved. If local Postgres already binds port `5432`, use
`DATABASE_URL=postgresql://dhanam:localdev@localhost:5433/dhanam` with Docker mapped to `5433`,
or stop the conflicting service.

Output: `docs/api/openapi.json` (generated; listed in `.gitignore`).

## Specialized references

| Document                                                                         | Topic                           |
| -------------------------------------------------------------------------------- | ------------------------------- |
| [Transaction execution API](transaction-execution-api.md)                        | Transaction execution endpoints |
| [Billing module README](../../apps/api/src/modules/billing/README.md)            | Billing, POS, webhooks          |
| [Referral module README](../../apps/api/src/modules/referral/README.md)          | Referral rewards                |
| [Webhook outbound README](../../apps/api/src/modules/webhook-outbound/README.md) | Svix endpoint registry          |

## Base URLs

| Environment | Base URL                         |
| ----------- | -------------------------------- |
| Production  | `https://api.dhan.am/v1`         |
| Staging     | `https://staging-api.dhan.am/v1` |
| Local       | `http://localhost:4010/v1`       |

## Health

| Endpoint                    | Purpose                |
| --------------------------- | ---------------------- |
| `GET /v1/monitoring/health` | Full production health |
| `GET /health`               | Liveness               |

See [Deployment Guide](../DEPLOYMENT.md) for operational checks.
