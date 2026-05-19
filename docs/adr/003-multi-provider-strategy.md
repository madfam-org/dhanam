# ADR-003: Multi-Provider Financial Data Strategy

## Status

**Accepted** - January 2025

## Context

Dhanam aggregates financial data from multiple sources for a unified wealth tracking experience. Key requirements:

1. **Geographic Coverage**: Mexico (primary), US/Canada (secondary)
2. **Asset Types**: Bank accounts, credit cards, investments, crypto, real estate
3. **Reliability**: 99.9% availability target for data sync
4. **Cost Optimization**: Different providers have different pricing models
5. **Compliance**: PCI-DSS for card data, SOC 2 for financial data

Single-provider dependency creates unacceptable risk for a financial platform.

## Decision

Implement a **multi-provider orchestration strategy** with intelligent failover and geographic routing.

### Provider Matrix

| Provider       | Region     | Asset Types               | Use Case               |
| -------------- | ---------- | ------------------------- | ---------------------- |
| **Belvo**      | LATAM (MX) | Banks, Cards              | Primary for Mexico     |
| **Plaid**      | US/Canada  | Banks, Cards, Investments | Primary for US         |
| **MX**         | US/Canada  | Banks, Cards              | Backup for US          |
| **Finicity**   | US         | Banks, Investments        | Enterprise backup      |
| **Bitso**      | Global     | Crypto exchange           | Direct integration     |
| **Blockchain** | Global     | On-chain wallets          | Non-custodial tracking |
| **Zapper**     | Global     | DeFi positions            | Protocol aggregation   |
| **Zillow**     | US         | Real estate               | Property valuations    |

### Orchestration Architecture

```
User Request
     │
     ▼
┌─────────────────────────────────┐
│   Provider Orchestrator Service  │
│   (apps/api/src/modules/        │
│    providers/orchestrator/)     │
└─────────────────────────────────┘
     │
     ├── Rate Limiter (per-provider limits)
     │
     ├── Circuit Breaker (failure isolation)
     │
     └── Provider Selection (ML-based routing)
           │
           ▼
     ┌─────────────────┐
     │ Primary Provider │◄── Based on region + asset type
     └────────┬────────┘
              │ (failure)
              ▼
     ┌─────────────────┐
     │ Backup Provider  │◄── Automatic failover
     └─────────────────┘
```

### Provider Selection Logic

```typescript
// Simplified selection algorithm
function selectProvider(region: string, assetType: string): Provider[] {
  if (region === 'MX') {
    return ['belvo', 'plaid']; // Belvo primary, Plaid backup
  }
  if (region === 'US' || region === 'CA') {
    return ['plaid', 'mx', 'finicity']; // Priority order
  }
  // Crypto
  if (assetType === 'crypto_exchange') {
    return ['bitso'];
  }
  if (assetType === 'defi') {
    return ['zapper'];
  }
}
```

### Data Normalization

All providers' data is normalized to a common schema:

```typescript
interface NormalizedTransaction {
  id: string;
  externalId: string;
  provider: Provider;
  date: Date;
  amount: Decimal;
  currency: string;
  merchant: string | null;
  description: string;
  category: string | null;
  accountId: string;
  metadata: Record<string, any>; // Provider-specific data
}
```

### Circuit Breaker Pattern

```
CLOSED ──[5 failures in 5min]──► OPEN
   ▲                               │
   │                               │ [60s timeout]
   │                               ▼
   └────[2 successes]──── HALF-OPEN
```

- **Failure Threshold**: 5 failures within monitoring window
- **Recovery Timeout**: 60 seconds before retry
- **Half-Open Test**: Allow 1 request, close on success, reopen on failure

### Rate Limiting

| Provider | Requests/Min | Requests/Hour | Max Backoff |
| -------- | ------------ | ------------- | ----------- |
| Plaid    | 100          | 3,000         | 5 min       |
| Belvo    | 60           | 1,000         | 5 min       |
| MX       | 60           | 1,000         | 5 min       |
| Finicity | 50           | 1,000         | 5 min       |
| Bitso    | 30           | 500           | 10 min      |

## Consequences

### Positive

- **High Availability**: Provider outages don't affect user experience
- **Geographic Optimization**: Best provider per region
- **Cost Efficiency**: Route to cheapest provider when quality is equal
- **Future-Proof**: Easy to add new providers
- **Compliance**: Provider-specific compliance requirements isolated

### Negative

- **Complexity**: More code to maintain
- **Data Consistency**: Same account may have slightly different data across providers
- **Cost**: Multiple provider contracts
- **Testing**: Complex integration testing matrix

### Mitigations

- Comprehensive provider adapters with common interface
- Normalization layer ensures consistent data model
- Synthetic monitoring for each provider
- Contract tests for webhook handlers

## Implementation

### Key Files

- `apps/api/src/modules/providers/orchestrator/provider-orchestrator.service.ts`
- `apps/api/src/modules/providers/orchestrator/circuit-breaker.service.ts`
- `apps/api/src/modules/providers/orchestrator/rate-limiter.service.ts`
- `apps/api/src/modules/providers/*/` - Individual provider adapters

### Provider Interface

```typescript
interface FinancialDataProvider {
  name: Provider;
  supportedRegions: string[];
  supportedAssetTypes: AssetType[];

  connect(userId: string): Promise<ConnectionResult>;
  sync(connectionId: string): Promise<SyncResult>;
  getAccounts(connectionId: string): Promise<NormalizedAccount[]>;
  getTransactions(connectionId: string, params: DateRange): Promise<NormalizedTransaction[]>;
}
```

## Related Decisions

- [ADR-001](./001-nestjs-fastify.md): NestJS for provider module architecture
- [ADR-002](./002-prisma-orm.md): Prisma for normalized data storage
- [ADR-004](./004-janua-auth-integration.md): Janua for user authentication

## References

- [Plaid API Documentation](https://plaid.com/docs/)
- [Belvo API Documentation](https://developers.belvo.com/)
- Circuit Breaker Pattern (Release It! by Michael Nygard)
