# Billing Integration Guide

> Subscription management, payment processing, and usage tracking with multi-provider support.

## Overview

Dhanam's billing system supports:

- **Multi-Provider Payments**: Janua (Conekta MX, Polar international), Stripe (fallback)
- **Multi-Product Billing**: Consolidated billing across MADFAM ecosystem products (Enclii, Tezca, Yantra4D, Dhanam)
- **Subscription Tiers**: Free and Premium with usage-based limits
- **Usage Tracking**: Per-feature metering with daily limits
- **Webhook Processing**: Real-time subscription and payment events

## Product Identifiers

The billing system supports consolidated billing across multiple MADFAM products. Each product is identified by a `ProductId`:

| ProductId | Product | Description |
|-----------|---------|-------------|
| `enclii` | Enclii | DevOps platform |
| `tezca` | Tezca | Legal tech platform |
| `yantra4d` | Yantra4D | 3D/CAD platform |
| `dhanam` | Dhanam | Financial planning (default) |

### Product-Prefixed Plan Slugs

Plans can be prefixed with a product identifier to route billing to the correct product context:

| Plan Slug | Tier | Product |
|-----------|------|---------|
| `essentials` | Essentials | Dhanam (default) |
| `pro` | Pro | Dhanam (default) |
| `madfam` | MADFAM | Dhanam (default) |
| `enclii_essentials` | Essentials | Enclii |
| `enclii_pro` | Pro | Enclii |
| `enclii_madfam` | MADFAM | Enclii |
| `tezca_essentials` | Essentials | Tezca |
| `tezca_pro` | Pro | Tezca |
| `tezca_madfam` | MADFAM | Tezca |
| `yantra4d_essentials` | Essentials | Yantra4D |
| `yantra4d_pro` | Pro | Yantra4D |
| `yantra4d_madfam` | MADFAM | Yantra4D |
| `dhanam_essentials` | Essentials | Dhanam |
| `dhanam_pro` | Pro | Dhanam |
| `dhanam_madfam` | MADFAM | Dhanam |

Yearly variants (`essentials_yearly`, `pro_yearly`, `madfam_yearly`) are also supported.

## Subscription Tiers

### Free Tier

| Feature | Daily Limit |
|---------|-------------|
| ESG Calculations | 10 |
| Monte Carlo Simulations | 3 |
| Goal Probability Analysis | 3 |
| Scenario Analysis | 1 |
| Portfolio Rebalancing | Not available |
| API Requests | 1,000 |

### Premium Tier

| Feature | Limit |
|---------|-------|
| All Features | Unlimited |

## Payment Providers

### Provider Selection by Region

| Region | Primary Provider | Fallback |
|--------|------------------|----------|
| Mexico (MX) | Conekta (via Janua) | Stripe MX |
| LATAM | Polar (via Janua) | Stripe |
| US/Canada | Polar (via Janua) | Stripe |
| Other | Stripe | - |

### Janua Integration

Janua is MADFAM's unified billing platform that routes to:
- **Conekta**: Mexican peso payments, local payment methods (OXXO, SPEI)
- **Polar**: International payments, multiple currencies

### Stripe Integration

Direct Stripe integration serves as fallback when Janua is unavailable.

## API Endpoints

### Subscription Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/billing/upgrade` | Initiate premium upgrade |
| `GET` | `/billing/checkout` | Public checkout redirect (no auth) |
| `POST` | `/billing/portal` | Create billing portal session |
| `GET` | `/billing/usage` | Get current usage metrics |
| `GET` | `/billing/history` | Get billing event history |
| `GET` | `/billing/limits` | Get tier limits configuration |

### Webhooks

| Endpoint | Provider | Description |
|----------|----------|-------------|
| `POST` | `/billing/webhooks/stripe` | Stripe webhook handler |
| `POST` | `/billing/webhooks/janua` | Janua webhook handler |

## Usage Examples

### Upgrade to Premium

```typescript
const response = await fetch('/api/billing/upgrade', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
  },
  body: JSON.stringify({
    countryCode: 'MX',  // Optional, for provider selection
  }),
});

// Response
{
  "checkoutUrl": "https://checkout.janua.dev/session/xxx",
  "provider": "conekta"
}

// Redirect user to checkout URL
window.location.href = response.checkoutUrl;
```

### Upgrade with Product Context

When initiating an upgrade from an external MADFAM product (e.g., Enclii), include the `product` and product-prefixed `plan` fields:

```typescript
// From Enclii
const response = await fetch('/api/billing/upgrade', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
  },
  body: JSON.stringify({
    plan: 'enclii_pro',
    product: 'enclii',
    successUrl: 'https://app.enclii.dev/billing/success',
    cancelUrl: 'https://app.enclii.dev/billing/cancel',
  }),
});
```

### Public Checkout with Product Parameter

The public checkout endpoint accepts a `product` query parameter to identify the originating product:

```
GET /billing/checkout?plan=enclii_pro&user_id=usr_123&return_url=https://app.enclii.dev/billing&product=enclii
```

Query parameters:

| Parameter | Required | Description |
|-----------|----------|-------------|
| `plan` | Yes | Plan slug (optionally product-prefixed) |
| `user_id` | Yes | Janua user ID (UUID) |
| `return_url` | Yes | URL to redirect after checkout |
| `product` | No | Product identifier (defaults to `dhanam`) |

### Using the Billing SDK

```typescript
import { DhanamClient } from '@dhanam/billing-sdk';

const client = new DhanamClient({
  baseUrl: 'https://api.dhan.am',
  token: accessToken,
});

// Build checkout URL with product context
const checkoutUrl = client.buildCheckoutUrl({
  plan: 'tezca_pro',
  userId: 'usr_123',
  returnUrl: 'https://tezca.mx/billing/success',
  product: 'tezca',
});

// Upgrade with product field
const { checkoutUrl, provider } = await client.upgrade({
  plan: 'enclii_pro',
  product: 'enclii',
});
```

### Check Usage Limits

```typescript
const usage = await fetch('/api/billing/usage', {
  headers: { 'Authorization': `Bearer ${accessToken}` },
});

// Response
{
  "date": "2025-01-23T00:00:00.000Z",
  "tier": "free",
  "usage": {
    "esg_calculation": { "used": 7, "limit": 10 },
    "monte_carlo_simulation": { "used": 2, "limit": 3 },
    "goal_probability": { "used": 0, "limit": 3 },
    "scenario_analysis": { "used": 1, "limit": 1 },
    "portfolio_rebalance": { "used": 0, "limit": 0 },
    "api_request": { "used": 234, "limit": 1000 }
  }
}
```

### Access Billing Portal

```typescript
const response = await fetch('/api/billing/portal', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${accessToken}` },
});

// Response
{
  "portalUrl": "https://billing.stripe.com/session/xxx"
}

// Redirect user to manage subscription
window.location.href = response.portalUrl;
```

## Protecting Premium Features

### Using Decorators

```typescript
import { RequiresTier } from '@modules/billing/decorators';
import { TrackUsage } from '@modules/billing/decorators';

@Controller('simulations')
export class SimulationsController {

  // Requires premium tier
  @RequiresTier('premium')
  @Post('portfolio-rebalance')
  async rebalancePortfolio() {
    // Only premium users can access
  }

  // Track usage for free tier limits
  @TrackUsage('monte_carlo_simulation')
  @Post('monte-carlo')
  async runMonteCarlo() {
    // Usage is tracked, limit enforced
  }
}
```

### Using Guards

```typescript
import { SubscriptionGuard } from '@modules/billing/guards';
import { UsageLimitGuard } from '@modules/billing/guards';

@UseGuards(AuthGuard, SubscriptionGuard)
@Controller('premium')
export class PremiumController {
  // All routes require active subscription
}

@UseGuards(AuthGuard, UsageLimitGuard)
@Controller('metered')
export class MeteredController {
  // All routes check usage limits
}
```

## Webhook Events

### Stripe Events

| Event | Handler | Action |
|-------|---------|--------|
| `customer.subscription.created` | `handleSubscriptionCreated` | Upgrade to premium |
| `customer.subscription.updated` | `handleSubscriptionUpdated` | Update expiration |
| `customer.subscription.deleted` | `handleSubscriptionCancelled` | Downgrade to free |
| `invoice.payment_succeeded` | `handlePaymentSucceeded` | Log payment |
| `invoice.payment_failed` | `handlePaymentFailed` | Log failure, alert user |

### Janua Events

| Event | Handler | Action |
|-------|---------|--------|
| `subscription.created` | `handleJanuaSubscriptionCreated` | Upgrade to premium |
| `subscription.updated` | `handleJanuaSubscriptionUpdated` | Update tier |
| `subscription.cancelled` | `handleJanuaSubscriptionCancelled` | Downgrade to free |
| `subscription.paused` | `handleJanuaSubscriptionPaused` | Mark as paused |
| `subscription.resumed` | `handleJanuaSubscriptionResumed` | Reactivate premium |
| `payment.succeeded` | `handleJanuaPaymentSucceeded` | Log payment |
| `payment.failed` | `handleJanuaPaymentFailed` | Log failure |
| `payment.refunded` | `handleJanuaPaymentRefunded` | Log refund |

## Database Schema

### User Billing Fields

```prisma
model User {
  subscriptionTier      SubscriptionTier @default(free)
  subscriptionStartedAt DateTime?
  subscriptionExpiresAt DateTime?

  // Provider-specific IDs
  stripeCustomerId      String?
  stripeSubscriptionId  String?
  januaCustomerId       String?
  billingProvider       String?   // 'stripe', 'conekta', 'polar'
}
```

### Usage Tracking

```prisma
model UsageMetric {
  id         String         @id @default(cuid())
  userId     String
  metricType UsageMetricType
  date       DateTime       @db.Date
  count      Int            @default(0)

  @@unique([userId, metricType, date])
}

enum UsageMetricType {
  esg_calculation
  monte_carlo_simulation
  goal_probability
  scenario_analysis
  portfolio_rebalance
  api_request
}
```

### Billing Events

```prisma
model BillingEvent {
  id              String   @id @default(cuid())
  userId          String
  eventType       String   // subscription_created, payment_succeeded, etc.
  status          String   // succeeded, failed
  provider        String?  // stripe, conekta, polar
  providerEventId String?
  amount          Decimal
  currency        Currency
  metadata        Json?
  createdAt       DateTime @default(now())
}
```

## Configuration

### Environment Variables

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PREMIUM_PRICE_ID=price_xxx

# Janua Configuration
JANUA_API_URL=https://api.janua.dev
JANUA_API_KEY=jan_xxx
JANUA_WEBHOOK_SECRET=jwh_xxx
JANUA_ENABLED=true

# URLs
WEB_URL=https://app.dhanam.com
```

## Error Handling

### Custom Exceptions

```typescript
import {
  PaymentRequiredException,
  SubscriptionExpiredException,
  UsageLimitExceededException
} from '@modules/billing/exceptions';

// Returns 402 Payment Required
throw new PaymentRequiredException('Premium subscription required');

// Returns 403 Forbidden
throw new SubscriptionExpiredException('Subscription has expired');

// Returns 429 Too Many Requests
throw new UsageLimitExceededException('Daily limit reached for ESG calculations');
```

## Testing

### Test Mode

```typescript
// Use test API keys
STRIPE_SECRET_KEY=sk_test_xxx

// Test card numbers
4242424242424242  // Successful payment
4000000000000002  // Declined payment
4000000000000341  // Attaches but fails payment
```

### Webhook Testing

```bash
# Stripe CLI for local webhook testing
stripe listen --forward-to localhost:4010/billing/webhooks/stripe

# Trigger test events
stripe trigger customer.subscription.created
```

## Audit Logging

All billing operations are logged:

| Action | Severity | Details |
|--------|----------|---------|
| `BILLING_UPGRADE_INITIATED` | Medium | Session ID, provider |
| `SUBSCRIPTION_ACTIVATED` | High | Tier, subscription ID |
| `SUBSCRIPTION_CANCELLED` | Medium | Subscription ID |
| `PAYMENT_FAILED` | High | Amount, invoice ID |

## Related Documentation

- [API Reference](../API.md)
- [Authentication Guide](./AUTH_GUIDE.md)
- [Janua SSO Integration](./JANUA_INTEGRATION.md)

---

**Module**: `apps/api/src/modules/billing/`
**Status**: Production
**Last Updated**: February 2026
