# Dhanam Architecture

Last updated: 2026-05-20

Dhanam is a Turborepo + pnpm monorepo that serves two related products:

- A LATAM-first personal/business finance app for budgeting, wealth tracking,
  provider ingestion, simulations, estate workflows, and ESG crypto insights.
- MADFAM's billing and financial ledger boundary for subscriptions, usage
  metering, Stripe MX/SPEI, Paddle, referrals, and signed ecosystem payment
  events.

## Runtime Surfaces

| Surface             | Path          | Local port | Production URL                           |
| ------------------- | ------------- | ---------: | ---------------------------------------- |
| Web app and landing | `apps/web`    |       3040 | `https://app.dhan.am`, `https://dhan.am` |
| API                 | `apps/api`    |       4010 | `https://api.dhan.am`                    |
| Admin console       | `apps/admin`  |       3400 | `https://admin.dhan.am`                  |
| Mobile app          | `apps/mobile` |       Expo | App store / dev client                   |

Production Kubernetes container ports are allocated by the MADFAM port block:
web `4200`, API `4300`, admin `3400`.

## High-Level Flow

```text
Browser / Mobile
  |
  | Janua OIDC/PKCE for identity
  v
Web app / Admin app (Next.js)
  |
  | REST JSON over HTTPS
  v
API (NestJS + Fastify)
  |
  | Prisma, BullMQ, Redis clients, provider SDKs
  v
PostgreSQL + Redis + external financial/billing providers
```

Public traffic enters through Cloudflare Tunnel and Kubernetes services managed
through Enclii. Routine operations use Enclii web/API/CLI first; raw `kubectl`,
Helm, SSH, provider CLIs, `docker exec`, and direct container access are
break-glass/bootstrap only.

## Tech Stack

### Frontend

- Next.js 15.5.x App Router for web and admin
- React 18.3.x for web/admin
- Tailwind CSS, Radix UI, shadcn-style components from `packages/ui`
- Zustand for client auth state and TanStack Query for server state
- Janua React SDK for SSO components and OIDC state sync

### Mobile

- Expo + React Native in `apps/mobile`
- Shared types/utilities from `packages/shared`

### API

- NestJS 11 with Fastify
- Prisma 7 with PostgreSQL
- Redis and BullMQ for queues, sessions, cache, and background work
- Provider modules for Belvo, Plaid, MX, Finicity, Bitso, blockchain, DeFi, FX,
  storage, collectibles, and billing providers
- Sentry and PostHog integration

### Shared Packages

- `packages/shared` - types, constants, i18n helpers, cross-app utilities
- `packages/ui` - shared UI primitives
- `packages/esg` - ESG scoring primitives
- `packages/simulations` - Monte Carlo and scenario engines
- `packages/billing-sdk` - typed billing/referral clients
- `packages/config` - shared TypeScript/ESLint/Prettier config

## Data Model

The core data hierarchy is:

```text
User
  -> Space
     -> Accounts
        -> Transactions
     -> Budgets
        -> Categories and rules
     -> Tags
     -> Goals
     -> Manual assets
     -> Households and ownership views
```

Additional modules cover subscriptions, usage metering, billing events,
referrals, provider connections, audit logs, compliance jobs, estate planning,
simulations, reporting, and admin operations.

## Authentication

Dhanam uses Janua for production authentication:

- Issuer: `https://auth.madfam.io`
- Web/admin UI: `@janua/react-sdk`
- API: Janua JWKS verification plus local JWT/session support where retained for
  test and legacy compatibility

Do not introduce Auth0, Clerk, or another identity provider. Keep Janua as the
auth source of truth.

Janua is **identity-only** in production today (`JANUA_BILLING_ENABLED=false`).
Optional Janua-mediated checkout is documented in
[ADR-008](../adr/008-integration-planes-janua-vs-direct.md).

## Integration Planes

Dhanam separates external integrations into three planes (ADR-008):

| Plane              | Route                                                | Examples                                           |
| ------------------ | ---------------------------------------------------- | -------------------------------------------------- |
| **Identity**       | Janua OIDC only                                      | Login, MFA, org membership                         |
| **Financial data** | Dhanam provider orchestrator (direct)                | Belvo, Plaid, Bitso, Zapper                        |
| **Money movement** | Dhanam billing boundary via `PaymentGatewayRegistry` | Stripe MX, Paddle, Conekta, optional Janua adapter |

Financial provider OAuth never routes through Janua. PSP webhooks and secrets
live in Dhanam billing modules, not in Janua.

## Billing Boundary

The billing module in `apps/api/src/modules/billing` is a facade over focused
services:

- subscription lifecycle
- usage tracking and limits
- Stripe MX/SPEI relay
- Paddle
- pricing and regional discounts
- Janua billing synchronization
- Stripe/Janua webhook processing
- reconciliation jobs
- signed MADFAM payment events

Downstream ecosystem products consume signed Dhanam billing/payment events.

## Deployment Architecture

Current production deploys to MADFAM bare-metal Kubernetes via Enclii:

- Namespace: `dhanam`
- Manifests: `infra/k8s/production`
- Staging overlay: `infra/k8s/overlays/staging`
- Service specs: `infra/enclii/services`
- Domain manifest: `enclii.yaml`
- GitHub workflows: `.github/workflows`

Staging and production status as of 2026-05-22 is documented in
[Stability Wrap-Up 2026-05-20](../STABILITY_WRAP_UP_2026-05-20.md). In short:
hosted CI is green, staging API/web/admin smoke passes, production rollout proof
passes through ArgoCD, and full production API health is `healthy`. Remaining
work is Enclii adapter coverage, commercial POS depth, and repeated deploy proof
— see [GA Remediation Roadmap](../GA_REMEDIATION_ROADMAP.md).

## Observability

- API health: `/health`, `/health/full`,
  `/v1/monitoring/health`, `/v1/monitoring/health/live`,
  `/v1/monitoring/health/ready`
- Web/admin health: `/api/health`
- Metrics: API monitoring controller and Prometheus manifests under
  `infra/k8s/monitoring`
- Dashboards and alerts: Grafana/Prometheus/Alertmanager manifests in
  `infra/k8s/monitoring`
- Error monitoring: Sentry
- Product analytics: PostHog

## Performance Targets

- Page loads: less than 1.5s p95
- API responses: less than 200ms p95 for common reads
- Manual account refresh: less than 15s
- Bulk transaction operations: less than 2s for 100+ rows
- Availability target: 99.9%, with RTO 4h and daily backups

## Read Next

- [Development Guide](../DEVELOPMENT.md)
- [Deployment Guide](../DEPLOYMENT.md)
- [Testing Overview](../testing/TEST_SUMMARY.md)
- [API Reference](../API.md)
- [Module index](../../apps/api/src/modules/README.md)
- [Billing Module README](../../apps/api/src/modules/billing/README.md)
- [Provider Orchestrator README](../../apps/api/src/modules/providers/orchestrator/README.md)
