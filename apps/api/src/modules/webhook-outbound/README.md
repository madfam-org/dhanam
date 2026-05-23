# Webhook Outbound Module

Last updated: 2026-05-22

Svix-backed outbound webhook delivery for registered MADFAM consumer apps. This
module is distinct from the billing **product webhook DLQ** (`PRODUCT_WEBHOOK_URLS`
/ `notifyProductWebhooks` in the billing module), which uses HMAC fan-out for
payment envelopes.

## Related docs

- [Billing module](../billing/README.md) — payment events, product DLQ, admin `/webhook-dlq`
- [Events module](../events/README.md) — Redis Streams cross-service events
- [Billing SDK](../../../../packages/billing-sdk/README.md) — Svix signature verification helper
- [Module index](../README.md)

## Architecture

```text
Service.emit(eventType, payload)
    -> EventDispatcherService
        -> Prisma WebhookEndpoint (active + subscribedEvents match)
        -> SvixClient.sendMessage
        -> WebhookDelivery audit row
Consumer verifies: svix-id, svix-timestamp, svix-signature headers
```

## API endpoints

Prefix: `/v1/billing/webhook-endpoints` (JWT required).

| Method   | Path                 | Purpose                                               |
| -------- | -------------------- | ----------------------------------------------------- |
| `POST`   | `/`                  | Register endpoint; returns signing secret **once**    |
| `GET`    | `/`                  | List endpoints                                        |
| `GET`    | `/:id`               | Get endpoint                                          |
| `POST`   | `/:id`               | Update endpoint                                       |
| `DELETE` | `/:id`               | Soft-disable endpoint (Svix delete + `active: false`) |
| `POST`   | `/:id/rotate-secret` | Rotate signing secret                                 |
| `POST`   | `/:id/replay-failed` | Replay failed Svix deliveries                         |

Registration URLs must pass `WEBHOOK_ENDPOINT_HOST_ALLOWLIST` (fail-closed if
unset).

## Environment variables

| Variable                          | Required         | Description                       |
| --------------------------------- | ---------------- | --------------------------------- |
| `SVIX_API_URL`                    | Yes for delivery | Svix API base URL                 |
| `SVIX_AUTH_TOKEN`                 | Yes for delivery | Svix auth token                   |
| `WEBHOOK_ENDPOINT_HOST_ALLOWLIST` | Yes for register | Comma-separated allowed hostnames |

When Svix is not configured, `EventDispatcherService` logs and drops events
(no throw).

## Primary files

| File                                   | Role                 |
| -------------------------------------- | -------------------- |
| `webhook-endpoints.controller.ts`      | Endpoint CRUD        |
| `services/event-dispatcher.service.ts` | Fan-out and delivery |
| `services/svix.client.ts`              | Svix HTTP client     |
| `dto/webhook-endpoint.dto.ts`          | Register/update DTOs |

## Data models

- `WebhookEndpoint` — consumer registration
- `WebhookDelivery` — local audit trail per delivery attempt
