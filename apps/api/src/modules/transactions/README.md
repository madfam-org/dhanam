# Transactions Module

> Transaction management with filtering, pagination, bulk categorization, and automatic balance updates.

## Purpose

The Transactions module handles all financial transaction operations including manual entry, provider-synced imports, category assignment, and bulk operations. It maintains account balance integrity by automatically adjusting balances on transaction create, update, and delete operations.

## Key Entities

| Entity      | Description                                                     |
| ----------- | --------------------------------------------------------------- |
| Transaction | Financial transaction with amount, date, merchant, and metadata |
| Account     | Parent account holding the transaction                          |
| Category    | Optional budget category for expense tracking                   |

## API Endpoints

| Endpoint                                        | Method | Description                                     |
| ----------------------------------------------- | ------ | ----------------------------------------------- |
| `/spaces/:spaceId/transactions`                 | GET    | List transactions with filtering and pagination |
| `/spaces/:spaceId/transactions/:id`             | GET    | Get transaction details                         |
| `/spaces/:spaceId/transactions`                 | POST   | Create manual transaction                       |
| `/spaces/:spaceId/transactions/:id`             | PATCH  | Update transaction                              |
| `/spaces/:spaceId/transactions/:id`             | DELETE | Delete transaction                              |
| `/spaces/:spaceId/transactions/bulk-categorize` | POST   | Bulk categorize multiple transactions           |

## Filter Options

| Parameter    | Type   | Description                               |
| ------------ | ------ | ----------------------------------------- |
| `accountId`  | UUID   | Filter by specific account                |
| `categoryId` | UUID   | Filter by category                        |
| `startDate`  | Date   | Transactions on or after date             |
| `endDate`    | Date   | Transactions on or before date            |
| `minAmount`  | number | Minimum transaction amount                |
| `maxAmount`  | number | Maximum transaction amount                |
| `sortBy`     | enum   | Sort field: `amount`, `date`, `createdAt` |
| `sortOrder`  | enum   | Sort direction: `asc`, `desc`             |
| `page`       | number | Page number (default: 1)                  |
| `limit`      | number | Items per page (default: 20, max: 100)    |

## Service Architecture

```
TransactionsController
       |
       v
TransactionsService
       |
       +---> PrismaService (database operations)
       +---> SpacesService (access verification)
```

## Data Flow

**Transaction Creation:**

1. User submits transaction details (account, amount, date, description)
2. Service verifies account belongs to space
3. If categoryId provided, verify category belongs to space
4. Transaction created with account's currency
5. Account balance automatically incremented by amount
6. Negative amounts represent outflows (expenses)

**Transaction Update:**

1. Service retrieves existing transaction
2. If categoryId changed, verify new category belongs to space
3. If amount changed, calculate difference and adjust account balance
4. Transaction updated with new values

**Transaction Deletion:**

1. Service retrieves transaction
2. Account balance decremented by transaction amount
3. Transaction deleted from database

**Bulk Categorization:**

1. User provides list of transaction IDs and target category
2. Service verifies all transactions belong to space
3. Service verifies category belongs to space
4. All transactions updated with new categoryId in single operation

## Response Format

**List Response:**

```json
{
  "data": [Transaction],
  "total": 150,
  "page": 1,
  "limit": 20
}
```

**Transaction Object:**

```json
{
  "id": "uuid",
  "accountId": "uuid",
  "amount": -50.00,
  "currency": "MXN",
  "date": "2025-01-15T00:00:00Z",
  "description": "Grocery purchase",
  "merchant": "Walmart",
  "categoryId": "uuid",
  "metadata": {},
  "account": { ... },
  "category": { ... }
}
```

## Error Handling

| Error                     | HTTP Status | Description                         |
| ------------------------- | ----------- | ----------------------------------- |
| Transaction not found     | 404         | Transaction does not exist in space |
| Account not found         | 403         | Account not found or not in space   |
| Category not found        | 403         | Category not found or not in space  |
| Partial transaction match | 403         | Some bulk transactions not in space |

## Related Modules

| Module     | Relationship                                    |
| ---------- | ----------------------------------------------- |
| Accounts   | Transactions belong to accounts                 |
| Categories | Transactions optionally linked to categories    |
| Budgets    | Category spending tracked within budget periods |
| Spaces     | Transactions scoped via account to spaces       |

## Testing

```bash
# Run transactions module tests
pnpm test -- transactions

# Run with coverage
pnpm test:cov -- transactions
```

---

**Module**: `transactions`
**Last Updated**: January 2025
