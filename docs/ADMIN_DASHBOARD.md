# Admin Dashboard Guide

## Overview

The Dhanam Admin Dashboard provides comprehensive tools for system administrators to manage users, monitor system health, analyze user behavior, and control feature releases.

## Access Requirements

- **Role**: User must be a platform admin (`User.isAdmin=true`) or present a
  verified Janua `is_admin` claim. Space `owner` / `admin` roles are scoped to
  spaces and do not grant platform-admin access.
- **Production URL**: `https://admin.dhan.am/dashboard`
- **Development URL**: `http://localhost:3400/dashboard` (standalone admin app)
- **Authentication**: Cross-subdomain cookie (`auth-storage` with `Domain=.dhan.am`) — unauthenticated users redirected to `app.dhan.am/login`

## Dashboard Sections

### 1. System Overview

The main dashboard displays real-time system statistics:

#### User Metrics

- **Total Users**: All registered users
- **Active Users**: Users who logged in within last 30 days
- **New Users**: Registrations in the last 7 days
- **Verified Users**: Users with verified email addresses
- **2FA Enabled**: Users with TOTP authentication active

#### System Health

- **Database Status**: PostgreSQL connection health
- **Redis Status**: Cache server availability
- **Queue Status**: Background job processing metrics
- **API Response Time**: Average response time (last 5 min)
- **Error Rate**: Failed requests percentage

#### Financial Overview

- **Total Spaces**: Personal + Business spaces
- **Connected Accounts**: By provider (Plaid, Belvo, Bitso, etc.)
- **Transaction Volume**: Last 30 days
- **Active Budgets**: Currently tracked budgets

### 2. User Management

Search and view user information (read-only):

#### Search Filters

- **Email**: Partial match search
- **Name**: Full or partial name search
- **Status**: Active/Inactive
- **Email Verified**: Yes/No
- **TOTP Enabled**: Yes/No
- **Onboarding**: Completed/In Progress
- **Date Range**: Registration date filter

#### User Details View

- Basic Information (name, email, locale, timezone)
- Account Status (active, verified, 2FA)
- Space Memberships (spaces and roles)
- Connected Providers
- Recent Activity
- Audit Trail (last 50 actions)

Sensitive user actions are intentionally narrow and audited: deactivate a user,
reset TOTP, force logout sessions, and run GDPR export/delete workflows.

### 3. Audit Logs

Comprehensive security audit trail:

#### Log Filters

- **User**: Filter by user email/ID
- **Action**: Specific action types
- **Resource**: Entity type affected
- **Severity**: low/medium/high
- **Date Range**: Custom date selection

#### Log Entry Details

- Timestamp
- User who performed action
- Action type
- Affected resource
- IP address (if available)
- User agent
- Detailed metadata

#### Common Audit Events

- User login/logout
- Password changes
- 2FA enable/disable
- Space creation/deletion
- Provider connections
- Budget modifications
- Admin dashboard access
- Feature flag changes

### 4. Analytics

#### Onboarding Funnel

Visual funnel showing conversion rates for each onboarding step:

1. **Welcome** → Email Verification
2. **Email Verification** → Preferences
3. **Preferences** → Space Setup
4. **Space Setup** → Connect Accounts
5. **Connect Accounts** → First Budget
6. **First Budget** → Feature Tour
7. **Feature Tour** → Completion

Metrics shown:

- Conversion rate per step
- Average time per step
- Abandonment points
- Completion rate by time period

#### Provider Adoption

- Percentage of users with connected accounts
- Breakdown by provider
- Average accounts per user
- Connection success rates

### 5. Feature Flags

Manage feature rollouts and A/B tests:

#### Flag Properties

- **Key**: Unique identifier
- **Name**: Human-readable name
- **Description**: What the feature does
- **Enabled**: Global on/off switch
- **Rollout Percentage**: 0-100% of users
- **Target Users**: Specific user IDs
- **Metadata**: Additional configuration

#### Available Flags (Default)

- `esg_scoring`: ESG features visibility
- `mobile_biometrics`: Mobile biometric auth
- `advanced_budgeting`: Advanced budget features
- `crypto_portfolios`: Crypto portfolio tracking
- `ai_categorization`: AI-powered categorization
- `real_time_sync`: Real-time account sync
- `export_reports`: Report generation
- `multi_currency`: Multi-currency support

#### Flag Management

- Toggle features on/off instantly
- Gradual rollout with percentage control
- User-specific targeting for beta testing
- Audit trail for all changes

### 6. Queue Management

The Queues page shows live BullMQ state from `QueueService`, not audit-log
proxies:

- **Status**: `error` when retained failed jobs exist, `active` when jobs are
  waiting/active/delayed, otherwise `idle`
- **Recent Jobs**: retained completed jobs plus live waiting/active/delayed jobs
- **Failed**: retained BullMQ failed jobs

Available actions:

- **Retry Failed**: calls `POST /v1/admin/queues/:name/retry-failed` and
  returns the actual retried job count.
- **Clear Failed**: calls `POST /v1/admin/queues/:name/clear-failed` with
  `{ "confirm": true }` and removes only retained failed jobs.
- Whole-queue clear remains available through `POST /v1/admin/queues/:name/clear`
  for break-glass cleanup. It removes waiting, active, completed, failed, and
  delayed jobs, so prefer inspect, retry, then failed-job-only cleanup.

Production note: the failed-job inspection and failed-job-only clear path is
live and auth-gated. Production queue health is currently green with
`failedJobs: 0`. Use these actions for future incidents when an admin token is
available; direct BullMQ access is break-glass only.

### 7. MADFAM POS

The POS page creates admin-only checkout links for existing Dhanam users. It is
the first operator-facing commercial control surface, not the final full POS.

Current support:

- user, product, plan, country, organization id, and optional return URLs;
- catalog-backed checkout through the billing lifecycle;
- high-severity audit event `admin.billing_pos_checkout_created`;
- returned checkout URL, selected provider, and checkout session id;
- Stripe checkout status lookup with recent billing event context and medium
  severity audit event `admin.billing_pos_status_viewed`.

Remaining POS work is tracked in
[Commercial Stability Roadmap](COMMERCIAL_STABILITY_ROADMAP.md): one-time
charges, refunds, provider-complete payment/refund timelines,
settlement/reconciliation, CFDI proof, and route override policy.

### 8. Webhook DLQ

The Webhook DLQ page exposes the product-webhook dead-letter queue for admin
operators. It is the routine recovery path when Dhanam cannot deliver a signed
`payment.*` envelope to a MADFAM consumer such as Karafiel or Tezca.

Current support:

- unresolved delivery listing with consumer, event id, event type, attempt
  count, status, retry time, consumer URL, and last error;
- consumer, date, and resolved-row filters;
- manual replay through `POST /v1/billing/dlq/:id/replay`;
- manual closeout through `POST /v1/billing/dlq/:id/resolve` with an operator
  reason for out-of-band remediation.

The DLQ page reduces direct database/provider inspection during revenue
incidents. Product webhook retries should use this page or the admin API before
any break-glass access.

## Admin Actions Audit Trail

All admin actions are logged with high severity:

```json
{
  "action": "admin_user_viewed",
  "severity": "medium",
  "entityType": "user",
  "entityId": "user-123",
  "adminId": "admin-456",
  "metadata": {
    "viewedSections": ["details", "spaces", "audit_logs"]
  }
}
```

## Best Practices

### Security

1. **Principle of Least Privilege**: Admin actions are narrow and role-gated
2. **Audit Everything**: All admin actions are logged
3. **Session Security**: Admin sessions expire after 1 hour of inactivity
4. **Two-Factor**: Admins should have 2FA enabled

### Performance

1. **Caching**: System stats are cached for 5 minutes
2. **Pagination**: User lists and logs are paginated (default: 20 items)
3. **Lazy Loading**: User details are fetched on-demand
4. **Background Jobs**: Heavy analytics are processed asynchronously

### Feature Flag Strategy

1. **Start Small**: Begin with 1-5% rollout
2. **Monitor Metrics**: Watch error rates during rollout
3. **Target Beta Users**: Use specific user targeting for testing
4. **Document Changes**: Update flag descriptions
5. **Clean Up**: Remove flags after full rollout

## Troubleshooting

### Common Issues

#### "Access Denied" Error

- Verify user is a platform admin:
  `SELECT is_admin FROM users WHERE id = ?`
- Check JWT token hasn't expired
- Confirm Janua tokens include `is_admin=true` when using Janua-admin access

#### Statistics Not Updating

- Check Redis connection through Enclii/admin health first
- Clear only targeted cache keys through the audited admin cache endpoint
- Verify background jobs are running

#### Feature Flags Not Working

- Ensure Redis is running
- Check flag key matches exactly
- Verify user ID format in targets
- Review audit logs for recent changes

### Debug Mode

Enable debug logging for admin operations:

```typescript
// In admin.service.ts
this.logger.setLogLevel('debug');
```

### Support Queries

```sql
-- Find all admin users
SELECT DISTINCT u.*
FROM users u
JOIN user_spaces us ON u.id = us.user_id
WHERE us.role IN ('admin', 'owner');

-- Recent admin actions
SELECT * FROM audit_logs
WHERE severity = 'high'
AND action LIKE 'admin_%'
ORDER BY created_at DESC
LIMIT 50;

-- Feature flag access logs
SELECT * FROM audit_logs
WHERE entity_type = 'feature_flag'
ORDER BY created_at DESC;
```

## API Reference

### Endpoints

```
GET  /v1/admin/stats
GET  /v1/admin/users?page=1&limit=20&search=john
GET  /v1/admin/users/:id
GET  /v1/admin/audit-logs?page=1&severity=high
GET  /v1/admin/analytics/onboarding-funnel
GET  /v1/admin/feature-flags
POST /v1/admin/feature-flags/:key
GET  /v1/admin/queues
GET  /v1/admin/queues/:name/failed?limit=25
POST /v1/admin/queues/:name/retry-failed
POST /v1/admin/queues/:name/clear-failed
POST /v1/admin/queues/:name/clear
POST /v1/admin/billing/pos/checkout
POST /v1/admin/billing/pos/status
```

### Response Formats

#### System Stats

```json
{
  "users": {
    "total": 1250,
    "active": 980,
    "new": 45
  },
  "system": {
    "database": "healthy",
    "redis": "healthy",
    "queues": {
      "default": { "active": 5, "waiting": 12 }
    }
  }
}
```

#### Feature Flag Update

```json
{
  "key": "esg_scoring",
  "enabled": true,
  "rolloutPercentage": 25,
  "targetUsers": ["user-123", "user-456"]
}
```

#### Queue Stats

```json
{
  "queues": [
    {
      "name": "sync-transactions",
      "status": "error",
      "recentJobs": 350,
      "failedJobs": 50
    }
  ]
}
```

---

For technical implementation details, see:

- [Admin Module Code](../apps/api/src/modules/admin/)
- [Standalone Admin App](../apps/admin/) — production admin at admin.dhan.am
- Web-embedded admin (dev fallback): `apps/web/src/app/(admin)/` — redirects to standalone in production
- [Infrastructure Guide](./INFRASTRUCTURE.md)
