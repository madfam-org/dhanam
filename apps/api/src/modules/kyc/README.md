# KYC Module

Last updated: 2026-05-22

Identity verification orchestration via **MetaMap** for CNBV-aligned KYC/AML
workflows. Publishes `kyc.verified` events to the Redis billing stream when
verification succeeds (see [Events module](../events/README.md)).

## Related docs

- [Launch operations — CNBV](../../../../docs/LAUNCH_OPERATIONS.md)
- [Events module](../events/README.md)
- [Module index](../README.md)

## API endpoints

Prefix: `/v1/kyc`.

| Method | Path         | Auth         | Purpose                          |
| ------ | ------------ | ------------ | -------------------------------- |
| `POST` | `/start`     | JWT          | Start MetaMap verification flow  |
| `GET`  | `/status`    | JWT          | Current user verification status |
| `POST` | `/documents` | JWT          | Upload verification documents    |
| `POST` | `/webhook`   | MetaMap HMAC | Provider status callbacks        |

Rate limit: 5 requests/minute on `/start` (abuse prevention).

## Environment variables

| Variable                 | Required        | Description              |
| ------------------------ | --------------- | ------------------------ |
| `METAMAP_API_URL`        | Yes for live    | MetaMap API base URL     |
| `METAMAP_CLIENT_ID`      | Yes for live    | OAuth client id          |
| `METAMAP_CLIENT_SECRET`  | Yes for live    | OAuth client secret      |
| `METAMAP_WEBHOOK_SECRET` | Yes for webhook | HMAC verification secret |
| `METAMAP_FLOW_ID`        | Yes for live    | Verification flow id     |

When MetaMap is unconfigured, initiation endpoints fail closed with a clear error.

## Primary files

| File                  | Role                            |
| --------------------- | ------------------------------- |
| `kyc.controller.ts`   | REST + webhook                  |
| `kyc.service.ts`      | Verification lifecycle          |
| `metamap.provider.ts` | MetaMap HTTP client             |
| `dto/`                | Start, upload, webhook payloads |

## Data model

- `IdentityVerification` — status, provider ids, user linkage

## Jobs

No dedicated BullMQ queue; webhook-driven state transitions.
