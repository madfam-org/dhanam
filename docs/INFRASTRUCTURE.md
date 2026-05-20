# Dhanam Infrastructure & Testing Guide

Last updated: 2026-05-19

Current production infrastructure is Enclii-managed bare-metal Kubernetes with
Cloudflare Tunnel ingress. For deploy/runbook truth, read
[DEPLOYMENT.md](DEPLOYMENT.md) and
[STABILITY_AUDIT_2026-05-19.md](STABILITY_AUDIT_2026-05-19.md) first.

## Overview

This document outlines the critical infrastructure components, testing strategies, and admin dashboard features implemented in the Dhanam Ledger project.

## Table of Contents

1. [Database Schema Updates](#database-schema-updates)
2. [Testing Infrastructure](#testing-infrastructure)
3. [Admin Dashboard](#admin-dashboard)
4. [CI/CD Pipeline](#cicd-pipeline)
5. [Monitoring & Observability](#monitoring--observability)
6. [Security Considerations](#security-considerations)

## Database Schema Updates

### UserPreferences Model

A comprehensive preferences system has been added to store user-specific settings:

```prisma
model UserPreferences {
  id                    String        @id @default(uuid())
  userId                String        @unique @map("user_id")

  // Notification preferences
  emailNotifications    Boolean       @default(true)
  transactionAlerts     Boolean       @default(true)
  budgetAlerts          Boolean       @default(true)
  weeklyReports         Boolean       @default(true)
  monthlyReports        Boolean       @default(true)

  // Privacy preferences
  dataSharing           Boolean       @default(false)
  analyticsTracking     Boolean       @default(true)

  // Display preferences
  dashboardLayout       String        @default("standard")
  themeMode             String        @default("light")

  // Financial preferences
  defaultCurrency       Currency      @default(MXN)
  autoCategorizeTxns    Boolean       @default(true)

  // ESG preferences
  esgScoreVisibility    Boolean       @default(true)
  sustainabilityAlerts  Boolean       @default(false)
}
```

### Migration Commands

```bash
# Apply schema changes
pnpm db:push

# Generate Prisma client
pnpm db:generate

# Run migrations in production
pnpm db:migrate:deploy
```

## Testing Infrastructure

### Test Structure

```
apps/api/
├── src/
│   └── modules/
│       ├── preferences/
│       │   └── preferences.service.spec.ts
│       ├── onboarding/
│       │   └── onboarding.service.spec.ts
│       └── admin/
│           └── admin.service.spec.ts
└── test/
    └── e2e/
        ├── onboarding-flow.e2e-spec.ts
        ├── preferences-management.e2e-spec.ts
        ├── helpers/
        │   └── test.helper.ts
        └── fixtures/
            ├── onboarding.fixtures.ts
            └── preferences.fixtures.ts
```

### Running Tests

#### Unit Tests

```bash
# Run all unit tests
pnpm test

# Run with coverage
pnpm --filter @dhanam/api test:cov

# Run in watch mode
pnpm test:watch

# Run specific test file
pnpm test preferences.service.spec.ts
```

#### E2E Tests

```bash
# Start infrastructure first
pnpm dev:infra

# Run all E2E tests
pnpm test:e2e

# Run specific E2E suite
pnpm test:e2e:onboarding
pnpm test:e2e:preferences

# Run with coverage
pnpm test:e2e:cov
```

#### Test Runner Script

```bash
# Run all tests with proper setup
./scripts/test-runner.sh

# Run only unit tests
./scripts/test-runner.sh --unit

# Run with coverage report
./scripts/test-runner.sh --coverage

# Run in watch mode
./scripts/test-runner.sh --unit --watch
```

### Test Coverage Requirements

- Unit Tests: 80% minimum coverage
- E2E Tests: Critical user flows covered
- Integration Tests: Provider integrations tested

## Admin Dashboard

### Features

1. **System Overview**
   - User statistics (total, active, new)
   - Space and account counts
   - Transaction insights
   - Provider connection breakdown
   - System health monitoring

2. **User Management**
   - Advanced search with filters
   - User details view (read-only)
   - Space memberships
   - Activity summaries
   - Audit trail per user

3. **Audit Logs**
   - Comprehensive security audit trail
   - Filter by severity, user, action, resource
   - Date range queries
   - Export capabilities

4. **Analytics**
   - Onboarding funnel visualization
   - Conversion metrics
   - Step-by-step analysis
   - Provider adoption rates
   - Time-based comparisons

5. **Feature Flags**
   - Runtime feature toggles
   - Percentage rollouts
   - User-specific targeting
   - A/B testing support

### Accessing Admin Dashboard

```typescript
// Admin routes are protected by role-based guards
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  // Only users with 'admin' or 'owner' roles can access
}
```

Navigate to `http://localhost:3400/dashboard` locally or
`https://admin.dhan.am/dashboard` in production (requires admin/owner role).

### Admin API Endpoints

```
GET  /api/admin/stats                 # System statistics
GET  /api/admin/users                 # User search
GET  /api/admin/users/:id             # User details
GET  /api/admin/audit-logs            # Audit log search
GET  /api/admin/analytics/onboarding  # Onboarding funnel
GET  /api/admin/feature-flags         # List feature flags
POST /api/admin/feature-flags/:key    # Update feature flag
```

## CI/CD Pipeline

### GitHub Actions Workflow

The CI pipeline runs on every push and PR to main/develop branches:

1. **Lint** - Code style and formatting checks
2. **Type Check** - TypeScript compilation
3. **Unit Tests** - Fast unit test execution
4. **E2E Tests** - Full integration testing with real services
5. **Build** - Production build verification
6. **Security Scan** - Vulnerability scanning with Trivy

### Environment Setup

```yaml
# Required GitHub Secrets
TURBO_TOKEN         # Turborepo remote caching
TURBO_TEAM          # Turborepo team ID
CODECOV_TOKEN       # Code coverage reporting
```

### Local CI Validation

```bash
# Run the same checks as CI locally
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Monitoring & Observability

### Logging

All admin actions are logged with appropriate severity levels:

```typescript
// High severity - security-critical actions
await this.auditService.log({
  action: 'feature_flag_updated',
  severity: 'high',
  entityType: 'feature_flag',
  entityId: key,
  userId: adminUserId,
  metadata: { oldValue, newValue },
});
```

### Metrics

Key metrics tracked:

- API response times
- Database query performance
- Queue processing times
- Error rates by endpoint
- User activity patterns

### Health Checks

```bash
# Check system health
curl http://localhost:4010/health

# Detailed health with dependencies
curl http://localhost:4010/health/ready
```

## Security Considerations

### Authentication & Authorization

1. **JWT-based Authentication**
   - Short-lived access tokens (15m)
   - Rotating refresh tokens (30d)
   - Secure token storage

2. **Role-Based Access Control**
   - User roles: user, admin, owner
   - Space-specific permissions
   - Admin operations require elevated privileges

3. **Audit Trail**
   - All admin actions logged
   - User data access tracked
   - Feature flag changes recorded
   - High-severity events for security operations

### Data Protection

1. **Encryption**
   - Provider tokens encrypted at rest
   - Sensitive data masked in logs
   - HTTPS enforced in production

2. **Input Validation**
   - DTOs with class-validator
   - SQL injection prevention via Prisma
   - XSS protection in frontend

3. **Rate Limiting**
   - API endpoint throttling
   - Progressive delays on auth failures
   - IP-based blocking for abuse

### Security Headers

```typescript
// Helmet configuration for production
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  })
);
```

## Deployment Considerations

### Environment Variables

Required for production:

```env
# Database
DATABASE_URL=postgresql://...

# Redis
REDIS_URL=redis://...

# Security
JWT_SECRET=<strong-secret>
JWT_REFRESH_SECRET=<strong-secret>
ENCRYPTION_KEY=<32-char-key>

# Providers
PLAID_CLIENT_ID=...
BELVO_SECRET_KEY_ID=...
BITSO_API_KEY=...

# DeFi/Web3
ZAPPER_API_KEY=...

# Real Estate
ZILLOW_API_KEY=...

# Email
SMTP_HOST=...
SMTP_USER=...
SMTP_PASS=...

# Analytics
POSTHOG_API_KEY=...

# Cloudflare R2 Storage
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=dhanam-documents
R2_PUBLIC_URL=https://docs.dhanam.io  # Optional: for public asset URLs
```

## Cloudflare R2 Storage

Document storage for manual asset attachments uses Cloudflare R2.

### R2 Configuration

```typescript
// apps/api/src/modules/storage/r2.config.ts
import { S3Client } from '@aws-sdk/client-s3';

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});
```

### Bucket Structure

```
dhanam-documents/
├── spaces/
│   └── {spaceId}/
│       └── assets/
│           └── {assetId}/
│               ├── appraisal-2025.pdf
│               ├── deed.pdf
│               └── photos/
│                   └── front-view.jpg
```

### CORS Configuration

```json
[
  {
    "AllowedOrigins": ["https://app.dhan.am", "https://admin.dhan.am"],
    "AllowedMethods": ["GET", "PUT", "DELETE"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

### Lifecycle Rules

```json
{
  "Rules": [
    {
      "ID": "DeleteOldTempUploads",
      "Status": "Enabled",
      "Filter": { "Prefix": "temp/" },
      "Expiration": { "Days": 1 }
    }
  ]
}
```

### Production Checklist

- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Redis instance running
- [ ] SSL certificates installed
- [ ] Monitoring configured
- [ ] Backup strategy implemented
- [ ] Security headers enabled
- [ ] Rate limiting configured
- [ ] Error tracking setup
- [ ] Admin users created

## Troubleshooting

### Common Issues

1. **Tests failing locally**

   ```bash
   # Ensure services are running
   pnpm dev:infra

   # Reset test database
   pnpm db:reset
   ```

2. **Admin dashboard access denied**
   - Verify user has admin/owner role
   - Check JWT token expiration
   - Confirm space membership

3. **E2E tests timeout**
   - Increase Jest timeout in jest-e2e.json
   - Check database connection
   - Verify Redis is running

### Debug Commands

```bash
# Check database schema
pnpm db:studio

# View Redis contents
redis-cli
> KEYS *

# Check API logs
pnpm dev:api

# Inspect build output
pnpm build --verbose
```

---

For more information, see:

- [API Documentation](./API.md)
- [Development Guide](./DEVELOPMENT.md)
- [Security Policy](./SECURITY.md)
