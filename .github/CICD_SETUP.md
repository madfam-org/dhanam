# CI/CD Setup Guide

Complete guide for setting up automated testing and coverage reporting for Dhanam Ledger.

---

## 🚀 Quick Start

### 1. Enable GitHub Actions

GitHub Actions is enabled by default. Once you push the workflow files, they will run automatically.

### 2. Set Up Codecov (Optional but Recommended)

**Step 1: Sign up for Codecov**

1. Go to https://codecov.io/
2. Sign in with your GitHub account
3. Select the `dhanam` repository

**Step 2: Get Codecov Token**

1. In Codecov dashboard, go to Settings → General
2. Copy the "Repository Upload Token"

**Step 3: Add Token to GitHub Secrets**

1. Go to GitHub repository Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `CODECOV_TOKEN`
4. Value: (paste the token from Codecov)
5. Click "Add secret"

**Step 4: Add Coverage Badge to README**

```markdown
[![codecov](https://codecov.io/gh/madfam-io/dhanam/branch/main/graph/badge.svg)](https://codecov.io/gh/madfam-io/dhanam)
```

---

## 📋 Workflow Files

### `test-coverage.yml`

**Triggers:**

- Push to `main`, `develop`, or `claude/**` branches
- Pull requests to `main` or `develop`

**Jobs:**

1. **test** - Unit tests with coverage
   - Runs on Ubuntu latest
   - Uses Postgres 15 + Redis 7
   - Generates Prisma client
   - Runs migrations
   - Executes tests with coverage
   - Uploads to Codecov
   - Comments coverage on PRs

2. **test-e2e** - End-to-end tests
   - Runs after unit tests pass
   - Same environment as unit tests
   - Tests full API flows

3. **build** - Build verification
   - Ensures all packages build successfully
   - No database required

**Timeout:** 15 minutes (test), 10 minutes (e2e), 10 minutes (build)

### `lint.yml`

**Triggers:**

- Same as test-coverage.yml

**Jobs:**

1. **lint** - ESLint checks
2. **type-check** - TypeScript type checking
3. **prettier** - Code formatting validation

**Timeout:** 5 minutes per job

---

## 🔧 Local CI Simulation

Run tests locally with the same environment as CI:

```bash
# Make the script executable (first time only)
chmod +x scripts/test-ci.sh

# Run CI simulation
./scripts/test-ci.sh
```

**What it does:**

1. Starts Postgres and Redis via Docker
2. Installs dependencies
3. Generates Prisma client
4. Runs migrations
5. Runs linting
6. Runs unit tests with coverage
7. Runs E2E tests
8. Shows coverage summary
9. Cleans up containers

---

## 📊 Coverage Requirements

### Thresholds (from `jest.config.js`)

```javascript
coverageThreshold: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80,
  },
}
```

### Codecov Configuration (from `codecov.yml`)

**Project Coverage:**

- Target: 80%
- Threshold: 1% (allows 79% to pass)
- Base: auto (compares to base branch)

**Patch Coverage:**

- Target: 80%
- Threshold: 5% (for new code in PRs)

**Components:**

- API: `apps/api/src/**`
- Web: `apps/web/src/**`
- Shared: `packages/shared/src/**`
- UI: `packages/ui/src/**`

---

## 🔍 Viewing Coverage Reports

### In Pull Requests

Coverage reports are automatically commented on PRs:

- Shows overall coverage change
- Highlights files with coverage changes
- Flags if coverage drops below threshold

### In Codecov Dashboard

1. Go to https://codecov.io/gh/madfam-io/dhanam
2. View:
   - Overall coverage trends
   - File-by-file coverage
   - Commit-by-commit history
   - Component breakdown
   - Coverage graphs

### Locally

After running `pnpm test:cov`:

```bash
cd apps/api
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux
start coverage/index.html  # Windows
```

---

## 🐛 Troubleshooting

### Prisma Client Generation Fails

**Error:**

```
Error: Failed to fetch the engine file
```

**Solution:**
The workflow sets `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1` to bypass this. If it still fails, check:

1. GitHub Actions has internet access
2. Prisma binaries CDN is not blocked
3. Try running locally first

### Tests Fail in CI but Pass Locally

**Common causes:**

1. **Missing environment variables**
   - Check `env:` section in workflow
   - Add missing vars to GitHub Secrets if needed

2. **Database not ready**
   - Workflow includes health checks
   - Wait times are configured

3. **Timezone differences**
   - CI runs in UTC
   - Use explicit timezones in tests

4. **File system differences**
   - Use path.join() instead of string concatenation
   - Avoid case-sensitive file operations

### Coverage Upload Fails

**Error:**

```
Failed to upload coverage
```

**Solutions:**

1. Check `CODECOV_TOKEN` secret is set
2. Verify `lcov.info` file exists
3. Check Codecov service status
4. Set `fail_ci_if_error: false` in workflow (already done)

### E2E Tests Timeout

**Increase timeout in workflow:**

```yaml
- name: Run E2E tests
  run: pnpm test:e2e
  timeout-minutes: 15 # Increase if needed
```

---

## 🔐 Secrets Management

### Required Secrets

| Secret          | Description                | Required    |
| --------------- | -------------------------- | ----------- |
| `CODECOV_TOKEN` | Codecov upload token       | Recommended |
| `GITHUB_TOKEN`  | Automatic, no setup needed | Auto        |

### Optional Secrets (for future)

| Secret        | Description           | When Needed |
| ------------- | --------------------- | ----------- |
| `SENTRY_DSN`  | Sentry error tracking | Production  |
| `POSTHOG_KEY` | PostHog analytics     | Production  |

**How to add:**

1. Go to GitHub repo → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Enter name and value
4. Click "Add secret"

---

## 📈 Coverage Trends

### Tracking Over Time

Codecov automatically tracks:

- Coverage by commit
- Coverage by branch
- Coverage by component
- Coverage trends (graphs)

### Setting Up Notifications

**Slack Integration:**

```yaml
# In codecov.yml
slack:
  url: 'secret:SLACK_WEBHOOK_URL'
```

**GitHub Status Checks:**
Already enabled in `codecov.yml`:

```yaml
github_checks:
  annotations: true
```

---

## 🎯 Best Practices

### 1. Write Tests Before Pushing

Run locally first:

```bash
pnpm test:cov
```

### 2. Check Coverage Locally

Before creating PR:

```bash
./scripts/test-ci.sh
```

### 3. Review Coverage in PRs

- Check the Codecov comment
- Ensure new code has 80%+ coverage
- Fix any uncovered branches

### 4. Keep Tests Fast

- Use `TestDatabase` helpers for cleanup
- Mock external services
- Parallelize independent tests

### 5. Maintain Green Builds

- Fix failing tests immediately
- Don't merge PRs with failing tests
- Monitor coverage trends

---

## 🚦 Status Badges

Add these to README.md:

```markdown
[![Test Coverage](https://github.com/madfam-io/dhanam/actions/workflows/test-coverage.yml/badge.svg)](https://github.com/madfam-io/dhanam/actions/workflows/test-coverage.yml)

[![Lint](https://github.com/madfam-io/dhanam/actions/workflows/lint.yml/badge.svg)](https://github.com/madfam-io/dhanam/actions/workflows/lint.yml)

[![codecov](https://codecov.io/gh/madfam-io/dhanam/branch/main/graph/badge.svg)](https://codecov.io/gh/madfam-io/dhanam)
```

---

## 📝 Workflow Customization

### Change Test Database

Edit `test-coverage.yml`:

```yaml
services:
  postgres:
    env:
      POSTGRES_USER: your_user
      POSTGRES_PASSWORD: your_password
      POSTGRES_DB: your_db
```

### Add More Node Versions

```yaml
strategy:
  matrix:
    node-version: [18, 20]

steps:
  - name: Setup Node.js ${{ matrix.node-version }}
    uses: actions/setup-node@v4
    with:
      node-version: ${{ matrix.node-version }}
```

### Add More Test Environments

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest]

runs-on: ${{ matrix.os }}
```

### Skip CI for Docs Changes

Add to commit message:

```
docs: update README [skip ci]
```

Or configure in workflow:

```yaml
on:
  push:
    paths-ignore:
      - '**.md'
      - 'docs/**'
```

---

## 🔄 Workflow Updates

### Test the Workflow Locally

Use `act` to test GitHub Actions locally:

```bash
# Install act
brew install act  # macOS
# or
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Run workflow
act -j test
```

### Validate Workflow Syntax

GitHub automatically validates on push, or use:

```bash
# Using actionlint
actionlint .github/workflows/*.yml
```

---

## 📞 Support

**Issues with CI/CD:**

1. Check workflow logs in GitHub Actions tab
2. Run `./scripts/test-ci.sh` locally to reproduce
3. Review this guide for common solutions
4. Check GitHub Actions documentation

**Need Help:**

- GitHub Actions Docs: https://docs.github.com/en/actions
- Codecov Docs: https://docs.codecov.com/
- Jest Docs: https://jestjs.io/

---

## ✅ Checklist

After setting up CI/CD:

- [ ] Workflow files pushed to `.github/workflows/`
- [ ] Codecov token added to GitHub Secrets
- [ ] First workflow run succeeded
- [ ] Coverage report uploaded to Codecov
- [ ] Badges added to README.md
- [ ] Team notified about CI/CD setup
- [ ] Documentation reviewed and understood
- [ ] Local CI script tested (`./scripts/test-ci.sh`)

---

**Status:** Ready for production use ✅
**Last Updated:** November 17, 2025
