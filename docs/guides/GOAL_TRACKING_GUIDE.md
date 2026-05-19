# Goal Tracking System - Implementation Guide

**Version:** 1.0
**Date:** 2025-11-19
**Status:** Q1 Implementation - Weeks 4-6 Complete

---

## Overview

The Goal Tracking System enables users to set financial goals (retirement, education, house purchase, etc.) and track their progress by allocating portions of their accounts toward specific goals.

**Key Features:**

- Multi-goal support per space
- Fractional account allocation (e.g., 40% retirement, 60% house)
- Automatic progress calculation
- Timeline tracking with "on track" indicators
- Monthly contribution recommendations
- Projected completion dates

---

## Database Schema

### Goal Model

```prisma
model Goal {
  id               String        // UUID
  spaceId          String        // Belongs to a Space
  name             String        // e.g., "Retirement Fund"
  description      String?       // Optional details
  type             GoalType      // retirement, education, house_purchase, etc.
  targetAmount     Decimal       // Goal amount
  currency         Currency      // MXN, USD, EUR
  targetDate       Date          // When to achieve the goal
  priority         Int           // 1-10 (1 = highest priority)
  status           GoalStatus    // active, paused, achieved, abandoned
  notes            String?       // User notes
  createdAt        DateTime
  updatedAt        DateTime

  allocations      GoalAllocation[]
}
```

### GoalAllocation Model

```prisma
model GoalAllocation {
  id               String        // UUID
  goalId           String        // References Goal
  accountId        String        // References Account
  percentage       Decimal       // 0-100 (e.g., 40.00 = 40%)
  notes            String?       // Optional allocation notes
  createdAt        DateTime
  updatedAt        DateTime

  @@unique([goalId, accountId])  // One allocation per account per goal
}
```

### Enums

```prisma
enum GoalType {
  retirement
  education
  house_purchase
  emergency_fund
  legacy
  travel
  business
  debt_payoff
  other
}

enum GoalStatus {
  active    // Currently working toward
  paused    // Temporarily stopped
  achieved  // Target reached
  abandoned // No longer pursuing
}
```

---

## API Endpoints

### 1. Create Goal

**POST** `/goals`

**Request Body:**

```json
{
  "spaceId": "uuid",
  "name": "Retirement Fund",
  "description": "Build a comfortable retirement nest egg",
  "type": "retirement",
  "targetAmount": 1000000,
  "currency": "USD",
  "targetDate": "2045-12-31",
  "priority": 1,
  "notes": "Target: $1M by age 65"
}
```

**Response:** `201 Created`

```json
{
  "id": "goal-uuid",
  "spaceId": "space-uuid",
  "name": "Retirement Fund",
  "type": "retirement",
  "targetAmount": "1000000.0000",
  "currency": "USD",
  "targetDate": "2045-12-31",
  "priority": 1,
  "status": "active",
  "createdAt": "2025-11-19T00:00:00.000Z",
  "updatedAt": "2025-11-19T00:00:00.000Z"
}
```

---

### 2. Get All Goals for a Space

**GET** `/goals/space/:spaceId`

**Response:** `200 OK`

```json
[
  {
    "id": "goal-uuid-1",
    "name": "Retirement Fund",
    "type": "retirement",
    "targetAmount": "1000000.0000",
    "currency": "USD",
    "targetDate": "2045-12-31",
    "priority": 1,
    "status": "active",
    "allocations": [
      {
        "id": "alloc-uuid-1",
        "accountId": "account-uuid-1",
        "percentage": "60.00",
        "account": {
          "id": "account-uuid-1",
          "name": "401(k)",
          "balance": "150000.0000",
          "currency": "USD"
        }
      }
    ]
  },
  {
    "id": "goal-uuid-2",
    "name": "House Down Payment",
    "type": "house_purchase",
    "targetAmount": "100000.0000",
    "currency": "USD",
    "targetDate": "2028-06-01",
    "priority": 2,
    "status": "active",
    "allocations": []
  }
]
```

---

### 3. Get Goal Summary

**GET** `/goals/space/:spaceId/summary`

**Response:** `200 OK`

```json
{
  "totalGoals": 3,
  "activeGoals": 2,
  "achievedGoals": 1,
  "totalTargetAmount": 1500000,
  "totalCurrentValue": 350000,
  "overallProgress": 23.33
}
```

---

### 4. Get Goal Details

**GET** `/goals/:id`

**Response:** `200 OK`

```json
{
  "id": "goal-uuid",
  "spaceId": "space-uuid",
  "name": "Retirement Fund",
  "description": "Build a comfortable retirement nest egg",
  "type": "retirement",
  "targetAmount": "1000000.0000",
  "currency": "USD",
  "targetDate": "2045-12-31",
  "priority": 1,
  "status": "active",
  "notes": "Target: $1M by age 65",
  "allocations": [
    {
      "id": "alloc-uuid",
      "goalId": "goal-uuid",
      "accountId": "account-uuid",
      "percentage": "60.00",
      "account": {
        "id": "account-uuid",
        "name": "401(k)",
        "balance": "150000.0000",
        "currency": "USD",
        "type": "investment"
      }
    }
  ]
}
```

---

### 5. Update Goal

**PUT** `/goals/:id`

**Request Body:** (all fields optional)

```json
{
  "name": "Updated Retirement Fund",
  "targetAmount": 1200000,
  "targetDate": "2046-12-31",
  "priority": 2,
  "status": "active",
  "notes": "Increased target to $1.2M"
}
```

**Response:** `200 OK` (updated goal object)

---

### 6. Delete Goal

**DELETE** `/goals/:id`

**Response:** `204 No Content`

---

### 7. Get Goal Progress

**GET** `/goals/:id/progress`

**Response:** `200 OK`

```json
{
  "goalId": "goal-uuid",
  "goalName": "Retirement Fund",
  "targetAmount": 1000000,
  "currency": "USD",
  "currentValue": 150000,
  "percentComplete": 15.0,
  "timeProgress": 25.5,
  "projectedCompletion": "2048-06-15T00:00:00.000Z",
  "onTrack": false,
  "monthlyContributionNeeded": 3542.35,
  "allocations": [
    {
      "accountId": "account-uuid-1",
      "accountName": "401(k)",
      "percentage": 60,
      "contributedValue": 90000
    },
    {
      "accountId": "account-uuid-2",
      "accountName": "Roth IRA",
      "percentage": 40,
      "contributedValue": 60000
    }
  ]
}
```

**Progress Indicators:**

- `percentComplete`: Percentage of target amount reached
- `timeProgress`: Percentage of time elapsed since creation
- `onTrack`: `true` if currentValue >= expectedValue for time elapsed (within 10% tolerance)
- `monthlyContributionNeeded`: Additional monthly savings needed to reach target by targetDate
- `projectedCompletion`: Estimated completion date based on current growth rate (null if no growth)

---

### 8. Add Allocation

**POST** `/goals/:id/allocations`

**Request Body:**

```json
{
  "accountId": "account-uuid",
  "percentage": 60,
  "notes": "Primary retirement account"
}
```

**Validation:**

- Account must belong to the same space as the goal
- Total percentage across all allocations cannot exceed 100%
- Cannot create duplicate allocation for the same account

**Response:** `201 Created`

```json
{
  "id": "alloc-uuid",
  "goalId": "goal-uuid",
  "accountId": "account-uuid",
  "percentage": "60.00",
  "notes": "Primary retirement account",
  "createdAt": "2025-11-19T00:00:00.000Z",
  "updatedAt": "2025-11-19T00:00:00.000Z"
}
```

---

### 9. Remove Allocation

**DELETE** `/goals/:id/allocations/:accountId`

**Response:** `204 No Content`

---

## Usage Examples

### Example 1: Retirement Planning

```typescript
// 1. Create retirement goal
const retirementGoal = await fetch('/goals', {
  method: 'POST',
  body: JSON.stringify({
    spaceId: userSpace.id,
    name: 'Retirement at 65',
    type: 'retirement',
    targetAmount: 1000000,
    currency: 'USD',
    targetDate: '2045-12-31',
    priority: 1,
  }),
});

// 2. Allocate 401(k) account (60%) to retirement
await fetch(`/goals/${retirementGoal.id}/allocations`, {
  method: 'POST',
  body: JSON.stringify({
    accountId: account401k.id,
    percentage: 60,
  }),
});

// 3. Allocate Roth IRA (40%) to retirement
await fetch(`/goals/${retirementGoal.id}/allocations`, {
  method: 'POST',
  body: JSON.stringify({
    accountId: accountRothIRA.id,
    percentage: 40,
  }),
});

// 4. Check progress
const progress = await fetch(`/goals/${retirementGoal.id}/progress`);
console.log(`Current: $${progress.currentValue.toLocaleString()}`);
console.log(`Progress: ${progress.percentComplete}%`);
console.log(`On track: ${progress.onTrack ? 'Yes' : 'No'}`);
console.log(`Need to save: $${progress.monthlyContributionNeeded}/month`);
```

### Example 2: Multi-Goal Strategy

```typescript
// Allocate single investment account to multiple goals
const investmentAccount = getAccount('Investment Account');

// 40% to retirement
await createAllocation(retirementGoal.id, {
  accountId: investmentAccount.id,
  percentage: 40,
});

// 30% to house down payment
await createAllocation(houseGoal.id, {
  accountId: investmentAccount.id,
  percentage: 30,
});

// 30% to education fund
await createAllocation(educationGoal.id, {
  accountId: investmentAccount.id,
  percentage: 30,
});

// Total: 100% of account allocated across 3 goals
```

### Example 3: Progress Dashboard

```typescript
// Get summary for space
const summary = await fetch(`/goals/space/${spaceId}/summary`);

// Display dashboard metrics
console.log(`Active Goals: ${summary.activeGoals}`);
console.log(`Total Target: $${summary.totalTargetAmount.toLocaleString()}`);
console.log(`Current Value: $${summary.totalCurrentValue.toLocaleString()}`);
console.log(`Overall Progress: ${summary.overallProgress}%`);

// Get detailed progress for each goal
const goals = await fetch(`/goals/space/${spaceId}`);
for (const goal of goals) {
  const progress = await fetch(`/goals/${goal.id}/progress`);

  console.log(`\n${goal.name}:`);
  console.log(`  ${progress.percentComplete}% complete`);
  console.log(
    `  ${progress.onTrack ? '✓' : '✗'} ${progress.onTrack ? 'On track' : 'Behind schedule'}`
  );
  console.log(`  Need: $${progress.monthlyContributionNeeded}/month`);
}
```

---

## Business Logic

### Progress Calculation Algorithm

```typescript
// Calculate current value from allocations
currentValue = sum(
  account.balance * (allocation.percentage / 100)
  for each allocation in goal.allocations
)

// Time progress (% of time elapsed)
timeProgress = (now - goal.createdAt) / (goal.targetDate - goal.createdAt) * 100

// Value progress
percentComplete = (currentValue / goal.targetAmount) * 100

// On track determination
expectedValue = goal.targetAmount * (timeProgress / 100)
onTrack = currentValue >= expectedValue * 0.9  // Within 10% tolerance

// Monthly contribution needed
monthsRemaining = (goal.targetDate - now) / (30 days)
remainingAmount = goal.targetAmount - currentValue
monthlyContributionNeeded = remainingAmount / monthsRemaining

// Projected completion (linear projection)
monthlyRate = currentValue / monthsElapsed
monthsToCompletion = remainingAmount / monthlyRate
projectedCompletion = now + (monthsToCompletion * 30 days)
```

### Validation Rules

1. **Account Allocation:**
   - Account must belong to the same space as the goal
   - Total allocation percentage across all goals for an account should not exceed 100% (warning, not enforced)
   - Allocation percentage for a single goal cannot exceed 100%

2. **Goal Creation:**
   - targetAmount must be > 0
   - targetDate must be in the future
   - priority must be between 1-10

3. **Goal Updates:**
   - Cannot change spaceId (would require moving allocations)
   - Status changes are tracked in audit logs

---

## Integration with Premium Features

### Future Integration Points (Week 10-12: Retirement Simulator)

```typescript
// Calculate probability of achieving goal using Monte Carlo
@RequiresPremium()
@Get(':id/probability')
async calculateGoalProbability(@Param('id') goalId: string) {
  const goal = await this.goalsService.findById(goalId);
  const progress = await this.goalsService.calculateProgress(goalId);

  // Monte Carlo simulation (Week 7-9 implementation)
  const simulation = await this.simulationService.runMonteCarloForGoal({
    currentValue: progress.currentValue,
    targetAmount: goal.targetAmount,
    monthsRemaining: monthsBetween(new Date(), goal.targetDate),
    expectedReturn: 0.07,  // 7% annual return
    volatility: 0.15,      // 15% standard deviation
    iterations: 10000
  });

  return {
    goalId,
    probabilityOfSuccess: simulation.successRate,
    medianOutcome: simulation.median,
    percentile10: simulation.p10,
    percentile90: simulation.p90
  };
}
```

---

## Audit Events

All goal operations are logged:

| Event              | Action                    | Severity |
| ------------------ | ------------------------- | -------- |
| Goal created       | `GOAL_CREATED`            | low      |
| Goal updated       | `GOAL_UPDATED`            | low      |
| Goal deleted       | `GOAL_DELETED`            | medium   |
| Allocation added   | `GOAL_ALLOCATION_ADDED`   | low      |
| Allocation removed | `GOAL_ALLOCATION_REMOVED` | low      |

---

## Error Handling

### Common Error Responses

**404 Not Found:**

```json
{
  "statusCode": 404,
  "message": "Goal not found or you do not have access",
  "error": "Not Found"
}
```

**400 Bad Request:**

```json
{
  "statusCode": 400,
  "message": "Total allocation percentage would exceed 100% (current: 70%)",
  "error": "Bad Request"
}
```

**400 Bad Request (Duplicate Allocation):**

```json
{
  "statusCode": 400,
  "message": "Allocation already exists for this account",
  "error": "Bad Request"
}
```

---

## Frontend Implementation Notes

### Recommended UI Components

1. **Goal List** - Display all goals with progress bars
2. **Goal Detail** - Show allocations, progress chart, monthly contribution needed
3. **Goal Form** - Create/edit goal with validation
4. **Allocation Manager** - Drag-and-drop interface for allocating accounts
5. **Progress Dashboard** - Overview with summary metrics

### State Management

```typescript
// Redux/Zustand store structure
interface GoalsState {
  goals: Goal[];
  selectedGoal: Goal | null;
  summary: GoalSummary | null;
  loading: boolean;
  error: string | null;
}

// Actions
-fetchGoalsBySpace(spaceId) -
  fetchGoalProgress(goalId) -
  createGoal(dto) -
  updateGoal(goalId, dto) -
  deleteGoal(goalId) -
  addAllocation(goalId, dto) -
  removeAllocation(goalId, accountId);
```

### Visualization Ideas

1. **Progress Circle Chart** - Circular progress indicator with percentage
2. **Timeline View** - Show goals on a timeline with target dates
3. **Allocation Pie Chart** - Show how accounts are allocated to goals
4. **Progress Trend** - Line chart showing goal value over time (requires historical snapshots)
5. **On Track Indicator** - Green/yellow/red badge based on progress vs time

---

## Testing Checklist

- [ ] Create goal with all required fields
- [ ] Create goal with optional fields (description, notes)
- [ ] Update goal fields individually
- [ ] Update goal status (active → paused → active → achieved)
- [ ] Delete goal (should cascade delete allocations)
- [ ] Add allocation to goal
- [ ] Add multiple allocations (verify total <= 100%)
- [ ] Attempt to add allocation >100% (should fail)
- [ ] Remove allocation from goal
- [ ] Calculate progress with no allocations (should be 0%)
- [ ] Calculate progress with single allocation
- [ ] Calculate progress with multiple allocations
- [ ] Verify "on track" indicator accuracy
- [ ] Verify monthly contribution calculation
- [ ] Test access control (user cannot access other space's goals)
- [ ] Test goal summary calculation
- [ ] Verify audit logs are created

---

## Migration Path

```bash
# Run migration
pnpm --filter @dhanam/api db:migrate:dev --name add_goal_tracking

# Verify schema
pnpm --filter @dhanam/api prisma studio

# Seed demo goals (optional)
# Add to prisma/seed.ts:
await prisma.goal.create({
  data: {
    spaceId: demoSpace.id,
    name: "Retirement Fund",
    type: "retirement",
    targetAmount: 1000000,
    currency: "USD",
    targetDate: new Date("2045-12-31"),
    priority: 1
  }
});
```

---

## Next Steps

1. **Frontend Dashboard** (Week 4-6 pending)
   - Build goal list component
   - Create goal form with validation
   - Implement allocation manager UI
   - Add progress visualization charts

2. **Monte Carlo Integration** (Week 7-9)
   - Add probability calculation endpoint
   - Integrate with retirement simulator
   - Show probability of success in UI

3. **Enhanced Analytics** (Future)
   - Historical goal progress snapshots
   - Trend analysis over time
   - Goal recommendation engine
   - Automatic rebalancing suggestions

---

**Documentation Version:** 1.0
**Last Updated:** 2025-11-19
**Module:** `apps/api/src/modules/goals`
