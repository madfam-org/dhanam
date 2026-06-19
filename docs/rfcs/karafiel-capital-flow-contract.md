# Karafiel Capital Flow API — Companion Contract (RFC-6)

**Status:** Draft (coordinate with Karafiel repo)
**Date:** 2026-06-18
**Parent:** [Owner–Operator Capital Stack](owner-operator-capital-stack.md)

## Purpose

Extend Karafiel beyond **billing CFDI fan-out** and **document compliance ingest**
to cover **owner capital flows** between Dhanam spaces, with intelligent
classification and a **manual review queue** synchronized with Dhanam.

## Authentication

| Direction         | Auth                                                               |
| ----------------- | ------------------------------------------------------------------ |
| Dhanam → Karafiel | `Authorization: Bearer ${KARAFIEL_API_KEY}` + `X-Source: dhanam`   |
| Karafiel → Dhanam | `X-Dhanam-Signature: HMAC-SHA256(raw body, DHANAM_WEBHOOK_SECRET)` |

Same secret pair as billing product webhooks and `POST /v1/internal/billing/cfdi-issued`.

## Outbound: register capital flow

**`POST {KARAFIEL_API_URL}/v1/compliance/capital-flow`**

### Request

```json
{
  "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
  "flow_type": "capital_contribution",
  "source": "dhanam",
  "status": "proposed",
  "beneficial_owner": {
    "dhanam_user_id": "uuid",
    "email": "owner@example.com",
    "rfc": "XAXX010101000",
    "name": "Owner Name"
  },
  "entity": {
    "dhanam_space_id": "uuid",
    "legal_name": "Innovaciones MADFAM S.A.S. de C.V.",
    "rfc": "RFC_FROM_VAULT",
    "operator_dhanam_user_id": "uuid"
  },
  "source_transaction": {
    "dhanam_transaction_id": "uuid",
    "space_id": "uuid",
    "date": "2026-06-18T12:00:00.000Z",
    "amount_minor": 1990000,
    "currency": "MXN",
    "description": "LOC draw",
    "capital_purpose": "owner_facility",
    "merchant": "BBVA",
    "metadata_rfc": "RFC_FROM_VAULT"
  },
  "target_transaction": {
    "dhanam_transaction_id": "uuid",
    "space_id": "uuid",
    "date": "2026-06-18T15:00:00.000Z",
    "amount_minor": 1990000,
    "currency": "MXN",
    "description": "Deposit"
  },
  "detection": {
    "confidence": 0.92,
    "rule_ids": ["rfc_counterparty_match", "amount_window_pair"],
    "detected_at": "2026-06-18T16:00:00.000Z"
  },
  "provenance": {
    "document_key": "retention-20y/...",
    "sha256": "hex",
    "compliance_record_id": "uuid"
  },
  "policy_hints": {
    "requires_cfdi": false,
    "requires_nom151_seal": true,
    "fiscal_treatment": "shareholder_loan"
  }
}
```

`target_transaction` may be omitted when status is `proposed` (unmatched).

### Response

```json
{
  "karafiel_case_id": "kf_cap_abc123",
  "status": "accepted",
  "review_required": false,
  "policy": {
    "requires_cfdi": false,
    "requires_nom151_seal": true
  }
}
```

| HTTP | Meaning                                   |
| ---- | ----------------------------------------- |
| 200  | Accepted (idempotent on `correlation_id`) |
| 202  | Queued for manual review                  |
| 400  | Invalid payload                           |
| 401  | Auth failure                              |

## Inbound: capital flow resolved

**`POST {DHANAM_API_URL}/v1/internal/compliance/capital-flow-resolved`**

Karafiel calls after seal, CFDI issuance, rejection, or operator resolution.

### Request body

```json
{
  "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
  "karafiel_case_id": "kf_cap_abc123",
  "resolution": "sealed",
  "cfdi_uuid": "optional-uuid",
  "sealed_at": "2026-06-18T17:00:00.000Z",
  "operator_notes": "optional",
  "source": "karafiel"
}
```

`resolution` enum: `sealed` | `cfdi_issued` | `rejected` | `manual_closed`.

### Dhanam behavior

- Updates `OwnerCapitalJournal.status` → `compliance_sealed` or `manual_review`.
- Appends `ComplianceBridgeEvent` (`karafiel_to_dhanam`).
- Stores `cfdi_uuid` in journal `metadata` when present.

## Inbound: manual action sync

**`POST {DHANAM_API_URL}/v1/internal/compliance/manual-action`**

When an operator acts in Karafiel UI (reclassify, split, reject, issue CFDI
out-of-band).

```json
{
  "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
  "karafiel_case_id": "kf_cap_abc123",
  "action": "reclassify",
  "actor_email": "operator@madfam.io",
  "payload": {
    "new_flow_type": "shareholder_loan",
    "notes": "Treated as partner loan per CPA"
  },
  "source": "karafiel"
}
```

Dhanam may update journal fields and echo `manual-action` outbound to Karafiel
when the operator acts in Dhanam admin instead (symmetric sync).

## Idempotency

| Key                | Scope                                  |
| ------------------ | -------------------------------------- |
| `correlation_id`   | Owner capital journal id (Dhanam UUID) |
| `karafiel_case_id` | Karafiel internal case                 |

Retries must return 200 with same body. Dhanam DLQ replays use verbatim payload

- signature (see `WebhookDlqService`).

## Review queue (Karafiel UI)

Each case should expose:

- Dhanam deep link: `https://app.dhan.am/capital/journal/{id}`
- Beneficial owner + entity RFC
- Source/target transaction summaries
- Detection confidence + rule ids
- Attached document preview (R2 key via signed URL)
- Actions: Approve seal, Request CFDI, Reject, Reclassify

## Error handling

| Scenario                           | Dhanam                                                 |
| ---------------------------------- | ------------------------------------------------------ |
| Karafiel 5xx                       | Journal stays `compliance_pending`; retry job (BullMQ) |
| Karafiel timeout                   | Same + Sentry alert                                    |
| Operator resolves in Karafiel only | `manual-action` callback updates Dhanam                |
| Operator resolves in Dhanam only   | Outbound sync + `ComplianceBridgeEvent`                |
| Karafiel down > 10 attempts        | Admin review queue; `resolved_out_of_band` pattern     |

## Contract tests

Implemented in Dhanam (Karafiel repo still pending live receiver):

| Suite                            | Path                                                                                   |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| Bridge payload + mock/live paths | `apps/api/src/modules/capital-stack/__tests__/karafiel-capital-bridge.service.spec.ts` |
| Inbound HMAC callbacks           | `apps/api/src/modules/capital-stack/__tests__/internal-compliance.controller.spec.ts`  |
| Golden journey                   | `apps/api/test/e2e/capital-stack.e2e-spec.ts`                                          |

Fixture directory (optional future Zod contract): `apps/api/test/contract/fixtures/karafiel-capital-flow/`.

## Karafiel repo checklist

- [ ] Implement `POST /v1/compliance/capital-flow`
- [ ] Review queue UI for `kf_cap_*` cases
- [ ] Emit `capital-flow-resolved` callback
- [ ] Emit `manual-action` on operator edits
- [ ] Idempotency on `correlation_id`
- [ ] Staging endpoint + shared `DHANAM_WEBHOOK_SECRET` proof
