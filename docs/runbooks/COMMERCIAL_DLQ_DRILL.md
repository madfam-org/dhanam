# Commercial DLQ Drill (G2-3)

Last updated: 2026-05-22

Operator drill for product-webhook dead-letter recovery on **staging** before prod promote.

## Preconditions

- Staging admin access (`staging-admin.dhan.am`) with platform-admin JWT
- `PRODUCT_WEBHOOK_URLS` configured with at least one consumer (Karafiel staging recommended)
- `/webhook-dlq` admin page available

## Drill steps

1. **Inject failure** — temporarily point one consumer URL at a failing endpoint (staging-only Vault change), or use a consumer that returns HTTP 503.
2. **Trigger payment event** — run staging commercial smoke with `STAGING_COMMERCIAL_CHARGE_ENABLED=true`, or complete a sandbox Stripe MX payment that fires `payment.succeeded`.
3. **Confirm DLQ row** — Admin → Webhook DLQ: unresolved row for consumer `karafiel` (or target), event type `payment.succeeded`.
4. **Replay** — `POST /v1/billing/dlq/:id/replay` via admin UI or API; verify consumer receives signed envelope.
5. **Resolve or fix consumer** — restore correct consumer URL in Vault; mark resolved if remediated out-of-band.
6. **Idempotency** — replay same row again; consumer must dedupe (no duplicate CFDI).

## Evidence to record

| Field                 | Example                          |
| --------------------- | -------------------------------- |
| Staging deploy run id | `Deploy to Staging` workflow run |
| DLQ row id            | `uuid`                           |
| Consumer              | `karafiel`                       |
| Replay HTTP status    | `200`                            |
| Operator              | name + date                      |

Attach evidence to [Commercial GA Execution](COMMERCIAL_GA_EXECUTION.md) G2-3 checklist.

## Rollback

Restore `PRODUCT_WEBHOOK_URLS` in staging Vault/ESO; no code rollback required.
