# Dhanam Ledger - Remediation Plan

> [!NOTE]
> Historical remediation plan from 2025. It is superseded by
> [../ROADMAP.md](../ROADMAP.md),
> [../TECH_DEBT.md](../TECH_DEBT.md),
> [../STABILITY_WRAP_UP_2026-05-20.md](../STABILITY_WRAP_UP_2026-05-20.md), and
> [../GA_REMEDIATION_ROADMAP.md](../GA_REMEDIATION_ROADMAP.md).

**Version:** 1.0
**Date:** 2025-11-16
**Status:** Draft
**Target Completion:** 4-6 weeks

---

## Executive Summary

This remediation plan addresses critical gaps identified in the codebase analysis to ensure the Dhanam Ledger platform is production-ready. The plan is organized into 3 priority tiers with 47 specific tasks across 5 work streams.

**Key Metrics:**

- Total Tasks: 47
- Estimated Effort: 18-24 developer-weeks
- Critical Issues: 7 security vulnerabilities
- Test Coverage Gap: 60-65% (from 15-20% to 80%+)
- Provider Integration Gap: 3 providers needing completion

---

## Table of Contents

1. [Priority 1: Critical Security Fixes](#priority-1-critical-security-fixes)
2. [Priority 2: Test Coverage Expansion](#priority-2-test-coverage-expansion)
3. [Priority 3: Provider Integration Completion](#priority-3-provider-integration-completion)
4. [Priority 4: Type Safety Improvements](#priority-4-type-safety-improvements)
5. [Priority 5: Performance & Reliability](#priority-5-performance--reliability)
6. [Implementation Timeline](#implementation-timeline)
7. [Success Criteria](#success-criteria)
8. [Risk Assessment](#risk-assessment)

---

## Priority 1: Critical Security Fixes

**Timeline:** Week 1-2
**Effort:** 5-7 days
**Risk Level:** 🔴 Critical

### Task 1.1: Fix JWT Secret Management

**File:** `apps/api/src/core/auth/auth.service.ts`
**Issue:** JWT secret has unsafe fallback without error throwing
**Impact:** Could allow JWT signing with predictable secret in production

**Implementation Steps:**

```typescript
// Current (UNSAFE):
const secret = process.env.JWT_SECRET || 'fallback-secret';

// Fixed:
const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error('JWT_SECRET environment variable is required');
}
```

**Acceptance Criteria:**

- [ ] Remove all fallback secrets in auth configuration
- [ ] Add environment variable validation on app startup
- [ ] Create startup validation service that checks all required secrets
- [ ] Update documentation with required environment variables
- [ ] Add CI check to ensure .env.example contains all required vars

**Estimated Effort:** 4 hours

---

### Task 1.2: Sanitize Password Reset Token Logging

**Files:**

- `apps/api/src/modules/users/users.service.ts`
- `apps/api/src/core/logger/logger.service.ts`

**Issue:** Password reset tokens could be logged in error messages
**Impact:** Token exposure in logs could allow unauthorized password resets

**Implementation Steps:**

1. Create a logger sanitization middleware
2. Add sensitive field redaction (tokens, passwords, secrets)
3. Audit all log statements containing user input
4. Add structured logging with explicit field filtering

**Code Changes:**

```typescript
// Create apps/api/src/core/logger/sanitizer.ts
export class LogSanitizer {
  private static SENSITIVE_FIELDS = [
    'password',
    'token',
    'secret',
    'resetToken',
    'totpSecret',
    'accessToken',
    'refreshToken',
  ];

  static sanitize(data: any): any {
    if (typeof data !== 'object' || data === null) return data;

    const sanitized = { ...data };
    for (const field of this.SENSITIVE_FIELDS) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }
    return sanitized;
  }
}

// Update logger.service.ts
log(message: string, context?: any) {
  const sanitized = LogSanitizer.sanitize(context);
  this.logger.log(message, sanitized);
}
```

**Acceptance Criteria:**

- [ ] Create LogSanitizer utility class
- [ ] Update all logger methods to sanitize data
- [ ] Audit all existing log statements
- [ ] Add unit tests for sanitization logic
- [ ] Update logging documentation

**Estimated Effort:** 6 hours

---

### Task 1.3: Remove Hardcoded TOTP Secrets from Seed Data

**File:** `apps/api/prisma/seed.ts`

**Issue:** Hardcoded TOTP secrets in development seed data
**Impact:** Known secrets could be used if seed data accidentally runs in production

**Implementation Steps:**

```typescript
// Current (UNSAFE):
totpSecret: 'JBSWY3DPEHPK3PXP',

// Fixed:
totpSecret: generateSecureSecret(), // Generate random secret per seed run
```

**Code Changes:**

```typescript
import * as speakeasy from 'speakeasy';

function generateSecureSecret(): string {
  return speakeasy.generateSecret({ length: 32 }).base32;
}

// In seed user creation:
totpSecret: process.env.NODE_ENV === 'development'
  ? generateSecureSecret()
  : null,
```

**Acceptance Criteria:**

- [ ] Replace all hardcoded secrets with generated values
- [ ] Add warning comment in seed file about production usage
- [ ] Add environment check to prevent seed in production
- [ ] Document seed data security practices
- [ ] Create separate production seed script (if needed)

**Estimated Effort:** 2 hours

---

### Task 1.4: Strengthen Backup Code Generation

**File:** `apps/api/src/core/auth/totp.service.ts`

**Issue:** Backup codes use weak random generation pattern
**Impact:** Potentially predictable backup codes

**Implementation Steps:**

```typescript
// Current (WEAK):
Math.random().toString(36).substring(2, 10);

// Fixed - Use crypto.randomBytes:
import { randomBytes } from 'crypto';

function generateBackupCode(): string {
  // Generate 8 characters from secure random bytes
  const bytes = randomBytes(6);
  return bytes.toString('base64').replace(/[+/=]/g, '').substring(0, 8).toUpperCase();
}
```

**Acceptance Criteria:**

- [ ] Replace Math.random() with crypto.randomBytes()
- [ ] Generate 10 backup codes per user (current: 8)
- [ ] Add checksum/validation to backup codes
- [ ] Hash backup codes before database storage
- [ ] Add unit tests for backup code generation
- [ ] Document backup code format and security properties

**Estimated Effort:** 4 hours

---

### Task 1.5: Implement AWS KMS Integration for Provider Tokens

**Files:**

- New: `apps/api/src/core/crypto/kms.service.ts`
- Update: `apps/api/src/core/crypto/crypto.service.ts`
- Update: `apps/api/src/modules/providers/*/providers.service.ts`

**Issue:** Provider tokens encrypted with application-level keys, not AWS KMS
**Impact:** Compliance and security best practices require KMS for production

**Implementation Steps:**

1. **Create KMS Service**

```typescript
// apps/api/src/core/crypto/kms.service.ts
import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';

@Injectable()
export class KmsService {
  private client: KMSClient;
  private keyId: string;

  constructor() {
    this.client = new KMSClient({ region: process.env.AWS_REGION });
    this.keyId = process.env.KMS_KEY_ID;
    if (!this.keyId && process.env.NODE_ENV === 'production') {
      throw new Error('KMS_KEY_ID required in production');
    }
  }

  async encrypt(plaintext: string): Promise<string> {
    if (process.env.NODE_ENV !== 'production') {
      // Fall back to local encryption in development
      return this.localEncrypt(plaintext);
    }

    const command = new EncryptCommand({
      KeyId: this.keyId,
      Plaintext: Buffer.from(plaintext, 'utf8'),
    });

    const response = await this.client.send(command);
    return Buffer.from(response.CiphertextBlob).toString('base64');
  }

  async decrypt(ciphertext: string): Promise<string> {
    if (process.env.NODE_ENV !== 'production') {
      return this.localDecrypt(ciphertext);
    }

    const command = new DecryptCommand({
      CiphertextBlob: Buffer.from(ciphertext, 'base64'),
    });

    const response = await this.client.send(command);
    return Buffer.from(response.Plaintext).toString('utf8');
  }

  private localEncrypt(plaintext: string): string {
    // Use existing crypto service for local development
    const crypto = new CryptoService();
    return crypto.encrypt(plaintext);
  }

  private localDecrypt(ciphertext: string): string {
    const crypto = new CryptoService();
    return crypto.decrypt(ciphertext);
  }
}
```

2. **Update CryptoService to use KMS**
3. **Update all provider services to use new encryption**
4. **Create migration script for existing encrypted data**

**Acceptance Criteria:**

- [ ] Create KMS service with encrypt/decrypt methods
- [ ] Add KMS client dependency (@aws-sdk/client-kms)
- [ ] Update CryptoService to delegate to KMS in production
- [ ] Create data migration script for re-encrypting existing tokens
- [ ] Add KMS key creation to Terraform
- [ ] Update environment variable documentation
- [ ] Add integration tests with LocalStack
- [ ] Document KMS key rotation procedure

**Estimated Effort:** 2 days

---

### Task 1.6: Add Webhook Signature Verification Audit

**Files:** All webhook handlers in `apps/api/src/modules/providers/*/webhooks/`

**Issue:** Need to verify all webhook handlers properly validate signatures
**Impact:** Unsigned webhooks could allow malicious data injection

**Implementation Steps:**

1. Audit all webhook handlers (Belvo, Plaid, Bitso)
2. Verify signature validation is the first step
3. Add signature verification tests
4. Document signature validation requirements

**Checklist:**

- [ ] Belvo webhook signature verification ✓ (already implemented)
- [ ] Plaid webhook signature verification (needs implementation)
- [ ] Bitso webhook signature verification ✓ (already implemented)
- [ ] Add early return on signature failure
- [ ] Add security tests for invalid signatures
- [ ] Document webhook security in API docs

**Estimated Effort:** 4 hours

---

### Task 1.7: Implement Rate Limiting for Sensitive Endpoints

**Files:**

- New: `apps/api/src/core/guards/rate-limit.guard.ts`
- Update: `apps/api/src/modules/users/users.controller.ts`
- Update: `apps/api/src/core/auth/auth.controller.ts`

**Issue:** Additional rate limiting needed for auth and sensitive operations
**Impact:** Brute force attacks on login, password reset, TOTP verification

**Implementation Steps:**

```typescript
// Create stricter rate limits for sensitive endpoints
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class AuthRateLimitGuard extends ThrottlerGuard {
  protected getTracker(req: Request): string {
    // Rate limit by IP + username combination
    const username = req.body?.email || req.body?.username || 'unknown';
    return `${req.ip}:${username}`;
  }
}

// Apply to controllers:
@UseGuards(AuthRateLimitGuard)
@Throttle(5, 900) // 5 attempts per 15 minutes
@Post('login')
async login(@Body() dto: LoginDto) { ... }

@Throttle(3, 3600) // 3 attempts per hour
@Post('reset-password')
async resetPassword(@Body() dto: ResetPasswordDto) { ... }

@Throttle(5, 300) // 5 attempts per 5 minutes
@Post('verify-totp')
async verifyTotp(@Body() dto: VerifyTotpDto) { ... }
```

**Acceptance Criteria:**

- [ ] Create custom rate limit guards for auth operations
- [ ] Apply strict limits to login (5/15min)
- [ ] Apply strict limits to password reset (3/hour)
- [ ] Apply strict limits to TOTP verification (5/5min)
- [ ] Add Redis-backed rate limiting for distributed systems
- [ ] Add rate limit headers to responses
- [ ] Add monitoring for rate limit violations
- [ ] Document rate limiting in API documentation

**Estimated Effort:** 6 hours

---

## Priority 2: Test Coverage Expansion

**Timeline:** Week 2-4
**Effort:** 10-12 days
**Risk Level:** 🟡 High

### Test Coverage Goals

| Component | Current | Target | Gap  |
| --------- | ------- | ------ | ---- |
| API       | 15-20%  | 80%    | +60% |
| Web       | 5%      | 70%    | +65% |
| Mobile    | 0%      | 60%    | +60% |
| Packages  | 30%     | 80%    | +50% |

---

### Task 2.1: API Unit Tests - Core Services

**Effort:** 3 days

#### 2.1.1 Authentication Service Tests

**File:** `apps/api/src/core/auth/__tests__/auth.service.spec.ts`

**Test Cases to Add:**

```typescript
describe('AuthService', () => {
  describe('register', () => {
    it('should register a new user with hashed password');
    it('should reject weak passwords');
    it('should reject duplicate emails');
    it('should generate JWT tokens');
    it('should create user preferences on registration');
    it('should send welcome email');
    it('should hash password with Argon2id');
  });

  describe('login', () => {
    it('should login with valid credentials');
    it('should reject invalid passwords');
    it('should require TOTP when enabled');
    it('should create session on successful login');
    it('should update last login timestamp');
    it('should reject inactive users');
  });

  describe('refreshTokens', () => {
    it('should refresh valid token');
    it('should reject expired tokens');
    it('should reject revoked tokens');
    it('should detect token reuse attacks');
    it('should rotate token families');
  });

  describe('resetPassword', () => {
    it('should reset password with valid token');
    it('should reject expired tokens');
    it('should reject used tokens');
    it('should invalidate all sessions on reset');
  });
});
```

**Acceptance Criteria:**

- [ ] 95%+ coverage of auth.service.ts
- [ ] All edge cases tested (expired tokens, invalid inputs)
- [ ] Mock Prisma and email services
- [ ] Test token generation and validation
- [ ] Test password hashing with Argon2id

---

#### 2.1.2 TOTP Service Tests

**File:** `apps/api/src/core/auth/__tests__/totp.service.spec.ts`

**Test Cases:**

```typescript
describe('TotpService', () => {
  describe('setupTotp', () => {
    it('should generate 32-character secret');
    it('should return QR code data URL');
    it('should not activate TOTP until verified');
  });

  describe('verifyTotp', () => {
    it('should verify valid TOTP code');
    it('should reject expired codes');
    it('should reject reused codes');
    it('should use 2-step window');
  });

  describe('generateBackupCodes', () => {
    it('should generate 10 unique codes');
    it('should use crypto.randomBytes');
    it('should hash codes before storage');
  });

  describe('verifyBackupCode', () => {
    it('should verify valid backup code');
    it('should invalidate used codes');
    it('should reject invalid codes');
  });
});
```

**Acceptance Criteria:**

- [ ] 95%+ coverage of totp.service.ts
- [ ] Test secret generation cryptographic strength
- [ ] Test QR code generation
- [ ] Test backup code uniqueness

---

#### 2.1.3 Transaction Rules Engine Tests

**File:** `apps/api/src/modules/categories/__tests__/rules.service.spec.ts`

**Test Cases:**

```typescript
describe('RulesService', () => {
  describe('applyRules', () => {
    it('should match transaction by description pattern');
    it('should match transaction by merchant');
    it('should match transaction by amount range');
    it('should apply highest priority rule');
    it('should handle no matching rules');
    it('should handle multiple matching rules');
  });

  describe('evaluateConditions', () => {
    it('should evaluate AND conditions');
    it('should evaluate OR conditions');
    it('should handle regex patterns');
    it('should handle amount comparisons');
    it('should handle date ranges');
  });

  describe('createRule', () => {
    it('should validate rule conditions JSON');
    it('should set default priority');
    it('should reject invalid patterns');
  });
});
```

**Acceptance Criteria:**

- [ ] 90%+ coverage of rules.service.ts
- [ ] Test all condition operators
- [ ] Test priority-based rule ordering
- [ ] Test pattern matching edge cases

---

### Task 2.2: API Integration Tests

**Effort:** 3 days

#### 2.2.1 Authentication Flow E2E Tests

**File:** `apps/api/test/auth.e2e-spec.ts`

**Test Scenarios:**

```typescript
describe('Authentication (e2e)', () => {
  it('POST /auth/register - should register new user', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: 'Test User',
      })
      .expect(201);

    expect(response.body).toHaveProperty('accessToken');
    expect(response.body).toHaveProperty('refreshToken');
  });

  it('POST /auth/login - should login with valid credentials');
  it('POST /auth/login - should reject invalid credentials');
  it('POST /auth/refresh - should refresh tokens');
  it('POST /auth/logout - should invalidate session');
  it('POST /auth/reset-password-request - should send reset email');
  it('POST /auth/reset-password - should reset password');

  describe('TOTP flow', () => {
    it('should setup TOTP and return QR code');
    it('should verify TOTP code');
    it('should require TOTP on login when enabled');
    it('should verify backup codes');
  });
});
```

**Acceptance Criteria:**

- [ ] Full authentication flow tested end-to-end
- [ ] Use test database (separate from development)
- [ ] Clean up test data after each test
- [ ] Test all HTTP status codes
- [ ] Test error responses

---

#### 2.2.2 Budget Management E2E Tests

**File:** `apps/api/test/budgets.e2e-spec.ts`

**Test Scenarios:**

```typescript
describe('Budgets (e2e)', () => {
  it('POST /budgets - should create budget');
  it('GET /budgets - should list user budgets');
  it('GET /budgets/:id/analytics - should return spending analytics');
  it('POST /budgets/:id/categories - should add category');
  it('PUT /budgets/:id/categories/:catId - should update category limit');
  it('DELETE /budgets/:id - should delete budget and categories');

  describe('budget calculations', () => {
    it('should calculate total spent per category');
    it('should calculate remaining budget');
    it('should identify over-budget categories');
    it('should handle multiple currencies');
  });
});
```

---

#### 2.2.3 Provider Integration E2E Tests

**File:** `apps/api/test/providers.e2e-spec.ts`

**Test Scenarios:**

```typescript
describe('Providers (e2e)', () => {
  describe('Belvo', () => {
    it('POST /providers/belvo/connect - should create Belvo link');
    it('POST /providers/belvo/webhook - should process account update webhook');
    it('POST /providers/belvo/webhook - should reject invalid signature');
    it('GET /providers/belvo/accounts - should fetch accounts');
  });

  describe('Plaid', () => {
    it('POST /providers/plaid/link-token - should create link token');
    it('POST /providers/plaid/exchange-token - should exchange public token');
    it('POST /providers/plaid/webhook - should process transaction webhook');
  });

  describe('Bitso', () => {
    it('POST /providers/bitso/connect - should connect Bitso account');
    it('GET /providers/bitso/balances - should fetch crypto balances');
  });
});
```

**Acceptance Criteria:**

- [ ] Mock external provider APIs
- [ ] Test webhook signature verification
- [ ] Test error handling for provider failures
- [ ] Test data normalization from providers

---

### Task 2.3: Frontend Component Tests

**Effort:** 3 days

#### 2.3.1 Web Component Tests

**Files:** Create tests for all components in `apps/web/src/components/`

**Priority Components:**

```typescript
// apps/web/src/components/auth/__tests__/LoginForm.test.tsx
describe('LoginForm', () => {
  it('should render email and password inputs');
  it('should show validation errors');
  it('should call onSubmit with form data');
  it('should show TOTP input when required');
  it('should disable submit button while loading');
  it('should display error message on failure');
});

// apps/web/src/components/budgets/__tests__/BudgetAnalytics.test.tsx
describe('BudgetAnalytics', () => {
  it('should render charts with budget data');
  it('should show category breakdown');
  it('should highlight over-budget categories');
  it('should handle empty data');
  it('should format currency correctly');
});

// apps/web/src/components/providers/__tests__/BelvoConnect.test.tsx
describe('BelvoConnect', () => {
  it('should render connect button');
  it('should open Belvo modal on click');
  it('should handle successful connection');
  it('should handle connection errors');
});
```

**Testing Libraries:**

- React Testing Library
- Jest
- MSW (Mock Service Worker) for API mocking

**Acceptance Criteria:**

- [ ] Test all 20+ components in /components
- [ ] Test user interactions (clicks, form inputs)
- [ ] Test loading and error states
- [ ] Test responsive behavior
- [ ] Achieve 70%+ coverage for web components

---

#### 2.3.2 Mobile Component Tests

**Files:** Create tests for screens in `apps/mobile/src/screens/`

**Priority Screens:**

```typescript
// apps/mobile/src/screens/__tests__/LoginScreen.test.tsx
describe('LoginScreen', () => {
  it('should render login form');
  it('should navigate to register on link click');
  it('should call login API on submit');
  it('should show biometric option if available');
});

// apps/mobile/src/screens/__tests__/DashboardScreen.test.tsx
describe('DashboardScreen', () => {
  it('should display account summaries');
  it('should show recent transactions');
  it('should navigate to accounts on card press');
  it('should handle pull-to-refresh');
});
```

**Testing Libraries:**

- React Native Testing Library
- Jest

**Acceptance Criteria:**

- [ ] Test all 19 mobile screens
- [ ] Test navigation flows
- [ ] Test biometric authentication
- [ ] Achieve 60%+ coverage for mobile

---

### Task 2.4: Package Unit Tests

**Effort:** 2 days

#### 2.4.1 ESG Package Tests

**File:** `packages/esg/__tests__/ESGManager.spec.ts`

**Test Cases:**

```typescript
describe('ESGManager', () => {
  describe('getAssetScore', () => {
    it('should fetch score from provider');
    it('should cache results for 1 hour');
    it('should handle provider failures');
    it('should return null for unknown assets');
  });

  describe('getBatchScores', () => {
    it('should fetch multiple asset scores');
    it('should rate limit requests');
    it('should handle partial failures');
  });
});

describe('PortfolioESGAnalyzer', () => {
  it('should calculate weighted portfolio score');
  it('should handle zero-value positions');
  it('should categorize assets by ESG rating');
});
```

**Acceptance Criteria:**

- [ ] 90%+ coverage of ESG package
- [ ] Mock Dhanam API responses
- [ ] Test caching behavior
- [ ] Test rate limiting

---

### Task 2.5: Test Infrastructure Setup

**Effort:** 1 day

**Tasks:**

- [ ] Configure Jest for monorepo
- [ ] Set up test database (PostgreSQL in Docker)
- [ ] Configure MSW for API mocking
- [ ] Set up code coverage reporting
- [ ] Add coverage thresholds to CI
- [ ] Create test utilities and factories
- [ ] Document testing practices

**Coverage Thresholds:**

```json
{
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "functions": 80,
      "lines": 80,
      "statements": 80
    }
  }
}
```

---

## Priority 3: Provider Integration Completion

**Timeline:** Week 3-5
**Effort:** 5-7 days
**Risk Level:** 🟡 Medium

### Task 3.1: Complete Plaid Integration

**File:** `apps/api/src/modules/providers/plaid/plaid.service.ts`
**Effort:** 2 days

**Current Status:** 40% complete (link token creation only)

#### 3.1.1 Implement Account Fetching

```typescript
async fetchAccounts(connectionId: string): Promise<Account[]> {
  const connection = await this.prisma.providerConnection.findUnique({
    where: { id: connectionId },
  });

  const accessToken = await this.crypto.decrypt(connection.encryptedToken);

  const response = await this.plaidClient.accountsGet({
    access_token: accessToken,
  });

  // Normalize Plaid accounts to common schema
  return response.accounts.map(account => ({
    providerAccountId: account.account_id,
    name: account.name,
    officialName: account.official_name,
    type: this.mapAccountType(account.type),
    subtype: account.subtype,
    balance: account.balances.current,
    currency: account.balances.iso_currency_code || 'USD',
    mask: account.mask,
  }));
}
```

**Acceptance Criteria:**

- [ ] Implement accountsGet API call
- [ ] Map Plaid account types to internal schema
- [ ] Handle pagination for large account lists
- [ ] Store account metadata
- [ ] Handle API errors gracefully
- [ ] Add unit tests
- [ ] Add integration tests

---

#### 3.1.2 Implement Transaction Sync

```typescript
async syncTransactions(
  accountId: string,
  startDate: Date,
  endDate: Date = new Date(),
): Promise<Transaction[]> {
  const account = await this.prisma.account.findUnique({
    where: { id: accountId },
    include: { space: { include: { connection: true } } },
  });

  const accessToken = await this.crypto.decrypt(
    account.space.connection.encryptedToken,
  );

  // Use Plaid Transactions Sync API
  let cursor = account.metadata?.plaidCursor as string | null;
  const transactions: Transaction[] = [];
  let hasMore = true;

  while (hasMore) {
    const response = await this.plaidClient.transactionsSync({
      access_token: accessToken,
      cursor,
      count: 500,
    });

    // Process added transactions
    for (const txn of response.added) {
      transactions.push(this.normalizeTransaction(txn, accountId));
    }

    // Process modified transactions
    for (const txn of response.modified) {
      await this.updateTransaction(txn, accountId);
    }

    // Process removed transactions
    for (const txnId of response.removed) {
      await this.deleteTransaction(txnId);
    }

    cursor = response.next_cursor;
    hasMore = response.has_more;
  }

  // Save cursor for next sync
  await this.prisma.account.update({
    where: { id: accountId },
    data: {
      metadata: { ...account.metadata, plaidCursor: cursor },
      lastSyncedAt: new Date(),
    },
  });

  return transactions;
}
```

**Acceptance Criteria:**

- [ ] Implement transactionsSync API
- [ ] Handle incremental updates with cursor
- [ ] Process added/modified/removed transactions
- [ ] Store sync cursor for next iteration
- [ ] Normalize transaction data
- [ ] Apply auto-categorization rules
- [ ] Add error handling and retries
- [ ] Add unit tests
- [ ] Add integration tests

---

#### 3.1.3 Implement Webhook Handlers

**File:** `apps/api/src/modules/providers/plaid/webhooks/plaid-webhook.controller.ts`

```typescript
@Controller('webhooks/plaid')
export class PlaidWebhookController {
  constructor(
    private readonly plaidService: PlaidService,
    private readonly jobsService: JobsService
  ) {}

  @Post()
  async handleWebhook(
    @Body() payload: PlaidWebhookPayload,
    @Headers('plaid-verification') signature: string
  ) {
    // Verify webhook signature
    if (!this.verifySignature(payload, signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    // Log webhook event
    await this.prisma.webhookEvent.create({
      data: {
        provider: 'plaid',
        eventType: payload.webhook_type,
        payload,
      },
    });

    // Handle different webhook types
    switch (payload.webhook_type) {
      case 'TRANSACTIONS':
        return this.handleTransactionsWebhook(payload);
      case 'ITEM':
        return this.handleItemWebhook(payload);
      case 'AUTH':
        return this.handleAuthWebhook(payload);
      default:
        this.logger.warn(`Unhandled webhook type: ${payload.webhook_type}`);
    }

    return { received: true };
  }

  private async handleTransactionsWebhook(payload: any) {
    const { item_id, webhook_code } = payload;

    switch (webhook_code) {
      case 'INITIAL_UPDATE':
      case 'HISTORICAL_UPDATE':
      case 'DEFAULT_UPDATE':
        // Queue transaction sync job
        await this.jobsService.queueTransactionSync({
          provider: 'plaid',
          itemId: item_id,
        });
        break;

      case 'TRANSACTIONS_REMOVED':
        // Handle removed transactions
        await this.plaidService.handleRemovedTransactions(payload.removed_transactions);
        break;
    }
  }

  private verifySignature(payload: any, signature: string): boolean {
    const crypto = require('crypto');
    const secret = process.env.PLAID_WEBHOOK_SECRET;

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    const expectedSignature = hmac.digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  }
}
```

**Acceptance Criteria:**

- [ ] Implement webhook signature verification
- [ ] Handle TRANSACTIONS webhooks
- [ ] Handle ITEM webhooks (connection status)
- [ ] Handle AUTH webhooks
- [ ] Queue background jobs for sync
- [ ] Add webhook event logging
- [ ] Add error handling
- [ ] Add integration tests

---

### Task 3.2: Complete Bitso Integration

**File:** `apps/api/src/modules/providers/bitso/bitso.service.ts`
**Effort:** 1.5 days

**Current Status:** 60% complete (basic API calls, missing real-time sync)

#### 3.2.1 Implement Real-time Balance Updates

```typescript
async syncBalances(connectionId: string): Promise<void> {
  const connection = await this.getConnection(connectionId);
  const balances = await this.bitsoClient.balances();

  for (const balance of balances) {
    const account = await this.prisma.account.findFirst({
      where: {
        connectionId,
        providerAccountId: balance.currency,
      },
    });

    if (account) {
      await this.prisma.account.update({
        where: { id: account.id },
        data: {
          balance: new Decimal(balance.total),
          lastSyncedAt: new Date(),
        },
      });

      // Create valuation snapshot
      await this.prisma.assetValuation.create({
        data: {
          accountId: account.id,
          date: new Date(),
          value: new Decimal(balance.total),
        },
      });
    }
  }
}
```

**Acceptance Criteria:**

- [ ] Implement balance syncing
- [ ] Create daily valuation snapshots
- [ ] Handle multiple cryptocurrencies
- [ ] Add error handling
- [ ] Add unit tests

---

#### 3.2.2 Implement Transaction History

```typescript
async fetchTransactions(
  accountId: string,
  options?: { startDate?: Date; endDate?: Date },
): Promise<Transaction[]> {
  // Bitso doesn't provide transaction history API
  // Need to implement via websocket or polling trades
  // This is a limitation of Bitso API

  this.logger.warn(
    'Bitso transaction history not available via API. ' +
    'Consider implementing via websocket for real-time trades.',
  );

  return [];
}
```

**Note:** Bitso API limitations - transactions may need to be tracked via webhooks

---

### Task 3.3: Implement Blockchain Address Tracking

**File:** `apps/api/src/modules/providers/blockchain/blockchain.service.ts`
**Effort:** 2 days

**Current Status:** 50% complete (address validation only)

#### 3.3.1 Implement ETH Balance Querying

```typescript
import { ethers } from 'ethers';

async getEthBalance(address: string): Promise<Decimal> {
  const provider = new ethers.JsonRpcProvider(
    process.env.ETH_RPC_URL || 'https://cloudflare-eth.com',
  );

  const balance = await provider.getBalance(address);
  const ethBalance = ethers.formatEther(balance);

  return new Decimal(ethBalance);
}

async getErc20Balance(
  address: string,
  tokenAddress: string,
): Promise<Decimal> {
  const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);

  const erc20Abi = ['function balanceOf(address) view returns (uint256)'];
  const contract = new ethers.Contract(tokenAddress, erc20Abi, provider);

  const balance = await contract.balanceOf(address);
  const tokenBalance = ethers.formatUnits(balance, 18); // Assumes 18 decimals

  return new Decimal(tokenBalance);
}
```

**Acceptance Criteria:**

- [ ] Implement ETH balance querying
- [ ] Implement ERC-20 token balance querying
- [ ] Support multiple RPC providers
- [ ] Add retry logic for RPC failures
- [ ] Cache balances with short TTL
- [ ] Add unit tests

---

#### 3.3.2 Implement BTC Balance Querying

```typescript
async getBtcBalance(address: string): Promise<Decimal> {
  // Use public Bitcoin API (e.g., Blockchair, Blockchain.info)
  const response = await fetch(
    `https://blockchain.info/q/addressbalance/${address}`,
  );

  const satoshis = await response.text();
  const btc = new Decimal(satoshis).div(100000000); // Convert satoshis to BTC

  return btc;
}

async getXpubBalance(xpub: string): Promise<Decimal> {
  // Use Blockchair API for xPub balance
  const response = await fetch(
    `https://api.blockchair.com/bitcoin/xpub/${xpub}`,
  );

  const data = await response.json();
  const balance = new Decimal(data.data[xpub].balance).div(100000000);

  return balance;
}
```

**Acceptance Criteria:**

- [ ] Implement BTC address balance
- [ ] Implement xPub balance aggregation
- [ ] Handle API rate limits
- [ ] Add fallback providers
- [ ] Add unit tests

---

#### 3.3.3 Create Background Sync Jobs

```typescript
@Injectable()
export class BlockchainSyncJob {
  @Cron('0 */6 * * *') // Every 6 hours
  async syncAllBlockchainAccounts() {
    const accounts = await this.prisma.account.findMany({
      where: {
        provider: 'blockchain',
        isActive: true,
      },
    });

    for (const account of accounts) {
      await this.syncAccount(account);
    }
  }

  private async syncAccount(account: Account) {
    const address = account.providerAccountId;
    let balance: Decimal;

    if (account.metadata?.asset === 'ETH') {
      balance = await this.blockchainService.getEthBalance(address);
    } else if (account.metadata?.asset === 'BTC') {
      if (address.startsWith('xpub')) {
        balance = await this.blockchainService.getXpubBalance(address);
      } else {
        balance = await this.blockchainService.getBtcBalance(address);
      }
    }

    await this.prisma.account.update({
      where: { id: account.id },
      data: {
        balance,
        lastSyncedAt: new Date(),
      },
    });

    await this.prisma.assetValuation.create({
      data: {
        accountId: account.id,
        date: new Date(),
        value: balance,
      },
    });
  }
}
```

**Acceptance Criteria:**

- [ ] Create scheduled sync jobs
- [ ] Sync every 6 hours
- [ ] Create valuation snapshots
- [ ] Add error handling and retries
- [ ] Add monitoring

---

## Priority 4: Type Safety Improvements

**Timeline:** Week 4-5
**Effort:** 3-4 days
**Risk Level:** 🟢 Low

### Task 4.1: Eliminate `as any` Type Assertions

**Effort:** 2 days

**Current Count:** 82 instances

**Strategy:**

1. Run grep to find all `as any` usages
2. Categorize by pattern (API responses, external libraries, etc.)
3. Replace with proper types

**Example Replacements:**

```typescript
// BEFORE (UNSAFE):
const data = response.data as any;
const client = this.belvoClient as any;

// AFTER (SAFE):
interface BelvoAccount {
  id: string;
  name: string;
  balance: number;
  currency: string;
}

const data: BelvoAccount[] = response.data;
const client: BelvoClient = this.belvoClient;
```

**Files to Audit:**

```bash
# Find all instances
rg "as any" --type ts -l

# Prioritize by file
apps/api/src/modules/providers/belvo/belvo.service.ts   # 12 instances
apps/api/src/modules/providers/plaid/plaid.service.ts   # 8 instances
apps/web/src/lib/api/client.ts                          # 15 instances
```

**Acceptance Criteria:**

- [ ] Reduce `as any` from 82 to <10
- [ ] Create proper type definitions for provider responses
- [ ] Document why any remaining `as any` is necessary
- [ ] Add ESLint rule to prevent new `as any` usages

---

### Task 4.2: Add Type Annotations to Untyped Parameters

**Effort:** 1.5 days

**Current Count:** 133 instances of `: any`

**Strategy:**

1. Find all `: any` parameter annotations
2. Infer proper types from usage
3. Add type definitions

**Example:**

```typescript
// BEFORE:
function processTransaction(txn: any) {
  return {
    id: txn.id,
    amount: txn.amount,
  };
}

// AFTER:
interface RawTransaction {
  id: string;
  amount: number;
  description?: string;
  date: Date;
}

function processTransaction(txn: RawTransaction) {
  return {
    id: txn.id,
    amount: txn.amount,
  };
}
```

**Acceptance Criteria:**

- [ ] Reduce `: any` from 133 to <20
- [ ] Create shared type definitions in `packages/shared/src/types`
- [ ] Add strict TypeScript compiler options
- [ ] Add ESLint rule: `@typescript-eslint/no-explicit-any: error`

---

### Task 4.3: Type API Responses

**Effort:** 1 day

**Create comprehensive API response types:**

```typescript
// packages/shared/src/types/api-responses.ts
export interface ApiResponse<T> {
  data: T;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ErrorResponse {
  statusCode: number;
  message: string;
  error?: string;
  timestamp: string;
  path: string;
}

// Specific response types
export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface UserProfileResponse {
  id: string;
  email: string;
  name: string;
  totpEnabled: boolean;
  onboardingStep: number;
}

// ... more response types
```

**Update API client:**

```typescript
// apps/web/src/lib/api/client.ts
import type { AuthTokenResponse, UserProfileResponse } from '@dhanam/shared';

export const api = {
  auth: {
    login: (dto: LoginDto): Promise<AuthTokenResponse> =>
      apiClient.post('/auth/login', dto).then((res) => res.data),

    profile: (): Promise<UserProfileResponse> =>
      apiClient.get('/auth/profile').then((res) => res.data),
  },
  // ... more endpoints
};
```

**Acceptance Criteria:**

- [ ] Create types for all API responses
- [ ] Update API client to use typed responses
- [ ] Add runtime validation with Zod
- [ ] Generate types from OpenAPI schema (optional)

---

## Priority 5: Performance & Reliability

**Timeline:** Week 5-6
**Effort:** 3-4 days
**Risk Level:** 🟢 Low

### Task 5.1: Configure Prisma Connection Pooling

**File:** `apps/api/src/core/database/prisma.service.ts`
**Effort:** 4 hours

**Implementation:**

```typescript
import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      errorFormat: 'pretty',

      // Connection pool configuration
      connection_limit: parseInt(process.env.DB_POOL_SIZE || '10', 10),
      pool_timeout: parseInt(process.env.DB_POOL_TIMEOUT || '10', 10),
    });
  }

  async onModuleInit() {
    await this.$connect();

    // Add query performance logging
    if (process.env.NODE_ENV === 'development') {
      this.$use(async (params, next) => {
        const before = Date.now();
        const result = await next(params);
        const after = Date.now();

        console.log(`Query ${params.model}.${params.action} took ${after - before}ms`);

        return result;
      });
    }
  }

  async enableShutdownHooks(app: INestApplication) {
    this.$on('beforeExit', async () => {
      await app.close();
    });
  }
}
```

**Environment Variables:**

```bash
# .env
DB_POOL_SIZE=10              # Default pool size
DB_POOL_TIMEOUT=10           # Seconds before timeout
DATABASE_URL="postgresql://user:pass@localhost:5432/dhanam?connection_limit=10&pool_timeout=10"
```

**Acceptance Criteria:**

- [ ] Configure connection pool size (10-20)
- [ ] Set pool timeout (10s)
- [ ] Add query performance logging
- [ ] Test under load (100+ concurrent requests)
- [ ] Monitor connection usage in production
- [ ] Document pool configuration

---

### Task 5.2: Implement Query Performance Monitoring

**Effort:** 6 hours

**Create performance monitoring middleware:**

```typescript
// apps/api/src/core/monitoring/query-monitor.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class QueryMonitorService {
  private slowQueryThreshold = 1000; // 1 second

  constructor(private prisma: PrismaService) {
    this.setupMonitoring();
  }

  private setupMonitoring() {
    this.prisma.$use(async (params, next) => {
      const start = Date.now();
      const result = await next(params);
      const duration = Date.now() - start;

      if (duration > this.slowQueryThreshold) {
        await this.logSlowQuery({
          model: params.model,
          action: params.action,
          duration,
          args: params.args,
        });
      }

      // Send metrics to monitoring service
      this.recordQueryMetrics({
        model: params.model,
        action: params.action,
        duration,
      });

      return result;
    });
  }

  private async logSlowQuery(data: any) {
    console.warn('SLOW QUERY DETECTED:', data);

    // Log to database for analysis
    await this.prisma.errorLog.create({
      data: {
        severity: 'warning',
        message: 'Slow query detected',
        context: data,
      },
    });
  }

  private recordQueryMetrics(data: any) {
    // Send to monitoring service (PostHog, DataDog, etc.)
    // posthog.capture('query_executed', data);
  }
}
```

**Acceptance Criteria:**

- [ ] Track query execution time
- [ ] Log queries >1s
- [ ] Send metrics to monitoring
- [ ] Create slow query alerts
- [ ] Add database indices for slow queries

---

### Task 5.3: Add Database Indices

**File:** `apps/api/prisma/schema.prisma`
**Effort:** 3 hours

**Add missing indices:**

```prisma
model Transaction {
  // ... existing fields

  @@index([accountId, date(sort: Desc)])      // For transaction history queries
  @@index([spaceId, categoryId])              // For budget analytics
  @@index([providerTransactionId])            // For deduplication
  @@index([pending])                          // For pending transaction queries
  @@index([createdAt(sort: Desc)])            // For recent transactions
}

model Account {
  // ... existing fields

  @@index([spaceId, isActive])                // For active account queries
  @@index([provider, providerAccountId])      // For provider lookups
  @@index([lastSyncedAt(sort: Desc)])         // For sync monitoring
}

model AssetValuation {
  // ... existing fields

  @@index([accountId, date(sort: Desc)])      // For valuation history (already exists)
  @@index([date(sort: Desc)])                 // For portfolio snapshots
}

model AuditLog {
  // ... existing fields

  @@index([userId, createdAt(sort: Desc)])    // For user audit trails
  @@index([action, createdAt(sort: Desc)])    // For action filtering
  @@index([severity, createdAt(sort: Desc)])  // For alert queries
}

model WebhookEvent {
  // ... existing fields

  @@index([provider, eventType])              // For webhook analytics
  @@index([processed])                        // For unprocessed webhooks
  @@index([createdAt(sort: Desc)])            // For recent webhooks
}
```

**Acceptance Criteria:**

- [ ] Analyze query patterns
- [ ] Add indices for common queries
- [ ] Run migration to add indices
- [ ] Test query performance improvement
- [ ] Monitor index usage in production

---

### Task 5.4: Implement Caching Strategy

**Effort:** 1 day

**Add Redis caching for expensive operations:**

```typescript
// apps/api/src/core/cache/cache.service.ts
import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

@Injectable()
export class CacheService {
  constructor(private redis: RedisService) {}

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', ttl);
  }

  async remember<T>(key: string, ttl: number, callback: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached) return cached;

    const value = await callback();
    await this.set(key, value, ttl);
    return value;
  }

  async invalidate(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

// Usage in services:
@Injectable()
export class BudgetsService {
  async getBudgetAnalytics(budgetId: string) {
    return this.cache.remember(
      `budget:${budgetId}:analytics`,
      300, // 5 minutes
      async () => {
        // Expensive calculation
        return this.calculateAnalytics(budgetId);
      }
    );
  }
}
```

**Cache Strategy:**

- User profile: 15 minutes
- Budget analytics: 5 minutes
- ESG scores: 1 hour (already implemented)
- Exchange rates: 24 hours
- Account balances: 5 minutes

**Acceptance Criteria:**

- [ ] Implement cache service
- [ ] Add caching to expensive operations
- [ ] Implement cache invalidation on updates
- [ ] Monitor cache hit/miss rates
- [ ] Document caching strategy

---

### Task 5.5: Add Health Checks

**File:** `apps/api/src/health/health.controller.ts`
**Effort:** 3 hours

**Implementation:**

```typescript
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { RedisHealthIndicator } from './redis-health.indicator';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: PrismaHealthIndicator,
    private redis: RedisHealthIndicator
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.pingCheck('redis'),
      () => this.checkDiskSpace(),
      () => this.checkMemory(),
    ]);
  }

  private async checkDiskSpace() {
    // Check available disk space
    const stats = await import('fs').then((fs) => fs.promises.statfs('/'));
    const available = stats.bavail * stats.bsize;
    const total = stats.blocks * stats.bsize;
    const usage = ((total - available) / total) * 100;

    return {
      disk: {
        status: usage < 90 ? 'up' : 'down',
        usage: `${usage.toFixed(2)}%`,
      },
    };
  }

  private async checkMemory() {
    const usage = process.memoryUsage();
    const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;

    return {
      memory: {
        status: heapUsedPercent < 90 ? 'up' : 'down',
        heapUsed: `${(usage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(usage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      },
    };
  }
}
```

**Acceptance Criteria:**

- [ ] Add database health check
- [ ] Add Redis health check
- [ ] Add disk space check
- [ ] Add memory check
- [ ] Expose /health endpoint
- [ ] Configure ALB health checks to use this endpoint

---

## Implementation Timeline

### Week 1-2: Critical Security Fixes

| Days    | Tasks                                            | Owner                |
| ------- | ------------------------------------------------ | -------------------- |
| Day 1-2 | Tasks 1.1-1.4 (JWT, logging, TOTP, backup codes) | Backend Dev          |
| Day 3-5 | Task 1.5 (AWS KMS integration)                   | Backend Dev + DevOps |
| Day 5   | Tasks 1.6-1.7 (Webhook audit, rate limiting)     | Backend Dev          |

**Deliverable:** All 7 critical security vulnerabilities fixed and tested

---

### Week 2-3: Test Coverage Expansion (API)

| Days    | Tasks                                   | Owner            |
| ------- | --------------------------------------- | ---------------- |
| Day 1-3 | Task 2.1 (Unit tests for core services) | Backend Dev      |
| Day 4-6 | Task 2.2 (Integration/E2E tests)        | Backend Dev + QA |
| Day 7   | Task 2.5 (Test infrastructure)          | DevOps           |

**Deliverable:** API test coverage at 70-80%

---

### Week 3-4: Provider Integration + Frontend Tests

| Days    | Tasks                               | Owner        |
| ------- | ----------------------------------- | ------------ |
| Day 1-2 | Task 3.1 (Plaid integration)        | Backend Dev  |
| Day 3   | Task 3.2 (Bitso completion)         | Backend Dev  |
| Day 4-5 | Task 3.3 (Blockchain tracking)      | Backend Dev  |
| Day 6-7 | Task 2.3 (Frontend component tests) | Frontend Dev |

**Deliverable:** All providers 90%+ complete, frontend coverage 60-70%

---

### Week 4-5: Type Safety + Mobile Tests

| Days    | Tasks                             | Owner          |
| ------- | --------------------------------- | -------------- |
| Day 1-2 | Task 4.1 (Eliminate `as any`)     | Full-stack Dev |
| Day 3   | Task 4.2 (Type annotations)       | Full-stack Dev |
| Day 4   | Task 4.3 (API response types)     | Full-stack Dev |
| Day 5-7 | Task 2.4 (Mobile + package tests) | Mobile Dev     |

**Deliverable:** Type safety >90%, mobile coverage 60%+

---

### Week 5-6: Performance & Reliability

| Days    | Tasks                             | Owner                |
| ------- | --------------------------------- | -------------------- |
| Day 1   | Task 5.1 (Connection pooling)     | Backend Dev + DevOps |
| Day 2   | Task 5.2 (Query monitoring)       | Backend Dev          |
| Day 3   | Task 5.3 (Database indices)       | Backend Dev          |
| Day 4-5 | Task 5.4 (Caching strategy)       | Backend Dev          |
| Day 6   | Task 5.5 (Health checks)          | DevOps               |
| Day 7   | Final testing and deployment prep | Full Team            |

**Deliverable:** Production-ready system with monitoring

---

## Success Criteria

### Security ✅

- [ ] All 7 critical vulnerabilities fixed
- [ ] AWS KMS integration in production
- [ ] Rate limiting on all auth endpoints
- [ ] No hardcoded secrets in codebase
- [ ] Webhook signatures verified for all providers
- [ ] Security audit passes

### Testing ✅

- [ ] API coverage: 80%+ (branches, functions, lines, statements)
- [ ] Web coverage: 70%+
- [ ] Mobile coverage: 60%+
- [ ] Package coverage: 80%+
- [ ] All E2E flows tested
- [ ] CI/CD enforces coverage thresholds

### Provider Integration ✅

- [ ] Plaid: 100% complete (accounts, transactions, webhooks)
- [ ] Belvo: 100% complete (already at 80%)
- [ ] Bitso: 90%+ complete (real-time sync)
- [ ] Blockchain: 90%+ complete (ETH, BTC, xPub)
- [ ] All webhook handlers tested
- [ ] Provider sync jobs running reliably

### Type Safety ✅

- [ ] `as any` count: <10 (from 82)
- [ ] `: any` count: <20 (from 133)
- [ ] All API responses typed
- [ ] ESLint enforces strict types
- [ ] No TypeScript errors in CI

### Performance ✅

- [ ] Database connection pooling configured
- [ ] Query performance monitoring active
- [ ] All slow queries optimized (<100ms p95)
- [ ] Caching implemented for expensive operations
- [ ] Health checks passing
- [ ] Page loads <1.5s p95

---

## Risk Assessment

### High Risk ⚠️

**Risk:** AWS KMS integration may have unexpected AWS configuration issues
**Mitigation:**

- Test in staging environment first
- Use LocalStack for local development
- Have rollback plan to existing encryption
- Implement gradual rollout

**Risk:** Test coverage expansion may reveal critical bugs
**Mitigation:**

- Fix bugs as they're discovered
- Prioritize security-critical bugs
- Add regression tests
- Don't block deployment on minor bugs

### Medium Risk ⚠️

**Risk:** Plaid integration changes may break existing functionality
**Mitigation:**

- Write comprehensive tests first
- Use feature flags for gradual rollout
- Test with Plaid sandbox thoroughly
- Have monitoring alerts

**Risk:** Database migration for indices may cause downtime
**Mitigation:**

- Create indices concurrently in PostgreSQL
- Run migrations during low-traffic periods
- Have rollback plan
- Test on staging first

### Low Risk ✅

**Risk:** Type safety improvements may require significant refactoring
**Mitigation:**

- Take incremental approach
- Fix high-impact files first
- Use automated tools where possible
- Allow some `any` usages if properly documented

---

## Post-Remediation Checklist

### Before Production Launch

- [ ] All Priority 1 tasks complete (security)
- [ ] All Priority 2 tasks complete (testing)
- [ ] All Priority 3 tasks complete (providers)
- [ ] Security audit passed
- [ ] Load testing completed
- [ ] Staging environment tested
- [ ] Documentation updated
- [ ] Monitoring configured
- [ ] Backup/restore tested
- [ ] Incident response plan ready

### Production Deployment

- [ ] Blue-green deployment strategy
- [ ] Database migration tested
- [ ] Feature flags configured
- [ ] Rollback plan documented
- [ ] On-call rotation assigned
- [ ] Status page ready
- [ ] Customer communication sent
- [ ] Post-launch monitoring active

### Post-Launch (Week 1)

- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Review security logs
- [ ] Verify provider sync reliability
- [ ] Check test coverage trends
- [ ] Review user feedback
- [ ] Address critical issues
- [ ] Conduct retrospective

---

## Resources Required

### Team

- 2x Backend Developers (full-time, 6 weeks)
- 1x Frontend Developer (full-time, 4 weeks)
- 1x Mobile Developer (full-time, 2 weeks)
- 1x DevOps Engineer (part-time, 3 weeks)
- 1x QA Engineer (part-time, 4 weeks)

### Infrastructure

- AWS account with KMS access
- Staging environment matching production
- LocalStack for local KMS testing
- PostHog or similar monitoring

### External Services

- Plaid sandbox account (already have)
- Belvo sandbox account (already have)
- Bitso test API access

### Budget Estimate

- Development time: 18-24 developer-weeks
- Infrastructure costs: ~$500/month (staging + testing)
- External services: Included in existing plans
- Total: Primarily internal development effort

---

## Appendix: Quick Reference

### Critical Commands

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:cov

# Run specific test suite
pnpm test apps/api/src/core/auth

# Lint all code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Type check
pnpm typecheck

# Database migration
pnpm db:migrate

# Start all services
pnpm dev
```

### Environment Variables Checklist

```bash
# Required in production:
JWT_SECRET=                 # 32+ character random string
JWT_REFRESH_SECRET=         # 32+ character random string
KMS_KEY_ID=                 # AWS KMS key ID
DATABASE_URL=               # PostgreSQL connection string
REDIS_URL=                  # Redis connection string
PLAID_CLIENT_ID=            # Plaid credentials
PLAID_SECRET=               # Plaid secret
PLAID_WEBHOOK_SECRET=       # Plaid webhook verification
BELVO_SECRET_KEY_ID=        # Belvo credentials
BELVO_SECRET_KEY_PASSWORD=  # Belvo password
BITSO_API_KEY=              # Bitso API key
BITSO_API_SECRET=           # Bitso API secret
BANXICO_TOKEN=              # Banxico FX rates API
AWS_REGION=                 # AWS region
AWS_ACCESS_KEY_ID=          # AWS credentials
AWS_SECRET_ACCESS_KEY=      # AWS secret
```

---

**Document Version:** 1.0
**Last Updated:** 2025-11-16
**Next Review:** After Week 3 completion
**Owner:** Engineering Team
