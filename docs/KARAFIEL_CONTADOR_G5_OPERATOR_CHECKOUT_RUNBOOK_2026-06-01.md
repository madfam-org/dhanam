# Karafiel contador G5 operator checkout runbook

Status: ready for production checkout proof
Date: 2026-06-01
SKU: `karafiel__contador`
Gate: `G5`

## Purpose

Generate the production checkout URL for Karafiel Contador once PhyndCRM `G4`
is complete. This helper does not create payment proof by itself; it prepares
the checkout path needed for Dhanam `G5`.

## Generate checkout URL

```bash
cd /Users/aldoruizluna/labspace/dhanam
JANUA_USER_ID=... \
scripts/build-karafiel-contador-checkout-url.mjs
```

Optional overrides:

```bash
DHANAM_API_BASE_URL=https://api.dhan.am
DHANAM_CHECKOUT_RETURN_URL=https://karafiel.mx/billing/success
```

Expected URL shape:

```text
https://api.dhan.am/billing/checkout?plan=karafiel_contador&product=karafiel&user_id=...&return_url=https%3A%2F%2Fkarafiel.mx%2Fbilling%2Fsuccess
```

## G5 pass criteria

Do not mark Tulana `G5` passed from the generated URL alone. `G5` requires:

- production checkout/session ID;
- SKU key `karafiel__contador`;
- plan `karafiel_contador`;
- product `karafiel`;
- amount MXN 1,299/month;
- proof that the session is not sample/staging-only.

## Follow-on G6 criteria

`G6` requires provider payment event ID and Dhanam ledger event ID after a real
payment succeeds.

## No-go rules

- Do not include card data, bank credentials, or tokens in Tulana.
- Do not mark `G5` passed without a session ID.
- Do not mark `G6` passed without provider and Dhanam ledger identifiers.
