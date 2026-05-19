# Simulations Module

> API wrapper for Monte Carlo simulations, retirement projections, and scenario analysis using the `@dhanam/simulations` package.

## Purpose

The Simulations module exposes financial simulation capabilities as REST endpoints:

- **Monte Carlo Simulations**: Wealth accumulation projections with confidence intervals
- **Retirement Simulations**: Two-phase retirement planning (accumulation + distribution)
- **Safe Withdrawal Rate**: Calculate sustainable withdrawal rates for retirement
- **Scenario Analysis**: Stress test portfolios against adverse conditions
- **Usage Tracking**: Integrate with billing for tier-based limits

## Key Entities

| Entity                  | Description                              |
| ----------------------- | ---------------------------------------- |
| `SimulationsService`    | Core service wrapping simulation engines |
| `SimulationsController` | REST endpoint handlers                   |
| `Simulation`            | Database record of simulation runs       |

## API Endpoints

| Endpoint                            | Method | Description                    |
| ----------------------------------- | ------ | ------------------------------ |
| `/simulations/monte-carlo`          | POST   | Run Monte Carlo simulation     |
| `/simulations/retirement`           | POST   | Run retirement simulation      |
| `/simulations/safe-withdrawal-rate` | POST   | Calculate safe withdrawal rate |
| `/simulations/scenario-analysis`    | POST   | Run scenario stress test       |
| `/simulations/:id`                  | GET    | Get simulation result by ID    |
| `/simulations`                      | GET    | List user's simulations        |
| `/simulations/:id`                  | DELETE | Delete simulation              |

## Service Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Simulations Module                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  SimulationsController                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            │                                     │
│                            ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   SimulationsService                      │   │
│  │  • Create simulation record                               │   │
│  │  • Invoke @dhanam/simulations engines                    │   │
│  │  • Track usage with billing service                      │   │
│  │  • Store results in database                             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            │                                     │
│                            ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              @dhanam/simulations Package                  │   │
│  │  • monteCarloEngine                                       │   │
│  │  • scenarioAnalysisEngine                                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Simulation Lifecycle

```
1. Request received at controller
2. Create simulation record (status: 'running')
3. Build configuration from DTO
4. Execute simulation engine
5. Update record with results (status: 'completed')
6. Track usage metric
7. Return result with simulationId
```

### Error Handling

```
1. Simulation fails → catch error
2. Update record (status: 'failed', errorMessage)
3. Log error details
4. Re-throw for controller to handle
```

## Simulation Types

### Monte Carlo Simulation

**Input:**

```typescript
interface RunSimulationDto {
  spaceId?: string;
  goalId?: string;
  type: 'basic' | 'retirement';
  initialBalance: number;
  monthlyContribution: number;
  years: number;
  iterations?: number; // Default: 10,000
  expectedReturn: number; // e.g., 0.07 for 7%
  returnVolatility: number; // e.g., 0.15 for 15%
  inflationRate?: number;
  inflationAdjustedContributions?: boolean;
}
```

**Output:**

```typescript
interface SimulationResult {
  simulationId: string;
  finalBalance: {
    median: number;
    mean: number;
    p10: number;
    p25: number;
    p75: number;
    p90: number;
    min: number;
    max: number;
  };
  yearlyProjections: YearlyProjection[];
  probabilities: {
    successRate: number;
    doublingProbability: number;
    maintainPurchasingPower: number;
  };
  executionTimeMs: number;
}
```

### Retirement Simulation

**Input:**

```typescript
interface RunRetirementSimulationDto {
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  currentSavings: number;
  monthlyContribution: number;
  monthlyWithdrawal: number;
  preRetirementReturn: number;
  postRetirementReturn: number;
  returnVolatility: number;
  iterations?: number;
  inflationRate?: number;
}
```

### Safe Withdrawal Rate

**Input:**

```typescript
interface CalculateSafeWithdrawalRateDto {
  portfolioValue: number;
  yearsInRetirement: number;
  successProbability: number; // e.g., 0.95 for 95%
  expectedReturn: number;
  returnVolatility: number;
  inflationRate?: number;
}
```

**Output:**

```typescript
interface SafeWithdrawalResult {
  safeWithdrawalRate: number; // e.g., 0.04 for 4%
  annualWithdrawalAmount: number;
  monthlyWithdrawalAmount: number;
  successProbability: number;
  portfolioValue: number;
}
```

### Scenario Analysis

**Supported Scenarios:**
| Scenario | Description | Severity |
|----------|-------------|----------|
| `JOB_LOSS` | 6-month income loss | Severe |
| `MARKET_CRASH` | 30% market downturn | Severe |
| `RECESSION` | Reduced income/returns | Moderate |
| `MEDICAL_EMERGENCY` | $50k unexpected expense | Moderate |
| `INFLATION_SPIKE` | 5-year high inflation | Moderate |
| `DISABILITY` | 40% income replacement | Severe |
| `MARKET_CORRECTION` | 10% correction | Mild |

## Usage Limits

Simulations are subject to tier-based usage limits:

| Tier    | Monte Carlo | Scenario Analysis |
| ------- | ----------- | ----------------- |
| Free    | 3/day       | 1/day             |
| Premium | Unlimited   | Unlimited         |

Usage is tracked via `BillingService.recordUsage()`.

## Error Handling

| Error                | HTTP Status | Description                 |
| -------------------- | ----------- | --------------------------- |
| Simulation not found | 404         | Invalid simulation ID       |
| Access denied        | 404         | User doesn't own simulation |
| Usage limit exceeded | 403         | Free tier limit reached     |
| Invalid parameters   | 400         | Validation failure          |

## Configuration

```typescript
// Default iterations
DEFAULT_ITERATIONS = 10000;

// Performance guidelines
// 10,000 iterations: ~50-100ms
// 50,000 iterations: ~200-500ms
// 100,000 iterations: ~500ms-1s
```

## Related Modules

| Module                                                                 | Relationship                         |
| ---------------------------------------------------------------------- | ------------------------------------ |
| [`@dhanam/simulations`](../../../../../packages/simulations/README.md) | Core simulation engines              |
| [`billing`](../billing/README.md)                                      | Usage tracking and limits            |
| [`goals`](../goals/README.md)                                          | Links simulations to financial goals |
| [`analytics`](../analytics/README.md)                                  | Uses simulation data for forecasts   |

## Testing

```bash
# Run simulations tests
pnpm test -- simulations

# Test specific operations
pnpm test -- simulations.service.spec.ts

# Coverage
pnpm test:coverage -- simulations
```

---

**Module**: `simulations`
**Last Updated**: January 2025
