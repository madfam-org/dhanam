# Blockchain Provider

> Direct blockchain integration for non-custodial cryptocurrency tracking.

## Purpose

The Blockchain provider enables read-only tracking of cryptocurrency wallets directly from the blockchain. It supports Ethereum and Bitcoin address monitoring without requiring custody or private keys - a fully non-custodial approach to crypto portfolio tracking.

## Supported Regions/Institutions

### Supported Networks

| Network  | Currency | Features                             |
| -------- | -------- | ------------------------------------ |
| Ethereum | ETH      | Balance, transactions, ERC-20 tokens |
| Bitcoin  | BTC      | Balance, transactions, xPub import   |

### Address Types

**Ethereum**:

- Standard addresses (0x...)
- All ERC-20 token balances via contract calls

**Bitcoin**:

- Legacy (P2PKH) addresses
- SegWit (P2SH-P2WPKH) addresses
- Native SegWit (Bech32) addresses
- Extended public keys (xpub, ypub, zpub) for HD wallets

## Authentication Flow

### Non-Custodial Approach

No private keys or secrets are ever stored. Only public addresses are tracked.

1. **User provides wallet address** via `POST /providers/blockchain/spaces/:spaceId/wallets`
2. **Address format validated** (checksum for ETH, network rules for BTC)
3. **Initial balance fetched** from blockchain
4. **USD value calculated** using CoinGecko prices
5. **Transaction history synced** from blockchain explorers

```
Public Address -> Validate -> Fetch Balance -> Get Price -> Calculate USD -> Sync Transactions
```

### xPub Import (Bitcoin)

1. **User provides extended public key** via `POST /providers/blockchain/spaces/:spaceId/import`
2. **Addresses derived** from xPub using HD derivation paths
3. **Non-empty addresses imported** as separate accounts
4. **Balances aggregated** across all derived addresses

## API Operations

### Endpoints

| Method   | Endpoint                                        | Description          |
| -------- | ----------------------------------------------- | -------------------- |
| `POST`   | `/providers/blockchain/spaces/:spaceId/wallets` | Add single wallet    |
| `POST`   | `/providers/blockchain/spaces/:spaceId/import`  | Import from xPub     |
| `POST`   | `/providers/blockchain/sync`                    | Sync all wallets     |
| `DELETE` | `/providers/blockchain/wallets/:accountId`      | Remove wallet        |
| `GET`    | `/providers/blockchain/health`                  | Service health check |

### Service Methods

- `addWallet(spaceId, userId, dto)` - Add and track wallet address
- `importWallet(spaceId, userId, dto)` - Import addresses from xPub
- `syncWallets(userId)` - Refresh all wallet balances
- `removeWallet(accountId, userId)` - Stop tracking wallet
- `getErc20Balance(address, tokenAddress, symbol, decimals)` - Get token balance

### Data Sources

| Network  | Balance Source              | Transaction Source  |
| -------- | --------------------------- | ------------------- |
| Ethereum | JSON-RPC Provider (Alchemy) | Recent blocks scan  |
| Bitcoin  | Blockchain.info API         | Blockchain.info API |

### Price Data

- CoinGecko API for USD prices
- 5-minute price cache to reduce API calls
- Fallback to last known price on API failure

## Error Handling

### Address Validation

| Currency | Validation                               |
| -------- | ---------------------------------------- |
| ETH      | `ethers.isAddress()` checksum validation |
| BTC      | `bitcoinjs-lib` address parsing          |

### Common Errors

- **Invalid address format**: Returns `BadRequestException` with currency-specific message
- **Unsupported currency**: Clear error message listing supported currencies
- **Price fetch failure**: Falls back to cached price or zero
- **RPC timeout**: 5-second threshold with retry logic

### Transaction Sync

- ETH: Scans last 100 blocks for transactions involving address
- BTC: Fetches last 50 transactions from Blockchain.info
- Duplicate detection via `providerTransactionId`

## Configuration

### Environment Variables

| Variable      | Description                | Default                                     |
| ------------- | -------------------------- | ------------------------------------------- |
| `ETH_RPC_URL` | Ethereum JSON-RPC endpoint | `https://eth-mainnet.g.alchemy.com/v2/demo` |

### Performance Thresholds

| Operation        | Threshold  | Monitoring                   |
| ---------------- | ---------- | ---------------------------- |
| Balance fetch    | 5 seconds  | `@MonitorPerformance(5000)`  |
| Transaction sync | 10 seconds | `@MonitorPerformance(10000)` |

### Data Mapping

**Account Metadata**:

```json
{
  "address": "0x...",
  "cryptoCurrency": "ETH",
  "cryptoBalance": "1.5",
  "network": "ethereum",
  "lastBlock": 19000000,
  "readOnly": true
}
```

**Transaction Metadata**:

```json
{
  "txHash": "0x...",
  "from": "0x...",
  "to": "0x...",
  "cryptoAmount": "0.5",
  "cryptoCurrency": "ETH",
  "fee": "0.002",
  "blockNumber": 19000000,
  "status": "confirmed",
  "network": "ethereum"
}
```

### Valuation Snapshots

- Daily `AssetValuation` records created on sync
- Enables historical portfolio tracking
- Values stored in USD

## Related Modules

- `@core/audit/audit.service` - Wallet add/remove logging
- `@core/prisma/prisma.service` - Database operations
- `modules/spaces/guards/space.guard` - Space access authorization
- `providers/defi` - DeFi position tracking for ETH wallets

---

**Provider**: `providers/blockchain`
**Last Updated**: January 2025
