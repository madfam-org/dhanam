# Finicity Provider

> Mastercard Open Banking integration for US financial data aggregation.

## Purpose

The Finicity provider serves as a tertiary backup financial data aggregator for the United States. Powered by Mastercard's Open Banking platform, it provides reliable access to US financial institutions when primary providers are unavailable. It implements the `IFinancialProvider` interface for seamless orchestration integration.

## Supported Regions/Institutions

- **Primary Region**: United States (US)
- **Secondary Region**: Canada (limited)
- **Coverage**: 15,000+ US financial institutions
- **Account Types**:
  - Checking accounts
  - Savings accounts
  - Money market accounts
  - Certificates of deposit (CD)
  - Credit cards
  - Lines of credit
  - Investment accounts (IRA, 401k, Roth)
  - Mortgages
  - Loans

## Authentication Flow

### Finicity Connect Flow

1. **Obtain partner token** - Authenticate as partner with Finicity
2. **Create Finicity customer** via `createLink()` - maps to Dhanam user
3. **Generate Connect URL** - embeddable connection widget
4. **User completes Connect** - selects institution, authenticates
5. **Exchange token** via `exchangeToken()` - fetch linked accounts
6. **Sync begins** - accounts and transactions fetched

```
Partner Auth -> Create Customer -> Connect URL -> User Auth -> Exchange -> Fetch Accounts
```

### Token Management

- Partner token: 2-hour validity, auto-refreshed 5 minutes before expiry
- Customer ID stored as `providerUserId`
- Encrypted credentials: `{ customerId, institutionId }`

### Partner Authentication

```typescript
POST /aggregation/v2/partners/authentication
{
  "partnerId": "...",
  "partnerSecret": "..."
}
// Returns: { "token": "..." }
```

## API Operations

### Interface Implementation

Finicity implements `IFinancialProvider`:

| Method                              | Description                     |
| ----------------------------------- | ------------------------------- |
| `healthCheck()`                     | Authenticate and return status  |
| `createLink(params)`                | Create customer and Connect URL |
| `exchangeToken(params)`             | Fetch accounts after Connect    |
| `getAccounts(params)`               | List customer accounts          |
| `syncTransactions(params)`          | Sync transaction history        |
| `handleWebhook(payload, signature)` | Process Finicity webhooks       |
| `searchInstitutions(query, region)` | Search institutions             |
| `getInstitution(institutionId)`     | Get institution details         |

### Service Methods

- `healthCheck()` - Authenticates and returns provider status
- `createLink(params)` - Creates Finicity customer and Connect URL
- `exchangeToken(params)` - Verifies connection and creates records
- `getAccounts(params)` - Lists all accounts for customer
- `syncTransactions(params)` - Syncs transactions with pagination
- `handleWebhook(payload, signature)` - Processes event notifications

### Transaction Sync

- Uses Unix timestamps for date range
- Default: 90 days of history
- Maximum: 1000 transactions per request
- Iterates through all customer accounts
- Creates or updates based on transaction ID

## Error Handling

### Webhook Events

| Event                 | Action                   |
| --------------------- | ------------------------ |
| `aggregation`         | Re-sync accounts         |
| `account.created`     | Log and sync account     |
| `account.updated`     | Update account data      |
| `transaction.created` | Trigger transaction sync |
| `transaction.updated` | Update transaction data  |

### Common Errors

- **Authentication failed**: Returns `BadRequestException`
- **Customer not found**: Logged with warning
- **Rate limited**: Automatic backoff via HttpService
- **Institution unavailable**: Temporary, retry recommended

### Webhook Signature Verification

All webhooks verified using HMAC-SHA256 with timing-safe comparison to prevent timing attacks.

## Configuration

### Environment Variables

| Variable                  | Description              | Default                    |
| ------------------------- | ------------------------ | -------------------------- |
| `FINICITY_PARTNER_ID`     | Finicity partner ID      | Required                   |
| `FINICITY_PARTNER_SECRET` | Finicity partner secret  | Required                   |
| `FINICITY_APP_KEY`        | Finicity application key | Required                   |
| `FINICITY_BASE_URL`       | Finicity API base URL    | `https://api.finicity.com` |
| `FINICITY_WEBHOOK_SECRET` | Webhook signature secret | Required                   |

### Environments

| Environment | Description                   |
| ----------- | ----------------------------- |
| Production  | `https://api.finicity.com`    |
| Sandbox     | Testing environment available |

### Data Mapping

**Account Type Mapping**:

- `checking` -> `checking`
- `savings` -> `savings`
- `moneyMarket` -> `savings`
- `cd` -> `savings`
- `creditCard` -> `credit`
- `lineOfCredit` -> `credit`
- `investment` -> `investment`
- `investmentTaxDeferred` -> `investment`
- `employeeStockPurchasePlan` -> `investment`
- `ira` -> `investment`
- `401k` -> `investment`
- `roth` -> `investment`
- `mortgage` -> `other`
- `loan` -> `other`

**Currency Mapping**:

- `USD` -> `Currency.USD` (default)
- `MXN` -> `Currency.MXN`
- `EUR` -> `Currency.EUR`

### Transaction Metadata

```json
{
  "finicityCategory": "Groceries",
  "finicityType": "debit",
  "finicityStatus": "posted",
  "finicityMemo": "WALMART #1234"
}
```

### Institution Search Response

```typescript
interface InstitutionInfo {
  institutionId: string;
  name: string;
  logo?: string;
  primaryColor?: string;
  url?: string;
  supportedProducts: ['accounts', 'transactions'];
  region: 'US';
}
```

## Related Modules

- `@nestjs/axios` - HTTP client for API calls
- `@core/crypto/crypto.service` - Credential encryption
- `@core/prisma/prisma.service` - Database operations
- `providers/orchestrator` - Provider failover coordination
- `providers/orchestrator/provider.interface` - Interface definition

---

**Provider**: `providers/finicity`
**Last Updated**: January 2025
