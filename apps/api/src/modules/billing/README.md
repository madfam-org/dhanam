# Billing Module

Last updated: 2026-06-12

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
- The internal POS is a source-level admin console at
  `POST /admin/billing/pos/*`, route preview at
  `POST /admin/billing/route/preview`, and `apps/admin/src/app/(dashboard)/pos`.
  It supports operator checkout links, Stripe checkout status, direct
  PaymentIntent charge/refund, correlation timelines, and reconciliation
  summary. Staging proof runs via
  [`scripts/staging-commercial-smoke.sh`](../../../../../scripts/staging-commercial-smoke.sh)
  (see [Commercial GA Execution](../../../docs/COMMERCIAL_GA_EXECUTION.md)).
- Janua identity relay and centralized email use the shared internal Janua key
  and Dhanam webhook secret. Janua-routed checkout remains explicitly disabled
  with `JANUA_BILLING_ENABLED=false` until the Dhanam client route/auth contract
  is aligned to Janua production and an end-to-end Janua checkout has been
  verified.
- `CheckoutRoutingPolicyService` wires subscription, external, and operator
  checkout through `PaymentGatewayRegistry` → `PaymentRouterService` when Janua
  billing is disabled (`FEATURE_UNIFIED_CHECKOUT_ROUTING=true`, default). MX
  routes to Stripe MX; non-MX routes to Paddle. Legacy US Stripe remains the
  fallback when hybrid providers are not configured.
- **Fee-aware routing:** `PaymentRouteOptimizerService` ranks provider × payment
  instrument by estimated merchant + FX cost using
  `config/payment-route-fee-schedule.json` (bundled) or an optional
  `platform_config` override (`billing.route_fee_schedule`). Public
  `GET /billing/checkout/route-recommendation` and upgrade `paymentMethod`
  flow through the optimizer when unified routing is enabled.

See [ADR-008](../../../docs/adr/008-integration-planes-janua-vs-direct.md) for
the identity vs financial-data vs money-movement separation model.

## Architecture

| Concern                  | Primary files                                                                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Facade and REST API      | `billing.service.ts`, `billing.controller.ts`                                                                                             |
| Subscription lifecycle   | `services/subscription-lifecycle.service.ts`                                                                                              |
| Catalog price resolution | `services/price-resolver.service.ts`, `services/product-catalog.service.ts`                                                               |
| Checkout policy          | `services/checkout-routing-policy.service.ts`                                                                                             |
| Fee schedule + optimizer | `config/payment-route-fee-schedule.json`, `services/payment-route-fee-schedule.service.ts`, `services/payment-route-optimizer.service.ts` |
| Payment gateway port     | `gateways/payment-gateway.port.ts`, `gateways/payment-gateway.registry.ts`                                                                |
| Hybrid router            | `services/payment-router.service.ts`                                                                                                      |
| Stripe SDK wrapper       | `stripe.service.ts`                                                                                                                       |
| Stripe MX/SPEI           | `stripe-mx.controller.ts`, `services/stripe-mx*.ts`, `gateways/stripe-mx.gateway.ts`                                                      |
| Paddle                   | `services/paddle.service.ts`, `gateways/paddle.gateway.ts`                                                                                |
| Conekta direct           | `services/conekta.service.ts`, `gateways/conekta.gateway.ts`                                                                              |
| Janua billing adapter    | `janua-billing.service.ts`, `gateways/janua-billing.gateway.ts`                                                                           |
| Product webhook DLQ      | `services/webhook-dlq.service.ts`, `dlq.controller.ts`                                                                                    |
| Usage and credits        | `services/usage-*.ts`, `jobs/overage-invoicing.job.ts`                                                                                    |
| Internal POS checkout    | `modules/admin/admin-pos-billing.service.ts`, `services/internal-pos.service.ts`                                                          |

## Pricing Source Of Truth

Commercial plan truth lives in [`catalog.yaml`](../../../../../catalog.yaml) and
is synced into Dhanam's product catalog. Do not hard-code commercial pricing in
new billing code or docs.

The public catalog endpoints serve `catalog.yaml` directly in production
(`DHANAM_PUBLIC_CATALOG_SOURCE=file` or unset with `NODE_ENV=production`). The
database catalog remains the Stripe/checkout reconciliation store populated by
`scripts/sync-catalog.ts`; it must not be the only public catalog source because
stale DB rows or connection pressure would otherwise hide the canonical MADFAM
SKU catalogue from downstream systems such as Tulana.

Janua's active catalogue scope is intentionally limited to the self-hosted Open
Source tier. Janua public docs currently mark managed SaaS hosting, enterprise
support contracts, and guaranteed uptime SLAs as unavailable or future roadmap
items, so those tiers must not be exposed in the active Dhanam catalogue until
the product repo and operator evidence prove they are current offers.

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
| `GET /billing/checkout/route-recommendation`                                          | Public           | Live                 | Fee-optimal route + instrument suggestions |
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
| `GET /admin/billing/route/fee-schedule`                                               | Admin JWT        | Live                 | View bundled or platform fee schedule      |
| `PUT /admin/billing/route/fee-schedule`                                               | Admin JWT        | Live                 | Upsert platform fee schedule override      |
| `DELETE /admin/billing/route/fee-schedule`                                            | Admin JWT        | Live                 | Clear platform override (revert to JSON)   |
| `POST /admin/billing/route/override`                                                  | Admin JWT        | Live                 | Audited per-user provider override         |
| `POST /admin/billing/route/override/clear`                                            | Admin JWT        | Live                 | Clear per-user provider override           |
| `POST /admin/billing/pos/charge`                                                      | Admin JWT        | Live                 | Operator PaymentIntent charge              |
| `POST /admin/billing/pos/refund`                                                      | Admin JWT        | Live                 | Operator refund (full/partial)             |
| `GET /admin/billing/pos/timeline/:correlationId`                                      | Admin JWT        | Live                 | POS correlation billing-event timeline     |
| `GET /admin/billing/reconciliation`                                                   | Admin JWT        | Live                 | Flagged reconciliation mismatches          |

## Provider Routing Truth

1. `SubscriptionLifecycleService`: self-service, external, and operator checkout
   orchestrator. Janua when enabled; otherwise hybrid router via
   `CheckoutRoutingPolicyService`, then legacy Stripe fallback.
2. `CheckoutRoutingPolicyService`: records provider, country, currency, route
   reason, and optional fee optimization metadata; executes hybrid checkout
   through `PaymentRouterService`.
3. `PaymentRouteOptimizerService`: ranks checkout instruments by estimated PSP
   fees; used by route preview, public recommendations, and upgrade when
   `paymentMethod` is supplied.
4. `PaymentRouterService`: `MX -> stripe_mx`, non-MX -> `paddle` implementation.

Use `POST /admin/billing/route/preview` to dry-run routing for a user/plan/country
matrix before changing production flags. Maintain PSP rate assumptions via the
admin **Fee Schedule** tab or `PUT /admin/billing/route/fee-schedule`. Validate
bundled JSON in CI with
[`scripts/validate-payment-route-fee-schedule.mjs`](../../../../../scripts/validate-payment-route-fee-schedule.mjs).

## Internal POS Status

The current internal POS surface supports:

- operator-selected user id, product, plan, country, organization id, and
  optional success/cancel URLs;
- catalog-backed plan resolution through the unified routing policy;
- returned provider checkout session ids;
- Stripe checkout status lookup with recent Dhanam `BillingEvent` context;
- direct PaymentIntent charge and full/partial refund (Stripe MX / legacy Stripe);
- correlation timelines and flagged reconciliation mismatches;
- admin-only access through the platform admin guard;
- tabbed admin UI at `/pos` (subscription, route preview, fee schedule,
  charge/refund, timeline/reconcile);
- web landing pricing and `/billing/upgrade` show fee-optimal instrument
  recommendations; upgrade passes `countryCode` + `paymentMethod` to checkout.

See [Commercial GA Execution](../../../docs/COMMERCIAL_GA_EXECUTION.md) for
staging soak and production promotion checklists.

Still missing before **commercial GA (G2)** sign-off:

- Karafiel CFDI / egreso proof in the admin POS timeline on staging;
- Conekta charge/refund in the operator POS path (Scope B);
- golden end-to-end revenue probes executed per MADFAM product on staging;
- production DLQ replay drill evidence;
- G2 sign-off checklist execution (see WS6).

Track progress in [Commercial GA Execution](../../../docs/COMMERCIAL_GA_EXECUTION.md).

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
pnpm --dir apps/api test -- admin-pos-billing.service.spec.ts
pnpm --dir apps/api test -- payment-route-
node scripts/validate-payment-route-fee-schedule.mjs
pnpm --dir apps/admin test -- pos-page.test.tsx
pnpm --dir packages/billing-sdk test
bash scripts/staging-commercial-smoke.test.sh
# optional live staging probe:
# RUN_STAGING_COMMERCIAL_SMOKE_LIVE=true bash scripts/staging-commercial-smoke.test.sh
```
