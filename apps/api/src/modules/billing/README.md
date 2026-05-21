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
- `PaymentRouterService` exists for the Stripe MX/Paddle hybrid router, but the
  primary `/billing/upgrade` and public `/billing/checkout` lifecycle still use
  Janua-first/direct-Stripe logic. Treat router unification as active roadmap
  work, not complete commercial stability.

## Architecture

| Concern                  | Primary files                                                               |
| ------------------------ | --------------------------------------------------------------------------- |
| Facade and REST API      | `billing.service.ts`, `billing.controller.ts`                               |
| Subscription lifecycle   | `services/subscription-lifecycle.service.ts`                                |
| Catalog price resolution | `services/price-resolver.service.ts`, `services/product-catalog.service.ts` |
| Hybrid router            | `services/payment-router.service.ts`                                        |
| Stripe SDK wrapper       | `stripe.service.ts`                                                         |
| Stripe MX/SPEI           | `stripe-mx.controller.ts`, `services/stripe-mx*.ts`                         |
| Paddle                   | `services/paddle.service.ts`                                                |
| Janua billing            | `janua-billing.service.ts`                                                  |
| Product webhook DLQ      | `services/webhook-dlq.service.ts`, `dlq.controller.ts`                      |
| Usage and credits        | `services/usage-*.ts`, `jobs/overage-invoicing.job.ts`                      |
| Internal POS checkout    | `modules/admin/admin.controller.ts`, `modules/admin/admin-ops.service.ts`   |

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

| Endpoint                                            | Auth             | Status               | Purpose                                  |
| --------------------------------------------------- | ---------------- | -------------------- | ---------------------------------------- |
| `GET /billing/pricing`                              | Public           | Live                 | Regional pricing                         |
| `GET /billing/catalog`                              | Public           | Live                 | Product catalog                          |
| `GET /billing/catalog/:slug`                        | Public           | Live                 | Product detail                           |
| `GET /billing/checkout`                             | Public/allowlist | Live                 | External checkout redirect               |
| `POST /billing/upgrade`                             | User JWT         | Live                 | Authenticated subscription checkout      |
| `POST /billing/portal`                              | User JWT         | Live                 | Stripe portal session                    |
| `GET /billing/status`                               | User JWT         | Live                 | Subscription status                      |
| `GET /billing/usage`                                | User JWT         | Live                 | Usage metrics                            |
| `GET /billing/history`                              | User JWT         | Live                 | Billing event history array              |
| `POST /billing/stripe-mx/spei-payment-intent`       | User JWT         | Live when configured | MXN SPEI PaymentIntent                   |
| `POST /billing/webhooks/stripe`                     | Stripe HMAC      | Live                 | Stripe MX event receiver                 |
| `POST /billing/webhook`                             | Stripe HMAC      | Legacy               | Legacy Stripe subscription webhook       |
| `POST /billing/webhook/janua`                       | Janua HMAC       | Blocked by secrets   | Janua billing webhook                    |
| `POST /billing/madfam-events`                       | MADFAM HMAC      | Live                 | Ecosystem revenue event receiver         |
| `GET /billing/dlq` / `POST /billing/dlq/:id/replay` | Admin JWT        | Live                 | Product-webhook DLQ inspection/replay    |
| `POST /admin/billing/pos/checkout`                  | Admin JWT        | Source landed        | Internal operator checkout link creation |
| `POST /admin/billing/pos/status`                    | Admin JWT        | Source landed        | Stripe checkout session status lookup    |

## Provider Routing Truth

There are two routing layers today:

1. `SubscriptionLifecycleService`: the currently wired self-service and public
   checkout path. It attempts Janua when enabled, otherwise direct Stripe.
2. `PaymentRouterService`: the hybrid router implementation for `MX ->
stripe_mx` and non-MX -> `paddle`. It is tested and registered, but not yet
   the sole checkout system of record.

Full commercial stability requires unifying these paths behind one explicit
policy that records provider, country, product, plan, currency, price source,
and routing reason for every checkout.

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

Commercial gaps remain for Conekta direct, unlinked revenue events, and full
provider parity. These are tracked in
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
