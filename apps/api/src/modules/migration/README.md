# Migration Module

Last updated: 2026-05-23

**Library-only** import mappers and clients — not a registered NestJS HTTP
module. Used by scripts, admin flows, or future import jobs to migrate external
data into Dhanam spaces.

## Related docs

- [Module index](../README.md)
- [Full Remediation Plan](../../../../docs/FULL_REMEDIATION_PLAN_G4_AND_OPERATOR_SLICE.md) (operator slice)
- Product note: LunchMoney import is idempotent per API token (see root README)

## Subpackages

| Path          | Purpose                                                         |
| ------------- | --------------------------------------------------------------- |
| `lunchmoney/` | LunchMoney API client, type definitions, ID map, entity mappers |
| `madfam-csv/` | MADFAM CSV row types, routing config, prod continuity helpers   |

## LunchMoney client

| File                   | Role                                                    |
| ---------------------- | ------------------------------------------------------- |
| `lunchmoney-client.ts` | HTTP client (`https://dev.lunchmoney.app`)              |
| `lunchmoney-mapper.ts` | Map LM accounts/assets/crypto/recurring → Dhanam schema |
| `lunchmoney-types.ts`  | API response types                                      |
| `id-map.ts`            | Stable LM id → Dhanam UUID mapping                      |

## MADFAM CSV

| File                        | Role                                                         |
| --------------------------- | ------------------------------------------------------------ |
| `madfam-csv-config.ts`      | Env-based RFC, space keys, suffixes                          |
| `madfam-csv-mapper.ts`      | Map CSV rows to accounts/transactions                        |
| `madfam-import-compat.ts`   | Prod continuity: discover spaces, preflight, budget backfill |
| `madfam-platform-config.ts` | Hydrate import env from `platform_config` when enabled       |
| `madfam-csv-types.ts`       | Row and mapping types                                        |

### Production continuity (`app.dhan.am`)

Existing operator data (Janua admin account + `madfam-csv-*` accounts) must not
be duplicated on re-import:

1. Set `TARGET_USER_EMAIL` to the operator account email from Vault (not in git).
2. Set `MADFAM_BUSINESS_RFC` from Vault or `platform_config` (`madfam.import.*`).
3. **Omit** `MADFAM_SPACE_NAME_*` when prod already has import accounts — spaces
   are auto-discovered from `providerAccountId` patterns (`-afac` partner,
   `-personal`, unsuffixed business).
4. Partner suffix defaults to `-afac` (matches first prod import).
5. Preflight: `pnpm --filter @dhanam/api tsx scripts/verify-madfam-import-compat.ts`
6. Operator env template: `apps/api/scripts/madfam-import.env.example`

**Platform config (optional):** set `PLATFORM_CONFIG_SOURCE=db` to load
`madfam.import.*` keys from the `platform_config` table (env vars override).
Admin API: `GET/PATCH /v1/admin/platform-config/madfam-import`.  
Admin UI: `https://admin.dhan.am/madfam-import` (after admin deploy).

**Production bootstrap (kubectl):**

```bash
cd apps/api
export TARGET_USER_EMAIL=<operator-email-from-vault>
bash scripts/bootstrap-madfam-prod-env.sh      # writes madfam-import.local.env (gitignored)
bash scripts/run-prod-madfam-import-verify.sh  # read-only continuity check in-cluster
bash scripts/run-prod-madfam-budget-backfill.sh  # idempotent budget metadata tag (DRY_RUN=true first)
```

Scripts: `import-madfam-csv.ts`, `verify-madfam-import-compat.ts`,
`backfill-madfam-budget-metadata.ts`, `bootstrap-madfam-prod-env.sh`,
`run-prod-madfam-import-verify.sh`, `run-prod-madfam-budget-backfill.sh`,
`seed-madfam-platform-config.ts`, `run-prod-seed-madfam-platform-config.sh`

## Tests

- `lunchmoney/__tests__/lunchmoney-mapper.spec.ts`
- `madfam-csv/__tests__/madfam-csv-mapper.spec.ts`
- `madfam-csv/__tests__/madfam-import-compat.spec.ts`
- `madfam-csv/__tests__/madfam-platform-config.spec.ts`

## Environment variables

LunchMoney import flows expect a caller-supplied LunchMoney API token at runtime
(not a global env var in this library). Wire secrets through the invoking job or
admin script.

MADFAM CSV import env vars are documented in `apps/api/scripts/madfam-import.env.example`.

## HTTP surface

None in this module. Platform import settings are exposed via the Admin module:
`GET/PATCH /v1/admin/platform-config/madfam-import`.
