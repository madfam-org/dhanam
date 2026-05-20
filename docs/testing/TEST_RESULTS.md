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
| Shared package build                                        | Passed                                        |
| API build                                                   | Passed                                        |
| Web production build                                        | Passed with blank public URL env vars         |
| Admin production build                                      | Passed after Google Fonts network access      |
| Web Playwright accessibility + subscription slice           | 41 passed                                     |
| Web Playwright auth + upgrade + visual harness slice        | 18 passed, 19 skipped by design               |
| Lint                                                        | Passed with existing warnings                 |
| YAML parse for `enclii.yaml` and Cloudflare route reference | Passed                                        |
| Primary documentation markdown-link scan                    | Passed for current entrypoint docs            |
| Local compiled API liveness smoke                           | Passed                                        |
| Local MX pricing API smoke                                  | Passed                                        |
| Production preflight                                        | Passed, including `www` apex redirect         |

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

- Staging DNS now exists and Enclii marks the three staging domains verified,
  but the ArgoCD Application/namespace are absent and Enclii junctions are not
  namespace-aware for staging tunnel routes.
- Enclii API/admin deployment records show a Kyverno image-signature annotation
  mutation denial.
- `deploy-staging.yml` now signs newly built staging images and
  `promote-to-prod.yml` verifies those signatures before writing production
  digests. Existing staging overlay digests that predate the signing change
  must be refreshed by the next staging build before promotion.
- The manual K8s workflows can build, sign, and commit production digests. Raw
  `kubectl set image` rollout is now opt-in with `direct_k8s_deploy=true`
  because GitHub runners cannot currently reach the cluster API.
- Production API health has reported queue/provider degradation.
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
