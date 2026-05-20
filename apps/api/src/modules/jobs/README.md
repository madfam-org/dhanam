# Jobs Module

> Background job processing with BullMQ for scheduled tasks, transaction categorization, portfolio sync, and valuation snapshots.

## Purpose

The Jobs module orchestrates all background processing for the Dhanam platform:

- **Scheduled cron jobs** for automated maintenance tasks
- **Queue management** via BullMQ with Redis backend
- **Provider synchronization** for crypto portfolios and blockchain wallets
- **Transaction categorization** with rules engine integration
- **Daily valuation snapshots** for wealth tracking trends

## Key Entities

### Queue Types

| Queue Name                | Purpose                       | Default Concurrency |
| ------------------------- | ----------------------------- | ------------------- |
| `sync-transactions`       | Provider data synchronization | 5                   |
| `categorize-transactions` | AI/rules-based categorization | 5                   |
| `esg-updates`             | ESG score refresh             | 5                   |
| `valuation-snapshots`     | Daily asset valuations        | 5                   |
| `email-notifications`     | Email delivery                | 5                   |
| `system-maintenance`      | Cleanup and maintenance       | 5                   |

### Job Data Types

```typescript
// Transaction sync job
interface SyncTransactionsJobData {
  type: 'sync-transactions';
  payload: {
    provider: 'belvo' | 'plaid' | 'bitso';
    userId: string;
    connectionId: string;
    fullSync?: boolean;
  };
}

// Categorization job
interface CategorizeTransactionsJobData {
  type: 'categorize-transactions';
  payload: {
    spaceId: string;
    transactionIds?: string[];
  };
}

// ESG update job
interface ESGUpdateJobData {
  type: 'esg-update';
  payload: {
    symbols: string[];
    forceRefresh?: boolean;
  };
}

// Valuation snapshot job
interface ValuationSnapshotJobData {
  type: 'valuation-snapshot';
  payload: {
    spaceId: string;
    date?: string;
  };
}
```

## API Endpoints

| Method | Endpoint                    | Auth        | Description                                |
| ------ | --------------------------- | ----------- | ------------------------------------------ |
| `POST` | `/jobs/categorize/:spaceId` | JWT         | Trigger categorization for specific space  |
| `POST` | `/jobs/categorize`          | JWT         | Trigger global categorization (all spaces) |
| `POST` | `/jobs/sync-portfolio`      | JWT         | Sync portfolio for current user            |
| `POST` | `/jobs/sync-portfolio/all`  | JWT (Admin) | Sync portfolios for all users              |

### Example: Trigger Categorization

```bash
curl -X POST "https://api.dhan.am/jobs/categorize/space_123" \
  -H "Authorization: Bearer <token>"
```

**Response:**

```json
{
  "message": "Categorized 45 out of 120 transactions",
  "categorized": 45,
  "total": 120,
  "spaces": 1
}
```

## Service Architecture

```
JobsModule
├── JobsController          # Manual trigger endpoints
├── JobsService             # Cron-scheduled jobs
│   ├── categorizeNewTransactions()    # Every hour
│   ├── syncCryptoPortfolios()         # Every 4 hours
│   ├── syncBlockchainWallets()        # Every 6 hours
│   ├── cleanupExpiredSessions()       # Daily 2 AM
│   └── generateValuationSnapshots()   # Daily 3 AM
├── QueueService            # BullMQ queue management
│   ├── Queue initialization
│   ├── Job scheduling
│   ├── Worker registration
│   └── Queue administration
├── EnhancedJobsService     # Advanced job orchestration
└── Processors/             # Queue job processors
    ├── transaction-processor.ts
    ├── esg-processor.ts
    └── valuation-processor.ts
```

### Scheduled Jobs (Cron)

| Schedule      | Job                          | Description                                |
| ------------- | ---------------------------- | ------------------------------------------ |
| Every hour    | `categorizeNewTransactions`  | Auto-categorize uncategorized transactions |
| Every 4 hours | `syncCryptoPortfolios`       | Sync Bitso crypto positions                |
| Every 6 hours | `syncBlockchainWallets`      | Sync ETH/BTC wallet balances               |
| Daily 2 AM    | `cleanupExpiredSessions`     | Remove stale provider connections          |
| Daily 3 AM    | `generateValuationSnapshots` | Create daily asset valuation records       |

### Queue Configuration

Default job options applied to all queues:

```typescript
{
  removeOnComplete: 100,   // Keep last 100 completed jobs
  removeOnFail: 50,        // Keep last 50 failed jobs
  attempts: 3,             // Retry up to 3 times
  backoff: {
    type: 'exponential',
    delay: 5000            // Start with 5s delay
  }
}
```

## Configuration

### Environment Variables

| Variable                                    | Description              | Default                  |
| ------------------------------------------- | ------------------------ | ------------------------ |
| `REDIS_URL`                                 | Redis connection URL     | `redis://localhost:6379` |
| `QUEUE_SYNC_TRANSACTIONS_CONCURRENCY`       | Sync queue workers       | `5`                      |
| `QUEUE_CATEGORIZE_TRANSACTIONS_CONCURRENCY` | Categorize queue workers | `5`                      |
| `QUEUE_ESG_UPDATES_CONCURRENCY`             | ESG queue workers        | `5`                      |
| `QUEUE_VALUATION_SNAPSHOTS_CONCURRENCY`     | Valuation queue workers  | `5`                      |
| `QUEUE_EMAIL_NOTIFICATIONS_CONCURRENCY`     | Email queue workers      | `5`                      |

### Queue Management Methods

```typescript
// Get stats for a specific queue
await queueService.getQueueStats('sync-transactions');

// Get stats for all queues
await queueService.getAllQueueStats();

// Pause/resume queue
await queueService.pauseQueue('sync-transactions');
await queueService.resumeQueue('sync-transactions');

// Clear all jobs from queue
const clearedCount = await queueService.clearQueue('sync-transactions');

// Retry failed jobs
const retriedCount = await queueService.retryFailedJobs('sync-transactions');
```

Admin queue operations use these methods through audited endpoints:

- `GET /v1/admin/queues`
- `GET /v1/admin/queues/:name/failed?limit=25`
- `POST /v1/admin/queues/:name/retry-failed`
- `POST /v1/admin/queues/:name/clear-failed` with `{ "confirm": true }`
- `POST /v1/admin/queues/:name/clear` with `{ "confirm": true }`

Use inspect, then retry, then failed-job-only cleanup. Whole-queue clearing
removes waiting, active, completed, failed, and delayed jobs and is reserved for
break-glass cleanup.

Production note: the failed-job inspection and failed-job-only clear path is in
current source commit `71f03516`. It is not available on live production until
that build is promoted after a green staging smoke, or through a documented
break-glass promotion.

### Graceful Shutdown

The module supports graceful shutdown with queue draining:

```typescript
// Drain queues before shutdown (30s timeout)
await queueService.drainQueues(30000);

// Check if accepting new jobs
queueService.isAcceptingJobs(); // false during shutdown
```

## Related Modules

| Module                 | Relationship                                |
| ---------------------- | ------------------------------------------- |
| `categories`           | RulesService for transaction categorization |
| `providers/bitso`      | Crypto portfolio sync                       |
| `providers/blockchain` | Wallet balance sync                         |
| `email`                | Email notification queue                    |
| `esg`                  | ESG score updates                           |
| `accounts`             | Valuation snapshot creation                 |

## Testing

### Unit Tests

```bash
# Run jobs tests
pnpm test -- --testPathPattern=jobs

# Run queue service tests
pnpm test -- --testPathPattern=queue.service

# With coverage
pnpm test:cov -- --testPathPattern=jobs
```

### Test Scenarios

Located in `__tests__/` and `queue.service.spec.ts`:

- Job scheduling with correct priorities
- Queue initialization and event handling
- Worker registration and processing
- Graceful shutdown with job draining
- Rate limiting and backoff behavior

### Manual Testing

1. Start Redis (`pnpm dev:infra`)
2. Start API server (`pnpm dev:api`)
3. Trigger manual jobs via endpoints
4. Monitor queue stats:

```bash
# Audited admin endpoint
curl "https://api.dhan.am/v1/admin/queues" \
  -H "Authorization: Bearer <admin-token>"

curl "https://api.dhan.am/v1/admin/queues/sync-transactions/failed?limit=25" \
  -H "Authorization: Bearer <admin-token>"
```

### Queue Health Check

```bash
# Check queue depths
curl "https://api.dhan.am/v1/admin/queues" \
  -H "Authorization: Bearer <admin-token>"
```

**Response:**

```json
{
  "queues": [
    {
      "name": "sync-transactions",
      "status": "error",
      "recentJobs": 1548,
      "failedJobs": 12
    }
  ]
}
```

---

**Module**: `jobs`
**Last Updated**: May 2026
