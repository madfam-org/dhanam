# Documents Module

Last updated: 2026-05-22

Space-scoped document uploads backed by Cloudflare R2. Supports presigned
upload URLs, quota enforcement by subscription tier, and CSV preview/mapping
for manual import workflows.

## Related docs

- [Storage module](../storage/README.md) — R2 client and bucket configuration
- [Manual assets guide](../../../../docs/guides/MANUAL_ASSETS.md)
- [Module index](../README.md)

## API endpoints

Prefix: `/v1/spaces/:spaceId/documents` (JWT required).

| Method   | Path               | Purpose                                             |
| -------- | ------------------ | --------------------------------------------------- |
| `POST`   | `/`                | Request presigned upload URL                        |
| `POST`   | `/:id/confirm`     | Confirm upload; trigger CSV preview when applicable |
| `GET`    | `/`                | List documents (query filters)                      |
| `GET`    | `/:id`             | Get document metadata                               |
| `PATCH`  | `/:id/csv-mapping` | Update CSV column mapping                           |
| `DELETE` | `/:id`             | Delete document and R2 object                       |

Admin routes live in `documents-admin.controller.ts` for operator operations.

## Environment variables

Uses R2 credentials via the storage module:

| Variable               | Required | Description                |
| ---------------------- | -------- | -------------------------- |
| `R2_ACCOUNT_ID`        | Yes      | Cloudflare account ID      |
| `R2_ACCESS_KEY_ID`     | Yes      | R2 access key              |
| `R2_SECRET_ACCESS_KEY` | Yes      | R2 secret key              |
| `R2_BUCKET_NAME`       | No       | Default `dhanam-documents` |
| `R2_PUBLIC_URL`        | No       | Public URL prefix          |

## Primary files

| File                            | Role                           |
| ------------------------------- | ------------------------------ |
| `documents.controller.ts`       | User-facing REST API           |
| `documents-admin.controller.ts` | Admin operations               |
| `documents.service.ts`          | Upload, quota, lifecycle       |
| `csv-preview.service.ts`        | CSV header preview and mapping |

## Data model

Prisma `Document` records tie uploads to spaces and users with status, MIME type,
and optional CSV mapping metadata.
