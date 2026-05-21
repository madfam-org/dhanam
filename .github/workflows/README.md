# GitHub Workflows

This directory contains GitHub Actions workflows for CI/CD, quality checks, and deployment automation.

## Workflow Overview

| Workflow               | Trigger  | Purpose                                    |
| ---------------------- | -------- | ------------------------------------------ |
| `ci.yml`               | Push, PR | Core CI pipeline - lint, test, build       |
| `lint.yml`             | Push, PR | Code quality checks (ESLint, Prettier)     |
| `test-coverage.yml`    | Push, PR | Test execution with coverage reporting     |
| `check-migrations.yml` | PR       | Database migration validation              |
| `deploy-staging.yml`   | Main     | Build, sign, and patch staging digests     |
| `promote-to-prod.yml`  | Manual   | Promote signed staging digest to prod      |
| `deploy-enclii.yml`    | Manual   | Break-glass web raw K8s deploy             |
| `deploy-k8s.yml`       | Manual   | Break-glass API build/sign, optional K8s   |
| `deploy-web-k8s.yml`   | Manual   | Break-glass web build/sign, optional K8s   |
| `deploy-admin-k8s.yml` | Manual   | Break-glass admin build/sign, optional K8s |

## Primary Deployment

**Production deployments are handled by Enclii PaaS and manual digest promotion, NOT raw GitHub Actions deploys.**

When you push to `main`:

1. CI validates the change
2. `deploy-staging.yml` builds and signs api/web/admin, then patches digest-pinned staging images
3. ArgoCD reconciles staging
4. `promote-to-prod.yml` verifies the deploy-staging cosign signature, requires a successful staging smoke run id unless break-glass is selected, and manually promotes a soaked staging digest to production

The raw K8s deployment workflows here are **break-glass options** for manual intervention when Enclii or promotion is unavailable. They require an incident/change reference and an explicit `break_glass_ack=true` acknowledgment before they build, write production digests, or mutate Kubernetes.

## CI/CD Pipeline

### On Every Push and PR

```
lint.yml          →  Code quality (ESLint, Prettier)
test-coverage.yml →  Unit tests with coverage
ci.yml            →  Full build validation
```

### On Pull Requests Only

```
check-migrations.yml →  Validates Prisma migrations
```

## Workflow Details

### ci.yml

Main CI pipeline that runs on all pushes and PRs.

**Jobs:**

- Install dependencies
- Lint codebase
- Run tests
- Build all apps and packages
- Upload artifacts

### lint.yml

Runs ESLint and Prettier checks.

**Checks:**

- TypeScript type checking
- ESLint rule violations
- Prettier formatting

### test-coverage.yml

Executes test suites and reports coverage.

**Features:**

- Jest test execution
- Coverage threshold enforcement (80%+)
- Codecov integration
- Test result artifacts

### check-migrations.yml

Validates database migrations on PRs.

**Checks:**

- Migration file syntax
- Schema consistency
- No destructive changes without review

### deploy-enclii.yml

Manual break-glass web deployment that still uses raw Kubernetes. Prefer Enclii web/API/CLI or `promote-to-prod.yml`; use this only when those paths are unavailable and the incident/change reference is recorded.

**Usage:**

```bash
# Via GitHub UI: Actions → deploy-enclii → Run workflow
# Or via gh CLI:
gh workflow run deploy-enclii.yml \
  -f incident_id=https://github.com/madfam-org/dhanam/issues/<id> \
  -f break_glass_ack=true
```

### deploy-k8s.yml / deploy-web-k8s.yml / deploy-admin-k8s.yml

Manual Kubernetes deployment workflows.

**Usage:**

- Emergency image build/sign and digest commits when Enclii/promotion is unavailable
- Require `incident_id` and `break_glass_ack=true`
- Raw Kubernetes rollout is opt-in via `direct_k8s_deploy=true` and requires runner network access to the cluster API
- Leave `direct_k8s_deploy=false` when the goal is a signed GitOps digest commit that ArgoCD will reconcile
- Documented incident response only
- Record the missing Enclii adapter gap after use

## Environment Secrets

Required secrets in GitHub repository settings:

| Secret             | Purpose                    |
| ------------------ | -------------------------- |
| `NPM_MADFAM_TOKEN` | MADFAM npm registry access |
| `CODECOV_TOKEN`    | Coverage reporting         |
| `ENCLII_API_KEY`   | Enclii deployment trigger  |
| `KUBECONFIG`       | K8s deployment (fallback)  |

## Branch Protection

Recommended branch protection rules for `main`:

- Require status checks to pass:
  - `lint`
  - `test`
  - `build`
  - `check-migrations`
- Require PR review before merge
- Require linear history

## Troubleshooting

### CI Failures

1. Check workflow logs in Actions tab
2. Run locally: `pnpm lint && pnpm test && pnpm build`
3. Verify environment variables are set

### Deployment Issues

1. Check Enclii dashboard first (primary)
2. Use manual workflows only if Enclii is down
3. Contact DevOps for infrastructure issues

## Related Documentation

- [Deployment Guide](../../docs/DEPLOYMENT.md)
- [Development Guide](../../docs/DEVELOPMENT.md)
- [Contributing Guidelines](../../CONTRIBUTING.md)

---

**Last Updated**: 2026-05-20
