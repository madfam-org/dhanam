# Owner–Operator Capital Stack

Guide for beneficial owners who operate a legal entity through a separate service
identity while funding the business via personal credit facilities.

**Canonical spec:** [RFC-6 Owner–Operator Capital Stack](../rfcs/owner-operator-capital-stack.md)

## Concepts

| Term                  | Meaning                                                      |
| --------------------- | ------------------------------------------------------------ |
| Beneficial owner      | You (`aldo@madfam.io`) — economic owner                      |
| Entity operator       | Service identity (`admin@madfam.io`) — day-to-day entity ops |
| Owner facility        | Personal LOC/card used to fund the company                   |
| Owner capital journal | Paired entry linking personal outflow ↔ business inflow      |
| Entity group          | `owner_operator` household linking your spaces               |

## Setup

1. Classify accounts: `personal_life`, `owner_facility`, or `entity_operating`.
2. Run bootstrap script (operator): see [module README](../../apps/api/src/modules/capital-stack/README.md).
3. Enable `FEATURE_CAPITAL_STACK_ENABLED=true` when API is deployed.

## Daily workflow

1. Transactions on `owner_facility` accounts are auto-detected (Phase 3).
2. Review **proposed** journal entries in the Owner Dashboard.
3. **Match** to business-side deposits when detected.
4. **Send to Karafiel** for compliance seal / CFDI when required.
5. Resolve manual review items in Dhanam or Karafiel (synced both ways).

## Karafiel

Material flows are registered with Karafiel for SAT/compliance treatment.
See [Karafiel contract](../rfcs/karafiel-capital-flow-contract.md) and
[ops runbook](../runbooks/OWNER_CAPITAL_KARAFIEL_OPS.md).

## API quick reference

- `GET /v1/capital-stack/groups` — your entity groups
- `GET /v1/capital-stack/groups/:id/dashboard` — owner cockpit
- `GET /v1/capital-stack/journal` — capital journal list
- `POST /v1/capital-stack/journal` — manual entry
- `PATCH /v1/capital-stack/accounts/:id/capital-purpose` — classify account
