# Dhanam Tech Debt Log

> [!IMPORTANT]
> MADFAM-ENCLII-FIRST-LEGACY-RAW v1: This document contains legacy raw infrastructure command examples.
> Routine production operations must use Enclii web, API, or CLI. Treat raw
> `kubectl`, `helm`, SSH, provider CLI/API, `docker exec`, and direct container
> access as platform bootstrap or documented break-glass only, and record any
> missing Enclii adapter gap.

> **Last Updated**: 2026-03-21
> **Context**: Production Readiness — Enterprise Hardening

---

## Critical (Blocking)

### TD-001: GHCR Container Build Workflow

**Status**: RESOLVED
**Severity**: CRITICAL

**Resolution**:
GHCR workflows now exist with pinned digests. `deploy-enclii.yml` and `deploy-web-k8s.yml` build and push to `ghcr.io/madfam-org/dhanam/*`. Images are signed with cosign.

**Ticket**: DHANAM-001

---

## High

### TD-002: Database Provisioning API

**Status**: RESOLVED
**Severity**: HIGH
**Violation**: Law 7 (API Mandate)

**Problem**:
Dhanam database and user were provisioned via `kubectl exec` into postgres pod instead of using a proper API. This violates Law 7: "All tenant operations MUST be performed via Enclii/Janua APIs."

**Resolution**:
The Enclii provisioning API already exists at `POST /v1/admin/provision/postgres` on the `switchyard-api` service. It is idempotent (checks `pg_database`/`pg_roles` before creating), handles PgBouncer config updates, and validates SQL identifiers. The `enclii onboard` CLI also supports `--db-name`/`--db-password` flags.

- Created `scripts/provision-db.sh` as a reproducible wrapper for the Enclii API call
- Rewrote `docs/DEPLOYMENT.md` to document the Enclii provisioning API as the required method (also removed ~600 lines of stale AWS ECS/Fargate content, related to TD-003)
- Updated `docs/LAUNCH_OPERATIONS.md` to reference the Enclii provisioning API

**Operational note**: The actual API call to formally re-register the existing database must be run by an operator with admin credentials. The call is idempotent and safe to run against the already-provisioned `dhanam` database.

**Ticket**: DHANAM-004

---

### TD-003: CI/CD Platform Migration

**Status**: RESOLVED
**Severity**: HIGH

**Resolution**:
AWS ECS/Fargate infrastructure has been fully removed. Deployment is exclusively via Enclii PaaS (bare metal K8s). Removed: `infra/terraform/`, `.github/workflows/deploy.yml`, `scripts/setup-aws.sh`, `scripts/deploy.sh`, `scripts/monitor.sh`, `scripts/backup.sh`, and the unused `KmsService`.

**Ticket**: DHANAM-002

---

## Medium

### TD-004: Billing Secrets Placeholder

**Status**: RESOLVED
**Severity**: MEDIUM

**Problem**:
Billing secrets (`dhanam-billing-secrets`) were created with placeholder values. Real Stripe/Paddle credentials need to be configured before billing features work.

**Current Values**:

- `STRIPE_MX_SECRET_KEY`: `sk_test_placeholder_update_before_billing`
- `PADDLE_*`: placeholder values

**Remediation**:

- Startup validation in `BillingService` now detects placeholder values (containing `placeholder`, starting with `your_` or `your-`) on application boot.
- In development, each detected placeholder logs a warning so developers know billing features may not work.
- In production (`NODE_ENV=production`), each detected placeholder logs a critical error and sets `billingDisabled = true`, preventing billing endpoints from operating with invalid credentials.
- `.env.example` updated to use format hints instead of `your_*` placeholder patterns.
- K8s secrets template (`infra/k8s/production/secrets-template.yaml`) added for billing credentials.
- Real credentials are still required before billing features can be used in production.

**Resolution (March 2026)**:

Stripe test-mode infrastructure provisioned via `scripts/setup-stripe.ts`:

- 3 products (Essentials $4.99/mo, Pro $11.99/mo, Premium $19.99/mo)
- 3 recurring prices, 1 webhook endpoint, billing portal config, intro coupon
- Stripe account: `acct_1T8qlgAKQiFuxYX7` (Dhanam sandbox)
- Script is idempotent and env-var-driven (no hardcoded secrets)

For production: swap test keys for live keys and re-run the setup script, then apply secrets to K8s via `infra/k8s/production/secrets-template.yaml`.

**Ticket**: DHANAM-003

---

### TD-005: Enclii Port Mismatch

**Status**: RESOLVED
**Severity**: MEDIUM

**Resolution**:
`enclii.yaml` port changed from 8080 to 80 to match ClusterIP service internal port mapping.

---

### TD-006: JWT Secrets Missing from Template

**Status**: RESOLVED
**Severity**: MEDIUM

**Resolution**:
Added `JWT_SECRET` and `JWT_REFRESH_SECRET` to `infra/k8s/production/secrets-template.yaml`. These are referenced by `api-deployment.yaml`.

---

### TD-007: Monitoring Stack

**Status**: RESOLVED
**Severity**: MEDIUM

**Resolution**:
Created `infra/k8s/monitoring/` with ServiceMonitor, PrometheusRule CRDs, Alertmanager routing config, and Grafana dashboard ConfigMaps. Added metrics port to api-deployment.yaml Service spec. Alert routing uses placeholder receivers for Slack/PagerDuty.

---

### TD-008: Staging Environment

**Status**: RESOLVED
**Severity**: MEDIUM

**Resolution**:
Created `infra/k8s/staging/` with namespace, kustomization overlay (1 replica, `:main` tags, `NODE_ENV=staging`), and secrets template. Added `.github/workflows/deploy-staging.yml` for auto-deploy on push to main.

---

### TD-009: ArgoCD Documentation

**Status**: RESOLVED
**Severity**: LOW

**Resolution**:
Created `infra/k8s/argocd/application.yaml` (ArgoCD Application CRD for GitOps sync) and `infra/k8s/argocd/README.md` documenting the sync loop, UI access, and operational procedures.

---

### TD-010: React 18 Global Pin

**Status**: ACTIVE
**Severity**: LOW

**Problem**:
React Native (Expo 54) requires React 18.x. The monorepo uses a pnpm override to pin react to 18.3.1 globally, preventing apps/web and apps/admin from upgrading to React 19.

**Impact**:

- `apps/mobile/src/lib/react-native-compat.tsx` (92 lines) provides type compatibility shims
- pnpm `overrides` in root `package.json` pins `react` and `react-dom` to `18.3.1`
- Next.js 15 features requiring React 19 server components are unavailable

**Removal Criteria**:
When Expo officially supports React 19, remove the pnpm override and the compat shim.

**Ticket**: DHANAM-010

---

## Tracking

| ID     | Title                             | Severity | Status   | Assigned |
| ------ | --------------------------------- | -------- | -------- | -------- |
| TD-001 | GHCR Container Build Workflow     | CRITICAL | RESOLVED | -        |
| TD-002 | Database Provisioning API         | HIGH     | RESOLVED | -        |
| TD-003 | CI/CD Platform Migration          | HIGH     | RESOLVED | -        |
| TD-004 | Billing Secrets Placeholder       | MEDIUM   | RESOLVED | -        |
| TD-005 | Enclii Port Mismatch              | MEDIUM   | RESOLVED | -        |
| TD-006 | JWT Secrets Missing from Template | MEDIUM   | RESOLVED | -        |
| TD-007 | Monitoring Stack                  | MEDIUM   | RESOLVED | -        |
| TD-008 | Staging Environment               | MEDIUM   | RESOLVED | -        |
| TD-009 | ArgoCD Documentation              | LOW      | RESOLVED | -        |
| TD-010 | React 18 Global Pin               | LOW      | ACTIVE   | -        |
| TD-011 | Janua SSO Full SDK Integration    | HIGH     | RESOLVED | -        |
| TD-012 | CodeQL Security Findings          | CRITICAL | RESOLVED | -        |
| TD-013 | Dashboard Blank Screens on Error  | HIGH     | RESOLVED | -        |
| TD-014 | Admin Test Failures               | MEDIUM   | RESOLVED | -        |
| TD-015 | API Raw Console Logging           | MEDIUM   | RESOLVED | -        |
| TD-016 | Mobile Config & Console Hygiene   | MEDIUM   | RESOLVED | -        |
| TD-017 | ESLint-Disable Audit              | LOW      | RESOLVED | -        |
| TD-018 | Pre-commit Hook Without DB Guard  | MEDIUM   | RESOLVED | -        |
| TD-019 | Loose `any` Types in API          | MEDIUM   | RESOLVED | -        |
| TD-020 | Backup/Restore Runbook            | MEDIUM   | RESOLVED | -        |
| TD-021 | Mobile Unit Test Coverage         | LOW      | ACTIVE   | -        |

---

### TD-011: Janua SSO Full SDK Integration

**Status**: RESOLVED
**Severity**: HIGH

**Problem**:
Backend `AUTH_MODE` defaulted to `local`; the `@janua/react-sdk` bridge used fragile manual
`localStorage.getItem('janua_access_token')` reads and JWT parsing with `atob()`. Auth pages
used custom PKCE code instead of SDK components. `admin.dhan.am` was missing from CORS origins.

**Resolution (March 2026)**:

- Set `AUTH_MODE=janua` in production K8s deployment and `NEXT_PUBLIC_AUTH_MODE=janua` in Enclii build args
- Added `admin.dhan.am` and `www.dhan.am` to `CORS_ORIGINS`
- Rewrote `JanuaAuthBridge` to use SDK hooks (`useAuth`, `useSession`, `useUser`) instead of `localStorage`
- Replaced login page with SDK's `<SignIn />` component
- Replaced register page with SDK's `<SignUp />` component
- Added `<UserButton />` to dashboard header
- Simplified auth callback page (SDK handles PKCE exchange internally)
- Deleted `janua-oauth.ts` (185 lines of manual PKCE helpers) and server-side OAuth callback route (110 lines)
- Removed dead `isJanuaAuthMode()`/`getJanuaUrl()` redirect branches from `auth.ts`
- Updated comprehensive type stubs for `@janua/react-sdk` (SDK doesn't ship `.d.ts`)
- All 64 web test suites pass, 0 typecheck errors, 0 lint errors

**Ticket**: DHANAM-011

---

### TD-012: CodeQL Security Findings

**Status**: RESOLVED
**Severity**: CRITICAL/HIGH

**Problem**:
CodeQL flagged 3 security issues:

1. **CRITICAL**: Type confusion in search controller — `@Query('q')` could receive an array, bypassing validation
2. **HIGH**: Polynomial ReDoS in billing-sdk — `while (url.endsWith('/'))` loop on user-controlled input
3. **HIGH**: Tainted format string in demo-data builder — `console.error('%s', ...)` with user-derived values

**Resolution (March 2026)**:

- Added `Array.isArray(query)` guard with `BadRequestException` in search controller
- Replaced `while` loop with single `replace(/\/+$/, '')` regex in billing-sdk client
- Replaced `%s` format specifiers with template literal in demo-data builder

**Ticket**: DHANAM-012

---

### TD-013: Dashboard Blank Screens on API Error

**Status**: RESOLVED
**Severity**: HIGH

**Problem**:
9 dashboard pages showed blank screens when API requests failed. Users had no indication of failure and no way to retry.

**Resolution (March 2026)**:
Added error states with retry buttons to all 10 affected pages (analytics, goals, projections, scenarios, assets, gaming, notifications, reports, retirement, ESG), following the existing pattern from the accounts page.

**Ticket**: DHANAM-013

---

### TD-014: Admin Test Failures

**Status**: RESOLVED
**Severity**: MEDIUM

**Problem**:
4 pre-existing test failures across 3 admin test files: `@dhanam/ui` Proxy mock rendered `<div>` for `Input` (breaking `fireEvent.change`), async race condition in queues page, and duplicate 'Analytics' text matching in nav.

**Resolution (March 2026)**:

- Render `Input` as `<input>` in Proxy mock
- Replace `findByText` with `waitFor`+`getByText` for async state transitions
- Use `getAllByText` with element type filtering for 'Analytics'

---

### TD-015: API Raw Console Logging

**Status**: RESOLVED
**Severity**: MEDIUM

**Problem**:
~15 raw `console.log/warn/error` calls in 7 API production source files bypassed NestJS structured logging.

**Resolution (March 2026)**:
Replaced all calls with `Logger` from `@nestjs/common`. Each service/class uses `private readonly logger = new Logger(ClassName.name)`.

---

### TD-016: Mobile Config & Console Hygiene

**Status**: RESOLVED
**Severity**: MEDIUM

**Problem**:

- Production API URL pointed to `api.dhanam.app` instead of `api.dhan.am`
- 3 unused deps (`@reduxjs/toolkit`, `react-redux`, `zustand`) installed but never imported
- 16 unguarded `console.error/warn` calls in production mobile code
- ESLint `import/no-unresolved` didn't recognize `@/` path aliases

**Resolution (March 2026)**:
Fixed API URL, removed unused deps, wrapped console calls with `__DEV__` guards, added `@/` to ESLint ignore patterns. Added ADR-006 documenting React Context + React Query decision.

---

### TD-017: ESLint-Disable Audit

**Status**: RESOLVED
**Severity**: LOW

**Problem**:
~85 `eslint-disable` comments across ~55 files, most without justification.

**Resolution (March 2026)**:

- ~25 suppressions removed (violations fixed or `any` replaced with proper types)
- ~40 remaining suppressions documented with justification comments
- Replaced `any` with typed interfaces in ESG widget, goals, simulations, analytics hooks
- Fixed `react-hooks/exhaustive-deps` violations by wrapping functions in `useCallback`

---

### TD-018: Pre-commit Hook Without DB Guard

**Status**: RESOLVED
**Severity**: MEDIUM

**Problem**:
Pre-commit and pre-push hooks ran `pnpm typecheck` unconditionally, which always failed without `DATABASE_URL` set (Prisma types not generated). Also, API test runner in pre-commit failed without DB access.

**Resolution (March 2026)**:
Added `DATABASE_URL` guards to both hooks: skip `@dhanam/api` typecheck and API tests when DB not available, while still checking all other packages.

---

### TD-019: Loose `any` Types in API

**Status**: RESOLVED
**Severity**: MEDIUM

**Problem**:
339 `any` types in non-test API source files, including `@Request() req: any` across all controllers.

**Resolution (March 2026)**:
Reduced to 122 (64% reduction):

- Created shared `AuthenticatedRequest` interface at `core/types/`
- Replaced `req: any` across 10 controllers (87 usages)
- Replaced `catch (error: any)` with `catch (error: unknown)` (21 usages)
- Typed decorator signatures, health service, billing, admin ops, analytics, provider interfaces
- Remaining 122 are in email tasks, transaction execution, logger utilities, and DTO metadata

---

### TD-020: Backup/Restore Runbook

**Status**: RESOLVED
**Severity**: MEDIUM

**Problem**:
No documented backup/restore procedure despite 99.9% availability target with RTO 4h / RPO 24h.

**Resolution (March 2026)**:
Created `docs/BACKUP_RESTORE.md` (full runbook), `scripts/backup-db.sh`, and `scripts/restore-db.sh`.

---

### TD-021: Mobile Unit Test Coverage

**Status**: ACTIVE
**Severity**: LOW

**Problem**:
Mobile app has only 6 test suites (~15% coverage). Target: ~20 test files (~40% coverage).

**Priority targets**: AuthContext, useAccounts, useTransactions, useBudgets, api service, BudgetCard, ChartCard, GoalCard, TransactionFilter.

**Ticket**: DHANAM-021

---

### TD-022: Codebase Remediation — Security, UX, and Quality Hardening

**Status**: RESOLVED
**Severity**: HIGH

**Problem**:
Comprehensive audit identified 48 issues across the monorepo: billing webhooks returning HTTP 200 on signature failure (leaking error messages), Stripe MX throwing raw `Error` instead of domain exceptions, PII in logs, circuit breaker failing open, 18 missing env var validations, toast delay set to 17 minutes, hardcoded magic numbers in financial calculations, hardcoded `'demo-space'` in gaming page, scattered hex color constants, race conditions in simulations hook, no fetch timeouts, and loose `any` types in shared packages.

**Resolution (April 2026)**:

- **Security**: Webhook throws 400 on bad signature, never leaks `error.message`; Stripe MX uses `InfrastructureException`; PII removed from logs; circuit breaker throws `ProviderException.circuitOpen()`
- **Config**: Added 18 env vars to validation schema; CORS/WEB_URL required in production; Finicity redirect URI made configurable
- **Frontend**: Toast delay fixed (5s); `FINANCIAL_DEFAULTS` constants extracted; gaming page uses `useSpaceStore()`; shared `CHART_COLORS`/`TAG_COLORS`/`CELEBRATION_COLORS` constants; `fetchWithTimeout` utility; simulations hook AbortController; global error page i18n + CSS variable fallbacks + keyboard focus
- **Types**: `Record<string, any>` → `Record<string, unknown>` in shared types; cookie consent accepts i18n props; ESG base score rationale documented
- **Admin**: Billing events page has visible error state with retry

---

_This document is maintained per Law 7 (API Mandate) requirements. All bare-metal workarounds must be logged here._
