# Commercial Stability Roadmap

Last updated: 2026-05-22

This document tracks Dhanam's path from production-stable billing backbone to a
full MADFAM internal billing router and POS. Read it with
[GA Remediation Roadmap](GA_REMEDIATION_ROADMAP.md) (Phases 3–4, commercial GA
gate G2), [Commercial GA Execution](COMMERCIAL_GA_EXECUTION.md) (WS1–WS6
runbook), [Roadmap](ROADMAP.md), [Tech Debt](TECH_DEBT.md), and
[`apps/api/src/modules/billing/README.md`](../apps/api/src/modules/billing/README.md).

**Implementation language:** Code, comments, commits, and technical docs are
English only. Product UI strings use i18n.

## Current Status

| Capability                        | Status         | Notes                                                                                  |
| --------------------------------- | -------------- | -------------------------------------------------------------------------------------- |
| Catalog-backed checkout           | Live           | Product plan slugs resolve through `PriceResolver` and fail closed.                    |
| Stripe MX/SPEI relay              | Live           | Signed webhook, canonical `payment.*` fan-out, DLQ on delivery failure.                |
| Public/external checkout redirect | Live           | Return-host allowlist protects unauthenticated checkout.                               |
| Unified provider routing          | Source on main | `CheckoutRoutingPolicyService` + hybrid router when Janua off; WS1 staging proof.      |
| Admin POS checkout link creation  | Source on main | `POST /v1/admin/billing/pos/checkout` plus admin `/pos` subscription tab.              |
| Admin POS status lookup           | Source on main | `POST /v1/admin/billing/pos/status` inspects Stripe checkout sessions.                 |
| Admin POS charge / refund         | Source on main | `POST /v1/admin/billing/pos/charge` and `/refund`; partial via `amountMinor`.          |
| Admin route preview               | Source on main | `POST /v1/admin/billing/route/preview` dry-run matrix.                                 |
| Admin timeline / reconciliation   | Source on main | Timeline + flagged mismatch summary in admin `/pos`.                                   |
| Staging commercial smoke          | WS1 active     | [`scripts/staging-commercial-smoke.sh`](../scripts/staging-commercial-smoke.sh) in CI. |
| Admin product-webhook DLQ         | Source landed  | Admin `/webhook-dlq` lists, replays, and resolves product webhook delivery failures.   |
| Janua-routed billing              | Blocked        | Production Janua billing secrets must be non-empty and verified.                       |
| CFDI proof in POS timeline        | Not complete   | Karafiel receipt correlation — WS2.                                                    |
| Conekta direct commercial parity  | Partial        | Webhook ledger/fan-out/DLQ source-landed; POS + live proof remain (Scope B).           |

## Remediation Plan

### 1. Stabilize The Operator Checkout Surface

- Keep admin POS checkout creation admin-only and high-severity audited.
- Keep POS status lookup admin-only and audit each session inspection.
- Add admin tests for failed user lookup, invalid plan, unconfigured provider,
  and successful product-prefixed checkout.
- **WS1:** Run [`staging-commercial-smoke.sh`](../scripts/staging-commercial-smoke.sh)
  after every staging deploy; promote after soak (see
  [Commercial GA Execution](COMMERCIAL_GA_EXECUTION.md)).

### 2. Unify Routing

- **Done (source):** `CheckoutRoutingPolicyService` is authoritative when Janua
  billing is disabled.
- Record provider, country, currency, product, plan, price source, route reason,
  and operator override in metadata/audit logs.
- Janua remains a separate optional path until production secrets and checkout
  proof are complete (TD-1011).

### 3. Complete POS Workflows

- **Done (source):** one-time charge, refund, timeline, reconciliation APIs.
- **WS2:** CFDI proof, partial refund admin UI, Conekta POS path, route override.
- Add golden end-to-end probes for Dhanam -> each MADFAM product.
- Add SDK methods for trusted internal services once the POS contract is stable.

### 4. Harden Product Contracts

- Version signed webhook envelopes.
- Add golden end-to-end probes for Dhanam -> each MADFAM product.
- Add SDK methods for trusted internal services once the POS contract is stable.
- Keep unlinked revenue events durable and searchable instead of audit-only.

### 5. Launch Gate

Do not call the MADFAM POS full-fledged until all of these are true:

- checkout, one-time charge, refund, provider-complete status timeline, and
  reconciliation paths are implemented and tested;
- every money event has an idempotency key, provider id, local correlation id,
  status, and replay path;
- product webhook delivery and admin DLQ replay/resolve are proven;
- Janua/Conekta/Paddle/Stripe MX launch semantics are explicit;
- docs, runbooks, API contracts, SDK types, and admin UI match source and
  production behavior.

Track execution in [Commercial GA Execution](COMMERCIAL_GA_EXECUTION.md).
