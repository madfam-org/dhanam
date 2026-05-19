# @dhanam/esg

> ESG (Environmental, Social, Governance) scoring adapters for crypto assets using the Dhanam methodology.

## Overview

This package provides ESG scoring capabilities for cryptocurrency portfolios:

- **ESG Scoring**: Environmental, Social, and Governance metrics for crypto assets
- **Portfolio Analysis**: Weighted ESG scores across holdings with insights
- **Provider System**: Extensible provider architecture with caching and fallback
- **Methodology**: Transparent scoring based on consensus mechanism, decentralization, and governance

## Installation

```bash
# From monorepo root
pnpm add @dhanam/esg

# Already included in API dependencies
```

## Quick Start

### Basic ESG Lookup

```typescript
import { ESGManager } from '@dhanam/esg';

const esgManager = new ESGManager();

// Get ESG score for a single asset
const btcScore = await esgManager.getAssetESG('BTC');

if (btcScore) {
  console.log(`Bitcoin ESG Score: ${btcScore.score.overall}/100`);
  console.log(`  Environmental: ${btcScore.score.environmental}`);
  console.log(`  Social: ${btcScore.score.social}`);
  console.log(`  Governance: ${btcScore.score.governance}`);
  console.log(`  Consensus: ${btcScore.metrics.consensusMechanism}`);
}
```

### Portfolio Analysis

```typescript
import { ESGManager, PortfolioHolding } from '@dhanam/esg';

const esgManager = new ESGManager();

const portfolio: PortfolioHolding[] = [
  { symbol: 'ETH', value: 50000 },
  { symbol: 'BTC', value: 30000 },
  { symbol: 'SOL', value: 15000 },
  { symbol: 'USDC', value: 5000 },
];

const analysis = await esgManager.analyzePortfolio(portfolio);

console.log(`Portfolio ESG Score: ${analysis.weightedScore.overall}/100`);
console.log('\nAsset Breakdown:');
analysis.assetBreakdown.forEach((asset) => {
  console.log(
    `  ${asset.symbol}: ${asset.score.overall} (${(asset.weight * 100).toFixed(1)}% weight)`
  );
});

console.log('\nTop Performers:', analysis.insights.topPerformers.join(', '));
console.log('Areas to Improve:', analysis.insights.improvementAreas.join(', '));
```

### Multiple Assets

```typescript
import { ESGManager } from '@dhanam/esg';

const esgManager = new ESGManager();

const symbols = ['BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'AVAX'];
const esgData = await esgManager.getMultipleAssetESG(symbols);

esgData.forEach((asset) => {
  console.log(`${asset.symbol}: ${asset.score.overall}/100 (${asset.metrics.consensusMechanism})`);
});
```

### Custom Configuration

```typescript
import { ESGManager, ESGConfiguration } from '@dhanam/esg';

const config: Partial<ESGConfiguration> = {
  caching: {
    ttl: 7200, // 2 hour cache
    maxSize: 500, // Max 500 cached assets
  },
  scoring: {
    weights: {
      environmental: 0.5, // Weight environmental more heavily
      social: 0.25,
      governance: 0.25,
    },
    minimumConfidence: 60, // Require higher confidence scores
  },
  updates: {
    refreshInterval: 3600,
    batchSize: 20,
  },
};

const esgManager = new ESGManager(config);
```

## API Reference

### ESGManager

The main class for ESG operations.

#### Constructor

```typescript
new ESGManager(config?: Partial<ESGConfiguration>)
```

#### Methods

| Method                         | Description                                |
| ------------------------------ | ------------------------------------------ |
| `getAssetESG(symbol)`          | Get ESG data for a single asset            |
| `getMultipleAssetESG(symbols)` | Get ESG data for multiple assets (batched) |
| `analyzePortfolio(holdings)`   | Analyze portfolio ESG with weighted scores |
| `refreshAssetData(symbols)`    | Force refresh data for specified assets    |
| `registerProvider(provider)`   | Register a custom ESG data provider        |
| `getCacheStats()`              | Get cache size and hit rate statistics     |
| `clearCache()`                 | Clear all cached ESG data                  |
| `getConfiguration()`           | Get current configuration                  |
| `updateConfiguration(config)`  | Update configuration at runtime            |

### Types

#### ESGScore

```typescript
interface ESGScore {
  overall: number; // 0-100 composite score
  environmental: number; // 0-100 E score
  social: number; // 0-100 S score
  governance: number; // 0-100 G score
  confidence: number; // 0-100 data confidence
  lastUpdated: Date;
  methodology: string;
  sources: string[];
}
```

#### ESGMetrics

```typescript
interface ESGMetrics {
  energyIntensity?: number; // kWh per transaction
  carbonIntensity?: number; // gCO2 per transaction
  consensusMechanism: 'pow' | 'pos' | 'dpos' | 'hybrid' | 'other';
  decentralizationScore?: number;
  developerActivity?: number;
  communityEngagement?: number;
  transparencyScore?: number;
  regulatoryCompliance?: number;
}
```

#### AssetESGData

```typescript
interface AssetESGData {
  symbol: string;
  name: string;
  score: ESGScore;
  metrics: ESGMetrics;
  category: 'cryptocurrency' | 'defi' | 'nft' | 'stablecoin';
  marketCap?: number;
  volume24h?: number;
}
```

#### PortfolioHolding

```typescript
interface PortfolioHolding {
  symbol: string;
  value: number; // USD value of holding
}
```

#### PortfolioESGAnalysis

```typescript
interface PortfolioESGAnalysis {
  weightedScore: ESGScore;
  assetBreakdown: Array<{
    symbol: string;
    weight: number;
    score: ESGScore;
    contribution: number;
  }>;
  insights: {
    topPerformers: string[];
    improvementAreas: string[];
    recommendations: string[];
  };
  trends: {
    scoreHistory: Array<{ date: Date; score: number }>;
    monthOverMonth: number;
    yearOverYear: number;
  };
}
```

## Scoring Methodology

### Environmental (E) - 40% Default Weight

| Factor              | Weight | Description                     |
| ------------------- | ------ | ------------------------------- |
| Consensus Mechanism | 50%    | PoS/DPoS scores higher than PoW |
| Energy Intensity    | 30%    | kWh per transaction             |
| Carbon Footprint    | 20%    | gCO2 emissions per transaction  |

**Consensus Scoring:**

- Proof of Stake (PoS): 85-100
- Delegated PoS (DPoS): 80-95
- Hybrid: 50-70
- Proof of Work (PoW): 10-40

### Social (S) - 30% Default Weight

| Factor             | Weight | Description                       |
| ------------------ | ------ | --------------------------------- |
| Community Size     | 30%    | Active users and developers       |
| Developer Activity | 30%    | GitHub commits, contributors      |
| Accessibility      | 20%    | Ease of use, wallet availability  |
| Inclusion          | 20%    | Geographic distribution, adoption |

### Governance (G) - 30% Default Weight

| Factor            | Weight | Description                             |
| ----------------- | ------ | --------------------------------------- |
| Decentralization  | 40%    | Node distribution, Nakamoto coefficient |
| Transparency      | 30%    | Open-source code, public roadmap        |
| Voting Rights     | 20%    | Token holder governance                 |
| Regulatory Stance | 10%    | Compliance with regulations             |

## Architecture

```
packages/esg/
├── src/
│   ├── providers/
│   │   └── dhanam-provider.ts    # Primary ESG data provider
│   ├── services/
│   │   ├── esg-manager.ts        # Main ESG manager class
│   │   └── portfolio-analyzer.ts # Portfolio analysis engine
│   ├── types/
│   │   └── esg.types.ts          # TypeScript interfaces
│   ├── utils/
│   │   └── scoring.ts            # Scoring calculation utilities
│   └── index.ts                  # Public API exports
├── __tests__/
│   ├── dhanam-provider.spec.ts
│   ├── esg-manager.spec.ts
│   ├── portfolio-analyzer.spec.ts
│   └── scoring.spec.ts
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

## Provider System

The ESG package uses a provider-based architecture for flexibility:

### Default Provider: Dhanam

Uses the open-source [Dhanam methodology](https://github.com/aldoruizluna/Dhanam) for scoring.

### Custom Provider

```typescript
import { ESGProvider, AssetESGData, ESGManager } from '@dhanam/esg';

class MyESGProvider implements ESGProvider {
  name = 'my-provider';

  async getAssetESG(symbol: string): Promise<AssetESGData | null> {
    // Fetch from your data source
    return {
      /* ESG data */
    };
  }

  async getMultipleAssetESG(symbols: string[]): Promise<AssetESGData[]> {
    return Promise.all(symbols.map((s) => this.getAssetESG(s)));
  }

  async refreshAssetData(symbol: string): Promise<void> {
    // Force refresh logic
  }
}

const manager = new ESGManager({
  providers: {
    primary: 'my-provider',
    fallback: ['dhanam'],
  },
});

manager.registerProvider(new MyESGProvider());
```

## Caching

The ESGManager includes built-in LRU caching:

- **Default TTL**: 1 hour (3600 seconds)
- **Default Max Size**: 1000 entries
- **Automatic Eviction**: LRU policy when cache is full

```typescript
const manager = new ESGManager();

// Check cache stats
const stats = manager.getCacheStats();
console.log(`Cache size: ${stats.size}/${stats.maxSize}`);

// Clear cache
manager.clearCache();
```

## Dependencies

**Runtime:**

- `@dhanam/shared` - Shared types and utilities
- `axios` - HTTP client for external APIs
- `date-fns` - Date manipulation
- `zod` - Schema validation

## Related Packages

| Package                                           | Relationship                         |
| ------------------------------------------------- | ------------------------------------ |
| [`@dhanam/shared`](../shared/README.md)           | Provides base types                  |
| [`@dhanam/simulations`](../simulations/README.md) | Can incorporate ESG into projections |
| [`@dhanam/config`](../config/README.md)           | Provides build configuration         |

## Usage in Dhanam

The ESG package is used by:

1. **API Module** (`apps/api/src/modules/esg/`): Exposes ESG endpoints
2. **Web Dashboard**: Displays ESG scores for crypto holdings
3. **Portfolio Views**: Shows weighted ESG analysis
4. **Reports**: Includes ESG metrics in financial reports

## Testing

```bash
# Run tests
pnpm test

# Watch mode
pnpm test --watch

# Type checking
pnpm typecheck
```

## Build

```bash
# Production build
pnpm build

# Development watch mode
pnpm dev
```

## Limitations

- **Crypto-Only**: Currently supports cryptocurrency assets only (equities/ETFs planned)
- **Data Freshness**: Scores updated based on available public data
- **Subjective Metrics**: Some governance factors involve qualitative assessment
- **Coverage**: Not all tokens have full ESG data available

---

**Package**: `@dhanam/esg`
**Version**: 0.1.0
**License**: AGPL-3.0
**Last Updated**: January 2025
