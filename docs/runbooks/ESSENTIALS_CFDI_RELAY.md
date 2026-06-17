# Essentials CFDI relay (Dhanam ↔ Karafiel)

Last Updated: 2026-06-17

> Public-safe operator pointer. Canonical cutover steps live in
> `internal-devops/runbooks/2026-06-16-dhanam-essentials-full-ga-monetization-run.md`.

## Flow

1. Stripe MX Checkout (Essentials, MXN 79/mo) captures `buyer_rfc` on the session.
2. `stripe-mx-spei-relay.service` emits a signed `payment.succeeded` envelope to Karafiel
   (`buyer_rfc`, `payment_id` = Stripe PaymentIntent id).
3. Karafiel auto-issues CFDI when `FEATURE_CFDI_AUTO_ISSUE=true` and emisor CSD is configured.
4. Karafiel callbacks `POST /v1/internal/billing/cfdi-issued` (HMAC via `DHANAM_WEBHOOK_SECRET`).
5. `CfdiTimelineService.attachCfdiUuid` writes `cfdiUuid` onto matching `BillingEvent.metadata`.

## Source (merged PR #573)

| Component            | Path                                                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Relay envelope       | `apps/api/src/modules/billing/services/stripe-mx-spei-relay.service.ts`                                               |
| Buyer RFC extraction | `apps/api/src/modules/billing/services/stripe-mx.service.ts`                                                          |
| Callback controller  | `apps/api/src/modules/billing/internal-cfdi.controller.ts`                                                            |
| Timeline merge       | `apps/api/src/modules/billing/services/cfdi-timeline.service.ts`                                                      |
| Tests                | `__tests__/internal-cfdi.controller.spec.ts`, `cfdi-timeline.service.spec.ts`, `stripe-mx-spei-relay.service.spec.ts` |

## Preflight scripts

```bash
# Prod route + pricing (expects stripe_mx / priceIdResolvable)
./scripts/essentials-purchase-preflight.sh

# Staging commercial smoke (Essentials anchor SKU section)
STAGING_API_URL=https://staging-api.dhan.am ./scripts/staging-commercial-smoke.sh
```

**Staging note:** `route-recommendation` returns 404 on staging until the staging API digest
includes PR #571+ (Essentials checkout routing). Prod is the source of truth for route checks
until staging is promoted.

## Related debt

- TD-1010 — end-to-end Karafiel CFDI proof on admin POS timeline (see `docs/TECH_DEBT.md`).
