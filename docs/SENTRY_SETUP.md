# Sentry Error Monitoring Setup

## Overview

Sentry provides real-time error tracking and performance monitoring for the Dhanam Ledger application.

## Configuration

### 1. Create Sentry Project

1. Go to [sentry.io](https://sentry.io)
2. Create a new project (select Node.js)
3. Copy your DSN

### 2. Environment Variables

```bash
# Required
SENTRY_DSN=https://your_key@sentry.io/project_id

# Optional
SENTRY_RELEASE=dhanam-api@0.1.0  # Should match app version
SENTRY_ENVIRONMENT=production     # development, staging, or production
```

### 3. Features Enabled

**Error Tracking:**

- All 5xx errors automatically captured
- Full stack traces
- Request context (URL, method, headers)
- User context (ID, email) when authenticated

**Performance Monitoring:**

- 10% of transactions sampled in production
- 100% in development
- HTTP request traces
- Database query traces (via Prisma integration)

**Profiling:**

- CPU profiling for performance bottlenecks
- 10% sample rate in production

### 4. Error Filtering

The following errors are **not** sent to Sentry:

- Validation errors (user input mistakes)
- 401 Unauthorized (expected auth failures)
- 404 Not Found (expected)
- All errors in test environment

### 5. Sensitive Data Protection

Automatically removes:

- `authorization` headers
- `cookie` headers
- `x-api-key` headers
- `token` query parameters
- `password` query parameters

## Usage in Code

```typescript
import { SentryService } from '@core/monitoring/sentry.service';

@Injectable()
export class MyService {
  constructor(private readonly sentryService: SentryService) {}

  async riskyOperation() {
    try {
      // Your code
    } catch (error) {
      // Capture with context
      this.sentryService.captureException(error, {
        userId: user.id,
        operation: 'riskyOperation',
        metadata: {
          /* custom data */
        },
      });
      throw error;
    }
  }

  async trackPerformance() {
    const transaction = this.sentryService.startTransaction('expensiveOperation', 'task');

    try {
      // Your expensive operation
    } finally {
      transaction?.finish();
    }
  }
}
```

## Monitoring Best Practices

### 1. Set Up Alerts

Configure Sentry alerts for:

- Any error affecting >10 users
- Error rate >1% in last hour
- Response time >2s p95
- Database errors
- Provider integration failures

### 2. Regular Review

- Check Sentry dashboard daily in production
- Review error trends weekly
- Address errors by priority:
  - **Critical**: Affecting payments, account balance
  - **High**: Breaking core features
  - **Medium**: Degraded UX
  - **Low**: Edge cases

### 3. Error Budgets

Maintain error rates below:

- Financial operations: 0.01% (1 in 10,000)
- Authentication: 0.1% (1 in 1,000)
- General API: 1% (1 in 100)

## Release Tracking

Tag releases to track when errors were introduced:

```bash
# Set in CI/CD
export SENTRY_RELEASE="dhanam-api@$(git rev-parse --short HEAD)"
```

## Integration with CI/CD

```yaml
# .github/workflows/deploy.yml
- name: Create Sentry Release
  run: |
    curl https://sentry.io/api/0/organizations/$ORG/releases/ \
      -X POST \
      -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
      -d '{
        "version": "${{ github.sha }}",
        "projects": ["dhanam-api"]
      }'
```

## Troubleshooting

**Sentry not capturing errors:**

1. Check `SENTRY_DSN` is set
2. Check network connectivity to sentry.io
3. Verify error is 5xx (4xx are not captured by default)
4. Check beforeSend filter isn't excluding your error

**Too many errors:**

1. Review beforeSend filter
2. Increase sample rate if needed
3. Set up proper error boundaries in frontend

**Performance impact:**

1. Sentry adds <5ms latency
2. Reduce tracesSampleRate if needed
3. Disable profiling in high-traffic scenarios

## Cost Optimization

- Use error grouping to avoid duplicate charges
- Set appropriate sample rates (10% in prod)
- Archive resolved issues to free quota
- Use quotas and rate limits in Sentry dashboard

## Resources

- [Sentry Node.js Docs](https://docs.sentry.io/platforms/node/)
- [Sentry NestJS Integration](https://docs.sentry.io/platforms/node/guides/nestjs/)
- [Performance Monitoring](https://docs.sentry.io/product/performance/)
