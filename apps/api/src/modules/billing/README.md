# Billing Module

> Subscription management, usage tracking, and payment processing with multi-provider support via Janua.

## Purpose

The Billing module handles all payment and subscription operations:

- **Subscription Management**: Free/Premium tier transitions
- **Multi-Provider Billing**: Janua integration for Conekta (MX) and Polar (international)
- **Stripe Fallback**: Direct Stripe integration as backup
- **Usage Tracking**: Monitor feature usage per tier
- **Webhook Handling**: Process payment events from all providers
- **MADFAM Integration**: Enclii → Dhanam → Janua payment loop

## Key Entities

| Entity                | Description                      |
| --------------------- | -------------------------------- |
| `BillingService`      | Main billing orchestration       |
| `StripeService`       | Stripe API wrapper               |
| `JanuaBillingService` | Janua multi-provider integration |
| `BillingEvent`        | Payment history records          |
| `UsageMetric`         | Daily feature usage tracking     |

## Service Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       Billing Service                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   upgradeToPremium()                     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                            │                                     │
│              ┌─────────────┼─────────────┐                      │
│              ▼             │             ▼                      │
│  ┌───────────────────┐    │   ┌───────────────────┐            │
│  │       Janua       │    │   │   Stripe Direct   │            │
│  │  (Multi-provider) │◄───┘   │    (Fallback)     │            │
│  └─────────┬─────────┘        └─────────┬─────────┘            │
│            │                            │                       │
│     ┌──────┼──────┐                     │                       │
│     ▼      ▼      ▼                     ▼                       │
│  ┌──────┐ ┌────┐ ┌─────┐          ┌──────────┐                 │
│  │Conekta│ │Polar│ │More│         │  Stripe  │                 │
│  │ (MX) │ │(Intl)│ │... │          │   API   │                 │
│  └──────┘ └────┘ └─────┘          └──────────┘                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Subscription Tiers

| Tier           | Price (USD) | Key Features                                           |
| -------------- | ----------- | ------------------------------------------------------ |
| **Community**  | $0          | Self-hosted, full features with BYOK                   |
| **Essentials** | $4.99/mo    | AI categorization, bank sync, 10 sims/day              |
| **Pro**        | $11.99/mo   | Unlimited usage, all connections, LifeBeat             |
| **Premium**    | $19.99/mo   | 50K Monte Carlo, 24 scenarios, 25 GB, priority support |

Regional pricing applies: Tier 2 (25% off), LATAM (45% off), Emerging (65% off).
Mexico promo: MXN$31/32/33 per month for first 3 months.

### Usage Limits by Tier

| Feature                 | Community (Self-Hosted) | Essentials | Pro       | Premium   |
| ----------------------- | ----------------------- | ---------- | --------- | --------- |
| ESG Calculations        | Unlimited               | 20/day     | Unlimited | Unlimited |
| Monte Carlo Simulations | Unlimited               | 10/day     | Unlimited | Unlimited |
| Goal Probability        | Unlimited               | 5/day      | Unlimited | Unlimited |
| Scenario Analysis       | Unlimited               | 3/day      | Unlimited | Unlimited |
| Portfolio Rebalance     | Unlimited               | 0          | Unlimited | Unlimited |
| API Requests            | Unlimited               | 5,000/day  | Unlimited | Unlimited |
| Spaces                  | Unlimited               | 2          | 5         | 10        |
| Storage                 | Unlimited (BYOK)        | 500 MB     | 5 GB      | 25 GB     |

> **Note:** Community tier is for self-hosted deployments only. All features are unlimited because
> users provide their own infrastructure, API keys, and storage. Paid tiers gate **managed cloud
> services** (Dhanam-hosted provider API keys, R2 storage, ML inference), not features.

## API Endpoints

| Endpoint                 | Method | Auth | Description                                 |
| ------------------------ | ------ | ---- | ------------------------------------------- |
| `/billing/pricing`       | GET    | No   | Get regional pricing for a country          |
| `/billing/trial/start`   | POST   | Yes  | Start a free trial                          |
| `/billing/trial/extend`  | POST   | Yes  | Extend trial with credit card               |
| `/billing/upgrade`       | POST   | Yes  | Initiate subscription upgrade               |
| `/billing/portal`        | POST   | Yes  | Create billing portal session               |
| `/billing/usage`         | GET    | Yes  | Get current usage statistics                |
| `/billing/history`       | GET    | Yes  | Get payment history                         |
| `/billing/status`        | GET    | Yes  | Get subscription status (incl. trial/promo) |
| `/billing/checkout`      | GET    | No   | Public checkout redirect (external apps)    |
| `/billing/webhook`       | POST   | No   | Stripe webhook handler                      |
| `/billing/webhook/janua` | POST   | No   | Janua webhook handler                       |

## Trial & Promo Flow

```
1. User registers with plan selection (?plan=pro)
2. POST /billing/trial/start → 3-day free trial (no CC)
3. Optional: POST /billing/trial/extend → 21-day trial (with CC)
4. Trial expires → promo pricing for 3 months (with CC) or downgrade (without CC)
5. Promo expires → regular regional pricing
```

## Upgrade Flow

### With Janua (Primary)

```
1. User initiates upgrade
2. Detect country code → select provider (Conekta/Polar)
3. Create/get Janua customer
4. Create checkout session via Janua
5. Redirect to provider checkout
6. Webhook confirms payment
7. Upgrade user to premium
8. Notify Janua identity system (if org-linked)
```

### With Stripe (Fallback)

```
1. User initiates upgrade
2. Create/get Stripe customer
3. Create checkout session
4. Redirect to Stripe checkout
5. Webhook confirms payment
6. Upgrade user to premium
```

## Provider Selection

| Country       | Provider | Payment Methods   |
| ------------- | -------- | ----------------- |
| Mexico (MX)   | Conekta  | Cards, OXXO, SPEI |
| International | Polar    | Cards             |
| Fallback      | Stripe   | Cards             |

## Webhook Events

### Stripe Events

| Event                           | Handler                       |
| ------------------------------- | ----------------------------- |
| `customer.subscription.created` | `handleSubscriptionCreated`   |
| `customer.subscription.updated` | `handleSubscriptionUpdated`   |
| `customer.subscription.deleted` | `handleSubscriptionCancelled` |
| `invoice.payment_succeeded`     | `handlePaymentSucceeded`      |
| `invoice.payment_failed`        | `handlePaymentFailed`         |

### Janua Events

| Event                    | Handler                            |
| ------------------------ | ---------------------------------- |
| `subscription.created`   | `handleJanuaSubscriptionCreated`   |
| `subscription.updated`   | `handleJanuaSubscriptionUpdated`   |
| `subscription.cancelled` | `handleJanuaSubscriptionCancelled` |
| `subscription.paused`    | `handleJanuaSubscriptionPaused`    |
| `subscription.resumed`   | `handleJanuaSubscriptionResumed`   |
| `payment.succeeded`      | `handleJanuaPaymentSucceeded`      |
| `payment.failed`         | `handleJanuaPaymentFailed`         |
| `payment.refunded`       | `handleJanuaPaymentRefunded`       |

## MADFAM Integration

The billing module supports the Enclii → Dhanam → Janua payment loop:

```
┌────────┐     ┌────────┐     ┌────────┐
│ Enclii │ ──► │ Dhanam │ ──► │ Janua  │
└────────┘     └────────┘     └────────┘
    │              │              │
    │  orgId       │  upgrade     │  customer
    └──────────────┼──────────────┘
                   │
                   ▼
              ┌──────────┐
              │ Provider │
              │(Conekta/ │
              │  Polar)  │
              └──────────┘
```

### Organization Linking

When upgrading with an `orgId`:

1. Payment processed through provider
2. Dhanam notifies Janua of tier change
3. Janua updates organization's `subscription_tier`
4. Enables premium features across MADFAM apps

## Usage Tracking

```typescript
// Record usage
await billing.recordUsage(userId, UsageMetricType.ESG_CALCULATION);

// Check limit before operation
const allowed = await billing.checkUsageLimit(userId, UsageMetricType.MONTE_CARLO);
if (!allowed) {
  throw new Error('Usage limit exceeded');
}
```

## Configuration

```bash
# Stripe
STRIPE_SECRET_KEY=sk_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_ESSENTIALS_PRICE_ID=price_xxx
STRIPE_PREMIUM_PRICE_ID=price_xxx      # Pro tier
STRIPE_PREMIUM_PLAN_PRICE_ID=price_xxx  # Premium tier

# Regional pricing coupons
STRIPE_PROMO_COUPON_MX=coupon_xxx
STRIPE_REGIONAL_COUPON_T2=coupon_xxx
STRIPE_REGIONAL_COUPON_LATAM=coupon_xxx
STRIPE_REGIONAL_COUPON_EMERGING=coupon_xxx

# Janua
JANUA_API_URL=https://api.janua.dev
JANUA_API_KEY=xxx
JANUA_WEBHOOK_SECRET=xxx
DHANAM_WEBHOOK_SECRET=xxx

# General
WEB_URL=https://app.dhan.am
```

## Security

- **Webhook Verification**: All webhooks verified with HMAC signatures
- **Audit Logging**: All billing actions logged with severity levels
- **PCI Compliance**: No card data stored; handled by Stripe/Conekta
- **Idempotency**: Webhook handlers are idempotent

## Error Handling

| Scenario                    | Behavior                                    |
| --------------------------- | ------------------------------------------- |
| Payment failed              | Log event, don't downgrade (retry expected) |
| Webhook verification failed | Reject with 401                             |
| User not found              | Log error, acknowledge webhook              |
| Already premium             | Throw error (400)                           |

## Related Modules

| Module                                    | Relationship                           |
| ----------------------------------------- | -------------------------------------- |
| [`users`](../users/README.md)             | User subscription tier stored          |
| [`simulations`](../simulations/README.md) | Uses usage limits for Monte Carlo      |
| [`esg`](../esg/README.md)                 | Uses usage limits for ESG calculations |
| [`analytics`](../analytics/README.md)     | Uses usage limits for reports          |

## Testing

```bash
# Run billing tests
pnpm test -- billing

# Test webhooks locally with Stripe CLI
stripe listen --forward-to localhost:4010/billing/webhook/stripe
```

---

**Module**: `billing`
**Last Updated**: March 2026
