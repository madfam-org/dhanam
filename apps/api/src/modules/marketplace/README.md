# Marketplace Module

Last updated: 2026-05-22

Stripe Connect–style marketplace scaffold: merchants, destination charges,
transfers, payouts, and disputes. Exposed under the billing namespace for a
single consumer-facing API surface.

**Status:** RFC / early implementation — see
[Connect Marketplace RFC](../../../../docs/rfcs/connect-marketplace.md) before
treating endpoints as production-ready.

## Related docs

- [Billing module](../billing/README.md)
- [Connect Marketplace RFC](../../../../docs/rfcs/connect-marketplace.md)
- [Module index](../README.md)

## API endpoints

Prefix: `/v1/billing` (JWT required).

| Area      | Methods                                               | Purpose                             |
| --------- | ----------------------------------------------------- | ----------------------------------- |
| Merchants | `POST /merchants`, `GET /merchants`, onboarding links | Connect merchant accounts           |
| Charges   | Destination charge creation                           | Platform + connected account splits |
| Transfers | Transfer creation                                     | Move funds between accounts         |
| Payouts   | Payout creation                                       | Merchant payouts                    |
| Disputes  | Evidence submission                                   | Dispute handling                    |

See `marketplace.controller.ts` and `dto/marketplace.dto.ts` for the full surface.

## Primary files

| File                           | Role               |
| ------------------------------ | ------------------ |
| `marketplace.controller.ts`    | HTTP surface       |
| `services/merchant.service.ts` | Merchant lifecycle |
| `services/charge.service.ts`   | Charges            |
| `services/transfer.service.ts` | Transfers          |
| `services/payout.service.ts`   | Payouts            |
| `services/dispute.service.ts`  | Disputes           |

## Environment variables

Uses Stripe credentials from the billing module (`STRIPE_*` / `STRIPE_MX_*`
depending on deployment configuration).

## Data models

Marketplace-specific Prisma models (merchants, charges, etc.) — see schema and
RFC for the intended ledger shape.
