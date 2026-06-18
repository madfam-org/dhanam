# RFC-6: Owner–Operator Capital Stack

**Status:** Accepted — **Phase 1 shipped** (2026-06-18); Phases 2–5 in backlog
**Date:** 2026-06-18
**Authors:** Engineering
**Stakeholders:** Platform, MADFAM operator slice, Karafiel, Compliance, Admin

## Summary

Dhanam today separates personal and business finances via **Spaces**, but has no
first-class model for **beneficial owner ↔ operating entity** relationships,
**personal credit facilities funding a company**, or **cross-space capital
journals** with Karafiel compliance orchestration.

This RFC introduces the **Capital Stack**: a platform primitive for
owner-operators (starting with Innovaciones MADFAM / Aldo Ruiz Luna) where:

- Personal liability instruments stay in the owner's personal space.
- The legal entity operates in a distinct business space (service identity).
- Capital flows between them are **paired, auditable journal entries**.
- Karafiel classifies, seals, and issues CFDI where required, with a **manual
  intervention lane** when automation is uncertain.

Companion contract: [Karafiel Capital Flow API](karafiel-capital-flow-contract.md).

Operator runbook: [Owner Capital + Karafiel Ops](../runbooks/OWNER_CAPITAL_KARAFIEL_OPS.md).

## Problem

### Reference customer (MADFAM operator)

| Role             | Identity          | Spaces                                        |
| ---------------- | ----------------- | --------------------------------------------- |
| Beneficial owner | `aldo@madfam.io`  | `Aldo Personal` (personal LOC + life)         |
| Entity operator  | `admin@madfam.io` | `Innovaciones MADFAM`, `MADFAM Operations`, … |

Personal lines of credit fund Innovaciones MADFAM operations. The owner needs:

1. A personal book (life + owner facilities).
2. Visibility into entity performance without commingling ledgers.
3. Tracked capital contributions / shareholder loans with running balances.
4. Karafiel compliance on material flows, with operator override.

### Gaps in current product

| Gap                                             | Impact                                         |
| ----------------------------------------------- | ---------------------------------------------- |
| No `owner_operator` household type              | Couple/family model forced for business owners |
| No cross-space journal                          | LOC→entity flows reconciled manually           |
| `Account.ownerId` mostly unset on imports       | Yours/Mine/Ours ineffective                    |
| Karafiel integration = documents + billing only | Ledger capital flows not compliance-aware      |
| No manual Dhanam↔Karafiel case sync             | Operators lack tandem workflow                 |

## Goals

1. **First-class capital stack** in API, schema, and UI.
2. **Intelligent detection** of owner-facility → entity flows.
3. **Karafiel bridge** with auto + manual paths and full audit.
4. **Innovaciones MADFAM bootstrap** from `PlatformConfig` (no hardcoded emails in git).

## Non-goals (v1)

- Full Mexican GAAP / NIF ERP double-entry.
- Moving personal LOCs into business spaces.
- Replacing Karafiel as CFDI authority.
- Multi-stakeholder cap tables (future `partnership` extension).

## Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│ Entity Group (Household type: owner_operator)                   │
│  beneficialOwnerUserId → aldo@madfam.io                           │
│  spaces: Aldo Personal (personal) + Innovaciones MADFAM (biz)   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        ▼                                       ▼
┌───────────────────┐                 ┌───────────────────────┐
│ Aldo Personal     │                 │ Innovaciones MADFAM   │
│ capitalPurpose:   │  Owner Capital  │ SpaceOperatorBinding: │
│  owner_facility   │  Journal (pair) │  operator = admin@    │
│  personal_life    │◄───────────────►│  owner = aldo@        │
└─────────┬─────────┘                 └───────────┬───────────┘
          │                                       │
          └──────────────┬────────────────────────┘
                         ▼
              ┌─────────────────────┐
              │ Karafiel bridge     │
              │ detect → classify   │
              │ seal / CFDI / queue │
              └─────────────────────┘
```

## Domain model

### `HouseholdType.owner_operator`

Extends `Household` with optional `beneficialOwnerUserId`. Entity groups link
personal + business spaces via existing `Space.householdId`.

### `SpaceOperatorBinding`

Per business space:

| Field                   | Description                             |
| ----------------------- | --------------------------------------- |
| `operatorUserId`        | Day-to-day identity (`admin@madfam.io`) |
| `beneficialOwnerUserId` | Economic owner (`aldo@madfam.io`)       |
| `legalName`             | e.g. Innovaciones MADFAM S.A.S. de C.V. |
| `taxId`                 | RFC (from PlatformConfig, not git)      |
| `ownershipPercent`      | Default 100                             |

### `Account.capitalPurpose`

| Value              | Use                                    |
| ------------------ | -------------------------------------- |
| `personal_life`    | Day-to-day personal                    |
| `owner_facility`   | Personal LOC/card funding the business |
| `entity_operating` | True company cash/liability            |
| `equity_stake`     | Manual asset link only                 |

### `OwnerCapitalJournal`

Cross-space paired flow with status machine:

`draft` → `proposed` → `matched` → `compliance_pending` → `compliance_sealed`

Branches: `manual_review`, `void`.

Flow types: `capital_contribution`, `shareholder_loan`, `loan_repayment`,
`owner_draw`, `distribution`.

### `ComplianceBridgeEvent`

Audit spine for every Dhanam↔Karafiel message (direction, correlation id,
resolution: `auto` | `manual` | `skipped`).

## Detection pipeline

| Stage | Rule                                                                    |
| ----- | ----------------------------------------------------------------------- |
| S0    | Scope: `owner_facility` or `entity_operating` in `owner_operator` group |
| S1    | Counterparty RFC matches `SpaceOperatorBinding.taxId`                   |
| S2    | Personal outflow + business inflow within ±3 days, amount tolerance     |
| S3    | Category / transaction rules                                            |
| S4    | Linked `ComplianceRecord` boosts confidence                             |
| S5    | Karafiel policy API                                                     |

| Confidence | Action                  |
| ---------- | ----------------------- |
| ≥ 0.85     | Auto journal + Karafiel |
| 0.50–0.84  | `proposed` journal      |
| < 0.50     | Inbox suggestion only   |

## API surface

Module: `apps/api/src/modules/capital-stack/`

### User (`JwtAuthGuard`)

| Method | Path                                             |
| ------ | ------------------------------------------------ |
| GET    | `/v1/capital-stack/groups`                       |
| GET    | `/v1/capital-stack/groups/:id/dashboard`         |
| GET    | `/v1/capital-stack/journal`                      |
| POST   | `/v1/capital-stack/journal`                      |
| POST   | `/v1/capital-stack/journal/:id/match`            |
| POST   | `/v1/capital-stack/journal/:id/send-to-karafiel` |
| PATCH  | `/v1/capital-stack/accounts/:id/capital-purpose` |

### Admin

| Method | Path                                          |
| ------ | --------------------------------------------- |
| GET    | `/v1/admin/capital-stack/review-queue`        |
| POST   | `/v1/admin/capital-stack/journal/:id/resolve` |
| GET    | `/v1/admin/compliance-bridge/events`          |

### Internal (Karafiel HMAC)

| Method | Path                                            |
| ------ | ----------------------------------------------- |
| POST   | `/v1/internal/compliance/capital-flow-resolved` |
| POST   | `/v1/internal/compliance/manual-action`         |

## Karafiel integration

Reuses:

- `KarafielService` (extend with `registerCapitalFlow`)
- `DHANAM_WEBHOOK_SECRET` / `X-Dhanam-Signature`
- `WebhookDlqService` retry pattern
- `ComplianceRecord` for document provenance

New outbound: `POST /v1/compliance/capital-flow` (see companion RFC).

Feature flag: `FEATURE_CAPITAL_STACK_KARAFIEL` (default `false`).

## PlatformConfig keys

| Key                                         | Scope | Purpose                                      |
| ------------------------------------------- | ----- | -------------------------------------------- |
| `capital_stack.auto_send_threshold`         | org   | Karafiel auto-send confidence (default 0.85) |
| `capital_stack.manual_review_threshold`     | org   | Proposed journal threshold (default 0.50)    |
| `capital_stack.flow_types_requiring_review` | org   | JSON array of flow types                     |
| `madfam.import.business_rfc`                | org   | Entity RFC (existing)                        |

Bootstrap script: `apps/api/scripts/bootstrap-owner-operator-stack.ts` (requires
env emails from Vault — never hardcoded).

## Phased delivery

| Phase | Scope                                                                   | Status (2026-06-18)                                  |
| ----- | ----------------------------------------------------------------------- | ---------------------------------------------------- |
| **0** | Prod hygiene: account classify, remove duplicate space, Janua for aldo@ | **Mostly done** — Janua for `aldo@madfam.io` pending |
| **1** | Schema, module skeleton, CRUD journal, capitalPurpose                   | **Shipped** — prod API + DB bootstrap                |
| **2** | Dashboard, match/mirror, account migration tool                         | Planned                                              |
| **3** | Detector + backfill job                                                 | Planned                                              |
| **4** | Karafiel bridge + admin review queue                                    | Stub shipped; Karafiel receiver pending              |
| **5** | E2E, runbook, staging proof, GA flag                                    | Partial — runbook + unit tests                       |

## Testing

| Layer       | Focus                                                |
| ----------- | ---------------------------------------------------- |
| Unit        | Journal status machine, balance math, detector rules |
| Integration | Cross-space match, Karafiel mock callback            |
| Contract    | Capital-flow envelope ↔ Karafiel schema              |
| E2E         | Owner contribution → proposed → sealed               |
| Ops         | DLQ drill when Karafiel unavailable                  |

Golden scenario: personal LOC outflow → proposed journal → business inflow match
→ Karafiel seal → `compliance_sealed`.

## Security

- No RFCs, emails, or credentials in git-tracked config.
- `TARGET_USER_EMAIL` / `BENEFICIAL_OWNER_EMAIL` from operator env only.
- Internal Karafiel callbacks: HMAC + replay window (5 min, billing parity).
- All manual resolutions audited via `ComplianceBridgeEvent` + `AuditService`.

## Related

- [Karafiel Capital Flow Contract](karafiel-capital-flow-contract.md)
- [Owner Capital Karafiel Ops Runbook](../runbooks/OWNER_CAPITAL_KARAFIEL_OPS.md)
- [Cross-Service Event Bus](cross-service-event-bus.md) — outbox for `capital_flow.*`
- [Full Remediation Plan](../FULL_REMEDIATION_PLAN_G4_AND_OPERATOR_SLICE.md)
- Module README: `apps/api/src/modules/capital-stack/README.md`
