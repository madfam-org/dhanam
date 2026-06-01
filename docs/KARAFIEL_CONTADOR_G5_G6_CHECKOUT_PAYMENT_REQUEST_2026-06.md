# Karafiel contador G5/G6 checkout and payment evidence request

Status: pending Dhanam proof
Date: 2026-06-01
SKU: `karafiel__contador`
Tulana gates: `G5`, `G6`

## Required Dhanam evidence before `G5` can pass

Dhanam must produce:

- Production checkout/session ID.
- SKU key: `karafiel__contador`.
- Public checkout plan: `karafiel_contador`.
- Public checkout product: `karafiel`.
- Amount: MXN 1,299/month.
- Currency: `MXN`.
- Mode/environment proving this is not sample/test-only data.
- Evidence locator safe for Tulana.

Public checkout URL template:

```text
https://api.dhan.am/billing/checkout?plan=karafiel_contador&product=karafiel&user_id=JANUA_USER_ID&return_url=https%3A%2F%2Fkarafiel.mx%2Fbilling%2Fsuccess
```

Operator helper:

```bash
cd /Users/aldoruizluna/labspace/dhanam
JANUA_USER_ID=... scripts/build-karafiel-contador-checkout-url.mjs
```

## Required Dhanam evidence before `G6` can pass

Dhanam must produce:

- Payment provider event ID.
- Dhanam billing event ID.
- Ledger entry ID.
- Amount and currency.
- Timestamp.
- Reconciliation reference linking the event to `karafiel__contador`.

## Gate decision

Current decision: `pending`

Reason:

- Tulana has catalog/pricing/apply evidence.
- A production checkout/session and payment/ledger evidence have not been
  attached yet.

## No-go rules

- Do not mark `G5` passed with local, staging, or sample-only checkout data.
- Do not mark `G6` passed without both provider and Dhanam ledger identifiers.
- Do not include card PANs, bank credentials, tokens, or customer PII in Tulana.

## Tulana pending evidence locator

`repo://dhanam/docs/KARAFIEL_CONTADOR_G5_G6_CHECKOUT_PAYMENT_REQUEST_2026-06.md`
