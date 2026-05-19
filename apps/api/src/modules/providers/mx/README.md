# MX Provider

> Financial data aggregation via MX Platform API for US and international markets.

## Purpose

The MX provider serves as a backup/failover financial data aggregator for the United States and other regions. It implements the `IFinancialProvider` interface for seamless integration with the provider orchestration system, enabling automatic failover when primary providers (Plaid, Belvo) are unavailable.

## Supported Regions/Institutions

- **Primary Region**: United States (US)
- **Coverage**: 16,000+ financial institutions worldwide
- **Account Types**:
  - Checking accounts
  - Savings accounts
  - Credit cards
  - Investment accounts
  - Loans
  - Lines of credit
  - Mortgages

## Authentication Flow

### MX Connect Widget Flow

1. **Create MX User** via `createLink()` - unique user per Dhanam user
2. **Generate Connect Widget URL** - embeddable connection UI
3. **User completes widget** - selects institution, authenticates
4. **Member created** - MX creates member linking user to institution
5. **Exchange token** via `exchangeToken()` - verify member and store credentials
6. **Aggregation begins** - MX fetches account and transaction data

```
Create User -> Widget URL -> User Authenticates -> Member Created -> Exchange -> Aggregation
```

### Token Management

- Member GUID stored as `providerUserId`
- User GUID stored in connection metadata
- Credentials encrypted: `{ memberGuid, userGuid, institutionCode }`

## API Operations

### Interface Implementation

MX implements `IFinancialProvider`:

| Method                              | Description                         |
| ----------------------------------- | ----------------------------------- |
| `healthCheck()`                     | Ping MX API and return status       |
| `createLink(params)`                | Create user and generate widget URL |
| `exchangeToken(params)`             | Verify member and store connection  |
| `getAccounts(params)`               | Fetch accounts for member           |
| `syncTransactions(params)`          | Sync transaction history            |
| `handleWebhook(payload, signature)` | Process MX webhooks                 |
| `searchInstitutions(query, region)` | Search institutions                 |
| `getInstitution(institutionId)`     | Get institution details             |

### Service Methods

- `healthCheck()` - Returns provider status with response time
- `createLink(params)` - Creates MX user and Connect widget URL
- `exchangeToken(params)` - Verifies member and creates connection
- `getAccounts(params)` - Lists all accounts for a member
- `syncTransactions(params)` - Syncs up to 90 days of transactions
- `handleWebhook(payload, signature)` - Processes MX event notifications

### Transaction Sync

- Fetches up to 1000 transactions per page
- Maximum 10 pages per sync (safety limit)
- Supports custom date ranges via `startDate` and `endDate`
- Creates or updates transactions based on GUID

## Error Handling

### Webhook Events

| Event                 | Action                           |
| --------------------- | -------------------------------- |
| `MEMBER.CREATED`      | Update connection metadata       |
| `MEMBER.UPDATED`      | Update connection status         |
| `MEMBER.AGGREGATED`   | Trigger account/transaction sync |
| `ACCOUNT.CREATED`     | Log new account                  |
| `ACCOUNT.UPDATED`     | Update account balance           |
| `TRANSACTION.CREATED` | Trigger transaction sync         |
| `TRANSACTION.UPDATED` | Trigger transaction sync         |

### Common Errors

- **Invalid credentials**: Returns `BadRequestException`
- **Member not found**: Logged and connection marked invalid
- **Rate limited**: Automatic retry with backoff
- **Aggregation failed**: Status stored in connection metadata

### Webhook Signature Verification

All webhooks verified using HMAC-SHA256 with timing-safe comparison.

## Configuration

### Environment Variables

| Variable            | Description              | Default                  |
| ------------------- | ------------------------ | ------------------------ |
| `MX_API_KEY`        | MX API key               | Required                 |
| `MX_CLIENT_ID`      | MX client ID             | Required                 |
| `MX_BASE_URL`       | MX API base URL          | `https://int-api.mx.com` |
| `MX_WEBHOOK_SECRET` | Webhook signature secret | Required                 |

### Environments

| Environment | Base URL                 |
| ----------- | ------------------------ |
| Integration | `https://int-api.mx.com` |
| Production  | `https://api.mx.com`     |

### Data Mapping

**Account Type Mapping**:

- `CHECKING` -> `checking`
- `SAVINGS` -> `savings`
- `CREDIT_CARD` -> `credit`
- `INVESTMENT` -> `investment`
- `LOAN` -> `other`
- `LINE_OF_CREDIT` -> `credit`
- `MORTGAGE` -> `other`

**Currency Mapping**:

- `MXN` -> `Currency.MXN`
- `USD` -> `Currency.USD` (default)
- `EUR` -> `Currency.EUR`

### Transaction Metadata

```json
{
  "mxCategory": "Food & Dining",
  "mxType": "DEBIT",
  "mxStatus": "POSTED",
  "mxMerchantCategoryCode": 5411,
  "mxOriginalDescription": "WALMART SUPERCENTER"
}
```

## Related Modules

- `@core/crypto/crypto.service` - Credential encryption
- `@core/prisma/prisma.service` - Database operations
- `providers/orchestrator` - Provider failover coordination
- `providers/orchestrator/provider.interface` - Interface definition

---

**Provider**: `providers/mx`
**Last Updated**: January 2025
