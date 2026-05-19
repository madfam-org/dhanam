# @dhanam/simulations

> Statistical simulation engines for wealth planning and financial projections.

## Overview

This package provides Monte Carlo simulation and scenario analysis capabilities for:

- **Retirement Planning**: Success probability calculations with pre/post-retirement phases
- **Goal Projections**: Wealth accumulation forecasting with confidence intervals
- **Safe Withdrawal Rate**: Dynamic calculation based on portfolio characteristics
- **Stress Testing**: Scenario analysis against adverse market conditions and life events

## Installation

```bash
# From monorepo root
pnpm add @dhanam/simulations

# Already included in API dependencies
```

## Quick Start

### Basic Monte Carlo Simulation

```typescript
import { monteCarloEngine } from '@dhanam/simulations';

const result = monteCarloEngine.simulate({
  initialBalance: 100000,
  monthlyContribution: 1000,
  years: 30,
  iterations: 10000,
  expectedReturn: 0.07, // 7% annual return
  returnVolatility: 0.15, // 15% standard deviation
  inflationRate: 0.03, // 3% inflation
  inflationAdjustedContributions: true,
});

console.log(`Median final balance: $${result.finalBalance.median.toLocaleString()}`);
console.log(`Success rate: ${(result.probabilities.successRate * 100).toFixed(1)}%`);
```

### Retirement Simulation

```typescript
import { monteCarloEngine } from '@dhanam/simulations';

const retirement = monteCarloEngine.simulateRetirement({
  currentAge: 35,
  retirementAge: 65,
  lifeExpectancy: 90,
  currentSavings: 150000,
  monthlyContribution: 2000,
  monthlyWithdrawal: 5000,
  preRetirementReturn: 0.08, // Higher risk during accumulation
  postRetirementReturn: 0.05, // Lower risk during distribution
  returnVolatility: 0.12,
  iterations: 10000,
  inflationRate: 0.025,
});

console.log(`Retirement success probability: ${(retirement.successProbability * 100).toFixed(1)}%`);
console.log(
  `Balance at retirement (median): $${retirement.balanceAtRetirement.median.toLocaleString()}`
);
```

### Scenario Analysis

```typescript
import { scenarioAnalysisEngine, ScenarioType } from '@dhanam/simulations';

const baselineConfig = {
  initialBalance: 500000,
  monthlyContribution: 0,
  years: 25,
  iterations: 10000,
  expectedReturn: 0.06,
  returnVolatility: 0.12,
};

// Analyze single scenario
const result = scenarioAnalysisEngine.analyzeScenario(baselineConfig, ScenarioType.MARKET_CRASH);

console.log(`Impact severity: ${result.comparison.impactSeverity}`);
console.log(`Median impact: ${result.comparison.medianDifferencePercent.toFixed(1)}%`);

// Analyze multiple scenarios
const allResults = scenarioAnalysisEngine.analyzeMultipleScenarios(baselineConfig, [
  ScenarioType.JOB_LOSS,
  ScenarioType.MARKET_CRASH,
  ScenarioType.RECESSION,
]);
```

## API Reference

### Monte Carlo Engine

#### `simulate(config: SimulationConfig): SimulationResult`

Run a Monte Carlo simulation with the given configuration.

**SimulationConfig:**
| Property | Type | Description |
|----------|------|-------------|
| `initialBalance` | number | Starting portfolio balance |
| `monthlyContribution` | number | Monthly contribution (negative for withdrawals) |
| `years` | number | Simulation period in years |
| `iterations` | number | Number of Monte Carlo iterations (100-100,000) |
| `expectedReturn` | number | Expected annual return (e.g., 0.07 for 7%) |
| `returnVolatility` | number | Annual return volatility (e.g., 0.15 for 15%) |
| `inflationRate?` | number | Annual inflation rate (optional) |
| `inflationAdjustedContributions?` | boolean | Adjust contributions for inflation |

**SimulationResult:**
| Property | Type | Description |
|----------|------|-------------|
| `finalBalance` | object | Statistics for final balance (median, mean, p10, p25, p75, p90, min, max) |
| `yearlyProjections` | array | Year-by-year projections with confidence intervals |
| `probabilities` | object | Success rate, doubling probability, maintaining purchasing power |
| `allOutcomes` | number[] | Raw outcomes from all iterations |
| `executionTimeMs` | number | Simulation execution time |

#### `simulateRetirement(config: RetirementSimulationConfig): RetirementSimulationResult`

Run a two-phase retirement simulation (accumulation + distribution).

#### `calculateSafeWithdrawalRate(params): number`

Binary search for safe withdrawal rate at a target success probability.

### Scenario Analysis Engine

#### `analyzeScenario(baselineConfig, scenario): ScenarioComparisonResult`

Compare baseline projection against a stressed scenario.

#### `analyzeMultipleScenarios(baselineConfig, scenarios[]): ScenarioComparisonResult[]`

Run multiple scenario analyses in batch.

### Predefined Scenarios

| Scenario            | Description                                   | Severity |
| ------------------- | --------------------------------------------- | -------- |
| `JOB_LOSS`          | 6-month complete income loss                  | Severe   |
| `MARKET_CRASH`      | 30% market downturn (2008-style)              | Severe   |
| `RECESSION`         | Economic downturn with reduced income/returns | Moderate |
| `MEDICAL_EMERGENCY` | $50k unexpected medical expense               | Moderate |
| `INFLATION_SPIKE`   | 5-year high inflation period                  | Moderate |
| `DISABILITY`        | Long-term disability (40% income replacement) | Severe   |
| `MARKET_CORRECTION` | 10% market correction with quick recovery     | Mild     |

### Statistical Utilities

```typescript
import {
  mean,
  median,
  stdDev,
  variance,
  percentile,
  correlation,
  covariance,
  normalRandom,
  cagr,
  futureValue,
  futureValueOfAnnuity,
  presentValue,
  confidenceInterval,
  summarize,
} from '@dhanam/simulations';
```

## Architecture

```
packages/simulations/
├── src/
│   ├── engines/
│   │   ├── monte-carlo.engine.ts    # Core simulation engine
│   │   └── scenario-analysis.engine.ts  # Stress testing engine
│   ├── utils/
│   │   └── statistics.util.ts       # Statistical functions
│   └── index.ts                     # Public API exports
├── __tests__/
│   └── statistics.util.spec.ts      # Unit tests
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

## Performance

- **10,000 iterations**: ~50-100ms
- **100,000 iterations**: ~500ms-1s
- **Retirement simulation**: ~100-200ms (two-phase)
- **Scenario analysis**: ~100-150ms per scenario

Recommended iteration counts:

- Quick estimates: 1,000-5,000
- Standard analysis: 10,000
- High-precision: 50,000-100,000

## Testing

```bash
# Run tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage
```

## Build

```bash
# Production build
pnpm build

# Development watch mode
pnpm dev
```

## Dependencies

- `@dhanam/shared` - Shared types and utilities

## Usage in Dhanam

The simulations package is used by the API backend for:

1. **Wealth Planning Module**: Retirement projections and goal tracking
2. **Risk Assessment**: Portfolio stress testing
3. **Advisory Features**: Safe withdrawal rate recommendations

## Mathematical Foundations

### Monte Carlo Method

The engine uses stochastic modeling where monthly returns are sampled from a normal distribution:

```
R_monthly ~ N(μ/12, σ/√12)
```

Where:

- μ = expected annual return
- σ = annual volatility

### Box-Muller Transform

Random normal numbers are generated using the Box-Muller transform for numerical stability:

```
Z = √(-2 ln U₁) × cos(2π U₂)
```

### Safe Withdrawal Rate

Uses binary search to find the withdrawal rate that achieves a target success probability (typically 90-95%) over the retirement period.

---

**Package**: `@dhanam/simulations`
**Version**: 0.1.0
**License**: AGPL-3.0
**Last Updated**: January 2025
