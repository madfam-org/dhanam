# Zero-Based Allocation Feature

**Status:** Implemented
**Date:** November 20, 2025
**Related Analysis:** _(removed — audit reports archived)_

## Overview

Zero-Based Allocation is a budgeting methodology (popularized by YNAB) where every dollar of income must be allocated to a category. This ensures users actively plan their spending rather than passively tracking it.

## Key Features

### 1. Income Tracking

- Each budget now tracks monthly/periodic income
- Income field added to Budget model (`apps/api/prisma/schema.prisma:450`)

### 2. Ready to Assign Calculation

- Formula: `Ready to Assign = Income + Total Carryover - Total Budgeted`
- Warns users when `Ready to Assign > 0`
- Prevents over-allocation

### 3. Carryover Balances

- Unspent category funds can roll over to next budget period
- `carryoverAmount` field added to Category model (`schema.prisma:408`)
- Rollover method: `POST /spaces/:spaceId/budgets/:id/rollover`

### 4. Allocation Workflow

- Users set income: `PATCH /spaces/:spaceId/budgets/:id/income`
- Allocate funds to categories: `POST /spaces/:spaceId/budgets/:id/allocate`
- System enforces allocation constraints

## Database Schema Changes

### Budget Model

```prisma
model Budget {
  // ... existing fields
  income  Decimal  @default(0) @db.Decimal(19, 4)
  // ...
}
```

### Category Model

```prisma
model Category {
  // ... existing fields
  carryoverAmount  Decimal  @default(0) @map("carryover_amount") @db.Decimal(19, 4)
  // ...
}
```

## API Endpoints

### Update Budget Income

```http
PATCH /spaces/:spaceId/budgets/:id/income
Content-Type: application/json

{
  "income": 5000.00
}
```

### Allocate Funds to Category

```http
POST /spaces/:spaceId/budgets/:id/allocate
Content-Type: application/json

{
  "categoryId": "uuid-here",
  "amount": 500.00
}
```

**Validation:**

- Checks if `amount <= readyToAssign`
- Throws `ConflictException` if insufficient funds

### Rollover Unspent Funds

```http
POST /spaces/:spaceId/budgets/:id/rollover
Content-Type: application/json

{
  "newBudgetId": "uuid-of-next-budget"
}
```

**Logic:**

1. Calculate unspent for each category in old budget
2. Find matching categories by name in new budget
3. Add unspent to `carryoverAmount` in new budget categories

## Frontend Component

### ReadyToAssign Component

**Location:** `apps/web/src/components/budgets/ready-to-assign.tsx`

**Features:**

- Visual indicator when funds are unassigned (orange alert)
- Success indicator when fully allocated (green checkmark)
- Quick income update UI
- Quick allocation dropdown for categories
- Real-time calculation display

**Usage:**

```tsx
import { ReadyToAssign } from '@/components/budgets/ready-to-assign';

<ReadyToAssign
  budgetId={budget.id}
  income={budget.income}
  totalBudgeted={summary.totalBudgeted}
  totalCarryover={summary.totalCarryover}
  readyToAssign={summary.readyToAssign}
  categories={budget.categories}
  onUpdateIncome={handleUpdateIncome}
  onAllocateFunds={handleAllocateFunds}
/>;
```

## Backend Implementation

### Service Methods

**File:** `apps/api/src/modules/budgets/budgets.service.ts`

#### `updateIncome()`

- Updates budget income amount
- Requires `member` permission

#### `allocateFunds()`

- Increments category `budgetedAmount`
- Validates sufficient funds available
- Prevents over-allocation

#### `rolloverBudget()`

- Transfers unspent balances to next period
- Matches categories by name
- Creates carryover amounts

### Updated getBudgetSummary()

Now returns:

```typescript
{
  summary: {
    totalBudgeted: number;
    totalSpent: number;
    totalRemaining: number;
    totalPercentUsed: number;
    totalIncome: number; // NEW
    readyToAssign: number; // NEW
    totalCarryover: number; // NEW
  }
}
```

## Migration Instructions

### For Development

```bash
cd apps/api
npx prisma db push
```

### For Production

```bash
cd apps/api
npx prisma migrate dev --name add_zero_based_allocation
npx prisma migrate deploy
```

**Migration SQL:**

```sql
-- Add income to budgets
ALTER TABLE budgets ADD COLUMN income DECIMAL(19,4) DEFAULT 0 NOT NULL;

-- Add carryover_amount to categories
ALTER TABLE categories ADD COLUMN carryover_amount DECIMAL(19,4) DEFAULT 0 NOT NULL;
```

## Testing

### Manual Testing Steps

1. Create a budget
2. Set income: `PATCH /budgets/:id/income { "income": 5000 }`
3. Verify `readyToAssign = 5000` in budget summary
4. Create categories with `budgetedAmount` totaling $3000
5. Verify `readyToAssign = 2000`
6. Attempt to allocate $3000 (should fail with ConflictException)
7. Allocate remaining $2000 successfully
8. Verify `readyToAssign = 0`
9. Create next month's budget
10. Rollover unspent funds
11. Verify `carryoverAmount` in new budget categories

### Automated Tests

**Location:** `apps/api/src/modules/budgets/__tests__/budgets.service.spec.ts`

Add tests for:

- [ ] `updateIncome()` - valid income update
- [ ] `updateIncome()` - unauthorized user
- [ ] `allocateFunds()` - successful allocation
- [ ] `allocateFunds()` - over-allocation (should fail)
- [ ] `rolloverBudget()` - correct carryover calculation
- [ ] `getBudgetSummary()` - includes readyToAssign

## Implementation Impact

### Addresses Market Gap

From _(removed — audit reports archived)_:

**Gap Closed:** Zero-Based Allocation (Tier 1 Critical Gap)

- **Business Impact:** HIGH - YNAB's #1 feature
- **Complexity:** LOW (as predicted)
- **Timeline:** 1-2 weeks (achieved ✅)

### Competitive Positioning

- **vs YNAB:** Feature parity on zero-based methodology
- **vs Monarch:** Differentiation (Monarch doesn't enforce allocation)
- **vs Kubera:** Not applicable (wealth tracking focus)

## Future Enhancements

1. **Auto-Allocation Rules**
   - "Allocate $X to Category Y every month"
   - Templates for recurring allocations

2. **Goals Integration**
   - Link categories to financial goals
   - Show goal progress when allocating

3. **Predictive Allocation**
   - ML-based suggestions: "You usually allocate $500 to Groceries"
   - Learn from past allocation patterns

4. **Mobile Quick Entry**
   - Voice command: "Allocate $100 to Dining"
   - Siri Shortcuts integration

5. **Allocation History**
   - Track allocation changes over time
   - Audit trail for budget modifications

## References

- **YNAB Methodology:** https://www.ynab.com/the-four-rules
- **Zero-Based Budgeting:** https://en.wikipedia.org/wiki/Zero-based_budgeting
- **Market Analysis:** _(removed — audit reports archived)_

---

**Implementation Complete:** ✅
**Migration Status:** Schema updated, manual migration required
**Documentation:** Complete
