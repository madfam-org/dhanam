# Tulana Commercial GA gap queue consumption

Status: active owner queue contract
Date: 2026-06-01
Owner system: Dhanam

## Source

```http
GET https://tulana-api.madfam.io/api/v1/commercial-ga-gap-queue/?environment=production&period=2026-06&owner=dhanam
```

## Dhanam responsibility

Dhanam owns cash-path gates:

- `G5`: production checkout/session proof.
- `G6`: payment provider event and Dhanam ledger proof.
- `G8`: payout and BBVA arrival proof.

## ROI rule

Process rows in returned order. For June 2026, Dhanam should prepare
`karafiel__contador` checkout/payment evidence while PhyndCRM completes `G4`.

Do not mark `G5`, `G6`, or `G8` passed with sample, staging, or synthetic
payment data.
