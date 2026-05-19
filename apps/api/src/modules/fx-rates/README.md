# FX Rates Module

> Currency exchange rates from Banco de Mexico (Banxico) with Redis caching and multi-currency conversion support.

## Purpose

The FX Rates module provides real-time and historical exchange rate data, primarily sourced from Banxico's official API. It supports MXN, USD, and EUR currencies with automatic rate updates, caching for performance, and fallback mechanisms for reliability.

## Key Entities

| Entity               | Description                               |
| -------------------- | ----------------------------------------- |
| `ExchangeRate`       | Stored exchange rate with date and source |
| `Currency`           | Supported currency enum (MXN, USD, EUR)   |
| `BanxicoApiResponse` | Banxico API response structure            |

### Exchange Rate Structure

```typescript
interface ExchangeRate {
  fromCurrency: Currency;
  toCurrency: Currency;
  rate: number;
  date: Date;
  source: string; // 'banxico' or 'fallback'
}
```

## API Endpoints

| Method | Endpoint               | Auth | Description                          |
| ------ | ---------------------- | ---- | ------------------------------------ |
| `GET`  | `/fx-rates/rate`       | JWT  | Get exchange rate between currencies |
| `GET`  | `/fx-rates/convert`    | JWT  | Convert amount between currencies    |
| `GET`  | `/fx-rates/historical` | JWT  | Get historical rates for date range  |
| `GET`  | `/fx-rates/currencies` | No   | List supported currencies            |
| `GET`  | `/fx-rates/health`     | No   | Service health check                 |

### Query Parameters

#### GET /fx-rates/rate

| Parameter | Type     | Required | Description                     |
| --------- | -------- | -------- | ------------------------------- |
| `from`    | Currency | Yes      | Source currency (MXN, USD, EUR) |
| `to`      | Currency | Yes      | Target currency                 |
| `date`    | ISO 8601 | No       | Historical rate date            |

#### GET /fx-rates/convert

| Parameter | Type     | Required | Description          |
| --------- | -------- | -------- | -------------------- |
| `amount`  | number   | Yes      | Amount to convert    |
| `from`    | Currency | Yes      | Source currency      |
| `to`      | Currency | Yes      | Target currency      |
| `date`    | ISO 8601 | No       | Historical rate date |

#### GET /fx-rates/historical

| Parameter   | Type     | Required | Description      |
| ----------- | -------- | -------- | ---------------- |
| `from`      | Currency | Yes      | Source currency  |
| `to`        | Currency | Yes      | Target currency  |
| `startDate` | ISO 8601 | Yes      | Range start date |
| `endDate`   | ISO 8601 | Yes      | Range end date   |

### Example Requests

```bash
# Get current USD to MXN rate
GET /fx-rates/rate?from=USD&to=MXN
Authorization: Bearer <token>

# Response
{
  "from": "USD",
  "to": "MXN",
  "rate": 17.5,
  "date": "2025-01-25T12:00:00.000Z",
  "timestamp": "2025-01-25T12:30:00.000Z"
}

# Convert 1000 USD to MXN
GET /fx-rates/convert?amount=1000&from=USD&to=MXN
Authorization: Bearer <token>

# Response
{
  "originalAmount": 1000,
  "convertedAmount": 17500,
  "from": "USD",
  "to": "MXN",
  "rate": 17.5,
  "date": "2025-01-25T12:00:00.000Z",
  "timestamp": "2025-01-25T12:30:00.000Z"
}

# Get historical rates
GET /fx-rates/historical?from=USD&to=MXN&startDate=2025-01-01&endDate=2025-01-25
Authorization: Bearer <token>
```

## Service Architecture

```
FxRatesModule
    |
    +-- FxRatesController
    |       |
    |       +-- Rate queries
    |       +-- Conversion logic
    |       +-- Historical lookups
    |       +-- Health checks
    |
    +-- FxRatesService
    |       |
    |       +-- Banxico API integration
    |       +-- Cross-rate calculations
    |       +-- Cache management
    |       +-- Scheduled updates
    |       +-- Fallback handling
    |
    +-- Dependencies
            |
            +-- HttpService (Banxico API calls)
            +-- RedisService (rate caching)
            +-- PrismaService (historical storage)
            +-- ConfigService (API credentials)
```

## Data Flow

### Rate Retrieval Flow

```
1. Request received for currency pair
2. Check Redis cache (key: fx:{from}:{to}:{date})
3. If cache hit: return cached rate
4. If cache miss:
   a. Call Banxico API
   b. Parse response
   c. Cache result (TTL: 1 hour)
   d. Store in database for history
   e. Return rate
5. On API error:
   a. Check database for recent rate
   b. If found: return with stale warning
   c. If not found: return fallback rate
```

### Cross-Rate Calculation

For currency pairs not directly available from Banxico (e.g., USD/EUR):

```
USD -> EUR = (USD -> MXN) / (EUR -> MXN)
EUR -> USD = (EUR -> MXN) / (USD -> MXN)
```

### Scheduled Updates

```
Cron: Every hour (@Cron(CronExpression.EVERY_HOUR))
- Refresh USD/MXN rate
- Refresh EUR/MXN rate
- Update cache and database
```

## Configuration

### Environment Variables

| Variable            | Description           | Required |
| ------------------- | --------------------- | -------- |
| `BANXICO_API_TOKEN` | Banxico SIE API token | Yes      |
| `REDIS_URL`         | Redis connection URL  | Yes      |

### Banxico API Configuration

```typescript
const BANXICO_CONFIG = {
  BASE_URL: 'https://www.banxico.org.mx/SieAPIRest/service/v1/series',
  SERIES_IDS: {
    USD_MXN: 'SF43718', // Dollar FIX rate
    EUR_MXN: 'SF46410', // Euro rate
  },
};
```

### Cache Configuration

```typescript
const CACHE_CONFIG = {
  TTL: 3600, // 1 hour in seconds
  KEY_PREFIX: 'fx:',
  KEY_FORMAT: 'fx:{from}:{to}:{date|latest}',
};
```

### Fallback Rates

When Banxico API is unavailable and no cached/stored rate exists:

```typescript
const FALLBACK_RATES = {
  USD_MXN: 17.5,
  MXN_USD: 0.057,
  EUR_MXN: 19.2,
  MXN_EUR: 0.052,
  USD_EUR: 0.91,
  EUR_USD: 1.1,
};
```

## Supported Currencies

| Currency     | Code | Description                     |
| ------------ | ---- | ------------------------------- |
| Mexican Peso | MXN  | Base currency for Banxico rates |
| US Dollar    | USD  | Primary foreign currency        |
| Euro         | EUR  | Secondary foreign currency      |

## Related Modules

| Module          | Relationship                                        |
| --------------- | --------------------------------------------------- |
| `transactions`  | Currency conversion for multi-currency transactions |
| `accounts`      | Balance conversion for reporting                    |
| `wealth`        | Net worth in preferred currency                     |
| `manual-assets` | Asset values in different currencies                |

## Testing

```bash
# Run FX rates tests
pnpm test -- fx-rates

# Run with coverage
pnpm test:cov -- fx-rates
```

### Test Files

- `fx-rates.service.spec.ts` - Service unit tests

### Key Test Scenarios

1. Direct rate retrieval (USD/MXN, EUR/MXN)
2. Inverse rate calculation (MXN/USD)
3. Cross-rate calculation (USD/EUR)
4. Cache hit/miss scenarios
5. API error handling and fallback
6. Historical rate queries
7. Amount conversion with rounding
8. Scheduled update execution

## Performance Considerations

- **Cache TTL**: 1 hour balances freshness with API limits
- **Database storage**: Historical rates for offline availability
- **Fallback rates**: Ensures service availability during outages
- **Performance monitoring**: `@MonitorPerformance(3000)` decorator tracks slow requests

## Error Handling

| Scenario              | Behavior                             |
| --------------------- | ------------------------------------ |
| Banxico API timeout   | Return cached/fallback rate          |
| Invalid currency pair | Return fallback rate (1 for unknown) |
| Cache unavailable     | Proceed to API/database              |
| All sources fail      | Return hardcoded fallback rates      |

---

**Module**: `fx-rates`
**Last Updated**: January 2025
