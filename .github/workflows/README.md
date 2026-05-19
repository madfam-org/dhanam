# GitHub Workflows

This directory contains GitHub Actions workflows for CI/CD, quality checks, and deployment automation.

## Workflow Overview

| Workflow               | Trigger  | Purpose                                |
| ---------------------- | -------- | -------------------------------------- |
| `ci.yml`               | Push, PR | Core CI pipeline - lint, test, build   |
| `lint.yml`             | Push, PR | Code quality checks (ESLint, Prettier) |
| `test-coverage.yml`    | Push, PR | Test execution with coverage reporting |
| `check-migrations.yml` | PR       | Database migration validation          |
| `deploy-enclii.yml`    | Manual   | Trigger Enclii deployment fallback     |
| `deploy-k8s.yml`       | Manual   | Break-glass API Kubernetes deploy      |
| `deploy-web-k8s.yml`   | Manual   | Break-glass web Kubernetes deploy      |
| `deploy-admin-k8s.yml` | Manual   | Break-glass admin Kubernetes deploy    |

## Primary Deployment

**Production deployments are handled by Enclii PaaS and manual digest promotion, NOT raw GitHub Actions deploys.**

When you push to `main`:

1. CI validates the change
2. `deploy-staging.yml` builds api/web/admin and patches digest-pinned staging images
3. ArgoCD reconciles staging
4. `promote-to-prod.yml` manually promotes a soaked staging digest to production

The raw K8s deployment workflows here are **break-glass options** for manual intervention when Enclii or promotion is unavailable.

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

Manual trigger to invoke Enclii deployment.

**Usage:**

```bash
# Via GitHub UI: Actions → deploy-enclii → Run workflow
# Or via gh CLI:
gh workflow run deploy-enclii.yml
```

### deploy-k8s.yml / deploy-web-k8s.yml / deploy-admin-k8s.yml

Manual Kubernetes deployment workflows.

**Usage:**

- Emergency deployments when Enclii/promotion is unavailable
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

**Last Updated**: January 2025
