# Owner–Operator Capital Stack

Guide for beneficial owners who operate a legal entity through a separate service
identity while funding the business via personal credit facilities.

**Canonical spec:** [RFC-6 Owner–Operator Capital Stack](../rfcs/owner-operator-capital-stack.md)  
**Operator runbook:** [Owner Capital + Karafiel Ops](../runbooks/OWNER_CAPITAL_KARAFIEL_OPS.md)  
**Session handoff:** [SESSION_WRAP_UP_2026-06-18](../SESSION_WRAP_UP_2026-06-18.md)

---

## Concepts

| Term                  | Meaning                                                      |
| --------------------- | ------------------------------------------------------------ |
| Beneficial owner      | You (`aldo@madfam.io`) — economic owner                      |
| Entity operator       | Service identity (`admin@madfam.io`) — day-to-day entity ops |
| Owner facility        | Personal LOC/card used to fund the company                   |
| Owner capital journal | Paired entry linking personal outflow ↔ business inflow      |
| Entity group          | `owner_operator` household linking your spaces               |

---

## Access requirements (operator-gated)

| Requirement                             | Status (2026-06-18) | Who fixes it                   |
| --------------------------------------- | ------------------- | ------------------------------ |
| Dhanam user + entity group bootstrap    | Done                | —                              |
| Janua SSO for `aldo@madfam.io`          | **Blocked**         | Platform / Janua               |
| `FEATURE_CAPITAL_STACK_ENABLED` on prod | Done                | —                              |
| Karafiel live compliance                | **Mock only**       | Karafiel + operator flag flip  |
| Auto-detection on prod                  | **Off**             | Operator enables detector flag |

You need a working **Janua login** before the web cockpit is usable. Until then, platform operators can manage journals via **Admin → Capital Stack**.

---

## Web app

**URL:** `https://app.dhan.am/capital-stack` (sidebar: **Capital Stack**)

| Section                | What you do                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------- |
| Metrics                | Unreconciled flows, owner-facility account count, journal totals                        |
| Account classification | Tag each account: `personal_life`, `owner_facility`, `entity_operating`, `equity_stake` |
| Capital journal        | Review entries; **Match** business transaction; **Send to Karafiel**                    |

### Daily workflow

1. Transactions on `owner_facility` accounts are auto-detected when the **detector flag** is on (staging today; prod pending operator flip).
2. Review **proposed** journal entries in the journal table.
3. **Match** — paste the business-side transaction ID if not auto-paired.
4. **Send to Karafiel** — compliance registration (live or mock depending on environment).
5. After Karafiel seals the flow, status becomes **Sealed** (`compliance_sealed`).

### Journal statuses

| Status               | Meaning                                |
| -------------------- | -------------------------------------- |
| `draft`              | Low-confidence detection; needs review |
| `proposed`           | Ready to match or send                 |
| `matched`            | Linked to business transaction         |
| `compliance_pending` | With Karafiel                          |
| `compliance_sealed`  | Compliance complete                    |
| `manual_review`      | Operator or mock Karafiel path         |
| `void`               | Cancelled                              |

---

## Karafiel

Material flows are registered with Karafiel for SAT/compliance treatment.

- **Today (prod):** Karafiel auto-send is **off** — send creates a mock case and routes to manual review.
- **After operator flip:** Live `kf_cap_*` cases; callbacks update status automatically.

See [Karafiel contract](../rfcs/karafiel-capital-flow-contract.md).

---

## API quick reference

| Method | Path                                              | Purpose                     |
| ------ | ------------------------------------------------- | --------------------------- |
| GET    | `/v1/capital-stack/groups`                        | Your entity groups          |
| GET    | `/v1/capital-stack/groups/:id/dashboard`          | Owner cockpit metrics       |
| GET    | `/v1/capital-stack/groups/:id/accounts`           | Accounts + `capitalPurpose` |
| GET    | `/v1/capital-stack/journal`                       | Journal list                |
| POST   | `/v1/capital-stack/journal`                       | Manual entry                |
| POST   | `/v1/capital-stack/journal/:id/match`             | Link business transaction   |
| POST   | `/v1/capital-stack/journal/:id/send-to-karafiel`  | Compliance registration     |
| POST   | `/v1/capital-stack/accounts/bulk-capital-purpose` | Bulk classify               |
| PATCH  | `/v1/capital-stack/accounts/:id/capital-purpose`  | Single account classify     |

All routes require JWT and `FEATURE_CAPITAL_STACK_ENABLED=true`.

---

## For platform operators

See the numbered checklist in [SESSION_WRAP_UP_2026-06-18](../SESSION_WRAP_UP_2026-06-18.md#operator-gated-checklist) and the full runbook [OWNER_CAPITAL_KARAFIEL_OPS.md](../runbooks/OWNER_CAPITAL_KARAFIEL_OPS.md).
