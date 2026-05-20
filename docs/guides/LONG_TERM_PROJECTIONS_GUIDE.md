# Long-Term Projections Guide

> 10-30 year cashflow forecasting with Monte Carlo simulation for retirement planning.

## Overview

Dhanam's long-term projection engine extends the standard 60-day cashflow forecast to multi-decade planning horizons. This enables users to model retirement scenarios, plan for major life events, and understand the probability of achieving their financial goals.

## Projection Engine

### Core Methodology

The projection engine uses Monte Carlo simulation to model uncertainty:

```typescript
interface ProjectionConfig {
  horizon: number; // Years (10, 20, 30)
  scenarios: number; // Simulation runs (100-10000)
  assumptions: ProjectionAssumptions;
  lifeEvents: LifeEvent[];
}

interface ProjectionAssumptions {
  inflationRate: number; // Annual inflation (e.g., 0.03)
  incomeGrowthRate: number; // Annual income growth (e.g., 0.025)
  portfolioReturn: number; // Expected return (e.g., 0.07)
  portfolioVolatility: number; // Standard deviation (e.g., 0.15)
  retirementAge?: number; // When income drops
  retirementSpending?: number; // Annual spending in retirement
}
```

### Monte Carlo Simulation

Each scenario simulates year-by-year outcomes:

```typescript
function runScenario(config: ProjectionConfig, seed: number): YearlyOutcome[] {
  const rng = new SeededRandom(seed);
  let netWorth = currentNetWorth;
  let income = currentAnnualIncome;
  const outcomes: YearlyOutcome[] = [];

  for (let year = 1; year <= config.horizon; year++) {
    // Apply life events
    const event = config.lifeEvents.find((e) => e.year === year);
    if (event) {
      netWorth += event.amount || 0;
      income += event.incomeChange || 0;
    }

    // Calculate expenses with inflation
    const expenses = calculateExpenses(year, config.assumptions);

    // Portfolio return with randomness
    const return_ = sampleNormal(
      rng,
      config.assumptions.portfolioReturn,
      config.assumptions.portfolioVolatility
    );

    // Update net worth
    const savings = Math.max(0, income - expenses);
    netWorth = netWorth * (1 + return_) + savings;

    // Apply income growth
    if (!isRetired(year, config.assumptions)) {
      income *= 1 + config.assumptions.incomeGrowthRate;
    }

    outcomes.push({
      year,
      netWorth,
      income,
      expenses,
      savings,
      portfolioReturn: return_,
    });
  }

  return outcomes;
}
```

### Outcome Aggregation

Results are aggregated across all scenarios:

```typescript
interface ProjectionResults {
  median: YearlyOutcome[];
  percentile10: YearlyOutcome[]; // Pessimistic
  percentile25: YearlyOutcome[];
  percentile75: YearlyOutcome[];
  percentile90: YearlyOutcome[]; // Optimistic
  successProbability: number; // % of scenarios with positive net worth
  runOutYear: number | null; // Year of first negative net worth
}
```

## Life Events

Model significant financial events:

### Supported Event Types

| Type            | Description         | Parameters                                |
| --------------- | ------------------- | ----------------------------------------- |
| `home_purchase` | Buy a home          | `amount` (down payment + closing)         |
| `home_sale`     | Sell a home         | `amount` (proceeds after costs)           |
| `college`       | Education expenses  | `amount` (total cost)                     |
| `wedding`       | Wedding expenses    | `amount`                                  |
| `inheritance`   | Receive inheritance | `amount`                                  |
| `retirement`    | Stop working        | `incomeChange` (salary to $0)             |
| `career_change` | Change careers      | `incomeChange` (delta)                    |
| `child`         | New child           | `expenseChange` (annual increase)         |
| `custom`        | Custom event        | `amount`, `incomeChange`, `expenseChange` |

### Example Life Event Timeline

```typescript
const lifeEvents: LifeEvent[] = [
  {
    year: 3,
    type: 'home_purchase',
    label: 'Buy first home',
    amount: -80000, // Down payment + closing costs
  },
  {
    year: 5,
    type: 'child',
    label: 'First child',
    expenseChange: 15000, // Annual childcare costs
  },
  {
    year: 18,
    type: 'college',
    label: 'Child college',
    amount: -200000, // Total 4-year cost
  },
  {
    year: 25,
    type: 'retirement',
    label: 'Retire at 65',
    incomeChange: -120000, // Salary stops
  },
];
```

## API Endpoints

### Get Long-Term Projection

```http
GET /projections/long-term?spaceId=space_123&years=30&scenarios=1000
```

**Response:**

```json
{
  "projection": {
    "horizon": 30,
    "scenarios": 1000,
    "assumptions": {
      "inflationRate": 0.03,
      "incomeGrowthRate": 0.025,
      "portfolioReturn": 0.07,
      "portfolioVolatility": 0.15
    },
    "outcomes": {
      "median": { "year10": 450000, "year20": 1200000, "year30": 2500000 },
      "percentile10": { "year10": 280000, "year20": 650000, "year30": 1100000 },
      "percentile90": { "year10": 680000, "year20": 2100000, "year30": 5200000 }
    },
    "successProbability": 0.87,
    "runOutYear": null
  },
  "yearByYear": [
    {
      "year": 1,
      "projectedNetWorth": 155000,
      "projectedIncome": 120000,
      "projectedExpenses": 95000,
      "projectedSavings": 25000
    }
  ]
}
```

### Create Custom Projection

```http
POST /projections/long-term
Content-Type: application/json

{
  "spaceId": "space_123",
  "years": 25,
  "scenarios": 5000,
  "assumptions": {
    "inflationRate": 0.035,
    "incomeGrowthRate": 0.02,
    "retirementAge": 65,
    "retirementSpending": 80000
  },
  "lifeEvents": [
    { "year": 5, "type": "home_purchase", "amount": -150000 },
    { "year": 18, "type": "college", "amount": -200000 }
  ]
}
```

### Save Scenario

```http
POST /projections/scenarios
Content-Type: application/json

{
  "spaceId": "space_123",
  "name": "Conservative Retirement",
  "config": { /* projection config */ },
  "results": { /* projection results */ }
}
```

### Compare Scenarios

```http
POST /projections/scenarios/compare
Content-Type: application/json

{
  "scenarioIds": ["scen_123", "scen_456", "scen_789"]
}
```

**Response:**

```json
{
  "scenarios": [
    {
      "id": "scen_123",
      "name": "Conservative",
      "successProbability": 0.92,
      "medianYear30": 2100000
    },
    {
      "id": "scen_456",
      "name": "Aggressive",
      "successProbability": 0.78,
      "medianYear30": 3500000
    }
  ],
  "comparison": {
    "bestSuccessRate": "scen_123",
    "bestMedianOutcome": "scen_456",
    "recommendation": "scen_123 offers better risk-adjusted returns"
  }
}
```

## What-If Analysis

Compare different assumptions:

```typescript
// Example: Impact of retiring 5 years later
const baseCase = await runProjection({
  assumptions: { retirementAge: 60 },
});

const laterRetirement = await runProjection({
  assumptions: { retirementAge: 65 },
});

// Compare outcomes
const improvement = {
  successProbability: laterRetirement.successProbability - baseCase.successProbability,
  medianYear30: laterRetirement.outcomes.median.year30 - baseCase.outcomes.median.year30,
};
```

## Integration with Monte Carlo Package

The projection engine uses the existing `packages/simulations` package:

```typescript
import { MonteCarloEngine, ProjectionConfig } from '@dhanam/simulations';

const engine = new MonteCarloEngine({
  scenarios: 5000,
  seed: Date.now(),
});

const results = await engine.runProjection({
  horizon: 30,
  startingNetWorth: currentNetWorth,
  annualIncome: income,
  annualExpenses: expenses,
  assumptions: config.assumptions,
  lifeEvents: config.lifeEvents,
});
```

## Visualization Components

### Projection Fan Chart

```tsx
import { ProjectionFanChart } from '@/components/projections/fan-chart';

<ProjectionFanChart
  projection={projectionResults}
  showPercentiles={[10, 25, 50, 75, 90]}
  lifeEvents={lifeEvents}
/>;
```

### Scenario Comparison

```tsx
import { ScenarioComparison } from '@/components/projections/scenario-comparison';

<ScenarioComparison scenarios={savedScenarios} highlightMetric="successProbability" />;
```

### Life Event Timeline

```tsx
import { LifeEventTimeline } from '@/components/projections/life-event-timeline';

<LifeEventTimeline events={lifeEvents} onEdit={handleEditEvent} onAdd={handleAddEvent} />;
```

## Assumptions & Limitations

### Default Assumptions

| Parameter            | Default | Range |
| -------------------- | ------- | ----- |
| Inflation Rate       | 3%      | 1-6%  |
| Income Growth        | 2.5%    | 0-5%  |
| Portfolio Return     | 7%      | 3-12% |
| Portfolio Volatility | 15%     | 5-30% |

### Limitations

1. **Historical Basis**: Return assumptions based on historical data
2. **No Guarantees**: Monte Carlo shows probability, not certainty
3. **Simplified Taxes**: Tax calculations are approximate
4. **Constant Allocations**: Assumes fixed asset allocation
5. **US-Focused**: Social Security/Medicare assumptions are US-based

## Best Practices

### For Accurate Projections

1. **Update Regularly**: Re-run projections when circumstances change
2. **Use Realistic Assumptions**: Avoid overly optimistic returns
3. **Model Life Events**: Include major planned expenses
4. **Run Multiple Scenarios**: Compare conservative/aggressive assumptions
5. **Review Annually**: Validate projections against actual results

### For Retirement Planning

1. **Target 90%+ Success**: Aim for high probability of success
2. **Consider Sequence Risk**: Early retirement years are critical
3. **Plan for Longevity**: Use 30+ year horizons
4. **Include Healthcare**: Factor in medical costs
5. **Stress Test**: Check projections with lower returns

## Configuration

```env
# Projection Configuration
PROJECTION_MAX_YEARS=50
PROJECTION_MAX_SCENARIOS=10000
PROJECTION_DEFAULT_SCENARIOS=1000
PROJECTION_CACHE_TTL_HOURS=24

# Monte Carlo Configuration
MONTE_CARLO_SEED_STRATEGY=time
MONTE_CARLO_PARALLEL_WORKERS=4
```

## Related Documentation

- [Monte Carlo Guide](./MONTE_CARLO_GUIDE.md) - Simulation engine details
- [Goal Tracking](./GOAL_TRACKING_GUIDE.md) - Financial goal setting
- [Simulations Package](../../packages/simulations/README.md) - Projection and
  simulation engines
- [API Reference](../API.md) - Projection API endpoints

---

**Module**: `apps/api/src/modules/projections/`
**Package**: `@dhanam/simulations`
**Status**: Implemented; production availability follows current stability gates
**Last Updated**: 2026-05-20
