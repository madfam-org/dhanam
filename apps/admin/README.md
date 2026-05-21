# Dhanam Admin Dashboard

> Standalone admin console for Dhanam platform management, system monitoring, and compliance operations.

## Overview

The admin dashboard provides platform administrators with tools for:

- **System Health**: Database, Redis, queues, and provider health monitoring
- **Queue Management**: BullMQ queue inspection and management
- **Provider Status**: Financial data provider health and connectivity
- **Deployment Status**: Build info, version, and environment details
- **User Management**: Search, view, and manage user accounts
- **Space Management**: Browse and inspect spaces
- **Feature Flags**: Control feature rollout across the platform
- **MADFAM POS**: Operator checkout-link creation and Stripe checkout status lookup
- **Webhook DLQ**: Product webhook delivery failure inspection, replay, and resolve
- **Audit Logs**: Searchable audit trail of all sensitive operations
- **Billing Events**: Billing event log viewer
- **Analytics**: Onboarding funnel visualization
- **Compliance**: GDPR data export/delete, data retention management

## Tech Stack

- **Framework**: Next.js 15.5.11 (App Router)
- **React**: 18.3.1
- **Styling**: Tailwind CSS with Dhanam design system
- **State**: Zustand (auth), React Context (admin data), TanStack React Query
- **UI Components**: Radix UI primitives, Recharts, Lucide icons
- **Error Tracking**: Sentry
- **Types**: TypeScript 5.9+

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- API server running (`pnpm dev:api` from monorepo root)

### Development

```bash
# From monorepo root
pnpm dev:admin

# Or from this directory
pnpm dev
```

The admin dashboard runs at **http://localhost:3400**

### Build

```bash
# Production build (standalone output)
pnpm build

# Start production server
pnpm start
```

## Project Structure

```
apps/admin/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout with providers
│   │   ├── page.tsx                # Redirects to /dashboard
│   │   └── (dashboard)/
│   │       ├── layout.tsx          # Admin shell (header + nav + main)
│   │       ├── dashboard/page.tsx  # System stats overview
│   │       ├── system-health/      # DB, Redis, queues, providers health
│   │       ├── queues/             # BullMQ queue management
│   │       ├── providers/          # Provider health monitoring
│   │       ├── deployment/         # Build info, version, environment
│   │       ├── spaces/             # Space search/browse
│   │       ├── users/              # User search/management
│   │       ├── feature-flags/      # Feature flag CRUD
│   │       ├── pos/                # MADFAM POS checkout operations
│   │       ├── webhook-dlq/        # Product webhook DLQ recovery
│   │       ├── audit-logs/         # Searchable audit trail
│   │       ├── billing-events/     # Billing event logs
│   │       ├── analytics/          # Onboarding funnel
│   │       └── compliance/         # GDPR export/delete, retention
│   ├── components/                 # 11 admin UI components
│   ├── contexts/                   # AdminContext provider
│   ├── lib/
│   │   ├── api/                    # Typed API client for admin endpoints
│   │   ├── hooks/                  # Auth store (Zustand + persist)
│   │   └── utils.ts                # cn() utility
│   ├── middleware.ts               # Auth cookie check
│   └── styles/
├── public/
├── tailwind.config.ts
├── postcss.config.js
├── next.config.js
├── package.json
└── tsconfig.json
```

## Authentication

Authentication uses cross-subdomain cookie sharing with the main web app:

1. The `auth-storage` cookie is set with `Domain=.dhan.am` by the web app
2. Admin middleware reads this cookie to verify authentication
3. Unauthenticated users are redirected to `app.dhan.am/login?from=admin.dhan.am`
4. Admin access requires `admin` or `owner` role in at least one space

No separate login flow — the web app handles all authentication.

## Environment Variables

See `.env.example` for the full template. Key variables:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4010/v1  # API base URL
NEXT_PUBLIC_APP_URL=http://localhost:3040      # Web app URL (for auth redirects)
NEXT_PUBLIC_OIDC_ISSUER=https://auth.madfam.io
NEXT_PUBLIC_SENTRY_DSN=                        # Optional: Sentry error tracking
```

## API Client

The admin app includes a fully typed API client (`src/lib/api/admin.ts`) covering:

- System stats and health checks
- User and space management (search, details, suspend/unsuspend)
- Feature flag CRUD operations
- Audit log queries with filtering
- Queue management (live stats, retry failed jobs, confirmed destructive clear)
- Cache operations (flush, stats)
- Compliance actions (GDPR export/delete, retention)
- Billing event queries, POS checkout/status operations, and webhook DLQ recovery

All requests include the auth token from the Zustand store and target the API at `NEXT_PUBLIC_API_URL`.

Queue clearing sends `{ "confirm": true }` after the UI confirmation dialog;
server-side confirmation is required before the API removes retained jobs.

## Playwright E2E

Admin Playwright tests use a synthetic admin session in CI by default and mock admin API reads at the browser-context layer. Set `E2E_ADMIN_USE_API_AUTH=true` only when a test environment has a seeded admin user and intentionally needs the real login path.

## Security

- **Cross-subdomain auth**: Cookie-based with `Domain=.dhan.am`
- **Role check**: Platform admin required (`User.isAdmin=true` or verified
  Janua `is_admin` claim); space owner/admin membership is not enough
- **AdminGuard**: Backend guard validates admin access on all admin API endpoints
- **Audit logging**: All admin actions logged server-side

## Deployment

Deployed via Enclii PaaS to bare metal K8s:

- **Production**: `https://admin.dhan.am`
- **Auto-deploy**: Triggered on push to `main` branch
- **K8s manifest**: `infra/k8s/production/admin-deployment.yaml`

## Related

- [AGENTS.md](../../AGENTS.md) - Canonical agent operating instructions
- [Documentation Index](../../docs/README.md) - Current documentation map
- Web-embedded admin fallback source: `../web/src/app/(admin)/`
- [API Admin Module](../api/src/modules/admin/) - Backend admin endpoints

---

**Port**: 3400
**Status**: ACTIVE — Standalone admin app at admin.dhan.am
**Last Updated**: March 2026
