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

| File                   | Role                                  |
| ---------------------- | ------------------------------------- |
| `madfam-csv-mapper.ts` | Map CSV rows to accounts/transactions |
| `madfam-csv-types.ts`  | Row and mapping types                 |

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
