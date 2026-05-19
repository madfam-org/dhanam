# Analytics Module

> Financial analytics, reporting, and forecasting services for wealth tracking and cashflow analysis.

## Purpose

The Analytics module provides comprehensive financial analysis capabilities:

- **Net Worth Tracking**: Multi-currency net worth with historical trends
- **Ownership Views**: Yours/Mine/Ours household breakdown
- **Cashflow Forecasting**: 60-day projections with weekly granularity
- **Long-term Forecasting**: 10-30 year projections with Monte Carlo
- **Spending Analysis**: Category-based spending breakdowns
- **Anomaly Detection**: Unusual transaction flagging
- **Report Generation**: Export-ready financial reports
- **PostHog Integration**: Product analytics events

## Key Entities

| Service                   | Description                   |
| ------------------------- | ----------------------------- |
| `AnalyticsService`        | Core analytics calculations   |
| `ReportService`           | Report generation             |
| `LongTermForecastService` | Multi-year projections        |
| `AnomalyService`          | Transaction anomaly detection |
| `WealthAnalytics`         | Net worth and wealth metrics  |
| `PosthogService`          | Product analytics tracking    |

## API Endpoints

### Analytics Controller

| Endpoint                          | Method | Description                |
| --------------------------------- | ------ | -------------------------- |
| `/analytics/net-worth`            | GET    | Get net worth with trends  |
| `/analytics/net-worth/history`    | GET    | Historical net worth data  |
| `/analytics/net-worth/ownership`  | GET    | Yours/Mine/Ours breakdown  |
| `/analytics/cashflow/forecast`    | GET    | 60-day cashflow forecast   |
| `/analytics/spending`             | GET    | Spending by category       |
| `/analytics/income-vs-expenses`   | GET    | Monthly income vs expenses |
| `/analytics/portfolio-allocation` | GET    | Asset allocation breakdown |
| `/analytics/dashboard`            | GET    | Combined dashboard data    |

### Reports Controller

| Endpoint            | Method | Description               |
| ------------------- | ------ | ------------------------- |
| `/reports/generate` | POST   | Generate financial report |
| `/reports/:id`      | GET    | Get generated report      |
| `/reports`          | GET    | List user's reports       |

## Service Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       Analytics Module                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐    ┌────────────────┐    ┌──────────────┐  │
│  │   Analytics    │    │    Reports     │    │   Long-term  │  │
│  │   Controller   │    │   Controller   │    │   Forecast   │  │
│  └───────┬────────┘    └───────┬────────┘    └──────┬───────┘  │
│          │                     │                    │           │
│          ▼                     ▼                    ▼           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    AnalyticsService                       │  │
│  │  • Net worth calculations                                 │  │
│  │  • Cashflow forecasting                                  │  │
│  │  • Spending analysis                                     │  │
│  │  • Ownership breakdowns                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                    │
│         ┌──────────────────┼──────────────────┐                │
│         ▼                  ▼                  ▼                │
│  ┌──────────┐      ┌──────────┐      ┌───────────┐            │
│  │ FxRates  │      │  Prisma  │      │  Anomaly  │            │
│  │ Service  │      │  Service │      │  Service  │            │
│  └──────────┘      └──────────┘      └───────────┘            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Net Worth Calculation

```
1. Verify user access to space
2. Fetch all accounts in space
3. Fetch all manual assets
4. Convert each balance to target currency (via FxRatesService)
5. Sum assets (positive balances)
6. Sum liabilities (negative balances)
7. Add DeFi value from crypto accounts (defiValueUsd in metadata)
8. Calculate 30-day trend from historical valuations
9. Return structured response
```

### Ownership Breakdown (Yours/Mine/Ours)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Account Ownership Logic                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ownership === 'joint' || 'trust' ────────────▶ 'ours'          │
│                                                                  │
│  ownerId === userId || !ownerId ──────────────▶ 'yours'         │
│                                                                  │
│  ownerId !== userId ──────────────────────────▶ 'mine'          │
│  (partner's individual account)                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Cashflow Forecasting

```
1. Get current liquid account balances (checking, savings)
2. Analyze 90-day historical patterns
3. Calculate average weekly income/expenses
4. Project 60 days forward in weekly intervals
5. Return forecast with confidence indicators
```

## Dashboard Endpoint

The `/analytics/dashboard` endpoint combines multiple data sources in parallel:

```typescript
interface DashboardResponse {
  accounts: Account[];
  recentTransactions: Transaction[];
  budgets: Budget[];
  currentBudgetSummary: BudgetSummary;
  netWorth: NetWorthResponse;
  cashflowForecast: CashflowForecast;
  portfolioAllocation: PortfolioAllocation[];
  goals: Goal[];
}
```

Benefits:

- Single API call vs multiple requests
- Parallel data fetching
- Reduced waterfall latency

## Multi-Currency Support

All calculations support multi-currency:

```typescript
// Example: Convert JPY account to USD target
await fxRatesService.convertAmount(
  accountBalance, // 1,000,000 JPY
  Currency.JPY, // Source
  Currency.USD // Target
);
// Returns: ~6,700 USD
```

## Anomaly Detection

The `AnomalyService` flags unusual transactions:

| Anomaly Type       | Description                   |
| ------------------ | ----------------------------- |
| Large Amount       | Transaction > 3x average      |
| Unusual Merchant   | New merchant with high amount |
| Timing Anomaly     | Transaction at unusual time   |
| Category Deviation | Spending spike in category    |

## Long-term Forecasting

The `LongTermForecastService` provides:

- 10-30 year wealth projections
- Monte Carlo simulation integration
- Confidence intervals (10th, 50th, 90th percentiles)
- Inflation-adjusted values
- Goal probability calculations

## PostHog Events

Events tracked via `PosthogService`:

| Event            | Trigger               |
| ---------------- | --------------------- |
| `view_net_worth` | User views net worth  |
| `view_dashboard` | Dashboard loaded      |
| `export_data`    | Data export requested |
| `view_report`    | Report accessed       |

## Configuration

```typescript
// Default forecast periods
CASHFLOW_FORECAST_DAYS = 60;
NET_WORTH_HISTORY_DAYS = 30;
INCOME_VS_EXPENSES_MONTHS = 6;

// Default currencies
DEFAULT_CURRENCY = Currency.MXN;
```

## Error Handling

| Error                      | HTTP Status | Description               |
| -------------------------- | ----------- | ------------------------- |
| Space not found            | 404         | Invalid space ID          |
| Access denied              | 403         | User lacks space access   |
| Invalid date range         | 400         | Start date after end date |
| Currency conversion failed | 500         | FX rate unavailable       |

## Related Modules

| Module                                        | Relationship               |
| --------------------------------------------- | -------------------------- |
| [`accounts`](../accounts/README.md)           | Source of account balances |
| [`transactions`](../transactions/README.md)   | Source of transaction data |
| [`budgets`](../budgets/README.md)             | Budget data for dashboard  |
| [`goals`](../goals/README.md)                 | Goal data for dashboard    |
| [`fx-rates`](../fx-rates/README.md)           | Currency conversion        |
| [`manual-assets`](../manual-assets/README.md) | Manual asset values        |
| [`simulations`](../simulations/README.md)     | Monte Carlo projections    |

## Testing

```bash
# Run analytics tests
pnpm test -- analytics

# Test specific services
pnpm test -- analytics.service.spec.ts
pnpm test -- long-term-forecast.service.spec.ts
pnpm test -- anomaly.service.spec.ts

# Coverage
pnpm test:coverage -- analytics
```

---

**Module**: `analytics`
**Last Updated**: January 2025
