# FX Module (platform service)

Last updated: 2026-05-22

JWT-authenticated **platform FX API** (RFC 0011 Phase 1) for spot, DOF, and
settled rate types. Distinct from the user-facing
[fx-rates module](../fx-rates/README.md), which serves Banxico-backed consumer
conversion endpoints.

## Related docs

- [FX rates module](../fx-rates/README.md) — consumer Banxico rates and convert
- [Module index](../README.md)

## When to use which module

| Module     | Audience                        | Typical use                                |
| ---------- | ------------------------------- | ------------------------------------------ |
| `fx-rates` | End-user app features           | Display/conversion in dashboard            |
| `fx`       | Platform / billing integrations | Typed spot/dof/settled rates for money ops |

## API endpoints

Prefix: `/v1/fx` (JWT required).

| Method | Path       | Purpose                                                         |
| ------ | ---------- | --------------------------------------------------------------- |
| `GET`  | `/rate`    | Single rate (`from`, `to`, `type`, optional `at`, `payment_id`) |
| `GET`  | `/rates`   | Batch rates from one base currency                              |
| `GET`  | `/history` | Historical rate series                                          |

`POST /fx/override` is deferred to RFC Phase 2.

## Rate types

Callers must specify `spot`, `dof`, or `settled` explicitly — they are not
interchangeable.

## Primary files

| File                 | Role                |
| -------------------- | ------------------- |
| `fx.controller.ts`   | REST API            |
| `fx.service.ts`      | Rate resolution     |
| `dto/fx-rate.dto.ts` | Query/response DTOs |

## Environment variables

Inherits provider configuration from the FX stack (Banxico token, Redis cache).
See [fx-rates README](../fx-rates/README.md) for `BANXICO_*` and cache vars.
