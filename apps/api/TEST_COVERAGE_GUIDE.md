# Test Coverage Guide

## Current Test Infrastructure Status

### ✅ Completed Test Infrastructure

**Test Helpers (3 files):**

- `test/helpers/test-database.ts` (196 lines) - Database setup/cleanup/teardown
- `test/helpers/auth-helper.ts` (370+ lines) - JWT, TOTP, password utilities
- `test/helpers/test-data-factory.ts` (111 lines) - Factory pattern for test data

**Test Files (26 total):**

- `src/modules/transactions/__tests__/transactions.service.spec.ts` (NEW - 400+ lines)
- `src/modules/budgets/__tests__/budgets.service.spec.ts` (NEW - 80+ lines)
- 24 existing test files

**Jest Configuration:**

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

---

## 🚧 Known Limitation: Prisma Client Generation

**Issue:** Prisma client generation requires downloading binary engines which is restricted in some CI/CD environments.

**Error:**

```
Error: Failed to fetch the engine file at https://binaries.prisma.sh/...
403 Forbidden
```

**Impact:** Tests that depend on Prisma types (Transaction, Budget, etc.) cannot run without a generated client.

---

## Running Tests Locally

### Prerequisites

1. **Install Dependencies:**

```bash
pnpm install
```

2. **Setup Test Database:**

```bash
# Use docker-compose for local Postgres
pnpm dev:infra

# Or set DATABASE_URL to test database
export DATABASE_URL="postgresql://user:password@localhost:5432/dhanam_test"
```

3. **Generate Prisma Client:**

```bash
cd apps/api
pnpm prisma generate
```

4. **Run Migrations:**

```bash
pnpm prisma migrate deploy
```

### Running Tests

**All Tests:**

```bash
pnpm test
```

**With Coverage:**

```bash
pnpm test:cov
```

**Watch Mode:**

```bash
pnpm test:watch
```

**Specific Test File:**

```bash
pnpm test src/modules/transactions/__tests__/transactions.service.spec.ts
```

**E2E Tests:**

```bash
pnpm test:e2e
```

---

## Test Coverage by Module

### ✅ High Coverage Modules

**Core Infrastructure:**

- `src/core/logger/__tests__/log-sanitizer.spec.ts` ✅ PASSING
- `src/core/encryption/encryption.service.spec.ts` ✅ PASSING
- `src/core/prisma/prisma.service.spec.ts` ✅ PASSING
- `src/core/cache/cache.service.spec.ts` ✅ PASSING

### 🆕 New Critical Path Tests

**Transactions Module:**

- `src/modules/transactions/__tests__/transactions.service.spec.ts` (400+ lines)
  - ✅ Pagination and filtering
  - ✅ Date range queries
  - ✅ Amount range queries
  - ✅ Decimal precision
  - ✅ Balance calculations
  - ✅ Bulk operations (<2s for 150 txns)
  - ✅ Multi-space isolation
  - ✅ Authorization checks

**Budgets Module:**

- `src/modules/budgets/__tests__/budgets.service.spec.ts` (80+ lines)
  - ✅ Budget creation (monthly/quarterly/yearly)
  - ✅ Overlap detection
  - ✅ Category spending calculations
  - ✅ Over-budget scenarios
  - ✅ Period-based filtering

### 🔄 Existing Tests (Require Prisma Client)

**Provider Integration:**

- `src/modules/providers/belvo/__tests__/belvo.webhook.spec.ts`
- `src/modules/providers/plaid/__tests__/plaid.webhook.spec.ts`
- `src/modules/providers/bitso/__tests__/bitso.webhook.spec.ts`

**Business Logic:**

- `src/modules/categories/__tests__/rules.service.spec.ts`
- `src/modules/accounts/accounts.service.spec.ts`
- `src/modules/esg/enhanced-esg.service.spec.ts`

### ⚠️ Modules Needing Tests

**High Priority:**

- `src/modules/auth/auth.service.ts` - Authentication flows
- `src/modules/spaces/spaces.service.ts` - Multi-tenant logic
- `src/modules/users/users.service.ts` - User management

**Medium Priority:**

- `src/modules/webhooks/webhook-handler.service.ts` - Webhook processing
- `src/modules/analytics/analytics.service.ts` - Event tracking
- `src/modules/notifications/notifications.service.ts` - Alert system

---

## Coverage Thresholds

**Target: 80%+ across all metrics**

```javascript
branches: 80%      // Conditional branches covered
functions: 80%     // Functions executed
lines: 80%         // Code lines executed
statements: 80%    // Statements executed
```

**How to Check Coverage:**

```bash
pnpm test:cov

# View HTML report
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux
```

**Coverage Report Location:**

```
apps/api/coverage/
├── index.html           # Main coverage report
├── lcov-report/         # Detailed HTML reports
└── lcov.info            # LCOV format for CI/CD
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Test Coverage
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: dhanam_test
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3

      - name: Setup pnpm
        uses: pnpm/action-setup@v2

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Generate Prisma Client
        run: pnpm prisma generate

      - name: Run migrations
        run: pnpm prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/dhanam_test

      - name: Run tests with coverage
        run: pnpm test:cov
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/dhanam_test
          JWT_SECRET: test-secret

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./apps/api/coverage/lcov.info
          flags: api
```

---

## Test Writing Guidelines

### 1. Use Test Helpers

```typescript
import { TestDatabase } from '../../../test/helpers/test-database';
import { TestDataFactory } from '../../../test/helpers/test-data-factory';
import { AuthHelper } from '../../../test/helpers/auth-helper';

describe('MyService', () => {
  let factory: TestDataFactory;

  beforeAll(async () => {
    await TestDatabase.setup();
    factory = new TestDataFactory(TestDatabase.getClient());
  });

  afterEach(async () => {
    await TestDatabase.cleanup();
  });

  afterAll(async () => {
    await TestDatabase.teardown();
  });

  it('should do something', async () => {
    const { user, space } = await factory.createFullSetup();
    // Test code here
  });
});
```

### 2. Test Organization

```typescript
describe('ServiceName', () => {
  describe('methodName', () => {
    it('should handle success case', () => {});
    it('should throw error when invalid input', () => {});
    it('should handle edge case', () => {});
  });
});
```

### 3. Performance Tests

```typescript
it('should complete in under 2 seconds for 100+ items', async () => {
  const startTime = Date.now();
  await service.bulkOperation(items);
  const duration = Date.now() - startTime;

  expect(duration).toBeLessThan(2000);
}, 10000); // Allow extra time for test setup
```

### 4. Decimal Precision Tests

```typescript
it('should handle decimal precision correctly', async () => {
  const result = await service.calculate({ amount: 123.456789 });
  expect(result.amount.toNumber()).toBe(123.456789);
});
```

---

## Troubleshooting

### Prisma Client Not Generated

**Symptom:**

```
Module '"@prisma/client"' has no exported member 'Transaction'
```

**Solution:**

```bash
cd apps/api
pnpm prisma generate
```

### Test Database Connection Failed

**Symptom:**

```
Error: DATABASE_URL must contain "test"
```

**Solution:**

```bash
export DATABASE_URL="postgresql://user:pass@localhost:5432/dhanam_test"
```

### Tests Timing Out

**Symptom:**

```
Timeout - Async callback was not invoked within the 5000 ms timeout
```

**Solution:**

```typescript
jest.setTimeout(30000); // In test/setup.ts

// Or per-test
it('should do something', async () => {
  // ...
}, 30000);
```

### Mock Data Conflicts

**Symptom:**

```
Unique constraint failed
```

**Solution:**

```typescript
afterEach(async () => {
  await TestDatabase.cleanup(); // Clean between tests
});
```

---

## Next Steps

1. **Generate Prisma Client in Local Environment:**

   ```bash
   pnpm prisma generate
   ```

2. **Run Full Test Suite:**

   ```bash
   pnpm test:cov
   ```

3. **Verify 80%+ Coverage:**
   - Check `coverage/index.html`
   - Identify uncovered modules
   - Add missing tests

4. **Add Missing Tests:**
   - Auth service tests
   - Spaces service tests
   - User service tests
   - Provider integration tests

5. **Set Up CI/CD:**
   - Add GitHub Actions workflow
   - Configure Codecov integration
   - Add coverage badge to README

---

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Prisma Testing Guide](https://www.prisma.io/docs/guides/testing/unit-testing)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [Test Coverage Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
