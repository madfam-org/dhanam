# Karafiel Contador G8 BBVA Payout Write-Back Runbook

Date: 2026-06-01

Scope: `karafiel__contador`

Owner: Dhanam

## Purpose

Record Tulana Commercial GA evidence that paid revenue for `karafiel_contador` has moved from the payment provider payout path into the configured BBVA account.

`G8` is the cash-arrival gate. It must not pass from checkout, invoice, subscription, or payment-provider success alone.

## Required environment

Set these without printing tokens or bank account details:

```sh
export TULANA_COMMERCIAL_GA_EVIDENCE_TOKEN=...
export TULANA_COMMERCIAL_GA_PERIOD=2026-06
export TULANA_COMMERCIAL_GA_ENVIRONMENT=production
export DHANAM_PAYOUT_AMOUNT_CENTAVOS=...
```

Optional:

```sh
export TULANA_API_BASE_URL=https://tulana-api.madfam.io/api/v1
export DHANAM_PAYOUT_CURRENCY=MXN
export DHANAM_PAYMENT_PROVIDER=stripe
export DHANAM_BILLING_EVENT_ID=...
export DHANAM_PAYMENT_PROVIDER_EVENT_ID=evt_...
export BBVA_DEPOSIT_ARRIVAL_DATE=2026-06-...
export DHANAM_OPERATOR_EMAIL=operator@madfam.io
export DHANAM_OPERATOR_RUN_ID=karafiel-contador-first-pesos-2026-06-01
```

## Command

```sh
node scripts/record-karafiel-contador-g8-evidence.mjs <provider_payout_id> <bbva_deposit_reference>
```

Expected Tulana effect:

- `sku=karafiel__contador`
- `gate_id=G8`
- `status=passed`
- `source_system=dhanam`
- `source_record_id=<provider_payout_id>`
- `evidence_type=bbva_payout_arrival`

## Controls

- Do not record `G8 passed` before a real BBVA deposit has arrived.
- Do not store the BBVA account number, token, or bank credential in Tulana metadata.
- Include provider payout id and BBVA deposit reference so finance can reconcile the chain.
- The script never prints the Tulana token.
- Test-mode, sandbox, sample, or manually adjusted provider records are not acceptable commercial-GA evidence.

## Readiness implication

When `G8` passes, `karafiel__contador` can be considered cash-GA-ready if `G0-G8` have all passed. Campaign-GA still requires `G9` Converge revenue evidence.
