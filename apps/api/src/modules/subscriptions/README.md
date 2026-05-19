# Subscriptions Module

> Recurring subscription tracking with automatic detection, spending analytics, and savings recommendations.

## Purpose

The Subscriptions module helps users manage their recurring service payments:

- **Manual subscription creation** with full metadata support
- **Automatic detection** from recurring transaction patterns
- **Spending analytics** with category breakdowns and monthly/annual totals
- **Savings recommendations** based on usage frequency analysis
- **Lifecycle management** (pause, resume, cancel) with audit trails

**Note:** This module tracks user subscriptions to external services (Netflix, Spotify, etc.), not Dhanam platform subscription plans. For platform billing, see the `billing` module.

## Key Entities

### Subscription

```typescript
interface Subscription {
  id: string;
  spaceId: string;
  serviceName: string; // e.g., "Netflix"
  serviceUrl?: string; // e.g., "https://netflix.com"
  serviceIcon?: string; // Icon identifier
  category: SubscriptionCategory;
  description?: string;
  amount: number; // Per-cycle cost
  currency: Currency;
  billingCycle: RecurrenceFrequency;
  nextBillingDate?: Date;
  lastBillingDate?: Date;
  status: SubscriptionStatus;
  startDate: Date;
  endDate?: Date;
  trialEndDate?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  annualCost: number; // Calculated yearly cost
  usageFrequency?: string; // 'high' | 'medium' | 'low' | 'unknown'
  savingsRecommendation?: string;
  alertBeforeDays: number; // Days before billing to alert
  alertEnabled: boolean;
  notes?: string;
  recurringId?: string; // Link to detected pattern
}
```

### Subscription Categories

| Category        | Examples                         |
| --------------- | -------------------------------- |
| `streaming`     | Netflix, Disney+, HBO Max        |
| `music`         | Spotify, Apple Music             |
| `software`      | Adobe, Microsoft 365, GitHub     |
| `gaming`        | Xbox Game Pass, PlayStation Plus |
| `news`          | NYT, WSJ                         |
| `fitness`       | Peloton, Headspace               |
| `food_delivery` | DoorDash, Uber Eats, Rappi       |
| `cloud_storage` | Dropbox, Google One              |
| `productivity`  | Notion, Slack, Zoom              |
| `education`     | Duolingo, Coursera               |
| `finance`       | Investment apps                  |
| `other`         | Uncategorized                    |

### Subscription Status

| Status      | Description                   |
| ----------- | ----------------------------- |
| `active`    | Currently active subscription |
| `trial`     | In free trial period          |
| `paused`    | Temporarily suspended         |
| `cancelled` | User cancelled                |
| `expired`   | Past end date                 |

## API Endpoints

All endpoints are scoped to a space: `/spaces/:spaceId/subscriptions`

| Method   | Endpoint      | Auth | Description                                |
| -------- | ------------- | ---- | ------------------------------------------ |
| `GET`    | `/`           | JWT  | List all subscriptions (filterable)        |
| `GET`    | `/summary`    | JWT  | Get spending summary and analytics         |
| `GET`    | `/:id`        | JWT  | Get subscription details with transactions |
| `POST`   | `/`           | JWT  | Create manual subscription                 |
| `POST`   | `/detect`     | JWT  | Auto-detect from recurring patterns        |
| `PATCH`  | `/:id`        | JWT  | Update subscription                        |
| `POST`   | `/:id/cancel` | JWT  | Cancel subscription                        |
| `POST`   | `/:id/pause`  | JWT  | Pause active subscription                  |
| `POST`   | `/:id/resume` | JWT  | Resume paused subscription                 |
| `DELETE` | `/:id`        | JWT  | Delete subscription                        |

### Example: List Subscriptions

```bash
curl "https://api.dhan.am/spaces/space_123/subscriptions?status=active" \
  -H "Authorization: Bearer <token>"
```

**Response:**

```json
[
  {
    "id": "sub_abc123",
    "serviceName": "Netflix",
    "serviceIcon": "netflix",
    "category": "streaming",
    "amount": 15.99,
    "currency": "USD",
    "billingCycle": "monthly",
    "nextBillingDate": "2025-02-01T00:00:00Z",
    "status": "active",
    "annualCost": 191.88,
    "alertEnabled": true,
    "alertBeforeDays": 3
  }
]
```

### Example: Get Spending Summary

```bash
curl "https://api.dhan.am/spaces/space_123/subscriptions/summary" \
  -H "Authorization: Bearer <token>"
```

**Response:**

```json
{
  "totalMonthly": 127.45,
  "totalAnnual": 1529.4,
  "activeCount": 8,
  "trialCount": 1,
  "pausedCount": 0,
  "cancelledCount": 2,
  "byCategory": [
    { "category": "streaming", "count": 3, "monthlyTotal": 45.97 },
    { "category": "software", "count": 2, "monthlyTotal": 35.99 },
    { "category": "music", "count": 1, "monthlyTotal": 10.99 }
  ],
  "upcomingThisMonth": [
    {
      "id": "sub_abc123",
      "serviceName": "Netflix",
      "amount": 15.99,
      "currency": "USD",
      "billingDate": "2025-02-01T00:00:00Z",
      "daysUntil": 5
    }
  ],
  "savingsOpportunities": [
    {
      "id": "sub_xyz789",
      "serviceName": "Adobe Creative Cloud",
      "recommendation": "Look for annual billing discounts - many services offer 15-20% off.",
      "annualCost": 599.88
    }
  ]
}
```

### Example: Auto-Detect Subscriptions

```bash
curl -X POST "https://api.dhan.am/spaces/space_123/subscriptions/detect" \
  -H "Authorization: Bearer <token>"
```

**Response:**

```json
{
  "detected": [
    {
      "id": "sub_new123",
      "serviceName": "Spotify",
      "amount": 10.99,
      "category": "music",
      "billingCycle": "monthly",
      "recurringId": "rec_pattern_456"
    }
  ],
  "total": 3
}
```

## Service Architecture

```
SubscriptionsModule
├── SubscriptionsController     # REST endpoints
├── SubscriptionsService        # Core subscription logic
│   ├── CRUD operations
│   ├── Status management
│   ├── Summary analytics
│   └── Space access validation
├── SubscriptionDetectorService # Automatic detection
│   ├── Pattern matching
│   ├── Known service database
│   ├── Category inference
│   └── Savings recommendations
└── Dependencies
    ├── SpacesService          # Access control
    └── PrismaService          # Database operations
```

### Known Services Database

The detector includes metadata for 25+ popular services:

```typescript
const KNOWN_SERVICES = {
  netflix: {
    category: 'streaming',
    icon: 'netflix',
    url: 'https://netflix.com',
    aliases: ['netflix.com', 'netflix inc'],
  },
  spotify: {
    category: 'music',
    icon: 'spotify',
    url: 'https://spotify.com',
    aliases: ['spotify.com', 'spotify ab', 'spotify usa'],
  },
  // ... 23+ more services
};
```

### Detection Algorithm

1. Fetch confirmed recurring transaction patterns without linked subscriptions
2. Match merchant names against known services database
3. For unknown merchants, apply heuristics:
   - Monthly/yearly frequency
   - Confidence score >= 70%
   - Subscription-like keywords in merchant name
4. Infer category from keywords if not matched
5. Calculate annual cost and set next billing date

### Annual Cost Calculation

```typescript
const multipliers = {
  daily: 365,
  weekly: 52,
  biweekly: 26,
  monthly: 12,
  quarterly: 4,
  yearly: 1,
};

annualCost = amount * multipliers[billingCycle];
```

## Configuration

### Usage Frequency Levels

| Level     | Description    | Savings Action         |
| --------- | -------------- | ---------------------- |
| `high`    | Regular use    | No recommendation      |
| `medium`  | Occasional use | Suggest annual billing |
| `low`     | Rarely used    | Suggest cancellation   |
| `unknown` | Not tracked    | No recommendation      |

### Alert Settings

| Setting           | Default | Description                   |
| ----------------- | ------- | ----------------------------- |
| `alertBeforeDays` | 3       | Days before billing to notify |
| `alertEnabled`    | true    | Whether to send notifications |

## Related Modules

| Module         | Relationship                                |
| -------------- | ------------------------------------------- |
| `recurring`    | Provides transaction patterns for detection |
| `transactions` | Source data for pattern analysis            |
| `spaces`       | Ownership and access control                |
| `billing`      | Platform subscription (different concern)   |
| `budgets`      | Subscription costs in budget tracking       |

## Testing

### Unit Tests

```bash
# Run subscription tests
pnpm test -- --testPathPattern=subscriptions

# Run detector tests
pnpm test -- --testPathPattern=subscription-detector

# With coverage
pnpm test:cov -- --testPathPattern=subscriptions
```

### Test Scenarios

Located in `subscriptions.service.spec.ts` and `subscription-detector.service.spec.ts`:

- CRUD operations with space access validation
- Duplicate subscription prevention
- Status transitions (active/paused/cancelled)
- Pattern detection with known services
- Heuristic detection for unknown merchants
- Annual cost calculation for all frequencies
- Savings recommendation generation

### Manual Testing

1. Create transactions with recurring patterns
2. Run detection: `POST /spaces/{id}/subscriptions/detect`
3. Review detected subscriptions
4. Manually create additional subscriptions
5. Check summary analytics
6. Test pause/resume/cancel flows

---

**Module**: `subscriptions`
**Last Updated**: January 2025
