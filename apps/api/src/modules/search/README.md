# Search Module

> Natural language search and query interface for transactions, accounts, and financial data.

## Purpose

The Search module provides intelligent search capabilities:

- **Natural Language Queries**: Parse human language into structured filters
- **Transaction Search**: Full-text search across transaction descriptions
- **Cross-Entity Search**: Search accounts, transactions, categories, goals
- **Context-Aware**: Results filtered by user's accessible spaces

## Key Entities

| Service                  | Description                      |
| ------------------------ | -------------------------------- |
| `SearchController`       | REST endpoint handlers           |
| `NaturalLanguageService` | Query parsing and interpretation |

## API Endpoints

| Endpoint               | Method | Description                       |
| ---------------------- | ------ | --------------------------------- |
| `/search`              | GET    | Global search across all entities |
| `/search/transactions` | GET    | Transaction-specific search       |
| `/search/natural`      | POST   | Natural language query processing |

## Service Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Search Module                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   SearchController                        │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │                                      │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               NaturalLanguageService                      │   │
│  │  • Parse natural language queries                        │   │
│  │  • Extract filters (date, amount, category)              │   │
│  │  • Convert to structured Prisma queries                  │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │                                      │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    PrismaService                          │   │
│  │  • Full-text search                                       │   │
│  │  • Filtered queries                                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Natural Language Examples

| Query                 | Parsed Filters                       |
| --------------------- | ------------------------------------ |
| "coffee last month"   | merchant: coffee, date: last 30 days |
| "spending over $100"  | amount: > 100, type: expense         |
| "groceries this week" | category: groceries, date: this week |
| "income from January" | type: income, date: January          |

## Search Features

- **Fuzzy Matching**: Finds similar terms (typo tolerance)
- **Date Parsing**: "last week", "this month", "January 2025"
- **Amount Ranges**: "over $50", "between $100 and $500"
- **Category Detection**: Maps common terms to category names

## Error Handling

| Error         | HTTP Status | Description               |
| ------------- | ----------- | ------------------------- |
| Invalid query | 400         | Cannot parse search query |
| No results    | 200         | Empty results array       |
| Access denied | 403         | User lacks space access   |

## Related Modules

| Module                                      | Relationship                    |
| ------------------------------------------- | ------------------------------- |
| [`transactions`](../transactions/README.md) | Primary search target           |
| [`accounts`](../accounts/README.md)         | Account search support          |
| [`categories`](../categories/README.md)     | Category-based filtering        |
| [`ml`](../ml/README.md)                     | Query understanding enhancement |

## Testing

```bash
# Run search tests
pnpm test -- search

# Test natural language service
pnpm test -- natural-language.service.spec.ts
```

---

**Module**: `search`
**Last Updated**: January 2025
