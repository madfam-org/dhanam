# Belvo Provider

> Open banking integration for Mexico financial institutions via Belvo API.

## Purpose

The Belvo provider enables read-only access to Mexican bank accounts, including transaction history, account balances, and financial data aggregation. It serves as the primary banking data provider for Mexico (MX) region users.

## Supported Regions/Institutions

- **Region**: Mexico (MX)
- **Coverage**: 90+ Mexican financial institutions
- **Account Types**:
  - Checking accounts (`CHECKING_ACCOUNT`)
  - Savings accounts (`SAVINGS_ACCOUNT`)
  - Credit cards (`CREDIT_CARD`)
  - Loan accounts (`LOAN_ACCOUNT`)
  - Investment accounts (`INVESTMENT_ACCOUNT`)

## Authentication Flow

### Link Creation Flow

1. **User initiates connection** via `POST /providers/belvo/spaces/:spaceId/link`
2. **Service registers link** with Belvo using institution credentials
3. **Link token encrypted** and stored in `ProviderConnection` table
4. **Accounts fetched** immediately after successful link creation
5. **Initial transaction sync** triggers for 90-day history

```
User -> API -> Belvo API -> Link Created -> Accounts Synced -> Transactions Synced
```

### Token Management

- Access tokens encrypted at rest using `CryptoService`
- Link ID stored as `providerUserId` in connection record
- Recurrent access mode enabled for automatic refresh

## API Operations

### Endpoints

| Method   | Endpoint                                        | Description           |
| -------- | ----------------------------------------------- | --------------------- |
| `POST`   | `/providers/belvo/spaces/:spaceId/link`         | Create new Belvo link |
| `POST`   | `/providers/belvo/spaces/:spaceId/sync/:linkId` | Manual sync trigger   |
| `DELETE` | `/providers/belvo/link/:linkId`                 | Delete Belvo link     |
| `POST`   | `/providers/belvo/webhook`                      | Webhook handler       |

### Service Methods

- `createLink(spaceId, userId, dto)` - Register new financial institution link
- `syncAccounts(spaceId, userId, linkId)` - Fetch and update account data
- `syncTransactions(spaceId, userId, linkId, dateFrom?, dateTo?)` - Sync transaction history
- `handleWebhook(dto, signature)` - Process Belvo webhook events
- `deleteLink(userId, linkId)` - Remove link and cleanup

## Error Handling

### Webhook Events

| Event                  | Action                               |
| ---------------------- | ------------------------------------ |
| `ACCOUNTS_CREATED`     | Sync all accounts for the link       |
| `TRANSACTIONS_CREATED` | Sync transactions for the link       |
| `LINK_FAILED`          | Log error, mark connection as failed |

### Common Errors

- **Invalid credentials**: Returns `BadRequestException` with user-friendly message
- **Link not found**: Logged and webhook skipped gracefully
- **API unavailable**: Caught and re-thrown as `BadRequestException`

### Webhook Signature Verification

All webhooks verified using HMAC-SHA256 with timing-safe comparison to prevent timing attacks.

## Configuration

### Environment Variables

| Variable                    | Description                           | Default   |
| --------------------------- | ------------------------------------- | --------- |
| `BELVO_SECRET_KEY_ID`       | Belvo API key ID                      | Required  |
| `BELVO_SECRET_KEY_PASSWORD` | Belvo API key password                | Required  |
| `BELVO_ENV`                 | Environment (sandbox/production)      | `sandbox` |
| `BELVO_WEBHOOK_SECRET`      | Webhook signature verification secret | Required  |

### Data Mapping

**Currency Mapping**:

- `MXN` -> `Currency.MXN`
- `USD` -> `Currency.USD`
- `EUR` -> `Currency.EUR`
- Default: `Currency.MXN`

**Account Type Mapping**:

- `CHECKING_ACCOUNT` -> `checking`
- `SAVINGS_ACCOUNT` -> `savings`
- `CREDIT_CARD` -> `credit`
- `LOAN_ACCOUNT` -> `other`
- `INVESTMENT_ACCOUNT` -> `investment`

## Related Modules

- `@core/crypto/crypto.service` - Token encryption/decryption
- `@core/audit/audit.service` - Connection event logging
- `@core/prisma/prisma.service` - Database operations
- `providers/orchestrator` - Multi-provider failover coordination
- `providers/connection-health` - Connection status monitoring

---

**Provider**: `providers/belvo`
**Last Updated**: January 2025
