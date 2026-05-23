# Billing Module

Last updated: 2026-05-21

The billing module is Dhanam's commercial boundary for the MADFAM ecosystem.
It owns subscription checkout, catalog price resolution, usage metering,
provider webhooks, payment-event fan-out, and the first internal MADFAM POS
checkout surface.

## Current Truth

- Production subscription and catalog-backed checkout flows are healthy for the
  currently deployed Stripe-backed path.
- Catalog plan slugs resolve through `PriceResolver`; unknown plans fail
  closed.
- Stripe MX/SPEI webhook relay emits canonical `payment.*` envelopes, persists
  linked billing events, and writes downstream delivery failures to the DLQ.
- The internal POS is now a source-level admin checkout generator and Stripe
  checkout status inspector at `POST /admin/billing/pos/checkout`,
  `POST /admin/billing/pos/status`, and `apps/admin/src/app/(dashboard)/pos`.
  It creates operator checkout links through the existing lifecycle path and
  can inspect Stripe checkout sessions; it is not yet a complete
  card-terminal/ledger/refund/settlement console.
- Janua identity relay and centralized email use the shared internal Janua key
  and Dhanam webhook secret. Janua-routed checkout remains explicitly disabled
  with `JANUA_BILLING_ENABLED=false` until the Dhanam client route/auth contract
  is aligned to Janua production and an end-to-end Janua checkout has been
  verified.
- `CheckoutRoutingPolicyService` wires subscription, external, and operator
  checkout through `PaymentRouterService` when Janua billing is disabled
  (`FEATURE_UNIFIED_CHECKOUT_ROUTING=true`, default). MX routes to Stripe MX;
  non-MX routes to Paddle. Legacy US Stripe remains the fallback when hybrid
  providers are not configured.

## Architecture

| Concern                  | Primary files                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------- |
| Facade and REST API      | `billing.service.ts`, `billing.controller.ts`                                       |
| Subscription lifecycle   | `services/subscription-lifecycle.service.ts`                                        |
| Catalog price resolution | `services/price-resolver.service.ts`, `services/product-catalog.service.ts`         |
| Hybrid router            | `services/payment-router.service.ts`, `services/checkout-routing-policy.service.ts` |
| Stripe SDK wrapper       | `stripe.service.ts`                                                                 |
| Stripe MX/SPEI           | `stripe-mx.controller.ts`, `services/stripe-mx*.ts`                                 |
| Paddle                   | `services/paddle.service.ts`                                                        |
| Janua billing            | `janua-billing.service.ts`                                                          |
| Product webhook DLQ      | `services/webhook-dlq.service.ts`, `dlq.controller.ts`                              |
| Usage and credits        | `services/usage-*.ts`, `jobs/overage-invoicing.job.ts`                              |
| Internal POS checkout    | `modules/admin/admin.controller.ts`, `modules/admin/admin-ops.service.ts`           |

## Pricing Source Of Truth

Commercial plan truth lives in [`catalog.yaml`](../../../../../catalog.yaml) and
is synced into Dhanam's product catalog. Do not hard-code commercial pricing in
new billing code or docs.

Current Dhanam managed-cloud tiers in the catalog:

| Tier       | USD monthly | MXN monthly |
| ---------- | ----------- | ----------- |
| Essentials | $4.99       | MXN 79      |
| Pro        | $14.99      | MXN 299     |
| Premium    | $29.99      | MXN 599     |

## API Endpoints

| Endpoint                                                                              | Auth             | Status               | Purpose                                    |
| ------------------------------------------------------------------------------------- | ---------------- | -------------------- | ------------------------------------------ |
| `GET /billing/pricing`                                                                | Public           | Live                 | Regional pricing                           |
| `GET /billing/catalog`                                                                | Public           | Live                 | Product catalog                            |
| `GET /billing/catalog/:slug`                                                          | Public           | Live                 | Product detail                             |
| `GET /billing/checkout`                                                               | Public/allowlist | Live                 | External checkout redirect                 |
| `POST /billing/upgrade`                                                               | User JWT         | Live                 | Authenticated subscription checkout        |
| `POST /billing/portal`                                                                | User JWT         | Live                 | Stripe portal session                      |
| `GET /billing/status`                                                                 | User JWT         | Live                 | Subscription status                        |
| `GET /billing/usage`                                                                  | User JWT         | Live                 | Usage metrics                              |
| `GET /billing/history`                                                                | User JWT         | Live                 | Billing event history array                |
| `POST /billing/stripe-mx/spei-payment-intent`                                         | User JWT         | Live when configured | MXN SPEI PaymentIntent                     |
| `POST /billing/webhooks/stripe`                                                       | Stripe HMAC      | Live                 | Stripe MX event receiver                   |
| `POST /billing/webhook`                                                               | Stripe HMAC      | Legacy               | Legacy Stripe subscription webhook         |
| `POST /billing/webhook/janua`                                                         | Janua HMAC       | Blocked by secrets   | Janua billing webhook                      |
| `POST /billing/madfam-events`                                                         | MADFAM HMAC      | Live                 | Ecosystem revenue event receiver           |
| `GET /billing/dlq` / `POST /billing/dlq/:id/replay` / `POST /billing/dlq/:id/resolve` | Admin JWT        | Live                 | Product-webhook DLQ inspect/replay/resolve |
| `POST /admin/billing/pos/checkout`                                                    | Admin JWT        | Live                 | Internal operator checkout link creation   |
| `POST /admin/billing/pos/status`                                                      | Admin JWT        | Live                 | Stripe checkout session status lookup      |
| `POST /admin/billing/route/preview`                                                   | Admin JWT        | Live                 | Dry-run checkout routing matrix            |
| `POST /admin/billing/pos/charge`                                                      | Admin JWT        | Live                 | Operator PaymentIntent charge              |
| `POST /admin/billing/pos/refund`                                                      | Admin JWT        | Live                 | Operator refund (full/partial)             |
| `GET /admin/billing/pos/timeline/:correlationId`                                      | Admin JWT        | Live                 | POS correlation billing-event timeline     |
| `GET /admin/billing/reconciliation`                                                   | Admin JWT        | Live                 | Flagged reconciliation mismatches          |

## Provider Routing Truth

1. `SubscriptionLifecycleService`: self-service, external, and operator checkout
   orchestrator. Janua when enabled; otherwise hybrid router via
   `CheckoutRoutingPolicyService`, then legacy Stripe fallback.
2. `CheckoutRoutingPolicyService`: records provider, country, currency, and route
   reason; executes hybrid checkout through `PaymentRouterService`.
3. `PaymentRouterService`: `MX -> stripe_mx`, non-MX -> `paddle` implementation.

Use `POST /admin/billing/route/preview` to dry-run routing for a user/plan/country
matrix before changing production flags.

## Internal POS Status

The current internal POS surface creates checkout links for an existing Dhanam
user and records high-severity admin audit events. It supports:

- operator-selected user id, product, plan, country, organization id, and
  optional success/cancel URLs;
- catalog-backed plan resolution through the existing lifecycle path;
- returned provider checkout session ids;
- Stripe checkout status lookup with recent Dhanam `BillingEvent` context;
- admin-only access through the platform admin guard;
- admin UI access at `/pos`.

Still missing before calling this a full POS:

- one-time line-item/cart charges;
- payment method capture, void, refund, and partial refund workflows;
- provider-complete payment/refund state timelines beyond Stripe checkout
  session inspection;
- ledger, settlement, reconciliation, and CFDI proof in the admin UI;
- provider fallback controls and route override policy;
- SDK methods for trusted internal MADFAM callers.

## Webhooks And Ledger

Stripe MX/SPEI is the strongest provider path today:

- inbound Stripe events are signature verified and idempotent on event id;
- linked events persist `BillingEvent` rows;
- canonical `payment.succeeded`, `payment.failed`, and `payment.refunded`
  envelopes are sent to product webhooks;
- downstream failures land in `WebhookDeliveryFailure` for retry/replay.

The direct Conekta webhook path now follows the same core safety pattern for
linked MXN events: signature verification, event-id dedupe, `BillingEvent`
persistence, canonical `payment.*` product fan-out, and DLQ capture on
consumer failure. Remaining Conekta gaps are refund initiation/partial-refund
operations, settlement reconciliation, provider-complete timeline display, and
live-mode operator proof. These are tracked in
[`docs/ROADMAP.md`](../../../../../docs/ROADMAP.md) and
[`docs/TECH_DEBT.md`](../../../../../docs/TECH_DEBT.md).

## Configuration

Required values vary by enabled provider. Do not set placeholder or empty
production values.

```bash
# Stripe legacy/subscription fallback
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_ESSENTIALS_PRICE_ID=price_...
STRIPE_PREMIUM_PRICE_ID=price_...       # Pro tier legacy env fallback
STRIPE_PREMIUM_PLAN_PRICE_ID=price_...  # Premium tier legacy env fallback

# Stripe MX / SPEI
STRIPE_MX_SECRET_KEY=sk_...
STRIPE_MX_WEBHOOK_SECRET=whsec_...
STRIPE_MX_PUBLISHABLE_KEY=pk_...
FEATURE_STRIPE_MXN_LIVE=false

# Paddle
PADDLE_VENDOR_ID=...
PADDLE_API_KEY=...
PADDLE_CLIENT_TOKEN=...
PADDLE_WEBHOOK_SECRET=...

# Janua identity/email relay
JANUA_API_URL=https://api.janua.dev
JANUA_INTERNAL_API_KEY=...
JANUA_ADMIN_KEY=...
DHANAM_WEBHOOK_SECRET=...

# Janua billing checkout proxy (disabled until route/auth contract is verified)
JANUA_BILLING_ENABLED=false
JANUA_API_KEY=...
JANUA_WEBHOOK_SECRET=...

# Product fan-out
PRODUCT_WEBHOOK_URLS=karafiel:https://api.karafiel.mx/api/v1/webhooks/dhanam

# General
WEB_URL=https://app.dhan.am
CHECKOUT_ALLOWED_HOSTS=karafiel.mx,tezca.mx,janua.dev
```

## Security And Stability Rules

- No card data is stored in Dhanam.
- Public checkout return hosts are allowlisted.
- Provider webhooks must be signature verified.
- Replay protection and idempotency are mandatory for money events.
- Admin POS actions are high-severity audit events.
- Unknown plans, unsupported products, and unconfigured providers fail closed.
- Routine production operations remain Enclii-first; raw provider or cluster
  access is bootstrap/break-glass only.

## Testing

```bash
pnpm --dir apps/api test -- billing
pnpm --dir apps/api test -- admin-ops.service.spec.ts
pnpm --dir apps/admin test -- pos-page.test.tsx
pnpm --dir packages/billing-sdk test -- client.spec.ts
```
