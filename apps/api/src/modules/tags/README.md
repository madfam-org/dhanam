# Tags Module

Last updated: 2026-05-22

Space-scoped transaction tags with bulk assign/remove support on the transactions
module. Tags are isolated per space and enforce unique names within a space.

## Related docs

- [Transactions module](../transactions/README.md) — bulk tag operations
- [Module index](../README.md)

## API endpoints

Prefix: `/v1/spaces/:spaceId/tags` (JWT required).

| Method   | Path   | Purpose            |
| -------- | ------ | ------------------ |
| `GET`    | `/`    | List tags in space |
| `GET`    | `/:id` | Get tag by id      |
| `POST`   | `/`    | Create tag         |
| `PATCH`  | `/:id` | Update tag         |
| `DELETE` | `/:id` | Delete tag         |

Transaction bulk tag endpoints are on the transactions controller
(`POST .../transactions/bulk/tags`).

## Authorization

All operations verify space membership via `SpacesService` before mutating tags.

## Primary files

| File                 | Role                       |
| -------------------- | -------------------------- |
| `tags.controller.ts` | REST API                   |
| `tags.service.ts`    | CRUD and uniqueness checks |
| `dto/`               | Create/update DTOs         |

## Data model

- `Tag` — belongs to a `Space`
- `TransactionTag` — many-to-many join with `Transaction`
