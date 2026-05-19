# Transaction Execution Module

> Transaction creation, updates, and deletion with balance synchronization and audit logging.

## Purpose

The Transaction Execution module handles the write operations for transactions:

- **Transaction Creation**: Manual entry with auto-categorization
- **Balance Updates**: Automatic account balance recalculation
- **Audit Logging**: Track all transaction modifications
- **Validation**: Ensure data integrity and business rules

## Key Entities

| Entity                           | Description                       |
| -------------------------------- | --------------------------------- |
| `TransactionExecutionService`    | Core transaction write operations |
| `TransactionExecutionController` | REST endpoint handlers            |

## API Endpoints

| Endpoint                        | Method | Description                 |
| ------------------------------- | ------ | --------------------------- |
| `/transactions`                 | POST   | Create new transaction      |
| `/transactions/:id`             | PUT    | Update existing transaction |
| `/transactions/:id`             | DELETE | Delete transaction          |
| `/transactions/bulk`            | POST   | Bulk create transactions    |
| `/transactions/bulk-categorize` | POST   | Bulk update categories      |

## Service Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 Transaction Execution Module                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │            TransactionExecutionController                 │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │                                      │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │             TransactionExecutionService                   │   │
│  │  • Create/Update/Delete transactions                     │   │
│  │  • Update account balances                               │   │
│  │  • Trigger auto-categorization                           │   │
│  │  • Log to audit trail                                    │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │                                      │
│         ┌─────────────────┼─────────────────┐                   │
│         ▼                 ▼                 ▼                   │
│  ┌──────────┐     ┌───────────┐     ┌──────────┐               │
│  │ Prisma   │     │    ML     │     │  Audit   │               │
│  │ Service  │     │ Categorize│     │ Service  │               │
│  └──────────┘     └───────────┘     └──────────┘               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Create Transaction

```
1. Validate request data
2. Verify user access to account
3. Create transaction record
4. Trigger ML auto-categorization
5. Update account balance (additive)
6. Create audit log entry
7. Return created transaction
```

### Update Transaction

```
1. Validate request data
2. Get existing transaction
3. Calculate balance delta (new - old amount)
4. Update transaction record
5. Apply balance delta to account
6. Create audit log entry
7. Return updated transaction
```

### Delete Transaction

```
1. Get existing transaction
2. Verify user access
3. Reverse balance impact (subtract amount)
4. Delete transaction record
5. Create audit log entry
6. Return success
```

## Balance Synchronization

| Operation        | Balance Update         |
| ---------------- | ---------------------- |
| Create (expense) | balance -= amount      |
| Create (income)  | balance += amount      |
| Update           | balance += (new - old) |
| Delete           | balance -= amount      |

## Validation Rules

| Rule              | Description                   |
| ----------------- | ----------------------------- |
| Amount required   | Must be non-zero number       |
| Date required     | Must be valid date            |
| Account required  | Must reference valid account  |
| Category optional | Auto-assigned if not provided |
| Description limit | Max 500 characters            |

## Error Handling

| Error                 | HTTP Status | Description               |
| --------------------- | ----------- | ------------------------- |
| Account not found     | 404         | Invalid account ID        |
| Transaction not found | 404         | Invalid transaction ID    |
| Access denied         | 403         | User lacks account access |
| Validation failed     | 400         | Invalid request data      |

## Configuration

```typescript
// Auto-categorization threshold
AUTO_CATEGORIZE_CONFIDENCE = 0.9;

// Bulk operation limits
MAX_BULK_CREATE = 500;
MAX_BULK_CATEGORIZE = 1000;
```

## Related Modules

| Module                                      | Relationship        |
| ------------------------------------------- | ------------------- |
| [`transactions`](../transactions/README.md) | Read operations     |
| [`accounts`](../accounts/README.md)         | Balance updates     |
| [`ml`](../ml/README.md)                     | Auto-categorization |
| [`categories`](../categories/README.md)     | Category assignment |

## Testing

```bash
# Run transaction execution tests
pnpm test -- transaction-execution

# Test balance updates
pnpm test -- transaction-execution.service.spec.ts
```

---

**Module**: `transaction-execution`
**Last Updated**: January 2025
