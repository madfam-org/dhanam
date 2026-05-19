# Plaid Provider

> Open banking integration for US financial institutions via Plaid API.

## Purpose

The Plaid provider enables read-only access to US bank accounts, credit cards, loans, and investment accounts. It serves as the primary banking data provider for United States (US) region users, supporting transactions, balances, and liability data.

## Supported Regions/Institutions

- **Region**: United States (US)
- **Coverage**: 12,000+ US financial institutions
- **Products Enabled**:
  - `Transactions` - Transaction history and real-time updates
  - `Auth` - Account and routing numbers
  - `Liabilities` - Credit cards, loans, mortgages
- **Account Types**:
  - Depository (Checking, Savings)
  - Credit (Credit Cards)
  - Loans (Auto, Student, Mortgage, Consumer, Home Equity, Line of Credit)
  - Investment accounts

## Authentication Flow

### Plaid Link Flow

1. **Generate Link Token** via `POST /providers/plaid/link-token`
2. **User completes Plaid Link** in frontend (selects institution, authenticates)
3. **Exchange public token** via `POST /providers/plaid/spaces/:spaceId/link`
4. **Access token encrypted** and stored in `ProviderConnection`
5. **Accounts synced** immediately after token exchange
6. **Initial transaction sync** via Transactions Sync API
7. **Liabilities synced** for credit/loan accounts

```
User -> Link Token -> Plaid Link UI -> Public Token -> Exchange -> Access Token -> Sync
```

### Token Management

- Public token exchanged for permanent access token
- Access tokens encrypted at rest using `CryptoService`
- Item ID stored as `providerUserId` for webhook correlation
- Sync cursor persisted for incremental transaction updates

## API Operations

### Endpoints

| Method | Endpoint                                          | Description                     |
| ------ | ------------------------------------------------- | ------------------------------- |
| `POST` | `/providers/plaid/link-token`                     | Generate Plaid Link token       |
| `POST` | `/providers/plaid/spaces/:spaceId/link`           | Exchange token and link account |
| `POST` | `/providers/plaid/webhook`                        | Webhook handler                 |
| `GET`  | `/providers/plaid/spaces/:spaceId/bills/upcoming` | Get upcoming bill payments      |
| `GET`  | `/providers/plaid/health`                         | Service health check            |

### Service Methods

- `createLinkToken(userId)` - Generate Link token for Plaid Link
- `createLink(spaceId, userId, dto)` - Exchange public token and sync accounts
- `syncTransactions(accessToken, itemId)` - Incremental transaction sync
- `syncLiabilities(accessToken, itemId)` - Sync credit card/loan details
- `getUpcomingBills(spaceId, daysAhead)` - Get liability due dates
- `handleWebhook(webhookData, signature)` - Process Plaid webhooks

### Liability Data

The provider syncs detailed liability information:

| Field                | Description                 |
| -------------------- | --------------------------- |
| `apr`                | Annual percentage rate      |
| `minimumPayment`     | Minimum payment amount      |
| `nextPaymentDueDate` | Due date for next payment   |
| `lastPaymentAmount`  | Last payment made           |
| `isOverdue`          | Overdue status flag         |
| `creditLimit`        | Credit limit (credit cards) |
| `originalPrincipal`  | Original loan amount        |

## Error Handling

### Webhook Types

| Type           | Events                                                                            | Action                                       |
| -------------- | --------------------------------------------------------------------------------- | -------------------------------------------- |
| `TRANSACTIONS` | `SYNC_UPDATES_AVAILABLE`, `DEFAULT_UPDATE`, `INITIAL_UPDATE`, `HISTORICAL_UPDATE` | Trigger transaction sync                     |
| `TRANSACTIONS` | `TRANSACTIONS_REMOVED`                                                            | Remove deleted transactions                  |
| `ACCOUNTS`     | Account updates                                                                   | Re-sync account balances                     |
| `ITEM`         | `ERROR`                                                                           | Mark connection as errored, disable accounts |
| `ITEM`         | `PENDING_EXPIRATION`                                                              | Flag for re-authentication                   |
| `ITEM`         | `USER_PERMISSION_REVOKED`                                                         | Mark as revoked, disable accounts            |

### Common Errors

- **Item login required**: User must re-authenticate via Plaid Link
- **Institution unavailable**: Temporary, retry later
- **Rate limited**: Automatic backoff and retry

### Webhook Signature Verification

All webhooks verified using HMAC-SHA256 signature in `plaid-verification` header.

## Configuration

### Environment Variables

| Variable               | Description                                  | Default   |
| ---------------------- | -------------------------------------------- | --------- |
| `PLAID_CLIENT_ID`      | Plaid client ID                              | Required  |
| `PLAID_SECRET`         | Plaid secret key                             | Required  |
| `PLAID_ENV`            | Environment (sandbox/development/production) | `sandbox` |
| `PLAID_WEBHOOK_URL`    | Webhook endpoint URL                         | Required  |
| `PLAID_WEBHOOK_SECRET` | Webhook signature secret                     | Required  |

### Data Mapping

**Currency Mapping**:

- `USD` -> `Currency.USD` (default)
- `MXN` -> `Currency.MXN`
- `EUR` -> `Currency.EUR`

**Account Type Mapping**:

- `depository` -> `checking`
- `credit` -> `credit`
- `investment` -> `investment`
- Default: `other`

## Related Modules

- `@core/crypto/crypto.service` - Token encryption/decryption
- `@core/prisma/prisma.service` - Database operations
- `modules/spaces/guards/space.guard` - Space access authorization
- `providers/orchestrator` - Multi-provider failover coordination
- `providers/connection-health` - Connection status monitoring

---

**Provider**: `providers/plaid`
**Last Updated**: January 2025
