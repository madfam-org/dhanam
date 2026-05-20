# Transaction Execution API Documentation

## Overview

The Transaction Execution API provides autonomous transaction management capabilities for the Dhanam platform. It enables users to create, verify, and execute financial transactions across multiple providers (Bitso, Plaid, Belvo) with built-in security features like idempotency, OTP verification, and order limits.

**Base URL:** `/v1/spaces/:spaceId/orders`

**Authentication:** Required (Bearer token)

**Rate Limiting:**

- Order creation: 10 requests/minute
- OTP verification: 5 requests/5 minutes

**Premium Tier:** Required for all transaction execution endpoints

---

## Table of Contents

1. [Create Order](#create-order)
2. [Verify Order](#verify-order)
3. [Execute Order](#execute-order)
4. [Get Orders](#get-orders)
5. [Get Order](#get-order)
6. [Update Order](#update-order)
7. [Cancel Order](#cancel-order)
8. [Get Order Executions](#get-order-executions)
9. [Data Models](#data-models)
10. [Error Codes](#error-codes)

---

## Create Order

Create a new transaction order.

### Endpoint

```
POST /v1/spaces/:spaceId/orders
```

### Request Body

```typescript
{
  accountId: string;             // UUID of source account
  idempotencyKey: string;        // Unique key for duplicate prevention
  type: 'buy' | 'sell' | 'transfer' | 'deposit' | 'withdraw';
  priority?: 'low' | 'normal' | 'high' | 'critical'; // Default: 'normal'
  amount: number;                // Transaction amount (> 0.01)
  currency: 'USD' | 'MXN' | 'EUR' | 'GBP' | 'BTC' | 'ETH';
  assetSymbol?: string;          // Required for buy/sell (e.g., 'BTC', 'ETH')
  targetPrice?: number;          // Optional for limit orders
  toAccountId?: string;          // Required for transfer orders
  provider: 'bitso' | 'plaid' | 'belvo' | 'manual';
  dryRun?: boolean;              // Simulate execution (default: false)
  maxSlippage?: number;          // Max acceptable price slippage % (0-100)
  goalId?: string;               // Link to goal for auto-rebalancing
  autoExecute?: boolean;         // Execute immediately after creation
  notes?: string;                // Optional notes
  metadata?: object;             // Custom metadata
}
```

### Response

```typescript
{
  id: string;
  spaceId: string;
  userId: string;
  accountId: string;
  idempotencyKey: string;
  type: string;
  status: 'pending_verification' | 'pending_execution' | 'executing' |
          'completed' | 'failed' | 'cancelled' | 'rejected';
  priority: string;
  amount: number;
  currency: string;
  assetSymbol?: string;
  targetPrice?: number;
  toAccountId?: string;
  provider: string;
  dryRun: boolean;
  otpVerified: boolean;
  goalId?: string;
  autoExecute: boolean;
  executedAmount?: number;
  executedPrice?: number;
  fees?: number;
  feeCurrency?: string;
  errorCode?: string;
  errorMessage?: string;
  notes?: string;
  metadata?: object;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  executedAt?: string;
}
```

### Examples

#### Buy Cryptocurrency (Bitso)

```bash
curl -X POST https://api.dhan.am/v1/spaces/space-123/orders \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "account-456",
    "idempotencyKey": "unique-key-789",
    "type": "buy",
    "amount": 1000,
    "currency": "MXN",
    "assetSymbol": "BTC",
    "provider": "bitso",
    "notes": "Buy BTC at market price"
  }'
```

#### Transfer via ACH (Plaid)

```bash
curl -X POST https://api.dhan.am/v1/spaces/space-123/orders \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "account-source",
    "toAccountId": "account-destination",
    "idempotencyKey": "unique-key-101",
    "type": "transfer",
    "amount": 5000,
    "currency": "USD",
    "provider": "plaid",
    "priority": "high",
    "notes": "Transfer to savings"
  }'
```

#### SPEI Transfer (Belvo)

```bash
curl -X POST https://api.dhan.am/v1/spaces/space-123/orders \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "account-mx-source",
    "toAccountId": "account-mx-destination",
    "idempotencyKey": "unique-key-202",
    "type": "transfer",
    "amount": 10000,
    "currency": "MXN",
    "provider": "belvo",
    "notes": "SPEI transfer between accounts"
  }'
```

### Status Codes

- `201 Created` - Order created successfully
- `400 Bad Request` - Invalid request body or validation error
- `403 Forbidden` - Premium tier required or insufficient permissions
- `409 Conflict` - Idempotency key already used with different request
- `429 Too Many Requests` - Rate limit exceeded

---

## Verify Order

Verify an order with OTP code. Required for high-value transactions (≥ $10,000) or sensitive operations (sell/withdraw).

### Endpoint

```
POST /v1/spaces/:spaceId/orders/:orderId/verify
```

### Request Body

```typescript
{
  otpCode: string; // 6-digit TOTP code
}
```

### Response

```typescript
{
  // Same as Create Order response with otpVerified: true
}
```

### Example

```bash
curl -X POST https://api.dhan.am/v1/spaces/space-123/orders/order-789/verify \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "otpCode": "123456"
  }'
```

### Status Codes

- `200 OK` - Order verified successfully
- `400 Bad Request` - Invalid OTP or order status
- `404 Not Found` - Order not found

---

## Execute Order

Execute a verified order. Triggers actual transaction with the provider.

### Endpoint

```
POST /v1/spaces/:spaceId/orders/:orderId/execute
```

### Request Body

No body required.

### Response

```typescript
{
  // Same as Create Order response with status updated
}
```

### Example

```bash
curl -X POST https://api.dhan.am/v1/spaces/space-123/orders/order-789/execute \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Status Codes

- `200 OK` - Order execution started
- `400 Bad Request` - Invalid order status or expired order
- `404 Not Found` - Order not found

---

## Get Orders

List all orders for a space with optional filtering and pagination.

### Endpoint

```
GET /v1/spaces/:spaceId/orders
```

### Query Parameters

```typescript
{
  type?: 'buy' | 'sell' | 'transfer' | 'deposit' | 'withdraw';
  status?: 'pending_verification' | 'pending_execution' | 'executing' |
           'completed' | 'failed' | 'cancelled' | 'rejected';
  provider?: 'bitso' | 'plaid' | 'belvo' | 'manual';
  accountId?: string;
  goalId?: string;
  startDate?: string;  // ISO 8601 format
  endDate?: string;    // ISO 8601 format
  page?: number;       // Default: 1
  limit?: number;      // Default: 20, Max: 100
}
```

### Response

```typescript
{
  orders: TransactionOrder[];
  total: number;
  page: number;
  limit: number;
}
```

### Example

```bash
curl -X GET "https://api.dhan.am/v1/spaces/space-123/orders?status=completed&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Status Codes

- `200 OK` - Orders retrieved successfully
- `400 Bad Request` - Invalid query parameters

---

## Get Order

Get a single order by ID with full details.

### Endpoint

```
GET /v1/spaces/:spaceId/orders/:orderId
```

### Response

```typescript
{
  // TransactionOrder object with all fields
}
```

### Example

```bash
curl -X GET https://api.dhan.am/v1/spaces/space-123/orders/order-789 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Status Codes

- `200 OK` - Order retrieved successfully
- `404 Not Found` - Order not found

---

## Update Order

Update an order's status or notes. Only pending orders can be updated.

### Endpoint

```
PATCH /v1/spaces/:spaceId/orders/:orderId
```

### Request Body

```typescript
{
  status?: 'cancelled';
  notes?: string;
}
```

### Response

```typescript
{
  // Updated TransactionOrder object
}
```

### Example

```bash
curl -X PATCH https://api.dhan.am/v1/spaces/space-123/orders/order-789 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Updated notes for this order"
  }'
```

### Status Codes

- `200 OK` - Order updated successfully
- `400 Bad Request` - Cannot update executing/completed order
- `404 Not Found` - Order not found

---

## Cancel Order

Cancel a pending order.

### Endpoint

```
POST /v1/spaces/:spaceId/orders/:orderId/cancel
```

### Request Body

No body required.

### Response

```typescript
{
  // TransactionOrder object with status: 'cancelled'
}
```

### Example

```bash
curl -X POST https://api.dhan.am/v1/spaces/space-123/orders/order-789/cancel \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Status Codes

- `200 OK` - Order cancelled successfully
- `400 Bad Request` - Cannot cancel executing/completed order
- `404 Not Found` - Order not found

---

## Get Order Executions

Get execution history for an order. Useful for tracking retry attempts and errors.

### Endpoint

```
GET /v1/spaces/:spaceId/orders/:orderId/executions
```

### Response

```typescript
[
  {
    id: string;
    orderId: string;
    attempt: number;
    status: string;
    providerOrderId?: string;
    executedAmount?: number;
    executedPrice?: number;
    fees?: number;
    feeCurrency?: string;
    errorCode?: string;
    errorMessage?: string;
    rawResponse?: object;
    startedAt: string;
    completedAt?: string;
    executionTime?: number; // milliseconds
  }
]
```

### Example

```bash
curl -X GET https://api.dhan.am/v1/spaces/space-123/orders/order-789/executions \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Status Codes

- `200 OK` - Executions retrieved successfully
- `404 Not Found` - Order not found

---

## Data Models

### TransactionOrder

Main order entity representing a financial transaction.

| Field          | Type              | Required | Description                   |
| -------------- | ----------------- | -------- | ----------------------------- |
| id             | string            | Yes      | UUID                          |
| spaceId        | string            | Yes      | UUID of space                 |
| userId         | string            | Yes      | UUID of user who created      |
| accountId      | string            | Yes      | UUID of source account        |
| idempotencyKey | string            | Yes      | Unique key for deduplication  |
| type           | OrderType         | Yes      | Type of transaction           |
| status         | OrderStatus       | Yes      | Current status                |
| priority       | OrderPriority     | Yes      | Execution priority            |
| amount         | number            | Yes      | Transaction amount            |
| currency       | Currency          | Yes      | Currency code                 |
| assetSymbol    | string            | No       | Asset for buy/sell orders     |
| targetPrice    | number            | No       | Target price for limit orders |
| toAccountId    | string            | No       | Destination account UUID      |
| provider       | ExecutionProvider | Yes      | Execution provider            |
| dryRun         | boolean           | Yes      | Simulation mode flag          |
| otpVerified    | boolean           | Yes      | OTP verification status       |
| goalId         | string            | No       | Linked goal UUID              |
| autoExecute    | boolean           | Yes      | Auto-execution flag           |
| executedAmount | number            | No       | Actual executed amount        |
| executedPrice  | number            | No       | Actual execution price        |
| fees           | number            | No       | Transaction fees              |
| feeCurrency    | string            | No       | Fee currency                  |
| errorCode      | string            | No       | Error code if failed          |
| errorMessage   | string            | No       | Error message                 |
| notes          | string            | No       | User notes                    |
| metadata       | object            | No       | Custom metadata               |
| createdAt      | string            | Yes      | ISO 8601 timestamp            |
| updatedAt      | string            | Yes      | ISO 8601 timestamp            |
| expiresAt      | string            | Yes      | Expiration timestamp (24h)    |
| executedAt     | string            | No       | Execution timestamp           |

### OrderExecution

Represents a single execution attempt for an order.

| Field           | Type   | Required | Description                |
| --------------- | ------ | -------- | -------------------------- |
| id              | string | Yes      | UUID                       |
| orderId         | string | Yes      | Parent order UUID          |
| attempt         | number | Yes      | Attempt number (1-indexed) |
| status          | string | Yes      | Execution status           |
| providerOrderId | string | No       | Provider's order ID        |
| executedAmount  | number | No       | Executed amount            |
| executedPrice   | number | No       | Execution price            |
| fees            | number | No       | Fees charged               |
| feeCurrency     | string | No       | Fee currency               |
| errorCode       | string | No       | Error code if failed       |
| errorMessage    | string | No       | Error message              |
| rawResponse     | object | No       | Full provider response     |
| startedAt       | string | Yes      | Start timestamp            |
| completedAt     | string | No       | Completion timestamp       |
| executionTime   | number | No       | Duration in milliseconds   |

---

## Error Codes

### Order Creation Errors

| Code                   | Description                                         | HTTP Status |
| ---------------------- | --------------------------------------------------- | ----------- |
| `IDEMPOTENCY_CONFLICT` | Idempotency key already used with different request | 409         |
| `INVALID_ACCOUNT`      | Account not found or not accessible                 | 403         |
| `LIMIT_EXCEEDED`       | Order exceeds daily/weekly/monthly limits           | 400         |
| `INVALID_AMOUNT`       | Amount below minimum or above maximum               | 400         |
| `INVALID_CURRENCY`     | Currency not supported by provider                  | 400         |
| `MISSING_DESTINATION`  | Transfer requires toAccountId                       | 400         |
| `PREMIUM_REQUIRED`     | Transaction execution requires premium tier         | 403         |
| `RATE_LIMIT_EXCEEDED`  | Too many requests                                   | 429         |

### Execution Errors

| Code                   | Description                          |
| ---------------------- | ------------------------------------ |
| `EXPIRED_ORDER`        | Order expired (>24 hours old)        |
| `INVALID_STATUS`       | Order not in executable state        |
| `NOT_VERIFIED`         | OTP verification required            |
| `PROVIDER_ERROR`       | Provider API returned error          |
| `INSUFFICIENT_BALANCE` | Account balance too low              |
| `INVALID_CREDENTIALS`  | Provider credentials missing/invalid |
| `NETWORK_ERROR`        | Network connectivity issue           |
| `TIMEOUT`              | Operation timed out                  |

### Provider-Specific Errors

**Bitso:**

- `INVALID_BOOK` - Trading pair not supported
- `ORDER_SIZE_TOO_SMALL` - Below minimum order size
- `INSUFFICIENT_FUNDS` - Not enough balance

**Plaid:**

- `AUTHORIZATION_DECLINED` - Transfer authorization failed
- `INVALID_ACCESS_TOKEN` - Account not linked or expired
- `TRANSFER_LIMIT_EXCEEDED` - Exceeds same-day ACH limit

**Belvo:**

- `INVALID_CLABE` - Invalid CLABE number format
- `PAYMENT_INTENT_FAILED` - Payment intent creation failed
- `INSUFFICIENT_FUNDS` - Not enough balance

---

## Best Practices

### Idempotency

Always provide a unique idempotency key to prevent duplicate orders. Example:

```typescript
const idempotencyKey = `web-${Date.now()}-${userId}-${Math.random()}`;
```

### Error Handling

Handle errors gracefully and check the `errorCode` field:

```typescript
if (!order.success && order.errorCode === 'LIMIT_EXCEEDED') {
  // Show user their current limits and suggest increasing them
}
```

### OTP Verification

Check if an order requires OTP verification:

```typescript
if (order.status === 'pending_verification' && !order.otpVerified) {
  // Prompt user for OTP code
  await verifyOrder(spaceId, order.id, { otpCode: userInput });
}
```

### Dry Run

Test strategies without risking real money:

```typescript
const order = await createOrder(spaceId, {
  // ... other fields
  dryRun: true, // Simulates execution
});
```

### Rate Limiting

Implement exponential backoff for rate limit errors:

```typescript
const createOrderWithRetry = async (data, retries = 3) => {
  try {
    return await createOrder(spaceId, data);
  } catch (error) {
    if (error.status === 429 && retries > 0) {
      await sleep(Math.pow(2, 4 - retries) * 1000);
      return createOrderWithRetry(data, retries - 1);
    }
    throw error;
  }
};
```

---

## Webhooks

_Coming soon_ - Configure webhooks to receive real-time updates on order status changes.

---

## Support

For questions or issues:

- Email: support@dhan.am
- GitHub: https://github.com/madfam-org/dhanam/issues
- Documentation: https://github.com/madfam-org/dhanam/tree/main/docs
