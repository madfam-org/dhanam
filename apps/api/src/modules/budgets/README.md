# Budgets Module

> YNAB-style envelope budgeting with zero-based allocation, income tracking, and period rollover support.

## Purpose

The Budgets module implements envelope budgeting methodology where users allocate their income to specific categories before spending. It supports multiple budget periods, tracks spending against allocations, calculates "Ready to Assign" funds, and enables unspent funds to roll over between budget periods.

## Key Entities

| Entity      | Description                                                  |
| ----------- | ------------------------------------------------------------ |
| Budget      | Budget period with income, date range, and rollover settings |
| Category    | Budget envelope with allocated amount and carryover funds    |
| Transaction | Spending tracked against categories within budget periods    |

## Budget Periods

| Period      | Duration       |
| ----------- | -------------- |
| `daily`     | 1 day          |
| `weekly`    | 7 days         |
| `monthly`   | Calendar month |
| `quarterly` | 3 months       |
| `yearly`    | 12 months      |

## API Endpoints

| Endpoint                                | Method | Description                              |
| --------------------------------------- | ------ | ---------------------------------------- |
| `/spaces/:spaceId/budgets`              | GET    | List all budgets in space                |
| `/spaces/:spaceId/budgets`              | POST   | Create new budget period                 |
| `/spaces/:spaceId/budgets/:id`          | GET    | Get budget details with categories       |
| `/spaces/:spaceId/budgets/:id`          | PATCH  | Update budget settings                   |
| `/spaces/:spaceId/budgets/:id`          | DELETE | Delete budget (cascades categories)      |
| `/spaces/:spaceId/budgets/:id/summary`  | GET    | Get budget summary with spending details |
| `/spaces/:spaceId/budgets/:id/income`   | PATCH  | Update budget income for allocation      |
| `/spaces/:spaceId/budgets/:id/allocate` | POST   | Allocate funds to a category             |
| `/spaces/:spaceId/budgets/:id/rollover` | POST   | Roll over unspent funds to next period   |

## Service Architecture

```
BudgetsController
       |
       v
BudgetsService
       |
       +---> PrismaService (database operations)
       +---> SpacesService (access verification)
```

## Data Flow

**Budget Creation:**

1. User specifies name, period, and start date
2. End date auto-calculated based on period if not provided
3. System validates no overlapping budgets for same period type
4. Budget created with initial income of 0

**Zero-Based Allocation:**

1. User updates budget income via `/income` endpoint
2. System calculates "Ready to Assign" = Income + Carryover - Total Budgeted
3. User allocates funds to categories via `/allocate`
4. Allocation fails if amount exceeds Ready to Assign

**Budget Summary Calculation:**

```
For each category:
  spent = sum(transactions in period)
  remaining = budgetedAmount + carryoverAmount - spent
  percentUsed = (spent / (budgetedAmount + carryoverAmount)) * 100

Overall:
  totalBudgeted = sum(category.budgetedAmount)
  totalCarryover = sum(category.carryoverAmount)
  totalSpent = sum(category.spent)
  readyToAssign = income + totalCarryover - totalBudgeted
```

**Period Rollover:**

1. User initiates rollover from source to target budget
2. For each category, unspent amount calculated
3. Matching categories in new budget receive carryover increment
4. Categories matched by name between budget periods

## Error Handling

| Error                   | HTTP Status | Description                            |
| ----------------------- | ----------- | -------------------------------------- |
| Budget not found        | 404         | Budget does not exist in space         |
| Period overlap          | 409         | Budget period overlaps existing budget |
| Insufficient funds      | 409         | Allocation exceeds Ready to Assign     |
| Category not found      | 404         | Category not in specified budget       |
| Source/target not found | 404         | Rollover budget not found              |

## Related Modules

| Module       | Relationship                                       |
| ------------ | -------------------------------------------------- |
| Categories   | Categories belong to budgets                       |
| Transactions | Transactions categorized against budget categories |
| Spaces       | Budgets scoped to spaces                           |

## Testing

```bash
# Run budgets module tests
pnpm test -- budgets

# Run with coverage
pnpm test:cov -- budgets
```

---

**Module**: `budgets`
**Last Updated**: January 2025
