# ML Module

> Machine learning services for intelligent transaction categorization, merchant normalization, and provider selection.

## Purpose

The ML module provides AI-powered features that learn from user behavior to improve the financial management experience:

- **Transaction Categorization**: Automatically categorize transactions based on historical patterns
- **User Correction Loop**: Learn from user corrections to improve future predictions
- **Merchant Normalization**: Standardize merchant names across different sources
- **Fuzzy Matching**: Find similar merchants using Levenshtein distance and pattern matching
- **Provider Selection**: Use ML to choose optimal financial data provider
- **Split Prediction**: Predict likely transaction splits based on patterns

## Key Entities

| Service                            | Description                       |
| ---------------------------------- | --------------------------------- |
| `TransactionCategorizationService` | Core categorization engine        |
| `CorrectionService`                | User correction recording         |
| `CorrectionAggregatorService`      | Pattern learning from corrections |
| `MerchantNormalizerService`        | Merchant name standardization     |
| `FuzzyMatcherService`              | String similarity algorithms      |
| `ProviderSelectionService`         | ML-based provider selection       |
| `SplitPredictionService`           | Transaction split suggestions     |

## Service Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   Transaction Categorization                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Input: { description, merchant, amount }                        │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Multi-Strategy Prediction                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                            │                                     │
│         ┌──────────┬───────┼───────┬──────────┐                 │
│         ▼          ▼       ▼       ▼          ▼                 │
│  ┌──────────┐ ┌─────────┐ ┌────┐ ┌─────────┐ ┌────────┐        │
│  │Correction│ │Merchant │ │Fuzzy│ │ Keyword │ │ Amount │        │
│  │ Patterns │ │  Match  │ │Match│ │  Match  │ │ Pattern│        │
│  │ (0.7-1.0)│ │(0.7-0.95)│(0.75)│ │  (0.7)  │ │ (0.5)  │        │
│  └────┬─────┘ └────┬────┘ └──┬──┘ └────┬────┘ └───┬────┘        │
│       │            │         │         │          │             │
│       └────────────┴─────────┴─────────┴──────────┘             │
│                            │                                     │
│                            ▼                                     │
│                 Best prediction with confidence                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Categorization Strategies

The categorization service uses multiple strategies in priority order:

| Priority | Strategy            | Confidence | Description                              |
| -------- | ------------------- | ---------- | ---------------------------------------- |
| 1        | Correction Patterns | 0.7-1.0    | Learned from user corrections            |
| 2        | Exact Merchant      | 0.7-0.95   | Historical merchant→category mapping     |
| 3        | Fuzzy Merchant      | 0.75       | Similar merchant match using Levenshtein |
| 4        | Keyword Match       | 0.7        | Description keyword analysis             |
| 5        | Amount Pattern      | 0.5        | Statistical amount range matching        |

### Auto-Categorization Threshold

Transactions are automatically categorized only when confidence ≥ 0.9 (HIGH_CONFIDENCE).

## API Endpoints

| Endpoint                | Method | Description                             |
| ----------------------- | ------ | --------------------------------------- |
| `/ml/categorize`        | POST   | Get category prediction for transaction |
| `/ml/corrections`       | POST   | Record user category correction         |
| `/ml/accuracy`          | GET    | Get categorization accuracy metrics     |
| `/ml/patterns/:spaceId` | GET    | Get learned patterns for a space        |

## Data Flow

### Categorization Flow

```
1. New transaction arrives
2. Extract: description, merchant, amount
3. Run through all strategies
4. Return best prediction (or null)
5. If confidence ≥ 0.9, auto-apply category
```

### Correction Learning Flow

```
1. User corrects transaction category
2. Record correction with context
3. Aggregator analyzes correction patterns
4. Pattern stored with confidence weight
5. Future predictions use learned pattern
```

## Merchant Normalization

The normalizer standardizes merchant names:

| Input                 | Output        |
| --------------------- | ------------- |
| `AMZN MKTP US*ABC123` | `Amazon`      |
| `UBER *EATS US JAN01` | `Uber Eats`   |
| `PAYPAL *NETFLIX`     | `Netflix`     |
| `SQ *COFFEE SHOP`     | `Coffee Shop` |

### Pattern Extraction

```typescript
// Extract pattern key (removes numbers, IDs)
'AMZN MKTP US*ABC123' → 'AMZN MKTP'
'UBER *EATS 12345' → 'UBER EATS'
```

## Fuzzy Matching

The fuzzy matcher combines multiple algorithms:

| Algorithm    | Weight | Purpose           |
| ------------ | ------ | ----------------- |
| Levenshtein  | 40%    | Edit distance     |
| Jaccard      | 30%    | Word overlap      |
| Prefix Match | 30%    | Common beginnings |

### Match Threshold

Minimum combined similarity: **0.75**

## Provider Selection

ML-based provider selection considers:

- Historical success rate per provider/institution
- Average response time
- User's past experience
- Circuit breaker state
- Time of day patterns

## Error Handling

| Error          | Handling                                |
| -------------- | --------------------------------------- |
| No prediction  | Return null (user categorizes manually) |
| Low confidence | Flag for review, don't auto-categorize  |
| Database error | Log and fail gracefully                 |

## Configuration

```typescript
// Confidence thresholds
HIGH_CONFIDENCE = 0.9; // Auto-categorize
MEDIUM_CONFIDENCE = 0.7; // Suggest category
LOW_CONFIDENCE = 0.5; // Low-priority suggestion

// Pattern requirements
MIN_MERCHANT_COUNT = 3; // Transactions needed for merchant pattern
MIN_KEYWORD_OVERLAP = 0.3; // Minimum keyword match ratio
```

## Accuracy Metrics

```typescript
interface CategorizationAccuracy {
  totalAutoCategorized: number;
  averageConfidence: string;
  period: string;
  correctionRate?: number; // % of auto-categorized later corrected
}
```

## Related Modules

| Module                                                          | Relationship                                |
| --------------------------------------------------------------- | ------------------------------------------- |
| [`transactions`](../transactions/README.md)                     | Triggers categorization on new transactions |
| [`categories`](../categories/README.md)                         | Category entity management                  |
| [`providers/orchestrator`](../providers/orchestrator/README.md) | Uses provider selection service             |
| [`budgets`](../budgets/README.md)                               | Categories linked to budgets                |

## Testing

```bash
# Run ML module tests
pnpm test -- ml

# Test specific service
pnpm test -- ml/transaction-categorization
pnpm test -- ml/fuzzy-matcher

# Coverage report
pnpm test:coverage -- ml
```

## Future Enhancements

- [ ] Deep learning model for complex descriptions
- [ ] Multi-language merchant normalization
- [ ] Transfer learning between users (privacy-preserving)
- [ ] Anomaly detection for unusual transactions
- [ ] Recurring transaction detection

---

**Module**: `ml`
**Last Updated**: January 2025
