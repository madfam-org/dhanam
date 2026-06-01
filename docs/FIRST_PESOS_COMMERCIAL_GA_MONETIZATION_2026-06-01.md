# First pesos and Commercial GA monetization runbook

Date: 2026-06-01
Status: operating plan; current revenue remains unproven until BBVA payout and Converge evidence import are complete.

## Purpose

This document turns the first-pesos discussion into an executable monetization remediation plan. The goal is not just to create a checkout link. The goal is to prove the full money path:

1. A campaign-safe SKU is selected.
2. A real buyer pays in MXN through Dhanam.
3. Dhanam writes durable billing, ledger, entitlement, and webhook evidence.
4. Provider payout lands in the BBVA account.
5. Converge Dashboard imports approved Dhanam revenue evidence.
6. `dash.madfam.io` shows calculated revenue from evidence, not sample values.

## Current truthful baseline

Evidence observed on 2026-06-01:

| Surface | Truth |
| --- | --- |
| Converge UI | `https://dash.madfam.io` responds HTTP 200. |
| Converge API | Public `GET /api/v1/metrics` returns `401 missing_bearer_token`, as expected for private metric APIs. |
| Converge financial page | May 2026 financial metrics show 2 metrics, 0 calculated snapshots, 0 evidence rows, Revenue `N/A`, status `not_calculated`. |
| Dhanam API | `https://api.dhan.am/health` returns healthy with database and Redis up. |
| Dhanam catalog | `https://api.dhan.am/v1/billing/catalog` returns 26 products / 82 tiers, 45 MXN-priced monthly tiers, updated `2026-06-01T01:00:39.142Z`. |
| Tulana evidence | Current Tulana status says 26 products / 82 active SKUs, 82/82 Dhanam proposals ready, 82/82 Selva-to-Dhanam handoffs applied, legal queue empty. |
| Janua | `https://auth.madfam.io/health` returns healthy. |

Therefore the truthful statement is: the monetization spine exists and is live, but recognized revenue is not yet evidenced in Converge and pesos-in-BBVA has not yet been proven.

## Business model

MADFAM is operating a multi-product vertical SaaS ecosystem with shared commercial infrastructure. The monetization model is:

| Layer | Owner | Commercial role |
| --- | --- | --- |
| Identity | Janua | Auth, OIDC, SSO, customer/session identity. |
| Billing | Dhanam | Catalog, checkout, payment providers, invoices, entitlements, usage, webhooks, ledger. |
| Pricing truth | Tulana | SKU readiness, cost/comparator evidence, proposal readiness, pricing confidence. |
| Agent orchestration | Selva | Campaign planning, draft generation from proof points, HITL approvals, feedback loop. |
| CRM | PhyndCRM | Contacts, consent, campaign staging/send, engagement outcomes, attribution. |
| Executive evidence | Converge Dash | Governed metric snapshots, lineage, approvals, stakeholder reporting. |
| Product value | Karafiel, Coforma, Tezca, Pravara, etc. | Paid product surfaces. |

Revenue types:

- MXN subscriptions.
- USD subscriptions where appropriate.
- Usage credits.
- Custom/enterprise contracts.
- Compliance, automation, advisory, and operating-system workflows.

## Campaign SKU policy

A SKU can be used in a PhyndCRM campaign through Selva agents only when its Commercial GA status is explicit. Do not infer readiness from catalog presence alone.

| Status | Meaning | Allowed campaign type |
| --- | --- | --- |
| `blocked` | Missing required proof or operational dependency. | None, except internal remediation. |
| `candidate` | Strong product/price candidate but checkout, payout, entitlement, or evidence path is not fully proven. | Waitlist or discovery only; no paid GA claims. |
| `ga_ready` | All Commercial GA gates are complete with evidence links. | Revenue campaign allowed with human approval. |
| `paused` | Previously ready but currently regressed or under incident/change freeze. | None until restored. |

## Commercial GA gates

Every revenue campaign SKU must pass these gates before PhyndCRM sends paid GA campaigns.

| Gate | Owner | Evidence required |
| --- | --- | --- |
| G0 Catalog truth | Dhanam + Tulana | Product, tier, MXN amount, billing interval, success/cancel URLs, and entitlement mapping match live Dhanam catalog. |
| G1 Pricing evidence | Tulana | Proposal-ready status, comparator/cost/WTP proof or explicit waiver, legal queue empty, last verification timestamp. |
| G2 Campaign proof pack | Tulana + Selva | Value prop, proof points, do-not-claim guardrails, audience, and readiness state are present. |
| G3 Selva guardrails | Selva | Agents generate copy only from proof points; no invented claims; HITL approval required. |
| G4 PhyndCRM consent/send gate | PhyndCRM | Contact lawful basis, unsubscribe/suppression, channel preference, campaign approval, and idempotent import are verified. |
| G5 Live checkout | Dhanam | Live-mode checkout opens with correct SKU, price, currency, metadata, and provider. |
| G6 Payment and ledger | Dhanam | Provider payment success maps to one durable BillingEvent/payment ledger row with idempotency and no duplicate revenue. |
| G7 Entitlement and fan-out | Dhanam + product repo | Paid tier/credits activate and product webhook receives signed payment/entitlement event or DLQ captures replayable failure. |
| G8 BBVA payout | Finance/operator | Provider payout lands in BBVA; gross, fees, net, provider payout ID, and arrival timestamp are recorded. |
| G9 Dashboard evidence | Converge Dash | Dhanam recognized-revenue evidence import produces revenue snapshot with evidence rows > 0 and sample values disabled. |

A SKU is not `ga_ready` until G0-G9 are complete. G8 and G9 are required so the business can distinguish checkout success from actual spendable pesos and recognized dashboard evidence.

## Initial campaign SKU slate

These are the recommended first-money campaign candidates. They are not broad paid-GA campaign SKUs until they pass G0-G9.

| Priority | SKU | Live catalog price | Current campaign status | Reason |
| --- | --- | --- | --- | --- |
| P1 | `karafiel__contador` | MXN 1,299/month | `candidate` | Strong Mexican B2B pain: SAT/CFDI/RFC compliance; clear buyer; high enough ticket for meaningful first pesos. |
| P1 fallback | `coforma__startup` | MXN 999/month | `candidate` | Clear PMF/CAB buyer and direct fit for PhyndCRM/Coforma customer-feedback motion. |
| P2 | `tezca__pro` | MXN 399/month | `candidate` | Lower ticket but good legal-intelligence inbound wedge once proof/copy is tightly governed. |
| P2 | `dhanam__pro` | MXN 299/month | `plumbing_smoke_only` | Useful to smoke billing, but too low-ticket and broad for first revenue focus. |
| P3 | `pravara-mes__starter` | MXN 4,999/month | `candidate_enterprise` | Strong ACV, but sales/procurement friction makes it poor for first-pesos speed. |

Campaign rule: paid outbound should begin with `karafiel__contador` after the Commercial GA gate evidence exists. `coforma__startup` is the parallel backup if there is an already-warm CAB/PMF prospect.

## First-pesos execution sequence

1. Freeze scope to one SKU, one buyer, one provider path, one success path.
2. Confirm live provider account, webhook, and BBVA payout destination. Do not print or store secrets.
3. Generate live Dhanam checkout for the selected SKU.
4. Buyer completes payment. Prefer card for fastest proof; SPEI is acceptable but slower.
5. Verify provider payment success.
6. Verify Dhanam billing event, ledger row, entitlement activation, and signed product webhook fan-out.
7. Wait for provider payout and verify BBVA deposit.
8. Export Dhanam recognized revenue evidence.
9. Import evidence into Converge Dash.
10. Confirm Converge financial revenue has evidence rows > 0 and no sample data.

## BBVA proof requirements

Do not declare first pesos until the BBVA account shows a net MXN deposit. The minimum proof packet is:

| Field | Requirement |
| --- | --- |
| Provider | Stripe MX or Conekta. |
| Provider payment ID | Stored in Dhanam ledger/evidence export. |
| Provider payout ID | Stored in finance/operator proof packet. |
| Gross amount | MXN minor and major units. |
| Fees | MXN amount and provider fee type. |
| Net amount | MXN amount landing in BBVA. |
| BBVA arrival timestamp | Timestamp of deposit arrival. |
| Reconciliation state | `matched`. |
| Dashboard state | Converge revenue calculated with evidence rows > 0. |

## No-go rules

- Do not run broad PhyndCRM paid campaigns for `candidate` SKUs.
- Do not claim GA, compliance approval, revenue, or customer proof without source-backed evidence.
- Do not treat checkout success as pesos in BBVA.
- Do not import manual optimistic numbers into Converge. Dhanam must be the source for revenue evidence.
- Do not bypass Selva HITL or PhyndCRM consent/suppression gates.
- Do not campaign custom-priced/enterprise tiers as self-serve offers.

## Related operating docs

- Dhanam stability: `docs/STABILITY_WRAP_UP_2026-05-20.md`
- Dhanam billing integration: `docs/guides/BILLING_INTEGRATION.md`
- Tulana status: `../tulana/docs/current-status-2026-05-29.md`
- PhyndCRM campaign gates: `../phynd-crm/docs/COMMERCIAL_GA_CAMPAIGN_SKU_GATES_2026-06-01.md`
- Selva campaign orchestration gates: `../selva-office/docs/COMMERCIAL_GA_CAMPAIGN_ORCHESTRATION_GATES_2026-06-01.md`
- Converge first revenue evidence import: `../converge-dash/docs/operations/FIRST_REVENUE_EVIDENCE_IMPORT_2026-06-01.md`
