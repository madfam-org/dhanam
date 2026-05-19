# Monte Carlo Simulation Guide

**Version**: 1.0
**Last Updated**: 2025-11-19
**Status**: Production Ready

## Overview

The Monte Carlo simulation module provides probabilistic wealth forecasting using stochastic modeling. This is a **premium tier feature** that differentiates Dhanam as a "Blue Ocean" product - moving beyond simple budget tracking to autonomous wealth management.

### Key Capabilities

- **Portfolio Growth Simulation**: Run 10,000+ iterations to model possible portfolio outcomes
- **Goal Probability Analysis**: Calculate likelihood of achieving financial goals
- **Retirement Planning**: Two-phase simulation (accumulation + withdrawal)
- **Scenario Analysis**: Stress test portfolios against historical market crashes
- **Risk Assessment**: Quantify downside risk and required savings

### Premium Tier Gating

All simulation endpoints require **Premium subscription** and are usage-metered:

- Free tier: 3 simulations/day
- Premium tier: Unlimited simulations

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [API Endpoints](#api-endpoints)
3. [Simulation Types](#simulation-types)
4. [Scenario Analysis](#scenario-analysis)
5. [Statistical Utilities](#statistical-utilities)
6. [Frontend Integration](#frontend-integration)
7. [Testing](#testing)
8. [Performance](#performance)

---

## Core Concepts

### Geometric Brownian Motion

Portfolio returns are modeled using the formula:

```
r = μ + σ * Z
```

Where:

- `r` = realized monthly return
- `μ` = expected monthly return (drift)
- `σ` = monthly volatility (standard deviation)
- `Z` = random normal variable ~ N(0,1)

### Monte Carlo Methodology

1. **Convert annual parameters to monthly**:
   - Monthly return: `(1 + annual_return)^(1/12) - 1`
   - Monthly volatility: `annual_volatility / √12`

2. **Run N iterations** (default 10,000):
   - For each month: generate random return
   - Update balance: `balance = balance * (1 + return) + contribution`
   - Track entire path

3. **Calculate statistics** from all paths:
   - Percentiles: p10, p25, median, p75, p90
   - Mean, standard deviation
   - Min/max outcomes

### Key Parameters

| Parameter             | Type   | Description              | Typical Range         |
| --------------------- | ------ | ------------------------ | --------------------- |
| `initialBalance`      | number | Starting portfolio value | $0 - $10M             |
| `monthlyContribution` | number | Monthly savings          | $0 - $50k             |
| `months`              | number | Time horizon             | 12 - 600 (1-50 years) |
| `iterations`          | number | Simulation runs          | 1,000 - 50,000        |
| `expectedReturn`      | number | Annual return (decimal)  | -0.20 to 0.20         |
| `volatility`          | number | Annual std dev (decimal) | 0.05 to 0.80          |

### Recommended Asset Allocations

| Risk Profile | Stocks/Bonds | Expected Return | Volatility |
| ------------ | ------------ | --------------- | ---------- |
| Conservative | 40/60        | 5%              | 10%        |
| Moderate     | 60/40        | 7%              | 15%        |
| Aggressive   | 80/20        | 9%              | 20%        |

---

## API Endpoints

### 1. Basic Monte Carlo Simulation

**Endpoint**: `POST /api/simulations/monte-carlo`
**Auth**: Required (JWT)
**Tier**: Premium
**Usage**: Tracks `monte_carlo_simulation`

#### Request Body

```typescript
{
  initialBalance: number;      // Starting balance
  monthlyContribution: number; // Monthly deposit
  months: number;              // Time horizon in months
  iterations?: number;         // Default: 10,000
  expectedReturn: number;      // Annual return (e.g., 0.07 = 7%)
  volatility: number;          // Annual volatility (e.g., 0.15 = 15%)
}
```

#### Example Request

```bash
curl -X POST https://api.dhanam.io/simulations/monte-carlo \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "initialBalance": 10000,
    "monthlyContribution": 500,
    "months": 120,
    "iterations": 10000,
    "expectedReturn": 0.07,
    "volatility": 0.15
  }'
```

#### Response

```typescript
{
  finalValues: number[];       // Array of all outcomes
  median: number;              // 50th percentile
  mean: number;                // Average outcome
  stdDev: number;              // Standard deviation
  p10: number;                 // 10th percentile (worst 10%)
  p25: number;                 // 25th percentile
  p75: number;                 // 75th percentile
  p90: number;                 // 90th percentile (best 10%)
  min: number;                 // Worst case
  max: number;                 // Best case
  timeSeries: MonthlySnapshot[]; // Month-by-month statistics
  config: MonteCarloConfig;    // Echo of input config
  computedAt: Date;            // Timestamp
}
```

#### Example Response

```json
{
  "median": 89523.45,
  "mean": 91234.67,
  "stdDev": 18456.23,
  "p10": 65234.12,
  "p25": 75123.45,
  "p75": 102345.67,
  "p90": 118456.78,
  "min": 45678.90,
  "max": 156789.01,
  "timeSeries": [
    { "month": 0, "median": 10000, "mean": 10000, "p10": 10000, "p90": 10000 },
    { "month": 1, "median": 10567, "mean": 10578, "p10": 10234, "p90": 10923 },
    ...
  ],
  "computedAt": "2025-11-19T12:00:00.000Z"
}
```

---

### 2. Goal Probability Calculation

**Endpoint**: `POST /api/simulations/goal-probability`
**Auth**: Required (JWT)
**Tier**: Premium
**Usage**: Tracks `goal_probability`

Calculates the probability of achieving a specific financial goal.

#### Request Body

```typescript
{
  goalId?: string;             // Optional: link to Goal entity
  currentValue: number;        // Current saved amount
  targetAmount: number;        // Goal target
  monthsRemaining: number;     // Time until goal date
  monthlyContribution?: number; // Default: 0
  expectedReturn: number;      // Annual return
  volatility: number;          // Annual volatility
  iterations?: number;         // Default: 10,000
}
```

#### Example Request

```bash
curl -X POST https://api.dhanam.io/simulations/goal-probability \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "goalId": "550e8400-e29b-41d4-a716-446655440000",
    "currentValue": 25000,
    "targetAmount": 100000,
    "monthsRemaining": 60,
    "monthlyContribution": 1000,
    "expectedReturn": 0.07,
    "volatility": 0.15
  }'
```

#### Response

```typescript
{
  probabilityOfSuccess: number; // 0.0 to 1.0
  medianOutcome: number; // Expected final value
  expectedShortfall: number; // Avg shortfall if goal not met
  confidence90Range: {
    low: number; // 10th percentile
    high: number; // 90th percentile
  }
  recommendedMonthlyContribution: number; // For 75% success rate
  currentMonthlyContribution: number;
  targetAmount: number;
  monthsRemaining: number;
  simulation: SimulationResult; // Full simulation data
}
```

#### Example Response

```json
{
  "probabilityOfSuccess": 0.73,
  "medianOutcome": 102345.67,
  "expectedShortfall": 8234.56,
  "confidence90Range": {
    "low": 78234.12,
    "high": 132456.78
  },
  "recommendedMonthlyContribution": 1150.0,
  "currentMonthlyContribution": 1000.0,
  "targetAmount": 100000,
  "monthsRemaining": 60
}
```

---

### 3. Retirement Simulation

**Endpoint**: `POST /api/simulations/retirement`
**Auth**: Required (JWT)
**Tier**: Premium
**Usage**: Tracks `monte_carlo_simulation`

Two-phase retirement planning:

1. **Accumulation**: Current age → retirement (save + invest)
2. **Withdrawal**: Retirement → life expectancy (withdraw + invest)

#### Request Body

```typescript
{
  initialBalance: number;          // Current savings
  monthlyContribution: number;     // Monthly savings until retirement
  currentAge: number;              // Current age (18-100)
  retirementAge: number;           // Target retirement age (50-100)
  lifeExpectancy: number;          // Expected lifespan (60-120)
  monthlyExpenses?: number;        // Monthly spending in retirement
  socialSecurityIncome?: number;   // Monthly SS/pension income
  expectedReturn: number;          // Annual return
  volatility: number;              // Annual volatility
  iterations?: number;             // Default: 10,000
  inflationAdjusted?: boolean;     // Default: true
}
```

#### Example Request

```bash
curl -X POST https://api.dhanam.io/simulations/retirement \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "initialBalance": 50000,
    "monthlyContribution": 1500,
    "currentAge": 35,
    "retirementAge": 65,
    "lifeExpectancy": 90,
    "monthlyExpenses": 5000,
    "socialSecurityIncome": 2000,
    "expectedReturn": 0.07,
    "volatility": 0.15,
    "inflationAdjusted": true
  }'
```

#### Response

```typescript
{
  accumulationPhase: {
    yearsToRetirement: number;
    finalBalanceMedian: number;     // Expected nest egg at retirement
    finalBalanceP10: number;        // Worst 10% outcome
    finalBalanceP90: number;        // Best 10% outcome
    totalContributions: number;     // Sum of all deposits
  };
  withdrawalPhase: {
    yearsInRetirement: number;
    probabilityOfNotRunningOut: number;  // Success rate
    medianYearsOfSustainability: number; // How long money lasts
    safeWithdrawalRate: number;     // Monthly safe withdrawal
    netMonthlyNeed: number;         // Expenses - SS income
  };
  recommendations: {
    increaseContributionBy?: number;  // If success rate < 75%
    canRetireEarlierBy?: number;      // If success rate > 90%
    targetNestEgg: number;            // Recommended retirement balance
  };
  simulation: SimulationResult;
}
```

#### Example Response

```json
{
  "accumulationPhase": {
    "yearsToRetirement": 30,
    "finalBalanceMedian": 1234567.89,
    "finalBalanceP10": 945678.9,
    "finalBalanceP90": 1678901.23,
    "totalContributions": 540000
  },
  "withdrawalPhase": {
    "yearsInRetirement": 25,
    "probabilityOfNotRunningOut": 0.82,
    "medianYearsOfSustainability": 27.5,
    "safeWithdrawalRate": 4200,
    "netMonthlyNeed": 3000
  },
  "recommendations": {
    "targetNestEgg": 1200000
  }
}
```

---

### 4. Scenario Comparison

**Endpoint**: `POST /api/simulations/scenarios/:scenarioName`
**Auth**: Required (JWT)
**Tier**: Premium
**Usage**: Tracks `scenario_analysis`

Compare baseline simulation against historical market crash scenarios.

#### Available Scenarios

| Scenario            | Magnitude | Duration  | Recovery  | Historical Example  |
| ------------------- | --------- | --------- | --------- | ------------------- |
| `BEAR_MARKET`       | -30%      | 6 months  | 12 months | 2018, 2022          |
| `GREAT_RECESSION`   | -50%      | 12 months | 24 months | 2008-2009           |
| `DOT_COM_BUST`      | -45%      | 18 months | 36 months | 2000-2002           |
| `MILD_RECESSION`    | -15%      | 3 months  | 6 months  | 2020 COVID crash    |
| `MARKET_CORRECTION` | -10%      | 1 month   | 3 months  | Regular corrections |

#### Request

```bash
curl -X POST https://api.dhanam.io/simulations/scenarios/GREAT_RECESSION \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "initialBalance": 100000,
    "monthlyContribution": 1000,
    "months": 120,
    "expectedReturn": 0.07,
    "volatility": 0.15
  }'
```

#### Response

```typescript
{
  baseline: SimulationResult; // Normal market conditions
  scenario: SimulationResult; // With market crash applied
  scenarioName: string; // e.g., "GREAT_RECESSION"
  scenarioDescription: string; // Human-readable description
  comparison: {
    medianDifference: number; // How much worse scenario is
    medianDifferencePercent: number; // Percentage impact
    p10Difference: number; // Impact on worst case
    recoveryMonths: number; // How long crash + recovery lasts
    worthStressTesting: boolean; // If impact > 10%
  }
}
```

---

### 5. Recommended Allocation

**Endpoint**: `POST /api/simulations/recommended-allocation`
**Auth**: Required (JWT)
**Tier**: **Free tier** (informational endpoint)

Get recommended portfolio parameters based on risk tolerance.

#### Request Body

```typescript
{
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  yearsToRetirement: number;
}
```

#### Example Request

```bash
curl -X POST https://api.dhanam.io/simulations/recommended-allocation \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "riskTolerance": "moderate",
    "yearsToRetirement": 25
  }'
```

#### Response

```json
{
  "riskTolerance": "moderate",
  "yearsToRetirement": 25,
  "expectedReturn": 0.07,
  "volatility": 0.15,
  "allocation": {
    "stocks": 0.6,
    "bonds": 0.4
  },
  "description": "Balanced portfolio with moderate growth potential"
}
```

---

## Simulation Types

### Type 1: Basic Portfolio Growth

**Use case**: Simple savings with no specific goal

```typescript
const config = {
  initialBalance: 10000,
  monthlyContribution: 500,
  months: 120,
  expectedReturn: 0.07,
  volatility: 0.15,
  iterations: 10000,
};

const result = await simulationsService.runSimulation(config);

console.log(`Median outcome: $${result.median.toFixed(2)}`);
console.log(`90% confidence range: $${result.p10.toFixed(2)} - $${result.p90.toFixed(2)}`);
```

### Type 2: Goal-Based Planning

**Use case**: Saving for house down payment, education, etc.

```typescript
const goalConfig = {
  goalId: 'uuid-here',
  currentValue: 25000,
  targetAmount: 100000,
  monthsRemaining: 60,
  monthlyContribution: 1000,
  expectedReturn: 0.07,
  volatility: 0.15,
};

const result = await simulationsService.calculateGoalProbability(goalConfig, userId);

if (result.probabilityOfSuccess < 0.75) {
  console.log(`Increase monthly savings to $${result.recommendedMonthlyContribution}`);
}
```

### Type 3: Retirement Planning

**Use case**: Comprehensive retirement readiness assessment

```typescript
const retirementConfig = {
  initialBalance: 50000,
  monthlyContribution: 1500,
  currentAge: 35,
  retirementAge: 65,
  lifeExpectancy: 90,
  monthlyExpenses: 5000,
  socialSecurityIncome: 2000,
  expectedReturn: 0.07,
  volatility: 0.15,
};

const result = await simulationsService.simulateRetirement(retirementConfig, userId);

console.log(
  `Probability of success: ${(result.withdrawalPhase.probabilityOfNotRunningOut * 100).toFixed(1)}%`
);
```

### Type 4: Stress Testing

**Use case**: Understand downside risk during market crashes

```typescript
const baseConfig = {
  /* ... */
};

const comparison = await simulationsService.compareScenarios(baseConfig, 'GREAT_RECESSION');

console.log(`Median impact: -$${comparison.comparison.medianDifference.toFixed(2)}`);
console.log(`Crash duration: ${comparison.comparison.recoveryMonths} months`);
```

---

## Scenario Analysis

### How Market Shocks Work

Market shocks are modeled as discrete events with three phases:

1. **Crash Phase**: Portfolio declines by X% over Y months
2. **Recovery Phase**: Portfolio recovers linearly over Z months
3. **Normal Phase**: Returns to stochastic simulation

#### Example: Great Recession

```typescript
{
  type: 'crash',
  magnitude: -0.50,      // 50% total decline
  startMonth: 24,        // Crash starts at month 24
  durationMonths: 12,    // Decline happens over 12 months
  recoveryMonths: 24     // Takes 24 months to recover
}
```

**Timeline**:

- Months 0-23: Normal stochastic returns
- Months 24-35: -50% / 12 = -4.17% per month (crash)
- Months 36-59: Gradual recovery back to baseline
- Months 60+: Normal stochastic returns

### When to Use Scenario Analysis

✅ **Use scenario analysis when**:

- Client is within 5-10 years of retirement
- Client has low risk tolerance
- Portfolio is heavily concentrated
- Client wants to understand downside protection

❌ **Don't use scenario analysis when**:

- Time horizon > 30 years (volatility already captures risk)
- Educational purposes for young investors
- It would cause undue anxiety

### Creating Custom Scenarios

```typescript
const customShocks: MarketShock[] = [
  {
    type: 'crash',
    magnitude: -0.35,
    startMonth: 12,
    durationMonths: 8,
    recoveryMonths: 16,
  },
  {
    type: 'recession',
    magnitude: -0.2,
    startMonth: 60,
    durationMonths: 6,
    recoveryMonths: 12,
  },
];

const result = await monteCarloEngine.simulateWithShocks(config, customShocks);
```

---

## Statistical Utilities

The `StatisticsUtil` class provides 25+ statistical functions.

### Basic Statistics

```typescript
import { StatisticsUtil } from '@modules/simulations/utils/statistics.util';

const returns = [0.05, 0.1, -0.03, 0.08, 0.12];

// Descriptive statistics
const mean = StatisticsUtil.mean(returns); // 0.064
const median = StatisticsUtil.median(returns); // 0.08
const stdDev = StatisticsUtil.stdDev(returns); // ~0.058
const p90 = StatisticsUtil.percentile(returns, 0.9); // 0.11

// Summary
const summary = StatisticsUtil.summary(returns);
// { mean, median, stdDev, p10, p25, p75, p90, min, max }
```

### Financial Calculations

```typescript
// Compound Annual Growth Rate
const cagr = StatisticsUtil.cagr(10000, 20000, 10); // 0.0718 (7.18%)

// Future Value
const fv = StatisticsUtil.futureValue(10000, 0.07, 10); // $19,671.51

// Present Value
const pv = StatisticsUtil.presentValue(19671.51, 0.07, 10); // $10,000

// Annuity Payment (mortgage calculator)
const payment = StatisticsUtil.annuityPayment(
  100000, // Loan amount
  0.05 / 12, // Monthly rate
  360 // 30 years
);
// $536.82 per month
```

### Return Conversions

```typescript
// Annual to monthly
const monthlyReturn = StatisticsUtil.monthlyReturn(0.1);
// (1.10)^(1/12) - 1 = 0.00797

const monthlyVol = StatisticsUtil.monthlyVolatility(0.2);
// 0.20 / sqrt(12) = 0.0577

// Monthly to annual
const annualReturn = StatisticsUtil.annualizeReturn(0.00797);
// (1.00797)^12 - 1 = 0.10

const annualVol = StatisticsUtil.annualizeVolatility(0.0577);
// 0.0577 * sqrt(12) = 0.20
```

### Risk Metrics

```typescript
// Sharpe Ratio
const returns = [0.1, 0.12, 0.08, 0.15, 0.05];
const riskFreeRate = 0.03;
const sharpe = StatisticsUtil.sharpeRatio(returns, riskFreeRate);

// Value at Risk (95% confidence)
const var95 = StatisticsUtil.valueAtRisk(
  100000, // Mean
  20000, // Std Dev
  0.95, // Confidence
  100000 // Initial value
);

// Maximum Drawdown
const portfolioValues = [100, 110, 105, 120, 90, 95, 115];
const maxDD = StatisticsUtil.maxDrawdown(portfolioValues);
// -0.25 (25% decline from peak of 120 to trough of 90)
```

### Random Number Generation

```typescript
// Normal distribution
const randomNormal = StatisticsUtil.randomNormal(0, 1); // Z ~ N(0,1)

// Uniform distribution
const randomUniform = StatisticsUtil.randomUniform(); // [0, 1)

// Normal CDF
const prob = StatisticsUtil.normalCDF(1, 0, 1);
// P(Z ≤ 1) = 0.8413 for standard normal
```

---

## Frontend Integration

### React Component Example

```typescript
// RetirementCalculator.tsx
import { useState } from 'react';
import { useSimulations } from '@/hooks/useSimulations';

export function RetirementCalculator() {
  const { simulateRetirement, loading, error } = useSimulations();
  const [inputs, setInputs] = useState({
    initialBalance: 50000,
    monthlyContribution: 1500,
    currentAge: 35,
    retirementAge: 65,
    lifeExpectancy: 90,
    monthlyExpenses: 5000,
    socialSecurityIncome: 2000,
    expectedReturn: 0.07,
    volatility: 0.15
  });
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = await simulateRetirement(inputs);
    setResult(data);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Input fields */}

      {result && (
        <div>
          <h3>Results</h3>
          <p>Retirement Nest Egg (median): ${result.accumulationPhase.finalBalanceMedian.toLocaleString()}</p>
          <p>Probability of Success: {(result.withdrawalPhase.probabilityOfNotRunningOut * 100).toFixed(1)}%</p>

          {result.withdrawalPhase.probabilityOfNotRunningOut < 0.75 && (
            <Alert variant="warning">
              Increase monthly savings by ${result.recommendations.increaseContributionBy}
            </Alert>
          )}
        </div>
      )}
    </form>
  );
}
```

### Chart Visualization

```typescript
// SimulationChart.tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts';

export function SimulationChart({ timeSeries }) {
  const chartData = timeSeries.map(point => ({
    month: point.month,
    median: point.median,
    p10: point.p10,
    p90: point.p90
  }));

  return (
    <LineChart width={800} height={400} data={chartData}>
      <XAxis dataKey="month" label="Months" />
      <YAxis label="Portfolio Value" />
      <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
      <Legend />
      <Line type="monotone" dataKey="p10" stroke="#ef4444" name="10th Percentile" strokeDasharray="5 5" />
      <Line type="monotone" dataKey="median" stroke="#3b82f6" name="Median" strokeWidth={3} />
      <Line type="monotone" dataKey="p90" stroke="#10b981" name="90th Percentile" strokeDasharray="5 5" />
    </LineChart>
  );
}
```

### Premium Upsell Component

```typescript
// PremiumGate.tsx
export function PremiumGate({ children }) {
  const { user } = useAuth();
  const { usageRemaining } = useUsage('monte_carlo_simulation');

  if (user.subscriptionTier === 'free' && usageRemaining === 0) {
    return (
      <Card>
        <CardHeader>
          <h3>Unlock Unlimited Simulations</h3>
        </CardHeader>
        <CardContent>
          <p>You've used your 3 free simulations for today.</p>
          <p>Upgrade to Premium for:</p>
          <ul>
            <li>Unlimited Monte Carlo simulations</li>
            <li>Advanced scenario analysis</li>
            <li>Retirement planning tools</li>
            <li>Goal probability tracking</li>
          </ul>
          <Button onClick={() => navigate('/billing/upgrade')}>
            Upgrade to Premium - $9.99/month
          </Button>
        </CardContent>
      </Card>
    );
  }

  return children;
}
```

---

## Testing

### Unit Tests

```bash
# Run statistics utility tests
npm test statistics.util.spec.ts

# Run Monte Carlo engine tests
npm test monte-carlo.engine.spec.ts

# Run all simulation tests
npm test simulations
```

### Test Coverage

- **StatisticsUtil**: 70+ tests covering all functions
- **MonteCarloEngine**: 40+ tests covering validation, scenarios, edge cases
- **SimulationsService**: Integration tests for all endpoints

### Manual Testing Checklist

- [ ] Run basic simulation with valid inputs
- [ ] Verify percentile ordering (p10 < p25 < median < p75 < p90)
- [ ] Test with zero initial balance
- [ ] Test with zero monthly contribution
- [ ] Test with negative expected return
- [ ] Test with very high volatility (80%)
- [ ] Test goal probability with success rate < 50%
- [ ] Test goal probability with success rate > 90%
- [ ] Test retirement simulation with early retirement
- [ ] Test retirement simulation with late retirement
- [ ] Run each predefined scenario
- [ ] Verify usage tracking increments correctly
- [ ] Verify premium tier gate blocks free users
- [ ] Test time series length matches months + 1

---

## Performance

### Benchmarks

| Iterations | Months | Time   | Requests/sec |
| ---------- | ------ | ------ | ------------ |
| 1,000      | 60     | ~50ms  | 20           |
| 5,000      | 120    | ~200ms | 5            |
| 10,000     | 120    | ~400ms | 2.5          |
| 10,000     | 480    | ~1.2s  | 0.8          |
| 50,000     | 120    | ~2s    | 0.5          |

### Optimization Tips

1. **Reduce iterations for interactive UX**:
   - Use 1,000 iterations for real-time slider feedback
   - Use 10,000 for final "Calculate" button

2. **Cache results**:
   - Store simulation results in Redis with TTL
   - Use config hash as cache key
   - Invalidate on user account changes

3. **Progressive enhancement**:
   - Show p50 (median) immediately
   - Stream percentiles as they're calculated
   - Render time series chart incrementally

4. **Rate limiting**:
   - Max 10 simulations per minute per user
   - Queue heavy requests (50k iterations) via BullMQ

### Memory Usage

- 10,000 iterations × 120 months = 1.2M data points
- Each data point = 8 bytes (float64)
- Total memory per simulation: ~10 MB
- Recommend max 50k iterations to stay under 50 MB

---

## Error Handling

### Common Errors

#### 402 Payment Required

```json
{
  "statusCode": 402,
  "message": "Upgrade to Premium to access Monte Carlo simulations",
  "error": "Payment Required"
}
```

**Solution**: Prompt user to upgrade subscription

#### 429 Usage Limit Exceeded

```json
{
  "statusCode": 429,
  "message": "Daily simulation limit exceeded (3/3). Upgrade to Premium for unlimited access.",
  "error": "Too Many Requests"
}
```

**Solution**: Show upgrade prompt or ask user to try tomorrow

#### 400 Validation Error

```json
{
  "statusCode": 400,
  "message": ["initialBalance must be a positive number"],
  "error": "Bad Request"
}
```

**Solution**: Fix input validation on frontend

#### 403 Subscription Expired

```json
{
  "statusCode": 403,
  "message": "Your Premium subscription expired on 2025-10-15. Please renew.",
  "error": "Forbidden"
}
```

**Solution**: Redirect to billing portal

---

## Best Practices

### For Developers

1. **Always use recommended allocations**: Call `/recommended-allocation` first to get sensible defaults
2. **Validate inputs on frontend**: Prevent unnecessary API calls
3. **Show loading states**: Simulations can take 1-2 seconds
4. **Cache results**: Store in component state or React Query cache
5. **Use debouncing**: Don't run simulations on every slider change
6. **Show confidence intervals**: Always display p10-p90 range, not just median
7. **Explain percentiles**: Add tooltips explaining what "10th percentile" means

### For Financial Advisors

1. **Use scenario analysis for clients near retirement**: Show impact of market crashes
2. **Focus on probability ranges, not point estimates**: Avoid false precision
3. **Adjust allocations over time**: Reduce volatility as clients age
4. **Account for inflation**: Use `inflationAdjusted: true` for retirement simulations
5. **Be conservative with return assumptions**: 7% real return is aggressive
6. **Include Social Security**: Don't ignore guaranteed income sources
7. **Stress test assumptions**: What if returns are 2% lower? Volatility 50% higher?

### For Product Managers

1. **Highlight success probability**: Make it the primary metric
2. **Use color coding**: Green (>75%), Yellow (50-75%), Red (<50%)
3. **Show actionable recommendations**: "Increase savings by $X"
4. **Gamify progress**: Show progress bars, milestones
5. **A/B test iterations**: Does 5k vs 10k impact conversion?
6. **Track abandonment**: Where do users drop off in the flow?
7. **Educate users**: Add tooltips, help text, video explainers

---

## Glossary

| Term                          | Definition                                                       |
| ----------------------------- | ---------------------------------------------------------------- |
| **Monte Carlo Simulation**    | Statistical technique using random sampling to model uncertainty |
| **Geometric Brownian Motion** | Mathematical model for random stock price movements              |
| **Percentile**                | Value below which a percentage of observations fall              |
| **Volatility**                | Standard deviation of returns (measure of risk)                  |
| **Expected Return**           | Average return anticipated over time                             |
| **Sharpe Ratio**              | Risk-adjusted return metric (higher is better)                   |
| **Value at Risk (VaR)**       | Maximum expected loss at a given confidence level                |
| **Drawdown**                  | Peak-to-trough decline in portfolio value                        |
| **CAGR**                      | Compound Annual Growth Rate                                      |
| **Time Series**               | Sequence of data points indexed in time order                    |
| **Stochastic**                | Randomly determined; having a random probability distribution    |
| **Iteration**                 | Single run through the simulation loop                           |

---

## Changelog

### v1.0 - 2025-11-19

- Initial implementation
- 4 simulation endpoints
- 5 predefined market scenarios
- 25+ statistical utility functions
- Premium tier gating
- Usage tracking
- Comprehensive test coverage

---

## Support

For questions or issues:

- **GitHub Issues**: https://github.com/madfam-io/dhanam/issues
- **Documentation**: https://docs.dhanam.io/simulations
- **Email**: support@dhanam.io

---

**Built with ❤️ by the Dhanam team**
