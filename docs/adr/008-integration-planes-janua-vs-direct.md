# ADR-008: Integration Planes — Janua vs Direct Third Parties

## Status

**Accepted** — May 2026

## Context

Dhanam participates in the MADFAM ecosystem as both a consumer finance product and
the **commercial billing boundary** for subscriptions, POS, usage metering, and
signed `payment.*` fan-out (Karafiel, PhyndCRM, Tezca, etc.).

Historically, ADR-007 stated that all payment operations route through Janua and
that Dhanam never talks to Stripe or Conekta directly. **G2 commercial work
(2026-05) superseded that assumption:**

- Production identity remains **Janua-only** (`AUTH_MODE=janua`).
- Production checkout defaults to **Dhanam-direct** hybrid routing
  (`JANUA_BILLING_ENABLED=false`, `FEATURE_UNIFIED_CHECKOUT_ROUTING=true`):
  MX → Stripe MX, global → Paddle, with Conekta as a direct POS/invoice adapter.
- Financial data providers (Belvo, Plaid, Bitso, …) were **always** Dhanam-direct
  via the provider orchestrator (ADR-003).

Engineering needs a single, durable model for **when Janua is in the path** vs
**when Dhanam integrates directly**, without parallel checkout implementations.

## Decision

Adopt **three orthogonal integration planes** inside Dhanam. Each external system
maps to exactly one plane.

| Plane              | Owner                     | Janua role                                          | Dhanam role                             |
| ------------------ | ------------------------- | --------------------------------------------------- | --------------------------------------- |
| **Identity**       | Janua                     | Source of truth (OIDC, orgs, MFA)                   | JWT validation, user provisioning       |
| **Financial data** | Dhanam                    | None (JWT only on API calls)                        | Provider orchestrator, encrypted tokens |
| **Money movement** | Dhanam (billing boundary) | Optional checkout adapter (`JANUA_BILLING_ENABLED`) | Direct PSP adapters + policy + ledger   |

### Money-movement implementation

All payment service providers (PSPs) implement a shared **`PaymentGatewayPort`**
registered in **`PaymentGatewayRegistry`**. Checkout routing policy and POS
services resolve a gateway id (`stripe_mx`, `paddle`, `conekta`, `janua`,
`legacy_stripe`) and delegate to the adapter — never to raw SDK calls from
controllers or lifecycle services.

```
User / operator action
        │
        ▼
CheckoutRoutingPolicyService / InternalPosService
        │
        ▼
PaymentGatewayRegistry ──► PaymentGatewayPort adapter
        │                      │
        │                      ├── StripeMxGateway
        │                      ├── PaddleGateway
        │                      ├── ConektaGateway
        │                      ├── JanuaBillingGateway (optional)
        │                      └── LegacyStripeGateway
        ▼
BillingEvent ledger + signed ecosystem fan-out
```

### When to use Janua

| Use Janua                                                   | Use Dhanam direct                      |
| ----------------------------------------------------------- | -------------------------------------- |
| Login, SSO, MFA, org membership                             | Bank/crypto link (Belvo, Plaid, Bitso) |
| `orgId` / Janua customer correlation on invoices            | PSP webhooks, secrets, reconciliation  |
| Optional unified checkout when `JANUA_BILLING_ENABLED=true` | POS, SPEI relay, Karafiel CFDI fan-out |
| Cross-product identity claims                               | Usage metering, referrals, DLQ         |

### When **not** to use Janua

- Financial provider OAuth or token storage.
- Replacing Dhanam as the MX commercial ledger and CFDI correlation boundary.
- Duplicating PSP SDK calls outside `PaymentGatewayPort` adapters.

## Consequences

### Positive

- **Clear separation of concerns** — identity, ledger data, and money movement
  evolve independently.
- **Janua billing is a toggle**, not a fork — enabling `JANUA_BILLING_ENABLED`
  selects the `janua` gateway adapter behind the same policy engine.
- **ADR-007 drift resolved** — Conekta direct gateway and Stripe MX direct are
  intentional for the billing boundary; Janua remains optional for checkout
  execution.
- **Ecosystem alignment** — Karafiel/Phynd still consume Dhanam-signed envelopes;
  Janua does not sit in the CFDI path.

### Negative

- Dhanam holds PSP credentials for the billing boundary (operational burden).
- Janua outage does **not** block direct checkout (by design); Janua outage
  **does** block login (unchanged).

### Mitigations

- Secret groups remain split (`dhanam-janua-secrets`, `dhanam-billing-secrets`,
  `dhanam-provider-secrets`) per plane.
- Enclii-first rotation runbooks per secret group.
- Contract tests per gateway adapter; staging commercial smoke exercises direct path.

## Supersedes

- **ADR-007** (`conekta-janua-dependency.md`) — superseded for payment routing.
  Retained for historical Conekta evaluation context; do not treat as current
  architecture.

## Related documents

- [ADR-003: Multi-Provider Strategy](003-multi-provider-strategy.md) — financial data
- [ADR-004: Janua Auth Integration](004-janua-auth-integration.md) — identity
- [Architecture — Integration Planes](../architecture/ARCHITECTURE.md)
- [Billing module README](../../apps/api/src/modules/billing/README.md)
