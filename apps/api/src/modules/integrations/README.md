# Integrations Module

> Third-party integration management with health monitoring, configuration status, and provider connectivity checks.

## Purpose

The Integrations module provides centralized management for all external service integrations:

- **Integration status dashboard** showing enabled/configured state
- **Health monitoring** with latency tracking for each provider
- **Provider configuration validation** based on environment variables
- **Real estate valuations** via Zillow API integration

## Key Entities

### Integration Status

```typescript
interface IntegrationStatus {
  name: string; // Provider name (Belvo, Plaid, Bitso)
  enabled: boolean; // Available for use
  configured: boolean; // API credentials set
  environment: string; // sandbox/production
  lastSync?: Date; // Most recent sync timestamp
}
```

### Supported Integrations

| Provider   | Region         | Type                   | Environment Variable Prefix |
| ---------- | -------------- | ---------------------- | --------------------------- |
| **Belvo**  | Mexico (LATAM) | Banking aggregation    | `BELVO_`                    |
| **Plaid**  | USA            | Banking aggregation    | `PLAID_`                    |
| **Bitso**  | Mexico         | Crypto exchange        | `BITSO_`                    |
| **Zillow** | USA            | Real estate valuations | `ZILLOW_`                   |

### Health Status Structure

```typescript
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  integrations: Array<{
    name: string;
    status: 'healthy' | 'unhealthy';
    latency?: number; // Response time in ms
    error?: string; // Error message if unhealthy
  }>;
}
```

## API Endpoints

| Method | Endpoint               | Auth   | Description                                 |
| ------ | ---------------------- | ------ | ------------------------------------------- |
| `GET`  | `/integrations/status` | Public | Get all integration configuration status    |
| `GET`  | `/integrations/health` | Public | Health check with latency for all providers |

### Example: Get Integration Status

```bash
curl "https://api.dhan.am/integrations/status"
```

**Response:**

```json
{
  "integrations": [
    {
      "name": "Belvo",
      "enabled": true,
      "configured": true,
      "environment": "production"
    },
    {
      "name": "Plaid",
      "enabled": true,
      "configured": false,
      "environment": "sandbox"
    },
    {
      "name": "Bitso",
      "enabled": true,
      "configured": true,
      "environment": "production"
    }
  ],
  "summary": {
    "total": 3,
    "enabled": 3,
    "configured": 2
  }
}
```

### Example: Health Check

```bash
curl "https://api.dhan.am/integrations/health"
```

**Response:**

```json
{
  "status": "degraded",
  "integrations": [
    {
      "name": "Belvo",
      "status": "healthy",
      "latency": 245
    },
    {
      "name": "Plaid",
      "status": "unhealthy",
      "error": "Plaid not configured"
    },
    {
      "name": "Bitso",
      "status": "healthy",
      "latency": 89
    }
  ]
}
```

## Service Architecture

```
IntegrationsModule
├── IntegrationsController   # Status and health endpoints
├── IntegrationsService      # Integration management
│   ├── Status checking
│   ├── Configuration validation
│   └── Health monitoring
└── Zillow/
    ├── ZillowService       # Property valuations
    │   ├── Address lookup
    │   ├── Zestimate retrieval
    │   ├── Property search
    │   └── Rate limiting
    └── zillow.types.ts     # Type definitions
```

### Zillow Integration

The Zillow submodule provides real estate property valuations:

```typescript
// Look up property by address
const result = await zillowService.lookupAddress('123 Main St', 'San Francisco', 'CA', '94102');

// Get valuation by Zillow Property ID
const valuation = await zillowService.getPropertyValuation('zpid_123');

// Search properties
const results = await zillowService.searchProperties('123 Main', 5);
```

**Valuation Result:**

```json
{
  "zpid": "zpid_123",
  "address": "123 Main St, San Francisco, CA 94102",
  "zestimate": 1250000,
  "zestimateLow": 1150000,
  "zestimateHigh": 1350000,
  "rentEstimate": 4500,
  "lastUpdated": "2025-01-25T00:00:00Z",
  "valueChange30Day": 15000,
  "propertyDetails": {
    "propertyType": "SingleFamily",
    "yearBuilt": 1985,
    "livingArea": 2100,
    "bedrooms": 4,
    "bathrooms": 2.5,
    "lastSoldDate": "2020-03-15",
    "lastSoldPrice": 980000
  }
}
```

## Configuration

### Environment Variables

#### Financial Providers

| Variable                    | Description            | Required           |
| --------------------------- | ---------------------- | ------------------ |
| `BELVO_SECRET_KEY_ID`       | Belvo API key ID       | For Mexico banking |
| `BELVO_SECRET_KEY_PASSWORD` | Belvo API key password | For Mexico banking |
| `BELVO_ENV`                 | Belvo environment      | Default: `sandbox` |
| `PLAID_CLIENT_ID`           | Plaid client ID        | For US banking     |
| `PLAID_SECRET`              | Plaid secret key       | For US banking     |
| `PLAID_ENV`                 | Plaid environment      | Default: `sandbox` |
| `BITSO_API_KEY`             | Bitso API key          | For crypto         |
| `BITSO_API_SECRET`          | Bitso API secret       | For crypto         |

#### Zillow Integration

| Variable                 | Description                | Default                                              |
| ------------------------ | -------------------------- | ---------------------------------------------------- |
| `ZILLOW_API_KEY`         | Bridge Data Output API key | None (mock mode)                                     |
| `ZILLOW_API_URL`         | API base URL               | `https://api.bridgedataoutput.com/api/v2/zestimates` |
| `ZILLOW_RATE_LIMIT`      | Requests per minute        | `100`                                                |
| `ZILLOW_CACHE_ENABLED`   | Enable Redis caching       | `true`                                               |
| `ZILLOW_CACHE_TTL_HOURS` | Cache duration             | `24`                                                 |

### Provider Availability Logic

```typescript
// In non-production: enabled even if not configured
// In production: only enabled if configured
const isEnabled = process.env.NODE_ENV !== 'production' || isConfigured;
```

This allows development without full credentials while ensuring production requires proper configuration.

## Related Modules

| Module            | Relationship                       |
| ----------------- | ---------------------------------- |
| `providers/belvo` | Belvo banking integration          |
| `providers/plaid` | Plaid banking integration          |
| `providers/bitso` | Bitso crypto exchange              |
| `accounts`        | Manual asset valuations via Zillow |
| `jobs`            | Scheduled valuation refreshes      |
| `redis`           | Caching for Zillow data            |

## Testing

### Unit Tests

```bash
# Run integration tests
pnpm test -- --testPathPattern=integrations

# Run Zillow tests
pnpm test -- --testPathPattern=zillow

# With coverage
pnpm test:cov -- --testPathPattern=integrations
```

### Test Scenarios

Located in `__tests__/`:

- Configuration detection for each provider
- Health check with mocked API responses
- Zillow address lookup and caching
- Rate limiting behavior
- Mock data generation for development

### Manual Testing

1. Configure environment variables for desired providers
2. Start API server (`pnpm dev:api`)
3. Check status: `GET /integrations/status`
4. Check health: `GET /integrations/health`

### Development Mode (No API Keys)

When `ZILLOW_API_KEY` is not set, the Zillow service operates in mock mode:

- Returns deterministic mock data based on input
- Allows frontend development without API costs
- Logs warning at startup indicating mock mode

---

**Module**: `integrations`
**Last Updated**: January 2025
