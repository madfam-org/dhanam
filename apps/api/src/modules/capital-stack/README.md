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

**Phase 2 (2026-06-18):** Owner cockpit UI at `apps/web/src/app/(dashboard)/capital-stack/page.tsx` — lists entity groups, dashboard metrics, journal table, account classification. Sidebar nav + i18n (`capitalStack` namespace).

**Phase 3 (2026-06-18):** `CapitalStackTransactionHookService` + `CapitalFlowBackfillJob` (daily 4:30 UTC). S2 amount-window pairing in detector. Enable with `FEATURE_CAPITAL_STACK_DETECTOR=true`.

**Phase 4 (2026-06-18):** Karafiel bridge sends full transaction payloads; idempotent resend; internal HMAC callbacks. Admin review queue + compliance bridge audit at `apps/admin/.../capital-stack/page.tsx`. Web journal match + send-to-Karafiel actions.

**Phase 5 (2026-06-18):** Golden journey E2E `apps/api/test/e2e/capital-stack.e2e-spec.ts`. Staging enables detector flag in `infra/k8s/overlays/staging/env-patch-api.yaml`.

## Operator-gated checklist

Engineering complete — see [SESSION_WRAP_UP](../../../docs/SESSION_WRAP_UP_2026-06-18.md#operator-gated-checklist) for the numbered gate table.

| Gate                             | Prod today                  | Flip when                     |
| -------------------------------- | --------------------------- | ----------------------------- |
| Janua `aldo@madfam.io`           | Blocked                     | Platform provisions SSO       |
| `FEATURE_CAPITAL_STACK_KARAFIEL` | `false` (mock `MOCK-CAP-*`) | Karafiel staging proof passes |
| `FEATURE_CAPITAL_STACK_DETECTOR` | `false`                     | After Karafiel stable on prod |
| PlatformConfig thresholds        | Operator sets in Vault      | Before tuning auto-send       |

Full runbook: [OWNER_CAPITAL_KARAFIEL_OPS.md](../../../docs/runbooks/OWNER_CAPITAL_KARAFIEL_OPS.md).

## Surfaces

| App       | Path                                                              |
| --------- | ----------------------------------------------------------------- |
| Web       | `/capital-stack` — cockpit, classify, match, send                 |
| Admin     | `/capital-stack` — review queue + bridge audit                    |
| API user  | `/v1/capital-stack/*`                                             |
| API admin | `/v1/admin/capital-stack/*`, `/v1/admin/compliance-bridge/events` |
| Internal  | `/v1/internal/compliance/*` (Karafiel HMAC)                       |

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
