# Goals Module

> Financial goal tracking with Monte Carlo probability calculations and account allocation management.

## Purpose

The Goals module enables users to define, track, and achieve financial objectives. It integrates with the Monte Carlo simulation engine to calculate achievement probabilities, provides detailed progress tracking, supports account allocation for goal funding, and offers what-if scenario analysis. Goals can be shared between users for collaborative financial planning.

## Key Entities

### Goal

Core entity representing a financial objective.

| Field                 | Type       | Description                                 |
| --------------------- | ---------- | ------------------------------------------- |
| `id`                  | UUID       | Unique identifier                           |
| `spaceId`             | UUID       | Parent space reference                      |
| `name`                | string     | Goal name                                   |
| `description`         | string     | Optional description                        |
| `type`                | enum       | Goal category (see types below)             |
| `targetAmount`        | Decimal    | Target amount to achieve                    |
| `currency`            | enum       | Goal currency                               |
| `targetDate`          | datetime   | Target completion date                      |
| `priority`            | int (1-10) | Goal priority ranking                       |
| `status`              | enum       | `active`, `achieved`, `paused`, `cancelled` |
| `currentProbability`  | Decimal    | Latest success probability (0-100)          |
| `confidenceLow`       | Decimal    | P10 confidence bound                        |
| `confidenceHigh`      | Decimal    | P90 confidence bound                        |
| `currentProgress`     | Decimal    | Current progress percentage                 |
| `projectedCompletion` | datetime   | Estimated completion date                   |
| `monthlyContribution` | Decimal    | Expected monthly contribution               |
| `expectedReturn`      | Decimal    | Expected annual return rate                 |
| `volatility`          | Decimal    | Expected volatility                         |
| `probabilityHistory`  | JSON       | Historical probability snapshots            |
| `lastSimulationAt`    | datetime   | Last Monte Carlo run                        |

### GoalType

Supported goal categories:

| Type             | Description                  |
| ---------------- | ---------------------------- |
| `emergency_fund` | Emergency savings buffer     |
| `retirement`     | Long-term retirement savings |
| `home_purchase`  | Down payment / home buying   |
| `education`      | Education expenses           |
| `vacation`       | Travel and vacation funding  |
| `debt_payoff`    | Debt elimination goal        |
| `investment`     | General investment target    |
| `custom`         | User-defined goal type       |

### GoalAllocation

Links accounts to goals with percentage allocation.

| Field        | Type    | Description                   |
| ------------ | ------- | ----------------------------- |
| `id`         | UUID    | Unique identifier             |
| `goalId`     | UUID    | Reference to goal             |
| `accountId`  | UUID    | Reference to account          |
| `percentage` | Decimal | Allocation percentage (0-100) |
| `notes`      | string  | Optional notes                |

### GoalShare

Collaboration records for shared goals.

| Field              | Type   | Description                         |
| ------------------ | ------ | ----------------------------------- |
| `id`               | UUID   | Unique identifier                   |
| `goalId`           | UUID   | Reference to goal                   |
| `sharedWithUserId` | UUID   | Target user                         |
| `role`             | enum   | `viewer`, `contributor`, `co-owner` |
| `status`           | enum   | `pending`, `accepted`, `declined`   |
| `message`          | string | Invitation message                  |

## API Endpoints

### Goal CRUD

| Method   | Endpoint                        | Description            |
| -------- | ------------------------------- | ---------------------- |
| `POST`   | `/goals`                        | Create a new goal      |
| `GET`    | `/goals/space/:spaceId`         | List goals in a space  |
| `GET`    | `/goals/space/:spaceId/summary` | Get space goal summary |
| `GET`    | `/goals/:id`                    | Get goal details       |
| `PUT`    | `/goals/:id`                    | Update a goal          |
| `DELETE` | `/goals/:id`                    | Delete a goal          |

### Progress and Allocations

| Method   | Endpoint                            | Description                            |
| -------- | ----------------------------------- | -------------------------------------- |
| `GET`    | `/goals/:id/progress`               | Get basic progress                     |
| `GET`    | `/goals/:id/progress/detailed`      | Get detailed progress with rebalancing |
| `POST`   | `/goals/:id/allocations`            | Add account allocation                 |
| `DELETE` | `/goals/:id/allocations/:accountId` | Remove allocation                      |

### Monte Carlo Probability

| Method | Endpoint                                       | Description             |
| ------ | ---------------------------------------------- | ----------------------- |
| `GET`  | `/goals/:id/probability`                       | Get current probability |
| `POST` | `/goals/:id/probability/update`                | Recalculate probability |
| `POST` | `/goals/:id/what-if`                           | Run what-if scenario    |
| `POST` | `/goals/space/:spaceId/probability/update-all` | Bulk update all goals   |

### Rebalancing

| Method | Endpoint                         | Description                 |
| ------ | -------------------------------- | --------------------------- |
| `GET`  | `/goals/:id/rebalancing/suggest` | Get rebalancing suggestions |
| `POST` | `/goals/:id/rebalancing/execute` | Execute rebalancing         |

### Collaboration

| Method   | Endpoint                         | Description              |
| -------- | -------------------------------- | ------------------------ |
| `POST`   | `/goals/:id/share`               | Share goal with user     |
| `GET`    | `/goals/:id/shares`              | List goal shares         |
| `GET`    | `/goals/shared/me`               | Get goals shared with me |
| `POST`   | `/goals/shares/:shareId/accept`  | Accept share invitation  |
| `POST`   | `/goals/shares/:shareId/decline` | Decline share invitation |
| `DELETE` | `/goals/shares/:shareId`         | Revoke a share           |
| `PUT`    | `/goals/shares/:shareId/role`    | Update share role        |
| `GET`    | `/goals/:id/activities`          | Get goal activity feed   |

### Request/Response Examples

**Create Goal**

```json
// POST /goals
{
  "spaceId": "uuid",
  "name": "Emergency Fund",
  "type": "emergency_fund",
  "targetAmount": 50000,
  "currency": "MXN",
  "targetDate": "2025-12-31",
  "priority": 1,
  "notes": "6 months of expenses"
}
```

**What-If Scenario**

```json
// POST /goals/:id/what-if
{
  "monthlyContribution": 5000,
  "targetAmount": 60000,
  "expectedReturn": 0.08,
  "volatility": 0.12
}
```

**Probability Response**

```json
{
  "goalId": "uuid",
  "probability": 72.5,
  "confidenceLow": 45000,
  "confidenceHigh": 68000,
  "currentProgress": 35.2,
  "projectedCompletion": "2025-10-15T00:00:00Z",
  "recommendedMonthlyContribution": 4500,
  "timeline": [
    { "month": 1, "median": 38000, "p10": 35000, "p90": 42000 },
    { "month": 2, "median": 41000, "p10": 36000, "p90": 47000 }
  ]
}
```

## Service Architecture

```
GoalsController
       │
       ├──► GoalsService (CRUD, allocations)
       │
       ├──► GoalProbabilityService (Monte Carlo)
       │         │
       │         └──► MonteCarloEngine
       │
       ├──► GoalsExecutionService (progress, rebalancing)
       │
       └──► GoalCollaborationService (sharing)
```

### Key Services

- **GoalsService**: Core CRUD operations, allocation management, progress calculation
- **GoalProbabilityService**: Monte Carlo simulation integration, what-if scenarios
- **GoalsExecutionService**: Detailed progress analysis, rebalancing recommendations
- **GoalCollaborationService**: Sharing, invitations, activity tracking

## Data Flow

### Probability Calculation

```
1. GoalProbabilityService receives goal ID
2. Fetch goal with allocations and account balances
3. Calculate current balance from allocations
4. Compute months until target date
5. Configure Monte Carlo parameters:
   - Initial balance (current allocated value)
   - Monthly contribution
   - Expected return rate
   - Volatility
   - Simulation iterations (10,000)
6. Run MonteCarloEngine.simulate()
7. Calculate success rate against target amount
8. Build timeline with percentile snapshots
9. Compute recommended contribution if probability < 50%
10. Store results and update goal record
```

### Progress Calculation

```
1. Fetch goal with account allocations
2. For each allocation:
   - Get account balance
   - Apply allocation percentage
   - Sum contributed values
3. Calculate time progress (elapsed / total)
4. Calculate value progress (current / target)
5. Determine on-track status (within 10% tolerance)
6. Project completion date via linear regression
7. Compute required monthly contribution
```

### Goal Sharing Flow

```
1. Owner shares goal with email and role
2. Target user lookup
3. GoalShare record created (status: pending)
4. Activity logged
5. Target user accepts/declines
6. On accept: Share status updated, access granted
7. Activities visible to all collaborators
```

## Error Handling

| Error                 | Status | Condition                                |
| --------------------- | ------ | ---------------------------------------- |
| `NotFoundException`   | 404    | Goal, space, or account not found        |
| `BadRequestException` | 400    | Invalid allocation, duplicate allocation |
| `Error`               | 500    | Target date in past, simulation failure  |

### Error Messages

- "Space not found or you do not have access"
- "Goal not found"
- "Account not found or does not belong to this space"
- "Allocation already exists for this account"
- "Total allocation percentage would exceed 100%"
- "Target date must be in the future"

## Related Modules

| Module        | Relationship                  |
| ------------- | ----------------------------- |
| `spaces`      | Goals belong to spaces        |
| `accounts`    | Accounts allocated to goals   |
| `simulations` | Monte Carlo engine dependency |
| `households`  | Goals can be household-level  |
| `audit`       | Goal actions are audited      |

## Testing

### Test Locations

```
apps/api/src/modules/goals/__tests__/
  goals.controller.spec.ts
  goals.service.spec.ts
apps/api/src/modules/goals/
  goal-probability.service.spec.ts
  goal-collaboration.service.spec.ts
```

### Test Coverage Areas

- Goal CRUD operations
- Allocation percentage validation
- Progress calculation accuracy
- Monte Carlo integration
- Probability boundary conditions (past due, no balance)
- What-if scenario validation
- Sharing and collaboration workflows
- Role-based access control

### Running Tests

```bash
# Unit tests
pnpm test -- goals

# Specific service
pnpm test -- goal-probability

# With coverage
pnpm test:cov -- goals
```

---

**Module**: `goals`
**Last Updated**: January 2025
