# Owner Capital Stack + Karafiel Operations

Last updated: 2026-06-18

Operator runbook for the **Owner–Operator Capital Stack** (RFC-6): beneficial
owner personal facilities funding a legal entity, with Karafiel compliance
orchestration and manual intervention.

**Handoff:** [SESSION_WRAP_UP_2026-06-18.md](../SESSION_WRAP_UP_2026-06-18.md) — production state + **operator-gated checklist**

**Canonical spec:** [RFC-6 Owner–Operator Capital Stack](../rfcs/owner-operator-capital-stack.md)

**Karafiel contract:** [Karafiel Capital Flow API](../rfcs/karafiel-capital-flow-contract.md)

**User guide:** [Owner–Operator Capital Stack](../guides/OWNER_OPERATOR_CAPITAL_STACK.md)

---

## Surfaces (post Phase 5)

| Surface            | URL                                                               | Purpose                                       |
| ------------------ | ----------------------------------------------------------------- | --------------------------------------------- |
| Web owner cockpit  | `https://app.dhan.am/capital-stack`                               | Metrics, account classify, journal match/send |
| Admin review queue | `https://admin.dhan.am/capital-stack`                             | Seal / void; compliance bridge audit table    |
| API (user)         | `/v1/capital-stack/*`                                             | JWT — groups, dashboard, journal, accounts    |
| API (admin)        | `/v1/admin/capital-stack/*`, `/v1/admin/compliance-bridge/events` | Review queue, bridge audit                    |
| API (Karafiel)     | `/v1/internal/compliance/capital-flow-resolved`, `/manual-action` | HMAC inbound callbacks                        |

---

## Operator-gated checklist

Engineering for RFC-6 Phases 0–5 is complete. **Do not skip gates** — especially Karafiel before detector on prod.

| Priority | Gate                                        | Owner            | Action                                                                                    |
| -------- | ------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------- |
| P0       | Janua for `aldo@madfam.io`                  | Platform / Janua | Provision SSO user. Dhanam DB user exists; login blocked until Janua account exists.      |
| P0       | Deploy phases 3–5 to prod                   | Engineering      | Merge + staging soak + promote (see session wrap-up).                                     |
| P1       | Staging Kyverno + smoke                     | Platform         | Sync `dhanam-staging`; fix web env header smoke on `staging.dhan.am`.                     |
| P1       | Karafiel `POST /v1/compliance/capital-flow` | Karafiel         | Implement companion contract; staging keys in Vault.                                      |
| P2       | Staging Karafiel proof                      | Operator         | `FEATURE_CAPITAL_STACK_KARAFIEL=true` on staging only; golden path → `compliance_sealed`. |
| P2       | Staging detector proof                      | Operator         | `FEATURE_CAPITAL_STACK_DETECTOR=true` on staging; verify hook + backfill.                 |
| P3       | Prod Karafiel flip                          | Operator         | After staging soak ≥30 min: prod flag + `KARAFIEL_API_KEY` in `dhanam-secrets`.           |
| P3       | Prod detector flip                          | Operator         | After Karafiel stable: `FEATURE_CAPITAL_STACK_DETECTOR=true` on prod.                     |
| P3       | PlatformConfig thresholds                   | Operator         | `capital_stack.auto_send_threshold`, `madfam.import.business_rfc` from Vault.             |

Full verification commands and digests: [SESSION_WRAP_UP_2026-06-18.md](../SESSION_WRAP_UP_2026-06-18.md#operator-gated-checklist).

---

## Prerequisites

- Janua accounts for beneficial owner and entity operator (separate identities).
- `KARAFIEL_API_KEY` and `KARAFIEL_API_URL` in `dhanam-secrets` (required for live Karafiel path).
- `DHANAM_WEBHOOK_SECRET` matches Karafiel's inbound callback secret (same as billing product webhooks).
- `PlatformConfig` keys for entity RFC (never commit RFC to git).

---

## Environment variables

| Variable                               | Required           | Default                          | Prod (2026-06-18) | Staging (overlay)                |
| -------------------------------------- | ------------------ | -------------------------------- | ----------------- | -------------------------------- |
| `FEATURE_CAPITAL_STACK_ENABLED`        | No                 | `false`                          | `true`            | `true`                           |
| `FEATURE_CAPITAL_STACK_KARAFIEL`       | No                 | `false`                          | `false`           | `false`                          |
| `FEATURE_CAPITAL_STACK_DETECTOR`       | No                 | `false`                          | `false`           | `true` (after phases 3–5 deploy) |
| `CAPITAL_STACK_AUTO_PROPOSE_THRESHOLD` | No                 | `0.85`                           | —                 | —                                |
| `BENEFICIAL_OWNER_EMAIL`               | Bootstrap          | —                                | Vault only        | Vault only                       |
| `OPERATOR_EMAIL`                       | Bootstrap          | —                                | Vault only        | Vault only                       |
| `MADFAM_BUSINESS_RFC`                  | Bootstrap          | —                                | Vault only        | Vault only                       |
| `KARAFIEL_API_KEY`                     | Karafiel live      | —                                | `dhanam-secrets`  | sandbox key                      |
| `KARAFIEL_API_URL`                     | Karafiel live      | `https://api.karafiel.madfam.io` | secrets           | staging URL                      |
| `DHANAM_WEBHOOK_SECRET`                | Karafiel callbacks | —                                | `dhanam-secrets`  | preview/staging secret           |

**Mock path:** When `FEATURE_CAPITAL_STACK_KARAFIEL=false`, `send-to-karafiel` records a bridge event and returns `MOCK-CAP-*`; journal moves to `manual_review`. Use admin **Seal** / **Void** until live Karafiel is enabled.

---

## Phase 0 — Prod hygiene

### 1. Verify user/space layout

```bash
export KUBECONFIG=~/.kube/config-hetzner
kubectl exec -n data deploy/postgres -c postgres -- psql -U postgres -d dhanam -c "
  SELECT u.email, s.name, us.role
  FROM user_spaces us
  JOIN users u ON u.id = us.user_id
  JOIN spaces s ON s.id = us.space_id
  WHERE u.email IN ('<owner>', '<operator>')
  ORDER BY u.email, s.name;
"
```

Expected:

- Owner: personal space + `admin` on business space.
- Operator: `owner` on business spaces only.

### 2. Classify accounts (`capitalPurpose`)

Via web cockpit **Account classification** or API:

- `owner_facility` — personal LOCs/cards funding the entity.
- `personal_life` — non-business personal accounts.
- `entity_operating` — accounts that belong in the business space.

Bulk API: `POST /v1/capital-stack/accounts/bulk-capital-purpose`.

### 3. PlatformConfig

Set via admin API or `platform_config` table (scope `org`):

```json
{
  "capital_stack.auto_send_threshold": 0.85,
  "capital_stack.manual_review_threshold": 0.5,
  "madfam.import.business_rfc": "<from-vault>"
}
```

---

## Phase 1 — Bootstrap entity group

```bash
cd apps/api
export BENEFICIAL_OWNER_EMAIL=<from-vault>
export OPERATOR_EMAIL=<from-vault>
export MADFAM_BUSINESS_RFC=<from-vault>
export BUSINESS_SPACE_NAME="Innovaciones MADFAM"
export PERSONAL_SPACE_NAME="Aldo Personal"
pnpm exec ts-node scripts/bootstrap-owner-operator-stack.ts
```

Creates:

- `Household` type `owner_operator`
- `SpaceOperatorBinding` on business space
- Links spaces to household

Dry-run: add `--dry-run`.

### Migration note (bootstrap before deploy)

If Phase 1 SQL/bootstrap runs before the API image with `20260618000000_add_capital_stack`
reaches production, `prisma migrate deploy` may fail with `type "CapitalPurpose" already exists`.
Mark the migration applied (operator break-glass):

```sql
UPDATE _prisma_migrations
SET finished_at = NOW(), logs = NULL
WHERE migration_name = '20260618000000_add_capital_stack' AND finished_at IS NULL;
```

---

## Phase 3 — Detector + backfill

| Component                            | Schedule / trigger   | Flag                             |
| ------------------------------------ | -------------------- | -------------------------------- |
| `CapitalStackTransactionHookService` | On manual txn create | `FEATURE_CAPITAL_STACK_DETECTOR` |
| `CapitalFlowBackfillJob`             | Daily 4:30 UTC       | Same flag                        |

Detection rules (S0–S2 shipped):

- Scope: `owner_facility` in `owner_operator` household.
- S1: counterparty RFC matches `SpaceOperatorBinding.taxId`.
- S2: business `entity_operating` inflow within ±3 days, 1% amount tolerance.

Confidence ≥ `CAPITAL_STACK_AUTO_PROPOSE_THRESHOLD` (default 0.85) → `proposed` or `matched` (if paired).

---

## Karafiel tandem workflow

### Automatic path (live Karafiel)

1. Detector or backfill creates journal (`proposed` / `matched`).
2. Owner **Send to Karafiel** (web) or auto-send when Karafiel flag on.
3. Dhanam → Karafiel `POST /v1/compliance/capital-flow`.
4. Karafiel → Dhanam `POST /v1/internal/compliance/capital-flow-resolved` (HMAC).
5. Journal → `compliance_sealed`.

### Mock path (prod today)

1. `FEATURE_CAPITAL_STACK_KARAFIEL=false`.
2. Send returns `MOCK-CAP-*`; journal → `manual_review`.
3. Admin **Seal** with optional `karafiel_case_id` or wait for Karafiel live.

### Manual intervention (Dhanam admin)

1. Open **Admin → Capital Stack**.
2. Review queue: **Seal** / **Void**.
3. Compliance bridge audit: recent `ComplianceBridgeEvent` rows.

### Manual intervention (Karafiel)

1. Operator opens Karafiel case `kf_cap_*`.
2. Reclassify, issue CFDI, or reject.
3. Karafiel emits `manual-action` + `capital-flow-resolved`.
4. Dhanam updates journal; bridge event records `resolution: manual`.

### Manual intervention (Dhanam web — owner)

1. Open **Capital Stack** → journal table.
2. **Match** — paste business-side transaction UUID.
3. **Send to Karafiel** — triggers outbound (mock or live per flag).

---

## Audit trail

```http
GET /v1/admin/compliance-bridge/events?correlationId=<journal_id>
GET /v1/admin/compliance-bridge/events?journalId=<journal_id>
```

Admin UI shows the latest 25 events on the Capital Stack page.

---

## Staging proof (Phase 5)

1. Confirm `FEATURE_CAPITAL_STACK_ENABLED=true` and `FEATURE_CAPITAL_STACK_DETECTOR=true` on staging API.
2. Classify at least one `owner_facility` + one `entity_operating` account in test entity group.
3. Create or import matching personal outflow + business inflow (±3 days).
4. Verify proposed/matched journal (hook or wait for 4:30 UTC backfill).
5. Enable `FEATURE_CAPITAL_STACK_KARAFIEL=true` with Karafiel staging keys.
6. Golden path: match → send → Karafiel callback → `compliance_sealed`.
7. DLQ drill (optional): Karafiel staging down → verify journal stays `compliance_pending` / manual resolve.

---

## Prod flip procedure (Karafiel + detector)

1. Complete staging proof with soak ≥30 min per RFC 0001.
2. Patch `infra/k8s/production/api-deployment.yaml`:
   - `FEATURE_CAPITAL_STACK_KARAFIEL=true`
   - (later) `FEATURE_CAPITAL_STACK_DETECTOR=true`
3. Confirm `KARAFIEL_API_KEY` + `DHANAM_WEBHOOK_SECRET` in `dhanam-secrets`.
4. Promote via `promote-to-prod.yml` or Enclii manual gate.
5. Smoke: owner JWT → `POST /v1/capital-stack/journal/:id/send-to-karafiel` → case ID **not** `MOCK-CAP-*`.
6. Monitor admin review queue volume for 48h after detector flip.

---

## Break-glass

If Enclii lacks capital-stack admin UI:

- Read-only audit: `kubectl exec` into postgres pod (document adapter gap).
- Mutations: bootstrap script or API with operator JWT only — never raw SQL
  on production without change reference.
- Promote without staging smoke: `break_glass_without_smoke=true` on `promote-to-prod.yml` (still requires 30 min digest soak unless incident override documented).

---

## Related

- [Essentials CFDI Relay](ESSENTIALS_CFDI_RELAY.md) — billing CFDI path
- [Session Wrap-Up 2026-06-18](../SESSION_WRAP_UP_2026-06-18.md)
- [Module README](../../apps/api/src/modules/capital-stack/README.md)
- [Golden E2E](../../apps/api/test/e2e/capital-stack.e2e-spec.ts)
