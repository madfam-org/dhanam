# Verification Snapshot

Last updated: 2026-05-20

This file records the current stabilization-session verification state. Older
test result reports in this directory are historical and may mention stale
Prisma, AWS, or port assumptions.

## Recently Passing Local Gates

| Gate                                                        | Result                                        |
| ----------------------------------------------------------- | --------------------------------------------- |
| Admin Playwright chromium                                   | 33 passed                                     |
| Admin typecheck                                             | Passed                                        |
| Admin Jest                                                  | 22 suites, 95 tests passed                    |
| Web typecheck                                               | Passed                                        |
| Web Jest                                                    | 72 suites passed, 1 skipped, 543 tests passed |
| API typecheck                                               | Passed                                        |
| API pricing-engine targeted Jest                            | Passed                                        |
| API onboarding + pricing targeted Jest                      | 3 suites, 68 tests passed                     |
| API admin queue remediation targeted Jest                   | 2 suites, 18 tests passed                     |
| API admin guard/auth strategy/job scheduler targeted Jest   | 5 suites, 71 tests passed                     |
| API Stripe/admin auth targeted Jest                         | 4 suites, 51 tests passed                     |
| API admin operations E2E with local Postgres/Redis          | 18 tests passed                               |
| Admin auth hook targeted Jest                               | 1 suite, 3 tests passed                       |
| Full monorepo `pnpm test`                                   | 13 tasks passed                               |
| Full monorepo `pnpm build`                                  | 8 tasks passed                                |
| API Prisma generate after catalog enum sync                 | Passed                                        |
| API typecheck after catalog enum sync                       | Passed                                        |
| API chaos health suite                                      | 11 suites, 102 tests passed                   |
| Shared package build                                        | Passed                                        |
| API build                                                   | Passed                                        |
| Web production build                                        | Passed with blank public URL env vars         |
| Admin production build                                      | Passed                                        |
| Web Playwright accessibility + subscription slice           | 41 passed                                     |
| Web Playwright auth + upgrade + visual harness slice        | 18 passed, 19 skipped by design               |
| Lint                                                        | Passed with existing warnings                 |
| YAML parse for `enclii.yaml` and Cloudflare route reference | Passed                                        |
| Primary documentation markdown-link scan                    | Passed for current entrypoint docs            |
| Local compiled API liveness smoke                           | Passed                                        |
| Local MX pricing API smoke                                  | Passed                                        |
| Production preflight                                        | Passed, including `www` apex redirect         |
| Production rollout proof                                    | Passed; live images match prod manifest       |
| Production full health                                      | Healthy, `failedJobs: 0`                      |
| Staging API/web/admin smoke                                 | Passed for `dd58fb39` / run `26196989053`     |
| Manual API production promotion                             | Passed, run `26195552704`, commit `593953ca`  |
| Hosted CI for `dd58fb39`                                    | Passed, run `26196989052`                     |
| Hosted lint/typecheck for `dd58fb39`                        | Passed, run `26196989035`                     |
| Hosted test coverage for `dd58fb39`                         | Passed, run `26196989033`                     |
| Hosted staging deploy for `dd58fb39`                        | Passed, run `26196989053`, commit `7f7a0248`  |
| Hosted CI for `d1f8ccf0`                                    | Passed, run `26194485015`                     |
| Hosted lint/typecheck for `d1f8ccf0`                        | Passed, run `26194485017`                     |
| Hosted test coverage for `d1f8ccf0`                         | Passed, run `26194484988`                     |
| Hosted migration check for `d1f8ccf0`                       | Passed, run `26194484989`                     |

## Recently Fixed In This Stabilization Pass

- Web accessibility defects in settings switches, report download controls,
  transaction rows, dashboard cards, account menus, saved reports, and share
  controls were fixed and rerun through Chromium Playwright.
- Subscription/pricing browser tests now align with the current Janua SSO,
  route, and plan-slug behavior.
- `@dhanam/ui` built artifacts now carry accessibility fallbacks for shared
  `Select`, `Progress`, and `Switch` primitives used by production bundles.
- The compiled API now copies email `.hbs` templates into `dist`, so production
  startup no longer emits missing-template errors.
- The onboarding preferences DTO was renamed at runtime to avoid Swagger model
  collisions with the full preferences DTO.
- Web root layout no longer imports `next/font/google`; production builds use a
  local system font stack and no longer depend on Google Fonts network access.
- `www.dhan.am` now redirects to `https://dhan.am/` without leaking the
  internal `:4200` port after the signed web digest was reconciled by ArgoCD.

## Current External Blockers

These are not unit-test failures, but they block full-system stability:

- Staging API/web/admin smoke is now green. Run `26196989053` built and signed
  all images for `dd58fb39`, committed `7f7a0248`, passed
  `https://staging-api.dhan.am/health`, and passed web/admin route checks that
  prove the staging API origin.
- Enclii API/admin deployment records show a Kyverno image-signature annotation
  mutation denial.
- `deploy-staging.yml` signs newly built staging images and
  `promote-to-prod.yml` verifies those signatures before writing production
  digests. Staging overlay digest refreshes land as signed `deploy(staging)`
  bot commits; `7f7a0248` is the latest observed here. Promotion requires an
  explicit successful staging smoke run id unless break-glass is selected.
- Manual API promotion run `26195552704` used that path after the 30-minute
  soak gate elapsed and committed production manifest change `593953ca`. Web and
  admin were not promoted from staging images because their public API/app/OIDC
  values are build-time bound.
- The manual K8s workflows can build, sign, and commit production digests.
  Break-glass only (not Enclii-first): raw `kubectl set image` rollout is opt-in
  with `direct_k8s_deploy=true` because GitHub runners cannot currently reach the
  cluster API. Their digest
  patch step no longer downloads the volatile upstream kustomize installer.
- Production API liveness and full health pass. Full health returns
  `status: "healthy"` with `failedJobs: 0`.
- The admin app client change was built/signed by run `26141639932`, committed
  as `f97ae247`, and ArgoCD synced it to production.
- Admin queue remediation endpoints now read BullMQ directly, retry failed jobs
  through `QueueService`, and require server-side `{ "confirm": true }` before
  destructive queue clearing. The failed-job inspection endpoint is live and
  auth-gated in production: unauthenticated calls return HTTP 401.
- Current source also hardens `AdminGuard` to require platform-admin status
  instead of any space owner/admin role, removes obsolete generic BullMQ
  repeatable schedules, and makes cron-dispatched queue jobs idempotent across
  API replicas. Targeted Jest and the full monorepo `pnpm test` / `pnpm build`
  gates passed locally.
- Current source also adds `ProductCategory.travel`, matching the Routecraft
  entry in `catalog.yaml` and unblocking catalog-seeded API E2E startup.
- Current source also updates the admin operations E2E fixture to create a
  real platform admin (`User.isAdmin=true`) and verifies that journey locally
  against disposable Postgres/Redis.
- Current source also makes the Stripe wrapper fail closed when unconfigured,
  returning a controlled service-unavailable error instead of a raw TypeError.
- Current source also makes the `product_tiers` migration derive
  `product_id` type from `products.id`, preventing the production UUID drift
  failure from recurring in future environments.
- Current source also allows catalog-backed checkout plan slugs to resolve
  through `PriceResolver`, while unsupported generic slugs still fail closed.
- Enclii `prod` deployment records are not currently sufficient proof of public
  production rollout: the live route is still served by the ArgoCD
  `dhanam-services` Application in the `dhanam` namespace.

See [Stability Audit 2026-05-19](../STABILITY_AUDIT_2026-05-19.md) for the full
assessment and remediation plan.

## Recommended Pre-Push Gate

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --dir apps/web exec playwright test --project=chromium --workers=1
pnpm --dir apps/admin exec playwright test --project=chromium --workers=1
```

Use focused checks first while iterating, then broaden to the full gate.
