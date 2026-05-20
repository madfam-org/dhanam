# AI-Driven Categorization Guide

> Machine learning-powered transaction categorization with user learning loop.

## Overview

Dhanam uses a multi-stage categorization engine that combines machine learning, fuzzy matching, and rule-based logic to automatically categorize transactions. The system learns from user corrections to improve accuracy over time.

## Categorization Pipeline

```
Transaction → Merchant Normalization → ML Prediction → Rule Matching → Final Category
                      ↑                      ↓
                      └──── User Corrections ←┘
```

### Stage 1: Merchant Normalization

Raw merchant names are normalized for consistent matching:

```typescript
// Input: "STARBUCKS #12345 SAN FRANCISCO CA"
// Output: "starbucks"

function normalizeMerchant(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/\d+/g, '') // Remove numbers
    .trim()
    .split(' ')[0]; // Take first word
}
```

### Stage 2: ML Prediction

A trained model predicts category based on:

- Normalized merchant name
- Transaction amount
- Transaction description
- Historical patterns

**Model Architecture:**

- Algorithm: Gradient Boosted Trees (XGBoost)
- Features: TF-IDF on merchant + amount buckets + time features
- Output: Category ID with confidence score

### Stage 3: Rule Matching

User-defined rules can override ML predictions:

```typescript
interface CategorizationRule {
  id: string;
  spaceId: string;
  categoryId: string;
  condition: 'merchant_contains' | 'merchant_equals' | 'description_contains' | 'amount_range';
  value: string;
  priority: number; // Higher = checked first
}
```

### Stage 4: Final Category Assignment

```typescript
function categorize(transaction: Transaction): string {
  // 1. Check exact merchant match from corrections
  const exactMatch = findExactMerchantMatch(transaction.merchantName);
  if (exactMatch) return exactMatch.categoryId;

  // 2. Check user-defined rules
  const ruleMatch = findMatchingRule(transaction);
  if (ruleMatch) return ruleMatch.categoryId;

  // 3. ML prediction with confidence threshold
  const prediction = mlPredict(transaction);
  if (prediction.confidence >= 0.75) return prediction.categoryId;

  // 4. Fuzzy merchant matching
  const fuzzyMatch = findFuzzyMerchantMatch(transaction.merchantName);
  if (fuzzyMatch) return fuzzyMatch.categoryId;

  // 5. Default to uncategorized
  return 'uncategorized';
}
```

## Fuzzy Matching

Uses Levenshtein distance for approximate merchant matching:

```typescript
function findFuzzyMerchantMatch(merchant: string): CategoryMatch | null {
  const normalized = normalizeMerchant(merchant);
  const threshold = 0.85; // Similarity threshold

  for (const known of knownMerchants) {
    const similarity =
      1 -
      levenshtein(normalized, known.normalized) /
        Math.max(normalized.length, known.normalized.length);

    if (similarity >= threshold) {
      return {
        categoryId: known.categoryId,
        confidence: similarity,
        matchedMerchant: known.name,
      };
    }
  }

  return null;
}
```

## User Correction Flow

### Submitting Corrections

When a user recategorizes a transaction:

```http
POST /ml/corrections
Content-Type: application/json

{
  "transactionId": "txn_456",
  "correctedCategoryId": "cat_business",
  "applyToSimilar": true
}
```

### Correction Aggregation

Corrections are aggregated with weighted scoring:

```typescript
interface CorrectionAggregate {
  normalizedMerchant: string;
  categoryVotes: Map<
    string,
    {
      count: number;
      weight: number;
      lastVote: Date;
    }
  >;
}

function calculateWeight(correction: Correction): number {
  // More recent corrections have higher weight
  const recencyWeight = Math.exp(-daysSince(correction.createdAt) / 30);

  // User-specific trust score
  const userWeight = getUserTrustScore(correction.userId);

  return recencyWeight * userWeight;
}
```

### Apply to Similar Transactions

When `applyToSimilar: true`, the system:

1. Finds transactions with same normalized merchant
2. Updates uncategorized or low-confidence transactions
3. Creates merchant → category mapping for future use

```typescript
async function applyToSimilar(correction: Correction): Promise<number> {
  const normalized = normalizeMerchant(correction.merchantName);

  const similar = await prisma.transaction.findMany({
    where: {
      spaceId: correction.spaceId,
      normalizedMerchant: normalized,
      OR: [{ categoryId: null }, { categoryConfidence: { lt: 0.75 } }],
    },
  });

  await prisma.transaction.updateMany({
    where: { id: { in: similar.map((t) => t.id) } },
    data: {
      categoryId: correction.correctedCategoryId,
      categorySource: 'user_correction',
      categoryConfidence: 1.0,
    },
  });

  return similar.length;
}
```

## ML Retrain Process

The model is retrained nightly via BullMQ job:

### Retrain Job

```typescript
// apps/api/src/modules/ml/ml-retrain.processor.ts
@Processor('ml-retrain')
export class MlRetrainProcessor {
  @Process()
  async handleRetrain(job: Job) {
    // 1. Collect training data
    const data = await this.collectTrainingData();

    // 2. Feature extraction
    const features = this.extractFeatures(data);

    // 3. Train model
    const model = await this.trainModel(features);

    // 4. Validate model
    const metrics = await this.validateModel(model);

    // 5. Deploy if improved
    if (metrics.accuracy > this.currentModelAccuracy) {
      await this.deployModel(model);
    }

    return { metrics, deployed: metrics.accuracy > this.currentModelAccuracy };
  }
}
```

### Training Data Sources

1. **User Corrections**: Highest weight (explicit feedback)
2. **Historical Categorizations**: Medium weight (implicit approval)
3. **Rule Matches**: Low weight (rule-based, not learned)

### Model Metrics

| Metric    | Target | Current |
| --------- | ------ | ------- |
| Accuracy  | > 85%  | 87.3%   |
| Precision | > 80%  | 82.1%   |
| Recall    | > 80%  | 84.7%   |
| F1 Score  | > 80%  | 83.4%   |

## API Endpoints

### List Corrections

```http
GET /ml/corrections?spaceId=space_123&status=applied
```

### Submit Correction

```http
POST /ml/corrections
{
  "transactionId": "txn_456",
  "correctedCategoryId": "cat_business",
  "applyToSimilar": true
}
```

### Trigger Manual Retrain (Admin)

```http
POST /ml/retrain
Authorization: Bearer <admin_token>
```

### Get Model Metrics

```http
GET /ml/metrics
```

**Response:**

```json
{
  "currentModel": {
    "version": "2025-01-15",
    "accuracy": 0.873,
    "precision": 0.821,
    "recall": 0.847,
    "f1Score": 0.834,
    "trainingSamples": 125000,
    "categories": 42
  },
  "retrainSchedule": "0 3 * * *",
  "lastRetrain": "2025-01-15T03:00:00Z",
  "nextRetrain": "2025-01-16T03:00:00Z"
}
```

## Configuration

```env
# ML Configuration
ML_MODEL_PATH=/models/categorization
ML_CONFIDENCE_THRESHOLD=0.75
ML_FUZZY_MATCH_THRESHOLD=0.85

# Retrain Configuration
ML_RETRAIN_CRON="0 3 * * *"  # 3 AM daily
ML_MIN_TRAINING_SAMPLES=1000
ML_VALIDATION_SPLIT=0.2
```

## Best Practices

### For Users

1. **Correct Consistently**: Apply the same category for similar merchants
2. **Use Rules for Patterns**: Create rules for recurring patterns (e.g., all "Amazon" → Shopping)
3. **Review Suggestions**: Check low-confidence categorizations periodically

### For Administrators

1. **Monitor Accuracy**: Track model metrics over time
2. **Review Corrections**: Audit user corrections for quality
3. **Manage Categories**: Keep category taxonomy clean and non-overlapping

## Troubleshooting

### Common Issues

| Issue                               | Cause                    | Solution                  |
| ----------------------------------- | ------------------------ | ------------------------- |
| Same merchant, different categories | Merchant name variations | Add categorization rule   |
| Low confidence scores               | New/unusual merchants    | Provide corrections       |
| Model not improving                 | Insufficient data        | Wait for more corrections |
| Corrections not applying            | Cache issue              | Clear category cache      |

## Related Documentation

- [API Reference](../API.md) - ML API endpoints
- [Budget Rules Source](../../apps/api/src/modules/budgets) - Category-based
  budgeting
- [Transaction Source](../../apps/api/src/modules/transactions) - Transaction
  handling

---

**Module**: `apps/api/src/modules/ml/`
**Queue**: `ml-retrain`
**Status**: Implemented; production availability follows current stability gates
**Last Updated**: 2026-05-20
