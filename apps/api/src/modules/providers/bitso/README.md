# Bitso Provider

> Cryptocurrency exchange integration for Mexico via Bitso API.

## Purpose

The Bitso provider enables read-only access to cryptocurrency holdings and trading history on Bitso, Mexico's leading crypto exchange. It supports real-time balance tracking, trade history synchronization, and portfolio valuation in USD.

## Supported Regions/Institutions

- **Region**: Mexico (MX), Latin America
- **Exchange**: Bitso (bitso.com)
- **Supported Assets**: All cryptocurrencies traded on Bitso
  - Bitcoin (BTC)
  - Ethereum (ETH)
  - Ripple (XRP)
  - Litecoin (LTC)
  - USD Coin (USDC)
  - Mexican Peso (MXN) holdings
  - 50+ additional tokens

## Authentication Flow

### API Key Authentication

1. **User provides API credentials** via `POST /providers/bitso/spaces/:spaceId/connect`
2. **Credentials validated** by fetching account status from Bitso
3. **API key and secret encrypted** separately and stored
4. **Balances synced** immediately after connection
5. **Trade history fetched** for transaction records

```
User -> API Key/Secret -> Validate -> Encrypt -> Store -> Sync Balances -> Sync Trades
```

### Credential Management

- API Key encrypted and stored as `encryptedToken`
- API Secret encrypted and stored in connection `metadata.encryptedApiSecret`
- Client ID from Bitso stored as `providerUserId`
- Auto-sync flag configurable per connection

### Request Signing

All Bitso API requests signed using HMAC-SHA256:

```
signature = HMAC-SHA256(timestamp + method + path + body, apiSecret)
Authorization: Bitso {apiKey}:{timestamp}:{signature}
```

## API Operations

### Endpoints

| Method | Endpoint                                   | Description           |
| ------ | ------------------------------------------ | --------------------- |
| `POST` | `/providers/bitso/spaces/:spaceId/connect` | Connect Bitso account |
| `POST` | `/providers/bitso/sync`                    | Manual portfolio sync |
| `GET`  | `/providers/bitso/portfolio`               | Get portfolio summary |
| `POST` | `/providers/bitso/webhook`                 | Webhook handler       |
| `GET`  | `/providers/bitso/health`                  | Service health check  |

### Service Methods

- `connectAccount(spaceId, userId, dto)` - Connect with API credentials
- `syncPortfolio(userId)` - Sync all Bitso accounts for user
- `getPortfolioSummary(userId)` - Get holdings with percentages
- `handleWebhook(webhookData, signature)` - Process Bitso webhooks
- `fetchBalances(connectionId)` - Update balances for connection

### Portfolio Data

Each crypto holding tracked with:

| Field             | Description                   |
| ----------------- | ----------------------------- |
| `cryptoCurrency`  | Token symbol (BTC, ETH, etc.) |
| `cryptoAmount`    | Amount held                   |
| `availableAmount` | Unlocked balance              |
| `lockedAmount`    | Locked in orders              |
| `usdPrice`        | Current USD price             |
| `balance`         | Total USD value               |

## Error Handling

### Webhook Events

| Type          | Action                          |
| ------------- | ------------------------------- |
| `deposits`    | Refresh balances                |
| `withdrawals` | Refresh balances                |
| `trades`      | Refresh balances and sync trade |
| `orders`      | Log order status update         |

### Common Errors

- **Invalid credentials** (401): Returns `BadRequestException` with clear message
- **Rate limited**: Automatic backoff via Axios interceptor
- **API unavailable**: Caught and logged, returns error to user

### Webhook Signature Verification

All webhooks verified using HMAC-SHA256 with `bitso-signature` header.

## Configuration

### Environment Variables

| Variable               | Description                         | Default  |
| ---------------------- | ----------------------------------- | -------- |
| `BITSO_API_KEY`        | Default Bitso API key (optional)    | -        |
| `BITSO_API_SECRET`     | Default Bitso API secret (optional) | -        |
| `BITSO_WEBHOOK_SECRET` | Webhook signature verification      | Required |

### Valuation

- All balances normalized to USD
- Real-time prices fetched from Bitso ticker API
- MXN to USD conversion using live exchange rate
- Daily valuation snapshots created for historical tracking

### Data Mapping

**Account Creation**:

- Provider: `bitso`
- Type: `crypto`
- Subtype: `crypto`
- Currency: `USD` (normalized)

**Transaction Mapping** (from trades):

- Buy orders: Positive amount
- Sell orders: Negative amount
- Merchant: `Bitso Exchange`
- Metadata includes: tradeId, orderId, symbol, price, fees

## Related Modules

- `@core/crypto/crypto.service` - Credential encryption/decryption
- `@core/prisma/prisma.service` - Database operations
- `modules/spaces/guards/space.guard` - Space access authorization
- `providers/connection-health` - Connection status monitoring

---

**Provider**: `providers/bitso`
**Last Updated**: January 2025
