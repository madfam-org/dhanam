# Provider Orchestrator Module

> Multi-provider coordination with automatic failover, circuit breaker pattern, and ML-based provider selection.

## Purpose

The Provider Orchestrator is the central coordination layer for all financial data provider interactions. It ensures high availability and reliability by implementing:

- **Automatic Failover**: Seamlessly switches between providers when one fails
- **Circuit Breaker Pattern**: Protects the system from cascading failures
- **ML-Based Provider Selection**: Uses machine learning to choose the optimal provider
- **Rate Limiting**: Prevents provider API abuse and rate limit violations
- **Connection Logging**: Comprehensive audit trail of all provider interactions

## Key Entities

| Entity                        | Description                            |
| ----------------------------- | -------------------------------------- |
| `ProviderOrchestratorService` | Main orchestration service             |
| `CircuitBreakerService`       | Circuit breaker state management       |
| `RateLimiterService`          | API rate limit enforcement             |
| `IFinancialProvider`          | Interface all providers must implement |
| `ConnectionAttempt`           | Database entity logging all attempts   |
| `ProviderHealthStatus`        | Real-time provider health tracking     |

## Service Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Provider Orchestrator                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐    │
│  │ ML Provider │    │   Circuit    │    │   Rate Limiter  │    │
│  │  Selection  │    │   Breaker    │    │                 │    │
│  └──────┬──────┘    └──────┬───────┘    └───────┬─────────┘    │
│         │                  │                    │               │
│         └──────────────────┼────────────────────┘               │
│                            │                                     │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              executeWithFailover()                       │   │
│  │  • Try primary provider                                  │   │
│  │  • On failure, try backup providers                      │   │
│  │  • Record metrics and update circuit breaker             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                     │
│         ┌──────────────────┼──────────────────┐                 │
│         │                  │                  │                 │
│         ▼                  ▼                  ▼                 │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐             │
│  │   Plaid  │      │   Belvo  │      │    MX    │  ...        │
│  └──────────┘      └──────────┘      └──────────┘             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Operations

The orchestrator supports four main operations:

| Operation          | Description                               |
| ------------------ | ----------------------------------------- |
| `createLink`       | Initialize account linking session        |
| `exchangeToken`    | Exchange temporary token for access token |
| `getAccounts`      | Fetch accounts from linked institution    |
| `syncTransactions` | Sync transaction history                  |

## Failover Strategy

### Provider Priority by Region

**US Region:**

1. Plaid (primary)
2. MX (backup)
3. Finicity (backup)

**MX Region:**

1. Belvo (primary)
2. MX (backup)

### Failover Logic

```typescript
// Pseudocode for failover execution
for (const provider of providersToTry) {
  if (circuitBreaker.isOpen(provider)) continue;

  try {
    result = await provider.execute(operation, params);
    circuitBreaker.recordSuccess(provider);
    return result;
  } catch (error) {
    circuitBreaker.recordFailure(provider);
    if (!error.retryable) break;
  }
}
```

## Circuit Breaker

The circuit breaker has three states:

| State         | Description      | Behavior                          |
| ------------- | ---------------- | --------------------------------- |
| **CLOSED**    | Normal operation | All requests go through           |
| **OPEN**      | Provider failing | Requests fail fast, skip provider |
| **HALF_OPEN** | Testing recovery | Limited requests allowed          |

### Configuration

```typescript
{
  failureThreshold: 5,      // Failures before opening
  successThreshold: 2,      // Successes to close
  timeout: 60000,           // Time in OPEN state before HALF_OPEN
}
```

## Error Handling

Errors are classified by type and retryability:

| Error Type      | Retryable | Description                      |
| --------------- | --------- | -------------------------------- |
| `auth`          | No        | Authentication/credential issues |
| `rate_limit`    | Yes       | API rate limit exceeded          |
| `network`       | Yes       | Network timeout/connectivity     |
| `provider_down` | Yes       | Provider unavailable             |
| `validation`    | No        | Invalid request parameters       |

## Configuration

```typescript
// Environment variables
PLAID_CLIENT_ID = xxx;
PLAID_SECRET = xxx;
BELVO_SECRET_KEY_ID = xxx;
BELVO_SECRET_KEY_PASSWORD = xxx;
MX_CLIENT_ID = xxx;
MX_API_KEY = xxx;
```

## Monitoring

### Metrics Tracked

- Provider success/failure rates
- Response times by provider
- Failover frequency
- Circuit breaker state changes

### Health Check Endpoint

```
GET /admin/stats
```

Returns provider health status including:

- Current circuit breaker state
- Success rate (24h rolling)
- Average response time
- Last error (if any)

## Usage Example

```typescript
// Using the orchestrator
const result = await orchestrator.executeWithFailover(
  'syncTransactions',
  {
    spaceId: 'space_123',
    accountId: 'acc_456',
    institutionId: 'ins_chase',
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-01-31'),
  },
  Provider.plaid, // Optional preferred provider
  'US' // Region
);

if (result.success) {
  console.log(`Synced ${result.data.transactions.length} transactions`);
  console.log(`Provider used: ${result.provider}`);
  console.log(`Failover used: ${result.failoverUsed}`);
} else {
  console.error(`Sync failed: ${result.error.message}`);
}
```

## Related Modules

| Module                                         | Relationship                           |
| ---------------------------------------------- | -------------------------------------- |
| [`providers/belvo`](../belvo/README.md)        | Belvo provider implementation          |
| [`providers/plaid`](../plaid/README.md)        | Plaid provider implementation          |
| [`providers/bitso`](../bitso/README.md)        | Bitso provider implementation          |
| [`ml`](../../ml/README.md)                     | ML-based provider selection            |
| [`accounts`](../../accounts/README.md)         | Uses orchestrator for account sync     |
| [`transactions`](../../transactions/README.md) | Uses orchestrator for transaction sync |

## Testing

```bash
# Run orchestrator tests
pnpm test -- providers/orchestrator

# Test with coverage
pnpm test:coverage -- providers/orchestrator
```

---

**Module**: `providers/orchestrator`
**Last Updated**: January 2025
