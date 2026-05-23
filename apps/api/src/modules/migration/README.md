# Migration Module

Last updated: 2026-05-22

**Library-only** import mappers and clients — not a registered NestJS HTTP
module. Used by scripts, admin flows, or future import jobs to migrate external
data into Dhanam spaces.

## Related docs

- [Module index](../README.md)
- Product note: LunchMoney import is idempotent per API token (see root README)

## Subpackages

| Path          | Purpose                                                         |
| ------------- | --------------------------------------------------------------- |
| `lunchmoney/` | LunchMoney API client, type definitions, ID map, entity mappers |
| `madfam-csv/` | MADFAM CSV row types and account/transaction mappers            |

## LunchMoney client

| File                   | Role                                                    |
| ---------------------- | ------------------------------------------------------- |
| `lunchmoney-client.ts` | HTTP client (`https://dev.lunchmoney.app`)              |
| `lunchmoney-mapper.ts` | Map LM accounts/assets/crypto/recurring → Dhanam schema |
| `lunchmoney-types.ts`  | API response types                                      |
| `id-map.ts`            | Stable LM id → Dhanam UUID mapping                      |

## MADFAM CSV

| File                      | Role                                        |
| ------------------------- | ------------------------------------------- |
| `madfam-csv-config.ts`    | Env-based RFC, space keys, suffixes         |
| `madfam-csv-mapper.ts`    | Map CSV rows to accounts/transactions       |
| `madfam-import-compat.ts` | Prod continuity: discover spaces, preflight |
| `madfam-csv-types.ts`     | Row and mapping types                       |

### Production continuity (`app.dhan.am`)

Existing operator data (Janua admin account + `madfam-csv-*` accounts) must not
be duplicated on re-import:

1. Set `TARGET_USER_EMAIL` to the operator account email from Vault (not in git).
2. Set `MADFAM_BUSINESS_RFC` from Vault.
3. **Omit** `MADFAM_SPACE_NAME_*` when prod already has import accounts — spaces
   are auto-discovered from `providerAccountId` patterns (`-afac` partner,
   `-personal`, unsuffixed business).
4. Partner suffix defaults to `-afac` (matches first prod import).
5. Preflight: `pnpm --filter @dhanam/api tsx scripts/verify-madfam-import-compat.ts`
6. Operator env template: `apps/api/scripts/madfam-import.env.example`

**Production bootstrap (kubectl):**

```bash
cd apps/api
bash scripts/bootstrap-madfam-prod-env.sh      # writes madfam-import.local.env (gitignored)
bash scripts/run-prod-madfam-import-verify.sh  # read-only continuity check in-cluster
```

Scripts: `apps/api/scripts/import-madfam-csv.ts`, `verify-madfam-import-compat.ts`,
`bootstrap-madfam-prod-env.sh`, `run-prod-madfam-import-verify.sh`

## Tests

- `lunchmoney/__tests__/lunchmoney-mapper.spec.ts`
- `madfam-csv/__tests__/madfam-csv-mapper.spec.ts`

## Environment variables

LunchMoney import flows expect a caller-supplied LunchMoney API token at runtime
(not a global env var in this library). Wire secrets through the invoking job or
admin script.

## HTTP surface

None today. If import endpoints are added, register a NestJS module and update
this README with routes and auth.
