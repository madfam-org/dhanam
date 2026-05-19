# ESG Module

> Environmental, Social, and Governance scoring for cryptocurrency assets using the Dhanam ESG Framework.

## Purpose

The ESG module provides comprehensive sustainability scoring for cryptocurrency holdings. It integrates the `@dhanam/esg` package to deliver real-time ESG analysis, portfolio-level insights, and trend recommendations for ESG-conscious investors.

## Key Entities

| Entity                 | Description                                               |
| ---------------------- | --------------------------------------------------------- |
| `EsgScore`             | Individual asset ESG score with E/S/G component breakdown |
| `AssetESGData`         | Enhanced ESG data from the Dhanam package                 |
| `PortfolioESGAnalysis` | Aggregated portfolio-level ESG metrics                    |
| `PortfolioHolding`     | Asset holding representation for analysis                 |

### ESG Score Structure

```typescript
interface EsgScore {
  symbol: string;
  assetType: 'crypto' | 'equity' | 'etf';
  environmentalScore: number; // 0-100
  socialScore: number; // 0-100
  governanceScore: number; // 0-100
  overallScore: number; // Weighted average
  grade: string; // A+ to D-
  energyIntensity?: number; // kWh per transaction
  carbonFootprint?: number; // kg CO2 per transaction
  consensusMechanism?: string;
  description?: string;
  lastUpdated: Date;
}
```

## API Endpoints

### V1 Endpoints (Basic)

| Method | Endpoint             | Auth | Description                           |
| ------ | -------------------- | ---- | ------------------------------------- |
| `GET`  | `/esg/score/:symbol` | No   | Get ESG score for an asset            |
| `GET`  | `/esg/portfolio`     | JWT  | Get portfolio ESG analysis            |
| `POST` | `/esg/compare`       | No   | Compare ESG scores of multiple assets |
| `GET`  | `/esg/trends`        | No   | Get ESG trends and market insights    |
| `GET`  | `/esg/methodology`   | No   | Get ESG scoring methodology details   |

### V2 Endpoints (Enhanced - Dhanam Package)

| Method | Endpoint                            | Auth | Description                            |
| ------ | ----------------------------------- | ---- | -------------------------------------- |
| `GET`  | `/esg/v2/score/:symbol`             | No   | Enhanced ESG score from Dhanam package |
| `GET`  | `/esg/v2/portfolio`                 | JWT  | Enhanced portfolio analysis            |
| `GET`  | `/esg/v2/spaces/:spaceId/portfolio` | JWT  | Space-specific portfolio analysis      |
| `POST` | `/esg/v2/compare`                   | No   | Enhanced multi-asset comparison        |
| `GET`  | `/esg/v2/trends`                    | No   | Enhanced trends and insights           |
| `POST` | `/esg/v2/refresh`                   | JWT  | Manually refresh ESG data              |
| `GET`  | `/esg/v2/cache/stats`               | JWT  | Get cache statistics                   |
| `POST` | `/esg/v2/cache/clear`               | JWT  | Clear ESG cache                        |

### Example Requests

```bash
# Get ESG score for Bitcoin
GET /esg/score/BTC

# Get portfolio analysis
GET /esg/portfolio
Authorization: Bearer <token>

# Compare multiple assets
POST /esg/compare
Content-Type: application/json
{ "symbols": ["BTC", "ETH", "ADA", "SOL"] }
```

## Service Architecture

```
EsgModule
    |
    +-- EsgController
    |       |
    |       +-- EsgService (V1 - built-in data)
    |       |       |
    |       |       +-- DHANAM_ESG_DATA (static dataset)
    |       |       +-- Portfolio analysis
    |       |       +-- Grade calculation
    |       |
    |       +-- EnhancedEsgService (V2 - @dhanam/esg package)
    |               |
    |               +-- ESGManager (from @dhanam/esg)
    |               +-- Configurable caching (TTL: 1 hour)
    |               +-- Weighted scoring (E: 40%, S: 30%, G: 30%)
    |
    +-- PrismaService
            |
            +-- Account (crypto holdings)
            +-- Space (portfolio grouping)
```

## Data Flow

1. **Asset Score Request**

   ```
   Client -> Controller -> Service -> DHANAM_ESG_DATA/ESGManager -> Response
   ```

2. **Portfolio Analysis**

   ```
   Client -> Controller -> Service -> PrismaService (fetch holdings)
                                   -> Calculate weights
                                   -> Apply ESG scores
                                   -> Generate insights
                                   -> Response
   ```

3. **Cache Management (V2)**
   ```
   Request -> ESGManager -> Check cache (TTL: 1 hour)
                        -> Cache hit: return cached
                        -> Cache miss: compute -> cache -> return
   ```

## Configuration

### Environment Variables

| Variable | Description                   | Default |
| -------- | ----------------------------- | ------- |
| N/A      | ESG module uses embedded data | -       |

### ESGManager Configuration (V2)

```typescript
new ESGManager({
  caching: {
    ttl: 3600, // 1 hour cache duration
    maxSize: 500, // Maximum cached assets
  },
  scoring: {
    weights: {
      environmental: 0.4, // 40% weight
      social: 0.3, // 30% weight
      governance: 0.3, // 30% weight
    },
    minimumConfidence: 60,
  },
});
```

### Supported Cryptocurrencies

The module includes built-in ESG data for:

- BTC, ETH, ADA, DOT, SOL, XRP, LTC, ALGO, MATIC, AVAX

Unknown assets receive default scores with appropriate disclaimers.

### Grading Scale

| Grade | Score Range | Description                   |
| ----- | ----------- | ----------------------------- |
| A+    | 95-100      | Exceptional ESG performance   |
| A     | 90-94       | Excellent ESG performance     |
| A-    | 85-89       | Very good ESG performance     |
| B+    | 80-84       | Good ESG performance          |
| B     | 75-79       | Above average ESG performance |
| B-    | 70-74       | Average ESG performance       |
| C+    | 65-69       | Below average ESG performance |
| C     | 60-64       | Poor ESG performance          |
| C-    | 55-59       | Very poor ESG performance     |
| D+    | 50-54       | Concerning ESG performance    |
| D     | 40-49       | Alarming ESG performance      |
| D-    | 0-39        | Unacceptable ESG performance  |

## Related Modules

| Module                 | Relationship                                     |
| ---------------------- | ------------------------------------------------ |
| `accounts`             | Source of crypto holdings for portfolio analysis |
| `spaces`               | Organizational context for space-level analysis  |
| `providers/blockchain` | Wallet data integration                          |
| `providers/defi`       | DeFi position integration                        |

## Testing

```bash
# Run ESG module tests
pnpm test -- esg

# Run with coverage
pnpm test:cov -- esg
```

### Test Files

- `esg.service.spec.ts` - Core service unit tests
- `enhanced-esg.service.spec.ts` - Enhanced service tests

### Key Test Scenarios

1. Individual asset ESG score retrieval
2. Unknown asset default scoring
3. Portfolio weighted ESG calculation
4. Grade boundary calculations
5. Cache hit/miss scenarios (V2)
6. Multi-asset comparison logic

---

**Module**: `esg`
**Last Updated**: January 2025
