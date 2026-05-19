# RFC-5: Connect / Marketplace Support & Outbound Webhooks

**Status:** Draft
**Date:** 2026-04-24
**Authors:** Engineering (with Claude Opus 4.7, 1M context — drafted on behalf of forj stability work)
**Stakeholders:** Billing, Platform, Forj, Janua, all future MADFAM marketplace apps

## Summary

Dhanam today is a B2C subscription-billing facade that routes to Stripe MX, Paddle, and (via Janua) Conekta/Polar. It has no marketplace primitives — no merchant accounts, no split payments, no transfers, no payouts, no disputes, no outbound webhook fabric. Forj (a distributed-manufacturing marketplace) currently talks to Stripe directly because dhanam cannot serve it. This RFC proposes closing that gap so dhanam becomes the ecosystem's canonical billing platform for both B2C subscriptions **and** marketplace/Connect use cases.

The scope splits into three tiers, delivered together:

1. **Marketplace / Connect primitives** — merchant accounts, destination charges, transfers, payouts, disputes, application fees. Stripe is the first (and currently only) adapter that implements them; Paddle and Stripe MX expose a `marketplace: false` capability and return a typed `NotSupportedError`.
2. **Formal `IPaymentProcessor` interface** — extracts the implicit shape every adapter already has into a checked TypeScript contract, with optional marketplace capability bits. Prerequisite to safely adding a fourth processor or migrating customers between two.
3. **Outbound webhooks** — dhanam becomes an event publisher, not just a subscriber. Backed by **self-hosted Svix running on Enclii** (per MADFAM DevOps convention; no external SaaS). Consumer apps register endpoints, receive signed events with retry semantics matching Stripe's, and can replay.

Out of scope for this RFC (filed as follow-ups): SetupIntent / saved-payment-method UX, 3D-Secure enforcement, processor-to-processor customer migration, Stripe Tax beyond RFC collection.

## Context

### Why now

Forj's browser-verified production state on 2026-04-24 showed the marketplace is functionally depending on Stripe Connect (`stripe.accounts.create`, `stripe.accountLinks.create`, `stripe.transfers.create`, `stripe.refunds.create`, dispute handling, 8 webhook event types). A stakeholder requested replacing Stripe with dhanam. Investigation (see forj#42) confirmed dhanam cannot serve this today. Forj needs it. Every future MADFAM marketplace-shaped product will need it. Building it once on dhanam, instead of once-per-app on raw Stripe, is the correct platform investment.

### What dhanam already has (keep, don't rebuild)

| Capability                                                      | Status | Evidence                                                           |
| --------------------------------------------------------------- | ------ | ------------------------------------------------------------------ |
| Multi-processor routing by geography                            | ✅     | `payment-router.service.ts:88-106`                                 |
| Subscription lifecycle (create/upgrade/pause/cancel/resume)     | ✅     | `billing.controller.ts`, `cancellation.service.ts`                 |
| Self-service billing portal                                     | ✅     | `stripe-mx.service.ts:279-292`, `stripe.service.ts` portal methods |
| Inbound webhook receiver, idempotent via `stripeEventId` unique | ✅     | `webhook-processor.service.ts`, schema L1168                       |
| Usage metering + daily quotas + alerts                          | ✅     | `usage-tracking.service.ts`                                        |
| Regional pricing (MXN / USD) + tier catalog                     | ✅     | `pricing-engine.service.ts`                                        |
| Tax (Stripe MX RFC collection, Paddle MoR)                      | ✅     | `stripe-mx.service.ts:146-150`                                     |
| Refund coordination via webhook events                          | ✅     | `BillingEventType.refund_issued`                                   |
| `@dhanam/billing-sdk` v0.2.0 published to `npm.madfam.io`       | ✅     | `packages/billing-sdk/`                                            |

### What's missing

**Marketplace / Connect:** No adapter has `createMerchantAccount`, `createDestinationCharge`, `createTransfer`, `createPayout`, `getMerchantBalance`, or `disputeEvidence` methods. No Prisma models for `MerchantAccount`, `Transfer`, `Payout`, `Dispute`, `ApplicationFee`. No routes. No webhook handlers for `account.updated`, `charge.dispute.*`, `payout.*`, `transfer.*`, `person.*`.

**Outbound webhook fabric:** Dhanam emits zero webhooks to consumer apps. The only cross-service event path today is the transactional-outbox proposal in RFC-4D (`cross-service-event-bus.md`), which hasn't shipped. Consumer apps have no way to subscribe to billing events — they would have to poll or rely on direct Janua coupling.

**Adapter contract:** `StripeService`, `StripeMxService`, and `PaddleService` independently implement near-identical method names with no enforced contract. Method-signature drift is a live risk and blocks clean addition of Conekta/Polar as first-class adapters.

## Proposal

### 1. `IPaymentProcessor` interface

A new file `apps/api/src/modules/billing/services/payment-processor.interface.ts` defines:

```ts
export type ProcessorId = 'stripe' | 'stripe_mx' | 'paddle' | 'conekta' | 'polar';

export interface ProcessorCapabilities {
  subscriptions: boolean;
  oneOffCharges: boolean;
  marketplace: boolean; // accounts, destination charges, transfers, payouts
  disputes: boolean;
  threeDSecure: boolean;
  taxCompliance: 'merchant-of-record' | 'automatic' | 'manual' | 'none';
}

export interface IPaymentProcessor {
  readonly id: ProcessorId;
  readonly capabilities: ProcessorCapabilities;

  // Customer (all processors)
  createCustomer(input: CreateCustomerInput): Promise<CustomerHandle>;
  getCustomer(externalId: string): Promise<CustomerHandle>;

  // Subscriptions (most processors)
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSessionHandle>;
  cancelSubscription(externalId: string, opts?: CancelOptions): Promise<void>;
  pauseSubscription(externalId: string, until: Date): Promise<void>;
  resumeSubscription(externalId: string): Promise<void>;

  // Marketplace (capability-gated — throws NotSupportedError otherwise)
  createMerchantAccount?(input: CreateMerchantInput): Promise<MerchantAccountHandle>;
  createMerchantOnboardingLink?(externalId: string, returnUrl: string): Promise<OnboardingLink>;
  getMerchantAccount?(externalId: string): Promise<MerchantAccountHandle>;
  createDestinationCharge?(input: CreateDestinationChargeInput): Promise<ChargeHandle>;
  createTransfer?(input: CreateTransferInput): Promise<TransferHandle>;
  createPayout?(input: CreatePayoutInput): Promise<PayoutHandle>;
  getMerchantBalance?(externalId: string): Promise<MerchantBalance>;
  submitDisputeEvidence?(externalId: string, evidence: DisputeEvidence): Promise<DisputeHandle>;

  // Webhooks
  verifyWebhookSignature(body: string, signature: string): Promise<VerifiedEvent>;
}
```

All three existing services conform; `StripeService` gets the marketplace methods implemented, `StripeMxService` and `PaddleService` leave them undefined (interface makes them optional), and a `MarketplaceCapabilityGuard` throws `NotSupportedError` at the router layer if a caller asks for marketplace routing against a non-capable processor.

### 2. Prisma schema additions

```prisma
model MerchantAccount {
  id                  String    @id @default(cuid())
  userId              String
  user                User      @relation(fields: [userId], references: [id])
  processorId         String    // 'stripe' | 'stripe_mx' | 'paddle' | ...
  externalAccountId   String    // Stripe acct_XXX etc.
  country             String
  defaultCurrency     Currency

  chargesEnabled      Boolean   @default(false)
  payoutsEnabled      Boolean   @default(false)
  detailsSubmitted    Boolean   @default(false)
  requirements        Json?     // { currently_due, past_due, disabled_reason }

  businessType        String?   // 'individual' | 'company'
  metadata            Json?

  createdAt           DateTime  @default(now())
  onboardedAt         DateTime?
  disabledAt          DateTime?
  updatedAt           DateTime  @updatedAt

  transfers           Transfer[]
  payouts             Payout[]
  disputes            Dispute[]
  applicationFees     ApplicationFee[]

  @@unique([processorId, externalAccountId])
  @@index([userId])
}

model Transfer {
  id                  String    @id @default(cuid())
  merchantAccountId   String
  merchantAccount     MerchantAccount @relation(fields: [merchantAccountId], references: [id])

  externalTransferId  String
  sourceChargeId      String?   // links to the originating destination charge
  amount              Decimal   @db.Decimal(12, 2)
  currency            Currency
  status              String    // 'pending' | 'paid' | 'failed' | 'reversed'
  failureCode         String?
  metadata            Json?

  createdAt           DateTime  @default(now())
  reversedAt          DateTime?

  @@unique([externalTransferId])
  @@index([merchantAccountId])
  @@index([sourceChargeId])
}

model Payout {
  id                  String    @id @default(cuid())
  merchantAccountId   String
  merchantAccount     MerchantAccount @relation(fields: [merchantAccountId], references: [id])

  externalPayoutId    String
  amount              Decimal   @db.Decimal(12, 2)
  currency            Currency
  status              String    // 'pending' | 'in_transit' | 'paid' | 'failed' | 'canceled'
  method              String?   // 'standard' | 'instant'
  arrivalDate         DateTime?
  failureCode         String?
  metadata            Json?

  createdAt           DateTime  @default(now())
  paidAt              DateTime?
  failedAt            DateTime?

  @@unique([externalPayoutId])
  @@index([merchantAccountId])
  @@index([status])
}

model Dispute {
  id                  String    @id @default(cuid())
  merchantAccountId   String
  merchantAccount     MerchantAccount @relation(fields: [merchantAccountId], references: [id])

  externalDisputeId   String
  externalChargeId    String
  amount              Decimal   @db.Decimal(12, 2)
  currency            Currency
  reason              String    // 'fraudulent' | 'duplicate' | 'product_not_received' | ...
  status              String    // 'warning_needs_response' | 'needs_response' | 'under_review' | 'won' | 'lost'
  evidenceDueBy       DateTime?
  evidence            Json?
  metadata            Json?

  createdAt           DateTime  @default(now())
  resolvedAt          DateTime?

  @@unique([externalDisputeId])
  @@index([merchantAccountId])
  @@index([status])
}

model ApplicationFee {
  id                  String    @id @default(cuid())
  merchantAccountId   String
  merchantAccount     MerchantAccount @relation(fields: [merchantAccountId], references: [id])

  externalFeeId       String
  externalChargeId    String
  amount              Decimal   @db.Decimal(12, 2)
  currency            Currency
  refunded            Boolean   @default(false)
  refundedAmount      Decimal?  @db.Decimal(12, 2)
  metadata            Json?

  createdAt           DateTime  @default(now())

  @@unique([externalFeeId])
  @@index([merchantAccountId])
}

model WebhookEndpoint {
  id                  String    @id @default(cuid())
  consumerAppId       String    // 'forj', 'karafiel', etc.
  url                 String
  svixEndpointId      String?   @unique  // populated after Svix registration
  subscribedEvents    String[]  // ['payment.succeeded', 'subscription.created', ...]
  description         String?
  active              Boolean   @default(true)
  metadata            Json?

  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  disabledAt          DateTime?

  deliveries          WebhookDelivery[]

  @@index([consumerAppId])
  @@index([active])
}

model WebhookDelivery {
  id                  String    @id @default(cuid())
  webhookEndpointId   String
  webhookEndpoint     WebhookEndpoint @relation(fields: [webhookEndpointId], references: [id])

  eventType           String    // 'payment.succeeded', 'merchant.onboarded', ...
  eventId             String    // dhanam-side event id, unique
  svixMessageId       String?   // populated after Svix accepts the message
  payload             Json
  lastStatus          Int?      // HTTP status from last attempt
  attempts            Int       @default(0)
  deliveredAt         DateTime?
  lastAttemptAt       DateTime?

  createdAt           DateTime  @default(now())

  @@index([webhookEndpointId])
  @@index([eventId])
  @@index([deliveredAt])
}
```

Also: add a `merchantAccounts MerchantAccount[]` back-reference on the existing `User` model.

Migration file: `20260424000000_add_marketplace_and_webhook_schema`.

### 3. NestJS modules

**`MarketplaceModule`** (new): `apps/api/src/modules/marketplace/`

- `marketplace.module.ts`
- `merchants.controller.ts` → `POST/GET /billing/merchants`, `POST /billing/merchants/:id/onboarding-link`, `GET /billing/merchants/:id/balance`
- `charges.controller.ts` → `POST /billing/charges` (destination charges)
- `transfers.controller.ts` → `POST/GET /billing/transfers`
- `payouts.controller.ts` → `POST/GET /billing/payouts`
- `disputes.controller.ts` → `GET /billing/disputes/:id`, `POST /billing/disputes/:id/evidence`
- `services/merchant.service.ts`
- `services/charge.service.ts`
- `services/transfer.service.ts`
- `services/payout.service.ts`
- `services/dispute.service.ts`

All injected through the existing `BillingModule` to share the adapter pool.

**`WebhookOutboundModule`** (new): `apps/api/src/modules/webhook-outbound/`

- `webhook-outbound.module.ts`
- `endpoints.controller.ts` → `POST/GET/DELETE /billing/webhook-endpoints`, `POST /.../:id/replay-failed`
- `services/svix.client.ts` — thin wrapper around `svix` npm package pointing at `SVIX_API_URL` env var (self-hosted URL, e.g. `http://svix.svix-system.svc.cluster.local:8071`)
- `services/event-dispatcher.service.ts` — called from `WebhookProcessorService` and the new marketplace services when a billable event occurs

### 4. Self-hosted Svix on Enclii

Svix deploys as a standalone service on the MADFAM k3s cluster — per DevOps convention, no external SaaS. Required K8s manifests (filed as a follow-up PR on `internal-devops`, not this PR):

```
infra/k8s/production/svix/
  namespace.yaml
  postgres.yaml       (dedicated Svix DB, Longhorn-backed)
  redis.yaml          (Svix queue)
  server.yaml         (Deployment: svix/svix-server:latest)
  service.yaml        (ClusterIP :8071)
  network-policy.yaml
```

Dhanam accesses Svix via `SVIX_API_URL` + `SVIX_AUTH_TOKEN` secrets. No public egress. All webhook delivery from Svix to consumer apps stays inside the cluster network (via Cloudflare tunnel to the consumer service's public URL) or to external URLs via a dedicated egress NetworkPolicy.

### 5. SDK updates (`@dhanam/billing-sdk` → v0.3.0)

New exports:

- `DhanamClient.merchants.create / get / onboardingLink / balance`
- `DhanamClient.charges.createDestinationCharge`
- `DhanamClient.transfers.create / list`
- `DhanamClient.payouts.create / list`
- `DhanamClient.disputes.get / submitEvidence`
- `DhanamClient.webhooks.registerEndpoint / listEndpoints / deleteEndpoint / replayFailed`
- `verifyMarketplaceWebhookSignature` — identical signature format to the existing subscription webhook, so consumers can use one verifier

New event types in `DhanamWebhookEventType`:

- `merchant.onboarded`
- `merchant.disabled`
- `merchant.requirements_updated`
- `charge.succeeded`
- `charge.refunded`
- `charge.dispute.created`
- `charge.dispute.updated`
- `charge.dispute.closed`
- `transfer.created`
- `transfer.reversed`
- `payout.paid`
- `payout.failed`

### 6. Webhook event taxonomy (canonical)

All outbound events share the envelope:

```ts
{
  id: string;                    // dhanam-side event id, idempotent
  type: DhanamWebhookEventType;  // see above
  created: number;               // unix seconds
  livemode: boolean;
  data: {
    object: <type-specific payload>;
    previous_attributes?: <for .updated events>;
  };
  metadata?: Record<string, string>;
}
```

Svix signs with its standard `svix-id`, `svix-timestamp`, `svix-signature` headers. The SDK verifier accepts both this and legacy `x-janua-signature` headers for back-compat.

### 7. Security & compliance

- **Signing keys**: Svix issues per-endpoint signing keys; SDK verifies with timing-safe comparison (already in `packages/billing-sdk/src/webhook.ts`).
- **Replay protection**: `svix-timestamp` rejects events older than 5 minutes.
- **Endpoint allowlist**: dhanam validates the registered URL against `WEBHOOK_ENDPOINT_HOST_ALLOWLIST` (env), mirroring the existing `PUBLIC_CHECKOUT_ALLOWED_HOSTS` pattern in the billing controller.
- **PCI scope**: unchanged. dhanam never holds card data; Stripe Connect's direct-charge and destination-charge flows keep cards inside Stripe's PCI boundary just like the current B2C flows.
- **Merchant KYC**: relies on Stripe Connect's built-in KYC via `accountLinks`. No MetaMap integration in this RFC; existing `kycVerified` on User continues to represent consumer-side KYC for Dhanam's own subscribers.

### 8. Rollout plan

1. **Land this PR to a feature branch on main, open PR for dhanam team review.** No prod impact.
2. **Dhanam team reviews RFC + code together.** Tests pass in CI; adapter refactor is backward-compatible (existing subscription flows untouched).
3. **Merge RFC + code + migration behind feature flags.** New controllers guarded by `MARKETPLACE_ENABLED=false` by default.
4. **Deploy Svix to staging cluster.** `SVIX_API_URL` pointed at staging; dhanam `WEBHOOK_OUTBOUND_ENABLED=false` in prod during this window.
5. **Pilot with forj in staging.** Migrate one test merchant through onboarding → charge → transfer → payout. Verify webhooks fire, retries work, SDK verifies.
6. **Deploy Svix to production** (separate `internal-devops` PR).
7. **Flip `MARKETPLACE_ENABLED=true` on dhanam prod.** Enable `WEBHOOK_OUTBOUND_ENABLED=true` in the same rollout window.
8. **Migrate forj off direct Stripe Connect, onto `@dhanam/billing-sdk@0.3.0`.** Separate forj PR.
9. **Decommission forj's direct `stripe` dependency** after a 30-day soak window.

Expected calendar: 3 weeks from merge of this PR to forj fully migrated. 6 weeks if Svix self-host onboarding on Enclii takes a sprint (it shouldn't — Svix has battle-tested Helm charts).

### 9. What this PR delivers vs. defers

**Delivered in this PR:**

- RFC (this document)
- `IPaymentProcessor` interface + all three existing adapters conforming
- Prisma schema migration
- `StripeService` marketplace method implementations
- `MarketplaceModule` controllers + services
- `WebhookOutboundModule` + Svix client wrapper
- `BillingController` webhook router updated to dispatch Connect events
- SDK updates
- Tests at ~47% coverage ratio matching current billing module standard

**Deferred (separate issues on dhanam repo):**

- SetupIntent / saved payment methods (tier 4)
- 3D-Secure enforcement (tier 4)
- Processor-to-processor customer migration (tier 4)
- Stripe Tax beyond RFC collection (tier 4)
- Real Stripe integration testing (needs test-mode account + CI Stripe CLI wiring)
- Svix self-host deployment manifests (filed as `internal-devops` PR)

### 10. Open questions

1. **Do we want to support Paddle for marketplace eventually?** Paddle recently launched a "marketplace" product but it's less mature than Stripe Connect. Recommended: no for MVP, revisit after 6 months of production Connect usage.
2. **Outbound webhook consumer allowlist — allowlist by consumer-app ID or free-form URL?** This RFC picks consumer-app ID (like forj, karafiel) registered at env level, with URL allowlist within that. Alternatives welcome.
3. **Do we need `charge.captured` vs `charge.succeeded` separation?** Stripe has both because it supports auth/capture split. This RFC omits auth/capture (deferred). Revisit when tier 4 lands.
4. **Svix vs. hand-rolled decision — do we want to lock in Svix long-term?** Per directive 2026-04-24, Svix self-hosted on Enclii is the chosen path. This is reversible — the `SvixClient` wrapper is the only Svix-aware class; a hand-rolled backend could replace it without touching any of `MarketplaceModule`, controllers, or the SDK.

## Appendix: file manifest

**New files:**

- `docs/rfcs/connect-marketplace.md` (this document)
- `apps/api/src/modules/billing/services/payment-processor.interface.ts`
- `apps/api/src/modules/marketplace/marketplace.module.ts`
- `apps/api/src/modules/marketplace/*.controller.ts` (5)
- `apps/api/src/modules/marketplace/services/*.service.ts` (5)
- `apps/api/src/modules/webhook-outbound/webhook-outbound.module.ts`
- `apps/api/src/modules/webhook-outbound/endpoints.controller.ts`
- `apps/api/src/modules/webhook-outbound/services/svix.client.ts`
- `apps/api/src/modules/webhook-outbound/services/event-dispatcher.service.ts`
- `apps/api/prisma/migrations/20260424000000_add_marketplace_and_webhook_schema/migration.sql`

**Modified files:**

- `apps/api/prisma/schema.prisma` (add 7 models + User relation back-ref)
- `apps/api/src/modules/billing/stripe.service.ts` (add marketplace methods)
- `apps/api/src/modules/billing/services/stripe-mx.service.ts` (conform interface, capabilities)
- `apps/api/src/modules/billing/services/paddle.service.ts` (conform interface, capabilities)
- `apps/api/src/modules/billing/services/webhook-processor.service.ts` (dispatch new Connect events → outbound dispatcher)
- `apps/api/src/modules/billing/billing.controller.ts` (route new webhook event types)
- `apps/api/src/modules/billing/billing.module.ts` (import MarketplaceModule, WebhookOutboundModule)
- `apps/api/src/app.module.ts` (register new modules)
- `apps/api/package.json` (add `svix` dependency)
- `packages/billing-sdk/src/index.ts` (export new methods + types)
- `packages/billing-sdk/src/client.ts` (new DhanamClient methods)
- `packages/billing-sdk/src/types.ts` (new request/response types)
- `packages/billing-sdk/package.json` (bump to 0.3.0)

**Test files** (new, co-located under `__tests__/`):

- Adapter conformance test (every processor implements the interface)
- Stripe Connect service unit tests
- Marketplace controller E2E tests
- Webhook-outbound dispatcher tests
- SDK type tests

---

_This RFC is implemented in the same PR as the RFC itself lands. Reviewers: please evaluate the proposal and the code together — the implementation is the proof the proposal is tractable._
