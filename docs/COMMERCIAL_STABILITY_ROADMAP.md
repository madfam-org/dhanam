# Commercial Stability Roadmap

Last updated: 2026-05-21

This document tracks Dhanam's path from production-stable billing backbone to a
full MADFAM internal billing router and POS. Read it with
[Roadmap](ROADMAP.md), [Tech Debt](TECH_DEBT.md), and
[`apps/api/src/modules/billing/README.md`](../apps/api/src/modules/billing/README.md).

## Current Status

| Capability                        | Status        | Notes                                                                    |
| --------------------------------- | ------------- | ------------------------------------------------------------------------ |
| Catalog-backed checkout           | Live          | Product plan slugs resolve through `PriceResolver` and fail closed.      |
| Stripe MX/SPEI relay              | Live          | Signed webhook, canonical `payment.*` fan-out, DLQ on delivery failure.  |
| Public/external checkout redirect | Live          | Return-host allowlist protects unauthenticated checkout.                 |
| Admin POS checkout link creation  | Source landed | `POST /v1/admin/billing/pos/checkout` plus admin `/pos` page.            |
| Admin POS status lookup           | Source landed | `POST /v1/admin/billing/pos/status` inspects Stripe checkout sessions.   |
| Unified provider routing          | Partial       | `PaymentRouterService` exists; primary checkout lifecycle still differs. |
| Janua-routed billing              | Blocked       | Production Janua billing secrets must be non-empty and verified.         |
| Full POS terminal                 | Not complete  | One-time charges, refunds, reconciliation, and CFDI proof remain.        |
| Conekta direct commercial parity  | Not complete  | Needs durable ledger, canonical fan-out, refund parity, and DLQ path.    |

## Remediation Plan

### 1. Stabilize The Operator Checkout Surface

- Keep admin POS checkout creation admin-only and high-severity audited.
- Keep POS status lookup admin-only and audit each session inspection.
- Add admin tests for failed user lookup, invalid plan, unconfigured provider,
  and successful product-prefixed checkout.
- Add production/staging smoke once the route is deployed.

### 2. Unify Routing

- Make one provider-routing policy authoritative for every checkout and payment
  request.
- Record provider, country, currency, product, plan, price source, route reason,
  and operator override in metadata/audit logs.
- Decide whether Janua wraps provider routing or remains a separate fallback
  until its production secrets and checkout proof are complete.

### 3. Complete POS Workflows

- Create one-time payment request and line-item/cart APIs.
- Extend status lookup from Stripe checkout sessions to provider-complete
  payment/refund timelines.
- Add full/partial refund workflows with idempotency.
- Add settlement and reconciliation views in admin.
- Add Karafiel CFDI/egreso proof for succeeded and refunded payments.

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
- product webhook delivery and DLQ replay are proven;
- Janua/Conekta/Paddle/Stripe MX launch semantics are explicit;
- docs, runbooks, API contracts, SDK types, and admin UI match source and
  production behavior.
