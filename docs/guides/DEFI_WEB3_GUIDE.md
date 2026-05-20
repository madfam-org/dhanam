# DeFi/Web3 Portfolio Tracking Guide

> Track your decentralized finance positions across multiple protocols and networks.

## Overview

Dhanam integrates with the Zapper API to provide comprehensive DeFi portfolio tracking. This enables users to see their liquidity pool positions, lending/borrowing balances, staked assets, and yield farming positions alongside traditional financial accounts.

## Supported Protocols

### Liquidity Protocols

| Protocol   | Networks                                    | Position Types         |
| ---------- | ------------------------------------------- | ---------------------- |
| Uniswap V2 | Ethereum, Polygon, Arbitrum                 | Liquidity pools        |
| Uniswap V3 | Ethereum, Polygon, Arbitrum, Optimism, Base | Concentrated liquidity |
| SushiSwap  | Ethereum, Polygon, Arbitrum                 | Liquidity pools, farms |
| Curve      | Ethereum, Polygon, Arbitrum                 | Stableswap pools       |
| Balancer   | Ethereum, Polygon, Arbitrum                 | Weighted pools         |

### Lending Protocols

| Protocol | Networks                                               | Position Types      |
| -------- | ------------------------------------------------------ | ------------------- |
| Aave V2  | Ethereum, Polygon                                      | Lending, borrowing  |
| Aave V3  | Ethereum, Polygon, Arbitrum, Optimism, Base, Avalanche | Lending, borrowing  |
| Compound | Ethereum                                               | Lending, borrowing  |
| Maker    | Ethereum                                               | Vaults, DAI minting |

### Staking & Yield

| Protocol | Networks | Position Types   |
| -------- | -------- | ---------------- |
| Lido     | Ethereum | stETH staking    |
| Yearn    | Ethereum | Yield vaults     |
| Convex   | Ethereum | Curve LP staking |

## Supported Networks

| Network   | Chain ID | Native Token |
| --------- | -------- | ------------ |
| Ethereum  | 1        | ETH          |
| Polygon   | 137      | MATIC        |
| Arbitrum  | 42161    | ETH          |
| Optimism  | 10       | ETH          |
| Base      | 8453     | ETH          |
| Avalanche | 43114    | AVAX         |
| BSC       | 56       | BNB          |

## Position Types

### Liquidity Pool

Assets deposited into AMM pools to earn trading fees.

```typescript
interface LiquidityPoolPosition {
  protocol: string;
  network: string;
  type: 'liquidity-pool';
  poolAddress: string;
  tokens: TokenBalance[];
  totalValueUSD: number;
  apy?: number;
  unclaimedFees?: number;
}
```

### Lending

Assets supplied to lending protocols to earn interest.

```typescript
interface LendingPosition {
  protocol: string;
  network: string;
  type: 'lending';
  supplyAPY: number;
  tokens: TokenBalance[];
  totalValueUSD: number;
  healthFactor?: number; // For protocols with borrowing
}
```

### Borrowing

Assets borrowed from lending protocols (shown as liabilities).

```typescript
interface BorrowingPosition {
  protocol: string;
  network: string;
  type: 'borrowing';
  borrowAPY: number;
  tokens: TokenBalance[];
  totalValueUSD: number; // Negative value (liability)
  collateralRatio?: number;
}
```

### Staking

Assets staked to earn protocol rewards.

```typescript
interface StakingPosition {
  protocol: string;
  network: string;
  type: 'staking';
  stakedToken: TokenBalance;
  rewardToken?: TokenBalance;
  apy: number;
  lockPeriod?: number; // Days
}
```

### Farming

LP tokens deposited in yield farms for additional rewards.

```typescript
interface FarmingPosition {
  protocol: string;
  network: string;
  type: 'farming';
  lpToken: TokenBalance;
  pendingRewards: TokenBalance[];
  apy: number;
}
```

### Vault

Assets deposited in auto-compounding yield strategies.

```typescript
interface VaultPosition {
  protocol: string;
  network: string;
  type: 'vault';
  depositToken: string;
  shareToken: TokenBalance;
  underlyingValue: number;
  apy: number;
}
```

## API Endpoints

### List DeFi Positions

```http
GET /defi/positions?spaceId=space_123
```

**Query Parameters:**

- `spaceId` (required): Space identifier
- `protocol`: Filter by protocol name
- `network`: Filter by network
- `type`: Filter by position type

**Response:**

```json
{
  "positions": [
    {
      "id": "pos_123",
      "protocol": "uniswap-v3",
      "network": "ethereum",
      "type": "liquidity-pool",
      "label": "ETH/USDC 0.3%",
      "tokens": [
        { "symbol": "ETH", "balance": 1.5, "balanceUSD": 3750 },
        { "symbol": "USDC", "balance": 3500, "balanceUSD": 3500 }
      ],
      "totalValueUSD": 7250,
      "apy": 12.5,
      "lastUpdated": "2025-01-15T10:00:00Z"
    }
  ],
  "summary": {
    "totalValueUSD": 45000,
    "totalLiabilitiesUSD": -5000,
    "netValueUSD": 40000,
    "byProtocol": { "uniswap-v3": 15000, "aave-v3": 20000 },
    "byNetwork": { "ethereum": 35000, "polygon": 5000 }
  }
}
```

### Connect Wallet

```http
POST /defi/wallets
Content-Type: application/json

{
  "spaceId": "space_123",
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f8e123",
  "label": "Main DeFi Wallet",
  "networks": ["ethereum", "polygon", "arbitrum"]
}
```

### Sync Positions

```http
POST /defi/sync
Content-Type: application/json

{
  "spaceId": "space_123",
  "walletIds": ["wallet_123"]
}
```

## Net Worth Integration

DeFi positions are automatically included in net worth calculations:

```
Total Net Worth =
  Sum(Bank Accounts) +
  Sum(Crypto Holdings) +
  Sum(DeFi Positions - Positive) +
  Sum(Manual Assets) -
  Sum(DeFi Borrowing) -
  Sum(Other Liabilities)
```

### Position Valuation

All positions are valued in USD using real-time token prices from Zapper. Values are refreshed:

- **On-demand**: When user requests sync
- **Scheduled**: Every 4 hours via BullMQ job
- **Webhook**: Real-time updates for significant price changes

## Environment Configuration

```env
# Zapper API Configuration
ZAPPER_API_KEY=your_zapper_api_key
ZAPPER_BASE_URL=https://api.zapper.xyz/v2

# Sync Configuration
DEFI_SYNC_INTERVAL_HOURS=4
DEFI_PRICE_CACHE_TTL_MINUTES=5
```

## Error Handling

### Common Errors

| Error Code            | Description                   | Resolution                          |
| --------------------- | ----------------------------- | ----------------------------------- |
| `INVALID_ADDRESS`     | Wallet address format invalid | Use checksummed Ethereum address    |
| `UNSUPPORTED_NETWORK` | Network not supported         | Use supported networks listed above |
| `RATE_LIMIT_EXCEEDED` | Zapper API rate limit         | Wait and retry, or upgrade API tier |
| `POSITION_NOT_FOUND`  | Position no longer exists     | Position may have been closed       |

### Retry Strategy

Failed syncs are retried with exponential backoff:

- 1st retry: 1 minute
- 2nd retry: 5 minutes
- 3rd retry: 15 minutes
- Max retries: 3

## Security Considerations

- **Read-Only**: Dhanam only reads wallet balances; no transaction signing
- **No Private Keys**: Never stores or requests private keys
- **Public Addresses Only**: Only public wallet addresses are stored
- **Rate Limiting**: API calls are rate-limited to prevent abuse

## Frontend Components

### DeFi Dashboard Widget

```tsx
import { DefiPositionsWidget } from '@/components/defi/positions-widget';

<DefiPositionsWidget spaceId={spaceId} showByProtocol={true} showByNetwork={true} />;
```

### Position Details Modal

```tsx
import { DefiPositionDetails } from '@/components/defi/position-details';

<DefiPositionDetails positionId={positionId} showHistory={true} />;
```

## Related Documentation

- [API Reference](../API.md) - Full DeFi API documentation
- [Wealth Management](./GOAL_TRACKING_GUIDE.md) - Goal tracking with DeFi
- [ESG Scoring](../../packages/esg/README.md) - ESG scores for crypto assets

---

**Module**: `apps/api/src/modules/defi/`
**Package**: `@dhanam/defi-adapter`
**Status**: Implemented; production availability follows current stability gates
**Last Updated**: 2026-05-20
