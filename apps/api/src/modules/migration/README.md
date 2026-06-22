# Migration Module

Last updated: 2026-06-22

NestJS module for competitor → Dhanam platform imports. **PM-1 (LunchMoney)** shipped
behind `FEATURE_LUNCHMONEY_IMPORT` (default `false`).

## HTTP API

JWT-scoped routes under `/v1/spaces/:spaceId/migration/`:

| Method | Path                   | Purpose                             |
| ------ | ---------------------- | ----------------------------------- |
| GET    | `status`               | Feature flags (`lunchMoney`, `csv`) |
| POST   | `lunchmoney/preflight` | Read-only LM counts                 |
| POST   | `lunchmoney/start`     | Enqueue async import                |
| GET    | `jobs`                 | Recent jobs for space               |
| GET    | `jobs/:jobId`          | Job status + summary                |

## Architecture

- `PlatformImportService` — credentials, audit, job lifecycle
- `platform-import` BullMQ queue — async worker in `jobs/platform-import.processor.ts`
- `LunchMoneyImportRunner` — shared engine for API + operator CLI
- Encrypted LM tokens cleared after successful import

## Related docs

- [Platform Migration Roadmap](../../../../docs/PLATFORM_MIGRATION_ROADMAP.md) (PM-1–PM-4)
- [Module index](../README.md)
- Operator CLI: `apps/api/scripts/migrate-lunchmoney.ts` (white-glove fallback)

## Subpackages

| Path          | Purpose                                                       |
| ------------- | ------------------------------------------------------------- |
| `lunchmoney/` | LunchMoney API client, runner, mappers, ID map                |
| `madfam-csv/` | MADFAM CSV row types, routing config, prod continuity helpers |

## Operator CLI (white-glove)

```bash
cd apps/api
LUNCHMONEY_API_TOKEN=... TARGET_USER_EMAIL=... pnpm tsx scripts/migrate-lunchmoney.ts
```

Optional: `TARGET_SPACE_ID`, `START_DATE`, `DRY_RUN=true`, `LUNCHMONEY_BUDGET_LABEL`.
