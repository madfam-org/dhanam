# DeFi Provider

> Decentralized finance portfolio tracking via Zapper API.

## Purpose

The DeFi provider enables tracking of decentralized finance positions across multiple protocols and networks. It aggregates liquidity pools, lending positions, staking rewards, and yield farming data into a unified portfolio view with USD valuations.

## Supported Regions/Institutions

### Supported Networks

| Network     | Chain ID | Description       |
| ----------- | -------- | ----------------- |
| `ethereum`  | 1        | Ethereum Mainnet  |
| `polygon`   | 137      | Polygon PoS       |
| `arbitrum`  | 42161    | Arbitrum One      |
| `optimism`  | 10       | Optimism          |
| `base`      | 8453     | Base              |
| `avalanche` | 43114    | Avalanche C-Chain |
| `bsc`       | 56       | BNB Smart Chain   |

### Supported Protocols

| Protocol                      | Position Types           |
| ----------------------------- | ------------------------ |
| `uniswap-v2`                  | Liquidity pools          |
| `uniswap-v3`                  | Concentrated liquidity   |
| `aave-v2` / `aave-v3`         | Lending, borrowing       |
| `compound-v2` / `compound-v3` | Lending, borrowing       |
| `curve`                       | Liquidity pools, staking |
| `lido`                        | ETH staking (stETH)      |
| `yearn`                       | Yield vaults             |
| `maker`                       | CDP, DAI minting         |
| `convex`                      | Curve staking            |
| `balancer`                    | Liquidity pools          |
| `sushiswap`                   | Liquidity pools, farming |
| `pancakeswap`                 | Liquidity pools (BSC)    |

### Position Types

- `liquidity-pool` - DEX LP positions
- `lending` - Supplied collateral
- `borrowing` - Outstanding loans
- `staking` - Staked tokens (e.g., stETH)
- `farming` - Yield farming positions
- `vault` - Yield optimizer vaults

## Authentication Flow

### Wallet-Based Access

DeFi positions are read directly from blockchain via wallet address - no authentication required.

1. **Wallet address provided** in account metadata
2. **Zapper API queried** with wallet address
3. **Positions aggregated** across protocols
4. **Balances cached** for 5 minutes

```
Wallet Address -> Zapper API -> Protocol Positions -> Aggregated Portfolio
```

### API Authentication

Zapper API uses Basic Auth with API key:

```
Authorization: Basic {base64(apiKey + ':')}
```

## API Operations

### Endpoints

| Method | Endpoint                                         | Description                   |
| ------ | ------------------------------------------------ | ----------------------------- |
| `GET`  | `/spaces/:spaceId/defi/status`                   | Check DeFi integration status |
| `GET`  | `/spaces/:spaceId/defi/summary`                  | Get space DeFi summary        |
| `GET`  | `/spaces/:spaceId/defi/accounts/:accountId`      | Get account positions         |
| `POST` | `/spaces/:spaceId/defi/accounts/:accountId/sync` | Sync account positions        |
| `POST` | `/spaces/:spaceId/defi/sync-all`                 | Sync all crypto accounts      |

### Service Methods

**ZapperService**:

- `getPortfolio(address, network)` - Fetch all positions for wallet
- `getProtocolPositions(address, protocols, network)` - Filter by protocols
- `getMultiNetworkStats(address, networks)` - Aggregate across networks
- `isAvailable()` - Check if Zapper API is configured

**DeFiService**:

- `getAccountPositions(spaceId, accountId)` - Get positions for account
- `getSpaceDeFiSummary(spaceId)` - Aggregate all DeFi in space
- `syncAccountPositions(spaceId, accountId)` - Refresh positions
- `syncAllAccountsInSpace(spaceId)` - Batch sync all accounts

### Position Data Structure

```typescript
interface DeFiPosition {
  id: string;
  protocol: DeFiProtocol;
  network: DeFiNetwork;
  type: DeFiPositionType;
  label: string;
  tokens: DeFiToken[];
  balanceUsd: number;
  apy?: number;
  healthFactor?: number; // For lending
  borrowedUsd?: number;
  suppliedUsd?: number;
}
```

## Error Handling

### Rate Limiting

- Default: 30 requests per minute
- Automatic rate limit tracking with reset timer
- Returns cached data when rate limited
- Configurable via `ZAPPER_RATE_LIMIT`

### Fallback Behavior

When Zapper API unavailable:

- Mock data generated for development/testing
- Deterministic mock based on address hash
- Realistic position structures for UI testing

### Common Errors

- **Rate limit exceeded**: Returns cached data or mock
- **Invalid address**: Caught and returned as empty portfolio
- **Network timeout**: 10-second timeout, returns cached if available

## Configuration

### Environment Variables

| Variable            | Description         | Default                     |
| ------------------- | ------------------- | --------------------------- |
| `ZAPPER_API_KEY`    | Zapper API key      | Required for production     |
| `ZAPPER_API_URL`    | Zapper API base URL | `https://api.zapper.xyz/v2` |
| `ZAPPER_RATE_LIMIT` | Requests per minute | `30`                        |

### Caching

- Portfolio data cached in Redis
- TTL: 5 minutes (300 seconds)
- Cache key format: `zapper:portfolio:{address}:{network}`

### Account Metadata Requirements

Crypto accounts must have metadata with:

```json
{
  "walletAddress": "0x...",
  "network": "ethereum"
}
```

## Related Modules

- `@core/redis/redis.service` - Response caching
- `@core/prisma/prisma.service` - Account data storage
- `modules/spaces/spaces.service` - Space context
- `providers/blockchain` - Wallet management

---

**Provider**: `providers/defi`
**Last Updated**: January 2025
