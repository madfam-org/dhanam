# ADR-007: Conekta Dependency and Janua Payment Routing

## Status

**Superseded by [ADR-008](008-integration-planes-janua-vs-direct.md)** — May 2026

> Historical record only. G2 commercial architecture uses Dhanam as the billing
> boundary with direct Stripe MX / Paddle / Conekta adapters behind
> `PaymentGatewayRegistry`. Janua billing remains an optional gateway when
> `JANUA_BILLING_ENABLED=true`. See ADR-008 for the current model.

## Context

During the evaluation of payment providers for Dhanam's Mexico-first market, Conekta was considered as a payment processor. Conekta is a Mexican-born payment platform that supports SPEI, OXXO, and card payments. It has strong local presence and is a common choice for Mexican fintech companies.

The evaluation occurred alongside a broader analysis of the MADFAM ecosystem's payment architecture. Dhanam's authentication and billing are tightly coupled to Janua, which acts as the SSO platform and billing orchestrator for all MADFAM products (see ADR-004). The Janua billing service (`JanuaBillingService`) creates customers in the appropriate payment provider, manages subscription lifecycle events, and routes webhooks to downstream services.

### Options Evaluated

1. **Conekta as a standalone payment provider.** Dhanam integrates Conekta directly for Mexican payment methods (SPEI, OXXO, cards), maintaining a separate code path from the existing Stripe integration.

2. **Conekta behind Janua's billing abstraction.** Janua adds Conekta as a second billing provider, and Dhanam interacts with Conekta indirectly through Janua's unified billing API.

3. **Stripe MX only.** Use Stripe's native Mexican payment method support (SPEI, OXXO, cards) through the existing Stripe integration, routed through Janua's billing layer.

### Constraints

- Dhanam must not implement custom authentication or billing outside the MADFAM ecosystem (see CLAUDE.md critical dependencies).
- Any payment provider must be compatible with Janua's billing orchestration model.
- Engineering capacity favors reuse of existing integrations over adding new provider code paths.
- The Stripe integration is already production-ready in `apps/api/src/modules/billing/`.

## Decision

**Accept the Janua dependency for payment routing and use Stripe MX as the sole payment provider. Do not integrate Conekta.**

Stripe MX covers the three payment methods required for the Mexican market:

| Payment Method               | Stripe MX Support                          | Conekta Equivalent       |
| ---------------------------- | ------------------------------------------ | ------------------------ |
| SPEI (bank transfers)        | Yes, via `customer_balance` payment method | Yes, native SPEI support |
| OXXO (cash vouchers)         | Yes, via voucher payment method            | Yes, native OXXO support |
| Card payments (Visa/MC/Amex) | Yes, via standard card processing          | Yes, via card processing |

Because Stripe covers the same surface area, adding Conekta provides no net new capability. The integration cost and ongoing maintenance of a second provider are not justified.

### Payment flow

All payment operations route through Janua's billing abstraction:

```
User action (subscribe, upgrade, pay)
        |
        v
Dhanam API (billing module)
        |
        v
Janua Billing Service
        |
        v
Stripe MX (SPEI / OXXO / Cards)
        |
        v
Webhook -> Janua -> Dhanam (subscription state update)
```

Dhanam never communicates with Stripe directly in production. Janua manages customer creation, subscription lifecycle, and webhook relay. This design means that if a future decision requires switching from Stripe to another provider (including Conekta), the change occurs in Janua's billing layer and Dhanam's code does not change.

## Consequences

### Positive

- **Single provider simplicity.** One payment integration to maintain, test, and monitor. No divergent code paths for Mexican vs. international payments.
- **Unified billing dashboard.** All payments (cards, SPEI, OXXO) appear in a single Stripe dashboard and flow through one reconciliation pipeline.
- **Ecosystem alignment.** Dhanam follows the MADFAM principle that billing routes through Janua. This preserves the ability to swap providers at the platform level without product-level code changes.
- **Reduced engineering scope.** No Conekta SDK integration, no Conekta webhook handler, no Conekta-specific error handling or retry logic. The engineering team focuses on product features rather than payment plumbing.
- **Consistent subscription management.** Stripe Billing provides trials, proration, dunning, and customer portal out of the box. Conekta's subscription support is less mature and would require custom logic for feature parity.

### Negative

- **Janua dependency risk.** Dhanam cannot process payments if Janua's billing service is unavailable. This is a shared risk across all MADFAM products and is mitigated by Janua's high-availability deployment (multi-region, health monitoring).
- **Stripe lock-in.** By not integrating a second provider, Dhanam is operationally dependent on Stripe MX for all Mexican payments. If Stripe changes pricing, introduces unfavorable terms, or experiences a regional outage, there is no automatic failover.
- **No Conekta-specific advantages.** Conekta offers deeper integration with certain Mexican banking APIs and has a support team based in Mexico City. By not using Conekta, Dhanam forgoes potential benefits of a locally-headquartered provider (faster dispute resolution, local regulatory expertise, MXN-first pricing).

### Mitigations

- **Janua availability.** Janua is deployed with redundancy and monitoring. Dhanam's dependency on Janua for billing is the same dependency it already has for authentication. The risk profile does not change with this decision.
- **Provider portability.** The Janua billing abstraction makes provider swaps a platform-level operation. If Conekta becomes necessary in the future, the integration occurs in Janua, and Dhanam receives the capability without code changes.
- **Stripe MX monitoring.** The Dhanam admin dashboard and Prometheus alerting track payment success rates, webhook delivery, and payout timing. Degradation in Stripe MX performance will be detected within minutes.

## Alternatives Considered

### Conekta as standalone provider

Rejected because it would require a parallel payment code path in Dhanam's API, violating the MADFAM principle that billing routes through Janua. It would also double the webhook handling, reconciliation, and admin dashboard complexity.

### Conekta behind Janua

Deferred rather than rejected. This remains a viable future option if Conekta offers capabilities that Stripe MX does not (e.g., direct debit from Mexican bank accounts, or materially lower pricing at scale). The decision to defer is based on current feature parity -- Stripe MX covers the same payment methods today.

## Related Documents

- [ADR-003: Multi-Provider Strategy](003-multi-provider-strategy.md)
- [ADR-004: Janua Auth Integration](004-janua-auth-integration.md)
- [RFC: Belvo Payments Evaluation](../rfcs/belvo-payments-evaluation.md)
