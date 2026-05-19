# Machine Learning Capabilities Guide

> AI-powered features for transaction categorization, predictions, and provider selection.

## Overview

Dhanam's ML module provides intelligent automation for:

- **Transaction Categorization**: Automatic classification based on historical patterns
- **Split Predictions**: Intelligent transaction splitting suggestions
- **Provider Selection**: Optimal financial data provider routing

## Transaction Categorization

### How It Works

The categorization engine uses a multi-strategy approach with confidence scoring:

```
Strategy 1: Exact Merchant Match (Highest Confidence)
    ↓ (if no match)
Strategy 2: Fuzzy Merchant Match (Medium Confidence)
    ↓ (if no match)
Strategy 3: Description Keyword Match (Medium Confidence)
    ↓ (if no match)
Strategy 4: Amount Pattern Match (Low Confidence)
    ↓ (if no match)
No Prediction - Manual categorization required
```

### Confidence Levels

| Level  | Threshold | Auto-Categorize | Description                               |
| ------ | --------- | --------------- | ----------------------------------------- |
| High   | 0.90+     | Yes             | 3+ historical matches, consistent pattern |
| Medium | 0.70-0.89 | No              | Fuzzy match or keyword similarity         |
| Low    | 0.50-0.69 | No              | Amount-based correlation only             |

### Strategy Details

#### 1. Exact Merchant Match

- Requires exact merchant name match (case-insensitive)
- Needs 3+ historical transactions with same merchant
- Confidence scales with frequency: `min(0.95, 0.7 + (count - 3) * 0.05)`

#### 2. Fuzzy Merchant Match

- Substring matching (either direction)
- Falls back to most recent similar merchant pattern
- Fixed medium confidence (0.70)

#### 3. Description Keyword Match

- Extracts top 5 keywords (excluding stop words)
- Compares against historical transaction descriptions per category
- Requires 30%+ keyword overlap for prediction

#### 4. Amount Pattern Match

- Statistical analysis of transaction amounts by category
- Uses z-score calculation (within 1 standard deviation)
- Requires 5+ historical transactions in category

### API Usage

```typescript
// Get category prediction (without applying)
const prediction = await fetch('/api/ml/predict-category', {
  method: 'POST',
  body: JSON.stringify({
    spaceId: 'space_123',
    description: 'UBER EATS *MCDONALDS',
    merchant: 'UBER EATS',
    amount: -15.99,
  }),
});

// Response
{
  "categoryId": "cat_dining_out",
  "categoryName": "Dining Out",
  "confidence": 0.92,
  "reasoning": "UBER EATS consistently categorized based on 12 past transactions"
}

// Auto-categorize (applies if confidence >= 0.90)
const result = await fetch('/api/ml/auto-categorize', {
  method: 'POST',
  body: JSON.stringify({
    transactionId: 'txn_456',
    spaceId: 'space_123',
    description: 'UBER EATS *MCDONALDS',
    merchant: 'UBER EATS',
    amount: -15.99,
  }),
});

// Response
{
  "categorized": true,
  "categoryId": "cat_dining_out",
  "confidence": 0.92
}
```

### Accuracy Metrics

```typescript
// Get categorization accuracy for a space
const metrics = await fetch('/api/ml/accuracy?spaceId=space_123&days=30');

// Response
{
  "totalAutoCategorized": 145,
  "averageConfidence": "0.88",
  "period": "30 days"
}
```

## Split Predictions

### Purpose

Suggests how to split transactions that cover multiple categories:

- Restaurant bill with tip → Dining + Tip
- Costco purchase → Groceries + Household
- Amazon order → Multiple categories

### Prediction Logic

1. Analyze merchant patterns for multi-category transactions
2. Review historical split ratios for similar amounts
3. Suggest splits based on user's typical behavior

### API Usage

```typescript
const splits = await fetch('/api/ml/predict-splits', {
  method: 'POST',
  body: JSON.stringify({
    transactionId: 'txn_789',
    spaceId: 'space_123',
    description: 'COSTCO WHOLESALE',
    amount: -250.00,
  }),
});

// Response
{
  "suggested_splits": [
    { "categoryId": "cat_groceries", "percentage": 70, "amount": 175.00 },
    { "categoryId": "cat_household", "percentage": 30, "amount": 75.00 }
  ],
  "confidence": 0.75,
  "reasoning": "Based on 8 similar Costco transactions"
}
```

## Provider Selection

### Purpose

Intelligently routes financial data requests to the optimal provider based on:

- Geographic availability
- Provider reliability scores
- Feature requirements
- Cost optimization

### Available Providers

| Provider   | Region        | Specialization            |
| ---------- | ------------- | ------------------------- |
| Belvo      | Mexico, LATAM | Primary MX provider       |
| Plaid      | US, Canada    | Primary US provider       |
| MX         | US, Canada    | Backup aggregation        |
| Finicity   | US            | Open Banking (Mastercard) |
| Bitso      | Global        | Crypto exchange           |
| Blockchain | Global        | On-chain data             |

### Selection Algorithm

```typescript
// Provider selection factors
interface ProviderScore {
  availability: number; // 0-1, can serve this region/institution
  reliability: number; // 0-1, recent success rate
  featureMatch: number; // 0-1, supports required features
  cost: number; // 0-1, cost efficiency
  latency: number; // 0-1, response time score
}

// Final score = weighted sum
score = availability * 0.3 + reliability * 0.25 + featureMatch * 0.25 + cost * 0.1 + latency * 0.1;
```

### API Usage

```typescript
const provider = await fetch('/api/ml/select-provider', {
  method: 'POST',
  body: JSON.stringify({
    countryCode: 'MX',
    institutionId: 'bancomer',
    features: ['transactions', 'balances'],
  }),
});

// Response
{
  "provider": "belvo",
  "score": 0.92,
  "fallback": "plaid",
  "reasoning": "Belvo has highest reliability for Mexican institutions"
}
```

## Learning and Improvement

### User Feedback Loop

When users manually re-categorize a transaction:

1. Original prediction is compared to user's choice
2. Feedback is stored for model improvement
3. Merchant patterns are updated
4. Confidence thresholds may adjust

### Data Requirements

| Feature          | Minimum Data     | Optimal Data       |
| ---------------- | ---------------- | ------------------ |
| Merchant Match   | 3 transactions   | 10+ transactions   |
| Keyword Match    | 100 transactions | 500+ transactions  |
| Amount Pattern   | 5 transactions   | 20+ per category   |
| Split Prediction | 3 similar splits | 10+ similar splits |

## Performance Characteristics

| Operation            | Latency        | Throughput |
| -------------------- | -------------- | ---------- |
| Single prediction    | <50ms          | 1000/sec   |
| Batch categorization | <500ms/100 txn | 200/sec    |
| Provider selection   | <20ms          | 5000/sec   |
| Accuracy metrics     | <200ms         | 100/sec    |

## Configuration

### Environment Variables

```bash
# ML Feature Flags
ML_AUTO_CATEGORIZE_ENABLED=true
ML_MIN_CONFIDENCE_AUTO=0.90
ML_SPLIT_PREDICTION_ENABLED=true

# Provider Selection
ML_PROVIDER_CACHE_TTL=3600
ML_RELIABILITY_WINDOW_HOURS=24
```

### Per-Space Settings

Users can configure ML behavior per space:

```typescript
interface SpaceMLSettings {
  autoCategorizeEnabled: boolean;
  minConfidenceThreshold: number; // 0.80 - 0.95
  splitPredictionEnabled: boolean;
  learningEnabled: boolean; // Allow model updates from corrections
}
```

## Privacy & Data Usage

- **Local Learning**: Models learn from user's own data only
- **No Cross-User Training**: Predictions are space-specific
- **Data Retention**: Historical patterns kept for 2 years
- **Opt-Out Available**: Users can disable ML features entirely

## Related Documentation

- [Transaction Management](./TRANSACTIONS_GUIDE.md)
- [Provider Integration](./MULTI_PROVIDER_REDUNDANCY.md)
- [Categories & Rules](./CATEGORIES_RULES_GUIDE.md)

---

**Module**: `apps/api/src/modules/ml/`
**Status**: Production
**Last Updated**: January 2025
