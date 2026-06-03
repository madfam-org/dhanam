# Dhanam to Tulana Commercial GA evidence producer

Status: producer contract
Date: 2026-06-01
Source system: Dhanam
Target system: Tulana

## ROI priority

Dhanam should prioritize evidence for `karafiel__contador` first, then
`coforma__startup`, then `tezca__pro`, then `dhanam__pro`, then
`pravara-mes__starter`.

## Gates owned by Dhanam

| Gate                          | Evidence condition                                        | Minimum payload                                                    |
| ----------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------ |
| `G0` Catalog truth            | SKU exists in the production billing catalog.             | catalog version, SKU key, product slug, tier slug, price, currency |
| `G5` Live checkout proof      | A production checkout/session can be created for the SKU. | checkout/session ID, SKU key, amount, currency, environment        |
| `G6` Payment and ledger proof | Provider payment event and Dhanam ledger entry exist.     | provider event ID, Dhanam billing event ID, ledger entry ID        |
| `G8` BBVA payout proof        | Provider payout reached BBVA.                             | payout ID, BBVA arrival timestamp, net amount, currency            |

## Tulana write target

```http
POST /api/v1/madfam-skus/{product_slug}/{tier_slug}/commercial-ga-evidence/
```

## G5 example

```json
{
  "environment": "production",
  "period": "2026-06",
  "gate_id": "G5",
  "status": "passed",
  "confidence": "high",
  "evidence_type": "dhanam_checkout_session",
  "evidence_url": "https://api.dhan.am/internal/evidence/checkout/{session_id}",
  "source_system": "dhanam",
  "source_record_id": "{session_id}",
  "metadata": {
    "sku_key": "karafiel__contador",
    "amount_centavos": 129900,
    "currency": "MXN"
  }
}
```

## Non-negotiables

- Do not write `G6` without both provider and Dhanam ledger identifiers.
- Do not write `G8` without payout and BBVA arrival evidence.
- Do not mark evidence `passed` with sample/test-mode IDs.
- Do not include secrets, tokens, card PANs, or bank credentials in Tulana.
