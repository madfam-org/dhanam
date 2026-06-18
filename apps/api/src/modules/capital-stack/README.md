# Capital Stack Module

> Owner–operator capital flows, entity groups, and Karafiel compliance bridge (RFC-6).

## Purpose

Models **beneficial owner ↔ operating entity** relationships for SMB owners who fund
their company via personal credit facilities while keeping separate ledgers.

## Key entities

| Entity           | Table                                 | Description                          |
| ---------------- | ------------------------------------- | ------------------------------------ |
| Entity group     | `households` (`type: owner_operator`) | Links personal + business spaces     |
| Operator binding | `space_operator_bindings`             | `admin@` operates, `aldo@` owns      |
| Capital purpose  | `accounts.capital_purpose`            | `personal_life`, `owner_facility`, … |
| Owner journal    | `owner_capital_journals`              | Cross-space paired flows             |
| Bridge event     | `compliance_bridge_events`            | Dhanam ↔ Karafiel audit log          |

## Feature flags

| Env                              | Default | Effect                                       |
| -------------------------------- | ------- | -------------------------------------------- |
| `FEATURE_CAPITAL_STACK_ENABLED`  | `false` | User/admin API gate — **production: `true`** |
| `FEATURE_CAPITAL_STACK_KARAFIEL` | `false` | Outbound Karafiel capital-flow               |
| `FEATURE_CAPITAL_STACK_DETECTOR` | `false` | Auto-detection on txn sync (Phase 3)         |

## API

User routes under `/v1/capital-stack/*` (JWT). Admin under `/v1/admin/capital-stack/*`.
Karafiel callbacks: `/v1/internal/compliance/*` (HMAC).

See [RFC-6](../../../docs/rfcs/owner-operator-capital-stack.md).

**Production (2026-06-18):** Module deployed; MADFAM operator bootstrap applied. Karafiel bridge stub only until Karafiel ships `POST /v1/compliance/capital-flow`.

## Bootstrap

```bash
cd apps/api
export BENEFICIAL_OWNER_EMAIL=<vault>
export OPERATOR_EMAIL=<vault>
export MADFAM_BUSINESS_RFC=<vault>
export BUSINESS_SPACE_NAME="Innovaciones MADFAM"
export PERSONAL_SPACE_NAME="Aldo Personal"
pnpm exec ts-node scripts/bootstrap-owner-operator-stack.ts
```

## Tests

```bash
pnpm test -- capital-stack
```

## Related

- [Karafiel contract](../../../docs/rfcs/karafiel-capital-flow-contract.md)
- [Ops runbook](../../../docs/runbooks/OWNER_CAPITAL_KARAFIEL_OPS.md)
- `KarafielService` — document ingest + capital-flow extension
- `WebhookDlqService` — retry pattern for Karafiel outages
