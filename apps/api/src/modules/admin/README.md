# Admin Module

This module provides administrative functionality for the Dhanam Ledger API, including user management, system statistics, audit logs, and feature flags.

## Features

### User Management

- Search and list users with advanced filtering
- View detailed user information (read-only)
- Filter by status, verification, onboarding completion
- Sort by various fields with pagination

### System Statistics

- Real-time system health monitoring
- User metrics (total, active, new)
- Space and account statistics
- Transaction and budget counts
- Provider connection breakdown
- Database and Redis health checks

### Audit Logs

- Search and filter audit logs
- Filter by user, action, resource, severity
- Date range filtering
- Full audit trail visibility

### Onboarding Analytics

- Funnel conversion rates
- Step-by-step breakdown
- Abandonment rate analysis
- Time-based metrics
- Provider adoption tracking

### Feature Flags

- Runtime feature toggle management
- Percentage-based rollouts
- User-specific feature access
- Metadata support for additional configuration

## Authorization

All admin endpoints require:

1. Valid JWT authentication (`JwtAuthGuard`)
2. Admin privileges (`AdminGuard`)

Admin privileges are granted only to platform admins:

- Local Dhanam users with `User.isAdmin=true`
- Janua-authenticated users with a verified `is_admin` claim

Space-level `owner` and `admin` roles are intentionally scoped to user spaces
and do not grant access to platform-admin endpoints.

## API Endpoints

### Users

- `GET /admin/users` - Search and list users
- `GET /admin/users/:userId` - Get user details

### System

- `GET /admin/stats` - Get system statistics

### Audit

- `GET /admin/audit-logs` - Search audit logs

### Analytics

- `GET /admin/analytics/onboarding-funnel` - Get onboarding funnel metrics

### Feature Flags

- `GET /admin/feature-flags` - List all feature flags
- `GET /admin/feature-flags/:key` - Get specific feature flag
- `POST /admin/feature-flags/:key` - Update feature flag

## Security Considerations

1. All admin actions are logged to the audit trail
2. User detail access is tracked with medium severity
3. Feature flag changes are tracked with high severity
4. No write operations on user data (read-only access)
5. Sensitive data (passwords, tokens) are never exposed

## Caching

- System statistics are cached for 5 minutes
- Feature flags are stored in Redis
- Cache invalidation happens on updates

## Future Enhancements

1. User impersonation (with strict audit logging)
2. Bulk user operations
3. Advanced analytics dashboards
4. A/B testing framework
5. System configuration management
6. Automated alerts for anomalies
