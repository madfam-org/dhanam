# Categories Module

> Transaction category management with budget allocation, spending analytics, and visual customization.

## Purpose

The Categories module manages budget envelopes for expense tracking. Each category belongs to a budget and has an allocated amount that spending is tracked against. Categories support visual customization (icons, colors) and provide detailed spending analytics including daily trends and transaction breakdowns.

## Key Entities

| Entity      | Description                                                      |
| ----------- | ---------------------------------------------------------------- |
| Category    | Budget envelope with name, allocated amount, and visual settings |
| Budget      | Parent budget period containing categories                       |
| Transaction | Transactions linked to categories for spending tracking          |

## API Endpoints

| Endpoint                                       | Method | Description                        |
| ---------------------------------------------- | ------ | ---------------------------------- |
| `/spaces/:spaceId/categories`                  | GET    | List all categories in space       |
| `/spaces/:spaceId/categories/budget/:budgetId` | GET    | Get categories for specific budget |
| `/spaces/:spaceId/categories/:id`              | GET    | Get category details               |
| `/spaces/:spaceId/categories/:id/spending`     | GET    | Get detailed spending analytics    |
| `/spaces/:spaceId/categories`                  | POST   | Create new category                |
| `/spaces/:spaceId/categories/:id`              | PATCH  | Update category                    |
| `/spaces/:spaceId/categories/:id`              | DELETE | Delete category                    |

## Service Architecture

```
CategoriesController
       |
       v
CategoriesService
       |
       +---> PrismaService (database operations)
       +---> SpacesService (access verification)
```

## Data Flow

**Category Creation:**

1. User specifies budget ID, name, and initial allocation
2. Service verifies budget belongs to space
3. Category created with optional icon, color, description
4. Color auto-generated from preset palette if not provided

**Spending Analytics (`/spending` endpoint):**

```
Returns:
  - totalBudgeted: category allocation
  - totalSpent: sum of transactions in budget period
  - remaining: totalBudgeted - totalSpent
  - percentUsed: (totalSpent / totalBudgeted) * 100
  - transactionCount: number of transactions
  - averageTransaction: totalSpent / transactionCount
  - dailySpending: { [date]: amount } trend data
  - transactions: last 10 transactions for review
```

**Category Deletion:**

1. Service verifies category exists in space
2. All transactions referencing category have `categoryId` set to null
3. Category deleted from database
4. Requires admin role on space

## Category Properties

| Property          | Type    | Description                       |
| ----------------- | ------- | --------------------------------- |
| `name`            | string  | Display name for category         |
| `budgetedAmount`  | decimal | Allocated funds for this envelope |
| `carryoverAmount` | decimal | Rolled over from previous period  |
| `icon`            | string  | Optional icon identifier          |
| `color`           | string  | Hex color code (e.g., `#3b82f6`)  |
| `description`     | string  | Optional description              |

## Available Colors

The system provides 17 preset colors when auto-generating:

```
red, orange, amber, yellow, lime, green, emerald,
teal, cyan, sky, blue, indigo, violet, purple,
fuchsia, pink, rose
```

## Error Handling

| Error                    | HTTP Status | Description                      |
| ------------------------ | ----------- | -------------------------------- |
| Category not found       | 404         | Category does not exist in space |
| Budget not found         | 403         | Budget not found or not in space |
| Insufficient permissions | 403         | User lacks required role         |

## Related Modules

| Module       | Relationship                           |
| ------------ | -------------------------------------- |
| Budgets      | Categories belong to budgets           |
| Transactions | Transactions categorized to categories |
| Spaces       | Categories scoped via budget to spaces |

## Testing

```bash
# Run categories module tests
pnpm test -- categories

# Run with coverage
pnpm test:cov -- categories
```

---

**Module**: `categories`
**Last Updated**: January 2025
