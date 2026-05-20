# Development Guide

Last updated: 2026-05-19

This guide describes the current local developer workflow for the Dhanam
monorepo.

## Prerequisites

- Node.js 20 or newer
- pnpm 9.15.0, matching `packageManager` in the root `package.json`
- Docker with Docker Compose
- Git

Optional tools:

- PostgreSQL client (`psql`) for local DB inspection
- Redis CLI for local queue/cache inspection
- Playwright browsers via `pnpm --dir apps/web exec playwright install`

## Local Ports

| Service     | Local URL                                      |
| ----------- | ---------------------------------------------- |
| API         | `http://localhost:4010`                        |
| API v1      | `http://localhost:4010/v1`                     |
| API Swagger | `http://localhost:4010/docs` in non-production |
| Web app     | `http://localhost:3040`                        |
| Admin app   | `http://localhost:3400`                        |
| Postgres    | `localhost:5432`                               |
| Redis       | `localhost:6379`                               |
| Mailhog     | `http://localhost:8025`                        |

Production domains use `dhan.am`:

- Web app: `https://app.dhan.am`
- Landing page: `https://dhan.am`
- Admin: `https://admin.dhan.am`
- API: `https://api.dhan.am`

## Registry Setup

Dhanam uses MADFAM's private npm registry for internal packages. Configure
`.npmrc` or your user-level npm config before installing dependencies:

```bash
@madfam:registry=https://npm.madfam.io
@dhanam:registry=https://npm.madfam.io
@janua:registry=https://npm.madfam.io
//npm.madfam.io/:_authToken=${NPM_MADFAM_TOKEN}
```

## Environment Files

Copy the example files, then replace secrets with local development values:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/admin/.env.example apps/admin/.env.local
```

Important local defaults:

- `apps/api/.env`: set `PORT=4010`, `WEB_URL=http://localhost:3040`, and
  `API_URL=http://localhost:4010/v1`.
- `apps/web/.env.local`: set `NEXT_PUBLIC_API_URL=http://localhost:4010/v1`
  and `NEXT_PUBLIC_BASE_URL=http://localhost:3040`.
- `apps/admin/.env.local`: set `NEXT_PUBLIC_API_URL=http://localhost:4010/v1`
  and `NEXT_PUBLIC_APP_URL=http://localhost:3040`.

Seed scripts require explicit passwords:

- `DEMO_USER_PASSWORD`
- `ADMIN_PASSWORD`
- `MADFAM_ADMIN_PASSWORD` for the MADFAM internal finance seed

## Install And Bootstrap

```bash
pnpm install
pnpm dev:infra
pnpm db:generate
pnpm db:migrate:dev
pnpm db:seed
```

`pnpm dev:infra` starts the Compose file at
`infra/docker/docker-compose.yml`, which currently includes Postgres, Redis,
and Mailhog.

## Run Apps

From the repo root:

```bash
pnpm dev
```

Or run a single app:

```bash
pnpm dev:api
pnpm dev:web
pnpm dev:admin
pnpm dev:mobile
```

Equivalent filtered commands:

```bash
pnpm --filter @dhanam/api dev
pnpm --filter @dhanam/web dev
pnpm --filter @dhanam/admin dev
pnpm --filter @dhanam/mobile dev
```

## Build

```bash
pnpm build:packages
pnpm --filter @dhanam/api build
pnpm --filter @dhanam/web build
pnpm --filter @dhanam/admin build
pnpm build
```

Next.js builds require the public env vars used at build time. For local CI-like
builds, set at least:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4010/v1
NEXT_PUBLIC_BASE_URL=http://localhost:3040
NEXT_PUBLIC_ADMIN_URL=http://localhost:3400
NEXT_PUBLIC_POSTHOG_HOST=https://analytics.madfam.io
NEXT_PUBLIC_SENTRY_DSN=https://public@example.com/1
```

## Test And Check

Common repo checks:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm lint:file-sizes
```

Focused app checks:

```bash
pnpm --filter @dhanam/api typecheck
pnpm --filter @dhanam/api test
pnpm --filter @dhanam/api test:cov
pnpm --filter @dhanam/api test:chaos

pnpm --filter @dhanam/web typecheck
pnpm --dir apps/web test -- --runInBand

pnpm --filter @dhanam/admin typecheck
pnpm --dir apps/admin test -- --runInBand
```

Playwright checks require app servers and, for API-backed journeys, local
Postgres and Redis:

```bash
pnpm --dir apps/web exec playwright test --project=chromium
pnpm --dir apps/admin exec playwright test --project=chromium
```

Visual regression is opt-in:

```bash
RUN_VISUAL_REGRESSION=true pnpm --dir apps/web exec playwright test e2e/visual-regression.spec.ts
```

## Database

```bash
pnpm db:generate
pnpm db:migrate:dev
pnpm db:migrate:deploy
pnpm db:migrate:status
pnpm db:seed
pnpm db:studio
```

Local Compose Postgres uses:

```text
postgresql://dhanam:localdev@localhost:5432/dhanam
```

Use a database with `test` in the name for destructive integration/e2e tests.

## Debugging

Check local infra:

```bash
docker compose -f infra/docker/docker-compose.yml ps
docker compose -f infra/docker/docker-compose.yml logs postgres
docker compose -f infra/docker/docker-compose.yml logs redis
```

Inspect ports:

```bash
lsof -i :4010
lsof -i :3040
lsof -i :3400
```

Reset local infra:

```bash
pnpm dev:infra:down
pnpm dev:infra
```

## Production Operations

Routine production operations are Enclii-first. Use Enclii web, API, or CLI for
deployment, observability, domains, secrets, scaling, rollback, and remediation.
Raw Kubernetes, Helm, SSH, provider CLIs, `docker exec`, and direct container
access are for bootstrap or documented break-glass only.

Start with:

```bash
enclii ps dhanam-api --env production
enclii logs dhanam-api --env production --since 1h
enclii releases dhanam-api --latest --output json
```

See [Deployment Guide](DEPLOYMENT.md) and
[Stability Audit 2026-05-19](STABILITY_AUDIT_2026-05-19.md) before changing
production.

## Documentation

Use [docs/README.md](README.md) as the canonical documentation map. When adding
durable docs, link them there and mark historical/session-specific reports as
historical if they should not be treated as current operational truth.
