# Tulana SKU and catalog handoff

Date: 2026-05-29

Status: active cross-repo contract

## Direct surfaces

| Surface           | URL                                      |
| ----------------- | ---------------------------------------- |
| Landing           | `https://dhan.am`                        |
| App               | `https://app.dhan.am`                    |
| Admin             | `https://admin.dhan.am`                  |
| API               | `https://api.dhan.am`                    |
| Billing catalogue | `https://api.dhan.am/v1/billing/catalog` |
| Tulana app        | `https://tulana-app.madfam.io`           |

## Dhanam's two roles

Dhanam has two separate responsibilities in the Tulana program:

1. Dhanam is a commercial platform/SKU family that Tulana evaluates.
2. Dhanam is the billing catalogue source of truth for MADFAM SKU identity,
   price application, and downstream checkout/subscription state.

Do not mix these roles. A Dhanam API/catalogue success proves billing catalogue
availability; it does not automatically prove the Dhanam product SKU family is
commercial-GA-ready.

## Catalogue handoff contract

Tulana should mirror active SKU rows from:

```text
https://api.dhan.am/v1/billing/catalog
```

For each active SKU, Dhanam should expose or preserve:

| Field                 | Purpose                                                          |
| --------------------- | ---------------------------------------------------------------- |
| Product slug          | Tulana platform/product grouping                                 |
| SKU/tier slug         | Stable Tulana `product__tier` key input                          |
| Active state          | Inclusion in readiness denominator                               |
| Price amount          | Current public or internal billing price                         |
| Currency              | Pricing normalization                                            |
| Billing interval      | Monthly, yearly, usage, one-time, etc.                           |
| Public visibility     | Whether SKU can appear in campaign copy                          |
| Apply endpoint status | Whether approved Tulana/Selva decisions can update the catalogue |

## Dhanam product SKU evidence

For Dhanam's own product SKUs, Tulana needs:

- public surfaces and app availability;
- competitor universe for wealth/family-office/portfolio management;
- cost basis for provider APIs, data aggregation, payment rails, hosting,
  support, and compliance operations;
- buyer signal from pilots, WTP/PMF, or Phynd CRM;
- explicit claims guardrails around regulated financial advice, custody, and
  transaction execution.

## Tulana -> Selva -> Dhanam price apply

The intended pricing lifecycle:

1. Tulana computes SKU recommendation from evidence.
2. Operator reviews and records decision in Tulana.
3. Tulana queues a Selva HITL `pricing_proposal` when requested.
4. Selva human approval records outcome.
5. Approved changes are applied to Dhanam through the internal catalogue apply
   API.
6. Tulana verifies Dhanam catalogue state after apply.

Dhanam must reject unauthenticated or unapproved price mutation attempts.

## Campaign guardrails

Campaign exports must not:

- imply Dhanam provides regulated investment advice unless supported by product
  and legal posture;
- advertise unavailable billing tiers;
- claim a price change has applied until the Dhanam catalogue reflects it;
- treat waived Tulana evidence as high-confidence financial proof.

## Definition of done

- Tulana mirrors the active Dhanam catalogue without denominator drift.
- Every target SKU has stable identity and active/inactive state.
- Approved pricing proposals can be traced from Tulana decision to Selva
  approval to Dhanam catalogue result.
- Dhanam product SKUs have their own comparator, cost, and buyer-signal evidence.
