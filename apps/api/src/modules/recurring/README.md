# Recurring Module

> Recurring transaction management with automatic pattern detection and bill reminders.

## Purpose

The Recurring module enables users to track, manage, and forecast recurring financial obligations such as subscriptions, bills, and regular payments. It features an intelligent pattern detection engine that analyzes transaction history to automatically identify recurring patterns, which users can confirm or dismiss. Confirmed patterns generate upcoming payment forecasts and can trigger alerts before due dates.

## Key Entities

### RecurringTransaction

Represents a detected or manually created recurring payment pattern.

| Field             | Type     | Description                    |
| ----------------- | -------- | ------------------------------ |
| `id`              | UUID     | Unique identifier              |
| `spaceId`         | UUID     | Parent space reference         |
| `merchantName`    | string   | Display name (e.g., "Netflix") |
| `merchantPattern` | string   | Regex pattern for matching     |
| `expectedAmount`  | Decimal  | Expected transaction amount    |
| `amountVariance`  | Decimal  | Allowed variance (0.0-1.0)     |
| `currency`        | enum     | Transaction currency           |
| `frequency`       | enum     | Recurrence frequency           |
| `status`          | enum     | Pattern status                 |
| `categoryId`      | UUID     | Auto-assign category           |
| `lastOccurrence`  | datetime | Last matched transaction date  |
| `nextExpected`    | datetime | Predicted next occurrence      |
| `occurrenceCount` | int      | Total matched occurrences      |
| `confidence`      | Decimal  | Detection confidence (0-1)     |
| `alertBeforeDays` | int      | Days before to send alert      |
| `alertEnabled`    | boolean  | Alert toggle                   |
| `notes`           | string   | User notes                     |
| `firstDetectedAt` | datetime | Initial detection timestamp    |
| `confirmedAt`     | datetime | User confirmation timestamp    |
| `dismissedAt`     | datetime | Dismissal timestamp            |

### RecurringStatus

| Status      | Description                         |
| ----------- | ----------------------------------- |
| `detected`  | Auto-detected, awaiting user action |
| `confirmed` | User verified, actively tracking    |
| `paused`    | Temporarily suspended tracking      |
| `dismissed` | User rejected pattern               |

### RecurrenceFrequency

| Frequency   | Days Between |
| ----------- | ------------ |
| `daily`     | 1            |
| `weekly`    | 7            |
| `biweekly`  | 14           |
| `monthly`   | 30           |
| `quarterly` | 90           |
| `yearly`    | 365          |

## API Endpoints

### Pattern Management

| Method   | Endpoint                             | Description             |
| -------- | ------------------------------------ | ----------------------- |
| `GET`    | `/spaces/:spaceId/recurring`         | List recurring patterns |
| `GET`    | `/spaces/:spaceId/recurring/summary` | Get recurring summary   |
| `GET`    | `/spaces/:spaceId/recurring/:id`     | Get pattern details     |
| `POST`   | `/spaces/:spaceId/recurring`         | Create manual pattern   |
| `PATCH`  | `/spaces/:spaceId/recurring/:id`     | Update pattern          |
| `DELETE` | `/spaces/:spaceId/recurring/:id`     | Delete pattern          |

### Detection and Status

| Method | Endpoint                                      | Description              |
| ------ | --------------------------------------------- | ------------------------ |
| `POST` | `/spaces/:spaceId/recurring/detect`           | Run pattern detection    |
| `POST` | `/spaces/:spaceId/recurring/:id/confirm`      | Confirm detected pattern |
| `POST` | `/spaces/:spaceId/recurring/:id/dismiss`      | Dismiss detected pattern |
| `POST` | `/spaces/:spaceId/recurring/:id/toggle-pause` | Pause/resume tracking    |

### Query Parameters

| Parameter         | Type    | Description                  |
| ----------------- | ------- | ---------------------------- |
| `status`          | enum    | Filter by status             |
| `includeDetected` | boolean | Include unconfirmed patterns |

### Request/Response Examples

**Create Manual Pattern**

```json
// POST /spaces/:spaceId/recurring
{
  "merchantName": "Netflix",
  "merchantPattern": "netflix",
  "expectedAmount": 199.0,
  "amountVariance": 0.1,
  "currency": "MXN",
  "frequency": "monthly",
  "categoryId": "uuid",
  "alertBeforeDays": 3,
  "alertEnabled": true,
  "notes": "Family plan subscription"
}
```

**Summary Response**

```json
{
  "totalMonthly": 2450.0,
  "totalAnnual": 29400.0,
  "activeCount": 8,
  "detectedCount": 3,
  "upcomingThisMonth": [
    {
      "id": "uuid",
      "merchantName": "Netflix",
      "expectedAmount": 199.0,
      "currency": "MXN",
      "expectedDate": "2025-01-28T00:00:00Z",
      "daysUntil": 3
    }
  ]
}
```

**Detection Response**

```json
{
  "detected": [
    {
      "id": "uuid",
      "merchantName": "Spotify",
      "expectedAmount": 115.0,
      "frequency": "monthly",
      "confidence": 0.85,
      "occurrenceCount": 8
    }
  ],
  "total": 5
}
```

## Service Architecture

```
RecurringController
       │
       ▼
  RecurringService
       │
       ├──► RecurringDetectorService (pattern detection)
       │
       ├──► SpacesService (access verification)
       │
       └──► PrismaService (database operations)
```

### Key Services

- **RecurringService**: CRUD operations, status management, summary generation
- **RecurringDetectorService**: Pattern detection algorithm, transaction matching

## Data Flow

### Pattern Detection Algorithm

```
1. Fetch last year's transactions for space
2. Filter out already-linked transactions
3. Group transactions by normalized merchant name
4. For each merchant group with 3+ transactions:
   a. Sort transactions by date
   b. Calculate intervals between consecutive transactions
   c. Detect frequency by matching intervals to expected patterns
   d. Calculate amount statistics (mean, variance)
   e. Skip if amount variance > 50%
   f. Compute confidence score
5. Filter patterns with confidence >= 60%
6. Sort by confidence descending
7. Store as 'detected' status
8. Link transactions to pattern
```

### Confidence Calculation

```
confidence =
  (frequencyScore * 0.5) +
  ((1 - amountVariance) * 0.3) +
  (min(occurrenceCount / 12, 1) * 0.2)
```

Factors:

- **Frequency Score (50%)**: How well intervals match expected frequency
- **Amount Consistency (30%)**: Lower variance increases confidence
- **Occurrence Count (20%)**: More occurrences boost confidence

### Frequency Detection

```
1. Calculate average interval between transactions
2. For each possible frequency:
   a. Define tolerance range (+-25%)
   b. Count intervals within range
   c. Calculate matching score
   d. Add deviation penalty for average
3. Combined score = (matchScore * 0.7) + (avgScore * 0.3)
4. Return highest scoring frequency
```

### Transaction Matching

When new transactions arrive:

```
1. Extract/normalize merchant name
2. For each confirmed recurring pattern:
   a. Compare normalized merchant names
   b. Check amount within variance range
   c. If match:
      - Link transaction to pattern
      - Update lastOccurrence
      - Calculate nextExpected
      - Increment occurrenceCount
```

### Monthly Total Calculation

```
For each confirmed pattern:
  switch(frequency):
    daily:     monthly += amount * 30
    weekly:    monthly += amount * 4.33
    biweekly:  monthly += amount * 2.17
    monthly:   monthly += amount
    quarterly: monthly += amount / 3
    yearly:    monthly += amount / 12
```

## Error Handling

| Error                | Status | Condition                                  |
| -------------------- | ------ | ------------------------------------------ |
| `NotFoundException`  | 404    | Pattern not found                          |
| `ConflictException`  | 409    | Duplicate pattern, wrong status transition |
| `ForbiddenException` | 403    | Insufficient space access                  |

### Error Messages

- "Recurring transaction not found"
- "A recurring pattern for this merchant already exists"
- "Can only confirm detected patterns"
- "Space not found or access denied"

## Related Modules

| Module         | Relationship                                   |
| -------------- | ---------------------------------------------- |
| `spaces`       | Recurring patterns belong to spaces            |
| `transactions` | Transactions linked to recurring patterns      |
| `categories`   | Patterns can auto-assign categories            |
| `alerts`       | Patterns can trigger upcoming payment alerts   |
| `forecasts`    | Recurring amounts used in cashflow projections |

## Testing

### Test Location

```
apps/api/src/modules/recurring/__tests__/
```

### Test Coverage Areas

- Pattern CRUD operations
- Detection algorithm accuracy
- Frequency detection edge cases
- Amount variance calculations
- Confidence scoring
- Transaction matching logic
- Status transitions
- Monthly/annual calculations
- Alert scheduling

### Running Tests

```bash
# Unit tests
pnpm test -- recurring

# With coverage
pnpm test:cov -- recurring
```

### Test Data Scenarios

- Regular monthly patterns (Netflix, gym)
- Variable amount patterns (utilities)
- Weekly/biweekly patterns (rent, paycheck)
- Annual patterns (insurance, subscriptions)
- Edge cases (missed payments, amount changes)

---

**Module**: `recurring`
**Last Updated**: January 2025
