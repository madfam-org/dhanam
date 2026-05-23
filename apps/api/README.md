# Dhanam API

NestJS 11 (Fastify) backend for Dhanam — personal/business finance, provider
ingestion, billing boundary, and MADFAM ecosystem payment events.

## Quick reference

| Item              | Value                              |
| ----------------- | ---------------------------------- |
| Local URL         | `http://localhost:4010`            |
| Production URL    | `https://api.dhan.am`              |
| OpenAPI / Swagger | `http://localhost:4010/docs` (dev) |
| Health            | `GET /v1/monitoring/health`        |
| Package           | `@dhanam/api`                      |

## Documentation

| Document                                        | Use                                      |
| ----------------------------------------------- | ---------------------------------------- |
| [Module index](src/modules/README.md)           | All NestJS feature modules               |
| [Billing module](src/modules/billing/README.md) | Commercial billing and POS               |
| [E2E tests](test/e2e/README.md)                 | Journey and integration tests            |
| [Test coverage guide](TEST_COVERAGE_GUIDE.md)   | Jest, chaos, coverage                    |
| [Migrations guide](MIGRATIONS_GUIDE.md)         | Prisma migrations                        |
| [OpenAPI export](scripts/export-openapi.ts)     | `pnpm openapi:export` → Jest e2e harness |
| [API reference index](../../docs/api/README.md) | Swagger and OpenAPI                      |
| [Development guide](../../docs/DEVELOPMENT.md)  | Local setup                              |
| [Deployment guide](../../docs/DEPLOYMENT.md)    | Enclii-first deploy                      |

## Commands

```bash
pnpm --filter @dhanam/api dev          # watch mode
pnpm --filter @dhanam/api build
pnpm --filter @dhanam/api test
pnpm --filter @dhanam/api test:e2e
pnpm --filter @dhanam/api test:cov
pnpm --filter @dhanam/api openapi:export
```

Requires PostgreSQL and Redis (`pnpm dev:infra` from repo root).

## Architecture

- **Entry:** `src/main.ts`
- **Modules:** `src/modules/` — see [module index](src/modules/README.md)
- **Core:** auth, prisma, redis, crypto, logger under `src/core/`
- **Schema:** `prisma/schema.prisma`

Production auth uses Janua JWKS. See [ADR-004](../../docs/adr/004-janua-auth-integration.md).
