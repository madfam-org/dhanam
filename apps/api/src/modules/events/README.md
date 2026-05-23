# Events Module

Last updated: 2026-05-22

Cross-service event publishing via **Redis Streams**. Billing lifecycle events
are written to `madfam:billing-events` for consumption by PhyndCRM, AutoSwarm,
Tezca, and other MADFAM services.

This is complementary to:

- **Webhook outbound** (Svix HTTP delivery to registered endpoints)
- **Billing product webhooks** (signed `payment.*` envelopes to `PRODUCT_WEBHOOK_URLS`)

See [Cross-Service Event Bus RFC](../../../../docs/rfcs/cross-service-event-bus.md)
for a future NATS-based design.

## Related docs

- [Webhook outbound module](../webhook-outbound/README.md)
- [Billing module](../billing/README.md)
- [Module index](../README.md)

## Stream contract

| Constant     | Value                                  |
| ------------ | -------------------------------------- |
| Stream key   | `madfam:billing-events`                |
| Max length   | ~10,000 entries (approximate `MAXLEN`) |
| Source field | `dhanam`                               |

### Envelope shape

```json
{
  "event_type": "billing.subscription.created",
  "source": "dhanam",
  "correlation_id": "<uuid>",
  "timestamp": "<ISO-8601>",
  "payload": "<JSON string>"
}
```

Keep in sync with `@madfam/types` / `event-schemas.yaml` when published
(TODO P4-4 in source).

## Published event types (convenience methods)

| Method                  | Event type                       |
| ----------------------- | -------------------------------- |
| `subscriptionCreated`   | `billing.subscription.created`   |
| `subscriptionCancelled` | `billing.subscription.cancelled` |
| `paymentSucceeded`      | `billing.payment.succeeded`      |
| `paymentFailed`         | `billing.payment.failed`         |
| `kycVerified`           | `kyc.verified`                   |
| `publish()`             | Arbitrary type                   |

Publishing is **fire-and-forget**: failures are logged, never thrown.

## Dependencies

- Redis (`RedisService`) — if Redis is unavailable at startup, publishing is
  disabled for the process lifetime.

## Primary files

| File                         | Role                |
| ---------------------------- | ------------------- |
| `event-publisher.service.ts` | Stream publisher    |
| `events.module.ts`           | Module registration |

## Environment variables

Uses standard Redis connection from core config (`REDIS_URL` / related vars).
No module-specific secrets.
