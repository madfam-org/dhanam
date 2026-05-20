# Testing Overview

Last updated: 2026-05-20

Dhanam uses layered tests across API, web, admin, mobile, contracts, and
Playwright journeys. Prefer focused checks while developing and run the broader
gates before merging to `main`.

Current 2026-05-20 stabilization state: full monorepo `pnpm test` and
`pnpm build` both pass locally after the admin authorization, queue scheduler,
staging overlay, E2E catalog-seeding, product-category enum sync, admin E2E
fixture, and Stripe fail-closed updates.

## Main Commands

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Focused app commands:

```bash
pnpm --filter @dhanam/api test
pnpm --filter @dhanam/api test:cov
pnpm --filter @dhanam/api test:contract
pnpm --filter @dhanam/api test:chaos

pnpm --dir apps/web test -- --runInBand
pnpm --dir apps/admin test -- --runInBand
pnpm --filter @dhanam/mobile test
```

Playwright:

```bash
pnpm --dir apps/web exec playwright test --project=chromium
pnpm --dir apps/admin exec playwright test --project=chromium
```

## Test Layers

| Layer                | Location                       | Notes                                                                  |
| -------------------- | ------------------------------ | ---------------------------------------------------------------------- |
| API unit/integration | `apps/api/src/**/*.spec.ts`    | Jest, Nest testing module, Prisma mocks or local DB depending on suite |
| API e2e              | `apps/api/test/e2e`            | Requires DB/Redis and seeded flows                                     |
| API contracts        | `apps/api/test/contract`       | Provider/webhook schema contracts                                      |
| API chaos            | `apps/api/src/__tests__/chaos` | Dedicated `test:chaos`; excluded from default unit config              |
| Web unit/component   | `apps/web/src/**/*.test.tsx`   | Jest + Testing Library                                                 |
| Web Playwright       | `apps/web/e2e`                 | Browser journeys, accessibility, optional visual regression            |
| Admin unit/component | `apps/admin/src/**/*.test.tsx` | Jest + Testing Library                                                 |
| Admin Playwright     | `apps/admin/e2e`               | Synthetic admin auth by default in CI                                  |
| Mobile               | `apps/mobile`                  | Jest/Expo suite                                                        |

## CI Gates

The primary CI workflow runs parallel jobs for API, web, admin, mobile,
contracts, and Playwright coverage. Staging deployment is a separate workflow on
push to `main`; see [Deployment Guide](../DEPLOYMENT.md) and
[Stability Audit 2026-05-19](../STABILITY_AUDIT_2026-05-19.md) for current
deployment caveats.

Latest wrap-up: hosted CI (`26194485015`), lint/typecheck (`26194485017`),
test coverage (`26194484988`), migration check (`26194484989`), and `Deploy to
Staging` (`26194485016`) passed for `d1f8ccf0`. The staging run built and
signed API, web, and admin images, committed digest refresh `7a848a2c`, and
passed API/web/admin smoke with staging API-origin proof. Production rollout
proof passes against the production manifest after manual API promotion run
`26195552704`, and production full health is `status: "healthy"` with
`failedJobs: 0`.

The latest stability source includes the type-adaptive `product_tiers`
migration, staging web/admin smoke checks, and checkout price-resolution
fail-closed hardening.
See [Verification Snapshot](TEST_RESULTS.md) and
[Stability Wrap-Up 2026-05-20](../STABILITY_WRAP_UP_2026-05-20.md).

## Local Playwright Notes

Use explicit URLs when testing production builds locally:

```bash
CI=true \
E2E_BASE_URL=http://localhost:3040 \
E2E_API_URL=http://localhost:4010/v1 \
pnpm --dir apps/web exec playwright test --project=chromium --workers=1
```

Visual regression is intentionally opt-in:

```bash
RUN_VISUAL_REGRESSION=true pnpm --dir apps/web exec playwright test e2e/visual-regression.spec.ts
```

Admin Playwright defaults to synthetic auth in CI. Set
`E2E_ADMIN_USE_API_AUTH=true` only for an environment with a seeded admin user
where the real login path is required.

## Coverage

API Jest owns coverage thresholds in `apps/api/jest.config.js`. Coverage runs
are intentionally separate from normal `pnpm test` so developers can run fast
feedback loops without producing coverage artifacts.

```bash
pnpm --filter @dhanam/api test:cov
pnpm --dir apps/web test -- --coverage --runInBand
pnpm --dir apps/admin test -- --coverage --runInBand
```

## Related Docs

- [Latest Verification Snapshot](TEST_RESULTS.md)
- [API Test Coverage Guide](../../apps/api/TEST_COVERAGE_GUIDE.md)
- [Development Guide](../DEVELOPMENT.md)
- [Documentation Index](../README.md)
