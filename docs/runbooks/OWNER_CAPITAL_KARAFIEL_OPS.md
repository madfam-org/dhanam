# Owner Capital Stack + Karafiel Operations

Last updated: 2026-06-18

Operator runbook for the **Owner–Operator Capital Stack** (RFC-6): beneficial
owner personal facilities funding a legal entity, with Karafiel compliance
orchestration and manual intervention.

**Production (2026-06-18):** Phase 1 API deployed; `FEATURE_CAPITAL_STACK_ENABLED=true`.
DB bootstrap + account classification applied for Innovaciones MADFAM. Session handoff:
[SESSION_WRAP_UP_2026-06-18.md](../SESSION_WRAP_UP_2026-06-18.md).

**Canonical spec:** [RFC-6 Owner–Operator Capital Stack](../rfcs/owner-operator-capital-stack.md)

**Karafiel contract:** [Karafiel Capital Flow API](../rfcs/karafiel-capital-flow-contract.md)

## Prerequisites

- Janua accounts for beneficial owner and entity operator (separate identities).
- `KARAFIEL_API_KEY` and `KARAFIEL_API_URL` in `dhanam-secrets`.
- `DHANAM_WEBHOOK_SECRET` matches Karafiel's inbound callback secret.
- `PlatformConfig` keys for entity RFC (never commit RFC to git).

## Environment variables

| Variable                         | Required      | Description                                     |
| -------------------------------- | ------------- | ----------------------------------------------- |
| `BENEFICIAL_OWNER_EMAIL`         | Bootstrap     | Owner email from Vault                          |
| `OPERATOR_EMAIL`                 | Bootstrap     | Entity operator email from Vault                |
| `MADFAM_BUSINESS_RFC`            | Bootstrap     | Business RFC from Vault                         |
| `FEATURE_CAPITAL_STACK_ENABLED`  | No            | API module gate — **prod: `true`** (2026-06-18) |
| `FEATURE_CAPITAL_STACK_KARAFIEL` | No            | Karafiel auto-send (default `false`)            |
| `KARAFIEL_API_KEY`               | Karafiel path | Outbound compliance API                         |
| `DHANAM_WEBHOOK_SECRET`          | Karafiel path | Inbound HMAC verification                       |

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

Use API or admin script (Phase 1+):

- `owner_facility` — personal LOCs/cards funding the entity.
- `personal_life` — non-business personal accounts.
- `entity_operating` — accounts that belong in the business space.

Misplaced entity accounts: use account migration tool (Phase 2) or manual
re-import.

### 3. PlatformConfig

Set via admin API or `platform_config` table (scope `org`):

```json
{
  "capital_stack.auto_send_threshold": 0.85,
  "capital_stack.manual_review_threshold": 0.5,
  "madfam.import.business_rfc": "<from-vault>"
}
```

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

## Karafiel tandem workflow

### Automatic path

1. Transaction sync creates candidate flow (detector Phase 3).
2. Journal status `proposed` or `compliance_pending`.
3. Dhanam → Karafiel `POST /v1/compliance/capital-flow`.
4. Karafiel → Dhanam `capital-flow-resolved`.
5. Journal → `compliance_sealed`.

### Manual intervention (Dhanam)

1. Open **Admin → Capital Stack → Review queue**.
2. Inspect journal + linked transactions.
3. Actions:
   - **Match** — link personal ↔ business transactions.
   - **Send to Karafiel** — force outbound registration.
   - **Resolve out-of-band** — Karafiel handled manually; enter `karafiel_case_id` / notes.
   - **Void** — cancel journal entry.

### Manual intervention (Karafiel)

1. Operator opens Karafiel case `kf_cap_*`.
2. Reclassify, issue CFDI, or reject.
3. Karafiel emits `manual-action` + `capital-flow-resolved`.
4. Dhanam updates journal; `ComplianceBridgeEvent` records `resolution: manual`.

## Audit trail

Query compliance bridge events (admin API):

```http
GET /v1/admin/compliance-bridge/events?correlationId=<journal_id>
```

Each event records direction, payload hash, resolver, and timestamp.

## Staging proof (Phase 5)

1. Set `FEATURE_CAPITAL_STACK_ENABLED=true` on staging API.
2. Create test journal entry (personal → business).
3. Enable `FEATURE_CAPITAL_STACK_KARAFIEL=true` with Karafiel staging keys.
4. Confirm:
   - Outbound capital-flow accepted.
   - Callback updates journal to `compliance_sealed`.
   - Admin review queue empty for happy path.
5. DLQ drill: stop Karafiel staging → verify retry ladder → manual resolve.

## Break-glass

If Enclii lacks capital-stack admin UI:

- Read-only audit: `kubectl exec` into postgres pod (document adapter gap).
- Mutations: use bootstrap script or API with operator JWT only — never raw SQL
  on production without change reference.

## Related

- [Essentials CFDI Relay](ESSENTIALS_CFDI_RELAY.md) — billing CFDI path
- [Webhook DLQ](../../apps/api/src/modules/billing/services/webhook-dlq.service.ts)
- [Compliance ingest](../../apps/api/src/modules/manual-assets/compliance-ingest.controller.ts)
