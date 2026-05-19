# Connection Health Provider

> Provider connection health monitoring and status tracking system.

## Purpose

The Connection Health module provides comprehensive monitoring of all financial provider connections. It tracks sync status, error rates, circuit breaker states, and generates actionable health scores to help users maintain healthy data connections.

## Supported Regions/Institutions

This module monitors all configured providers:

- Belvo (Mexico)
- Plaid (US)
- MX (US/Canada)
- Finicity (US)
- Bitso (Crypto)
- Blockchain (On-chain)
- DeFi (Protocols)

## Authentication Flow

Not applicable - this is an internal monitoring service that tracks health of existing authenticated connections.

## API Operations

### Endpoints

| Method | Endpoint                                                       | Description               |
| ------ | -------------------------------------------------------------- | ------------------------- |
| `GET`  | `/providers/connection-health/spaces/:spaceId`                 | Full health dashboard     |
| `GET`  | `/providers/connection-health/spaces/:spaceId/needs-attention` | Accounts requiring action |
| `GET`  | `/providers/connection-health/accounts/:accountId`             | Single account health     |
| `GET`  | `/providers/connection-health/spaces/:spaceId/summary`         | Quick summary for widgets |

### Service Methods

- `getConnectionHealth(spaceId)` - Full health summary for space
- `getAccountHealth(accountId)` - Health details for single account
- `recordConnectionAttempt(...)` - Record sync attempt for tracking
- `getAccountsNeedingAttention(spaceId)` - Filter problem accounts
- `getAccountsRequiringReauth(spaceId)` - Get accounts needing re-authentication

### Health Status Types

| Status            | Description                        | Health Score |
| ----------------- | ---------------------------------- | ------------ |
| `healthy`         | Connection working normally        | 80-100       |
| `degraded`        | Intermittent issues or stale data  | 40-79        |
| `error`           | Sync failures, needs investigation | 20-39        |
| `disconnected`    | Connection lost                    | 0-19         |
| `requires_reauth` | Authorization expired              | 0-19         |

### Health Score Calculation

The health score (0-100) is calculated based on:

1. **Connection Status** (base score)
   - `error`: 20
   - `disconnected`: 0
   - `requires_reauth`: 10
   - `healthy`: 100

2. **Consecutive Failures** (reduction)
   - 5+ failures: -70 points
   - 3-4 failures: -40 points
   - 1-2 failures: -20 points

3. **Last Sync Age** (reduction)
   - 48+ hours: -50 points
   - 24-48 hours: -30 points

4. **Provider Health** (reduction)
   - Circuit breaker open: -60 points

## Error Handling

### Connection Attempt Tracking

Each sync attempt is recorded with:

```typescript
{
  spaceId: string;
  accountId: string | null;
  provider: Provider;
  status: 'success' | 'failure';
  institutionId?: string;
  attemptType?: string;
  errorCode?: string;
  errorMessage?: string;
  responseTimeMs?: number;
  failoverUsed?: boolean;
  failoverProvider?: Provider;
}
```

### Circuit Breaker Integration

The service integrates with `CircuitBreakerService` to:

- Record successful requests with response times
- Record failures with error messages
- Query circuit state (closed/open/half-open)
- Adjust health scores based on provider-level issues

### Action Required Messages

| Condition        | Action Message                                          |
| ---------------- | ------------------------------------------------------- |
| Connection error | "Connection error. Try refreshing or reconnecting."     |
| Disconnected     | "Account disconnected. Please reconnect."               |
| Auth expired     | "Authorization expired. Please reconnect your account." |
| 5+ failures      | "{N} failed sync attempts in the last 24 hours."        |
| 48h stale        | "Account has not synced in over 48 hours."              |
| Provider issues  | "{Provider} provider is experiencing issues."           |

## Configuration

### Response Schema

**Full Health Dashboard**:

```typescript
interface ConnectionHealthSummary {
  totalConnections: number;
  healthyCount: number;
  degradedCount: number;
  errorCount: number;
  requiresReauthCount: number;
  overallHealthScore: number;
  accounts: AccountConnectionHealth[];
  providerHealth: ProviderHealth[];
}
```

**Account Health**:

```typescript
interface AccountConnectionHealth {
  accountId: string;
  accountName: string;
  provider: Provider;
  status: 'healthy' | 'degraded' | 'error' | 'disconnected' | 'requires_reauth';
  lastSyncAt: Date | null;
  lastErrorAt: Date | null;
  errorMessage: string | null;
  consecutiveFails: number;
  healthScore: number;
  actionRequired: string | null;
}
```

**Quick Summary** (for dashboard widgets):

```typescript
{
  statusBadge: 'green' | 'yellow' | 'red';
  statusText: string;
  healthScore: number;
  totalConnections: number;
  healthyCount: number;
  issueCount: number;
  providerHealth?: ProviderHealth[];
}
```

### Time Windows

- **Failure tracking**: Last 24 hours
- **Stale threshold**: 24-48 hours
- **Critical stale**: 48+ hours

## Related Modules

- `providers/orchestrator/circuit-breaker.service` - Circuit breaker state management
- `@core/prisma/prisma.service` - Connection attempt storage
- `modules/spaces/guards/space.guard` - Space access authorization

---

**Provider**: `providers/connection-health`
**Last Updated**: January 2025
