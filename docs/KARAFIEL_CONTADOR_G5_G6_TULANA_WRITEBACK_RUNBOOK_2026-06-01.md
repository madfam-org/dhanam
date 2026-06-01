# Karafiel Contador G5/G6 Tulana Write-Back Runbook

Date: 2026-06-01

Scope: `karafiel__contador`

Owner: Dhanam

## Purpose

Move the first-pesos candidate from campaign-send readiness into the money-path gates tracked by Tulana Commercial GA readiness:

- `G5`: Dhanam checkout session exists for `karafiel_contador`.
- `G6`: Payment provider success and Dhanam billing ledger entry exist.

These scripts intentionally do not create fake readiness. They only write `passed` evidence after an operator supplies real Dhanam/Stripe identifiers.

## Required environment

Set these without printing them in shell history or logs:

```sh
export TULANA_COMMERCIAL_GA_EVIDENCE_TOKEN=...
export TULANA_COMMERCIAL_GA_PERIOD=2026-06
export TULANA_COMMERCIAL_GA_ENVIRONMENT=production
```

Optional:

```sh
export TULANA_API_BASE_URL=https://tulana-api.madfam.io/api/v1
export DHANAM_OPERATOR_EMAIL=operator@madfam.io
export DHANAM_OPERATOR_RUN_ID=karafiel-contador-first-pesos-2026-06-01
```

## G5: record checkout-session evidence

Prerequisite:

- A real Dhanam checkout session was created for `plan=karafiel_contador`.
- The checkout was generated from the operator runbook or production checkout path.
- The checkout targets MXN settlement through the configured Dhanam money path.

Command:

```sh
node scripts/record-karafiel-contador-g5-evidence.mjs <checkout_session_id>
```

Optional metadata:

```sh
export DHANAM_CHECKOUT_AMOUNT_CENTAVOS=129900
export DHANAM_CHECKOUT_CURRENCY=MXN
export DHANAM_CHECKOUT_STATUS_URL=https://api.dhan.am/billing/operator/checkout/<checkout_session_id>
export DHANAM_CHECKOUT_EVIDENCE_URL=repo://dhanam/docs/KARAFIEL_CONTADOR_G5_OPERATOR_CHECKOUT_RUNBOOK_2026-06-01.md
```

Expected Tulana effect:

- `gate_id=G5`
- `status=passed`
- `source_system=dhanam`
- `source_record_id=<checkout_session_id>`
- `evidence_type=dhanam_checkout_session`

## G6: record payment-ledger evidence

Prerequisite:

- Stripe or the active payment provider emitted a successful payment event.
- Dhanam stored the corresponding billing event.
- The amount and currency match the `karafiel_contador` commercial package.

Command:

```sh
node scripts/record-karafiel-contador-g6-evidence.mjs <payment_provider_event_id> <billing_event_id>
```

Optional metadata:

```sh
export DHANAM_PAYMENT_AMOUNT_CENTAVOS=129900
export DHANAM_PAYMENT_CURRENCY=MXN
export DHANAM_PAYMENT_PROVIDER=stripe
export DHANAM_CHECKOUT_SESSION_ID=cs_live_...
export DHANAM_STRIPE_INVOICE_ID=in_...
export DHANAM_STRIPE_SUBSCRIPTION_ID=sub_...
export DHANAM_PAYMENT_EVIDENCE_URL=repo://dhanam/docs/KARAFIEL_CONTADOR_G5_G6_TULANA_WRITEBACK_RUNBOOK_2026-06-01.md
```

Expected Tulana effect:

- `gate_id=G6`
- `status=passed`
- `source_system=dhanam`
- `source_record_id=<billing_event_id>`
- `evidence_type=dhanam_payment_ledger`

## Controls

- The scripts never print the Tulana token.
- The BBVA destination is represented only as `configured_in_dhanam_secrets_not_logged`.
- No `passed` evidence should be written for test sessions, sample events, or unpaid checkouts.
- If the operator cannot point to a real checkout session and billing event, leave G5/G6 pending.

## Current readiness implication

As of 2026-06-01, this runbook provides the execution path for G5/G6 evidence capture. It does not itself prove money movement. `karafiel__contador` remains blocked until:

- G4 passes from PhyndCRM send telemetry.
- G5 passes from a real Dhanam checkout session.
- G6 passes from provider success plus Dhanam billing ledger evidence.
