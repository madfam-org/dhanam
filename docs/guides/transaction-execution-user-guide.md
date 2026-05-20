# Transaction Execution User Guide

## Introduction

Dhanam's autonomous transaction execution system enables you to create, manage, and execute financial transactions across multiple providers with built-in security and reliability features.

**What you can do:**

- ✅ Buy and sell cryptocurrency (Bitso)
- ✅ Transfer money between accounts (Plaid ACH, Belvo SPEI)
- ✅ Automate goal-based rebalancing
- ✅ Test strategies with dry-run mode
- ✅ Track execution history and fees

---

## Getting Started

### Prerequisites

1. **Premium Subscription** - Transaction execution requires a premium tier subscription
2. **Connected Account** - Link at least one account via Bitso, Plaid, or Belvo
3. **2FA Enabled (Recommended)** - For high-value transactions (≥ $10,000)

### Supported Providers

| Provider  | Region        | Capabilities    | Currencies |
| --------- | ------------- | --------------- | ---------- |
| **Bitso** | Mexico        | Buy/Sell crypto | MXN, USD   |
| **Plaid** | United States | ACH transfers   | USD        |
| **Belvo** | Mexico        | SPEI transfers  | MXN        |

---

## Creating Your First Transaction

### Step 1: Navigate to Orders

1. Go to your Space dashboard
2. Click "Orders" in the navigation menu
3. Click "Create Order"

### Step 2: Fill Out Order Details

**Required Fields:**

- **Account** - Select source account
- **Order Type** - Choose buy, sell, transfer, deposit, or withdraw
- **Amount** - Enter transaction amount
- **Provider** - Automatically selected based on account

**Optional Fields:**

- **Asset Symbol** - For buy/sell orders (e.g., BTC, ETH)
- **Target Price** - For limit orders (leave empty for market price)
- **Destination Account** - For transfers
- **Priority** - Low, Normal, High, or Critical
- **Notes** - Add personal notes

### Step 3: Review and Submit

1. Review order details
2. Check the "Dry Run" box to test without real money (optional)
3. Click "Create Order"

### Step 4: Verification (If Required)

High-value transactions (≥ $10,000) require 2FA:

1. Enter your 6-digit 2FA code
2. Click "Verify & Execute"

### Step 5: Execution

Your order will be executed automatically and you'll see:

- ✅ Execution status
- 💰 Executed amount
- 💵 Fees charged
- ⏱️ Execution time

---

## Order Types Explained

### Buy Order

Purchase cryptocurrency using fiat currency.

**Example:**

```
Account: Bitso MXN Account
Type: Buy
Amount: 1,000 MXN
Asset: BTC
Provider: Bitso
```

**Result:** Bitcoin purchased at current market price

### Sell Order

Sell cryptocurrency for fiat currency.

**Example:**

```
Account: Bitso BTC Account
Type: Sell
Amount: 0.01 BTC
Asset: BTC
Provider: Bitso
```

**Result:** Bitcoin sold, MXN credited to account

### Transfer Order

Move money between your accounts.

**Example:**

```
Account: Checking Account (Plaid)
Type: Transfer
Amount: 500 USD
Destination: Savings Account (Plaid)
Provider: Plaid
```

**Result:** $500 transferred via same-day ACH

### Deposit Order

Move money from external source to Dhanam account.

### Withdraw Order

Move money from Dhanam account to external destination.

---

## Understanding Order Status

| Status                   | Description           | Actions Available |
| ------------------------ | --------------------- | ----------------- |
| **Pending Verification** | Waiting for 2FA       | Enter OTP code    |
| **Pending Execution**    | Verified, queued      | Cancel            |
| **Executing**            | Currently processing  | Wait              |
| **Completed**            | Successfully executed | View details      |
| **Failed**               | Execution failed      | View error, retry |
| **Cancelled**            | User cancelled        | None              |
| **Rejected**             | System rejected       | View reason       |

---

## Advanced Features

### Market vs. Limit Orders

**Market Order:**

- Executes immediately at current price
- No target price specified
- Subject to slippage

**Limit Order:**

- Executes only at specified price or better
- Set target price
- May not execute if price not reached

**Example:**

```
Type: Buy
Asset: BTC
Amount: 1,000 MXN
Target Price: 500,000 MXN/BTC  ← This makes it a limit order
```

### Dry Run Mode

Test your strategies without risking real money.

**How it works:**

1. Enable "Dry Run" when creating order
2. System simulates execution with realistic fees and slippage
3. See expected results without actual transaction
4. Review and adjust before real execution

**Use Cases:**

- Test new trading strategies
- Verify order parameters
- Estimate fees and execution

### Order Priority

Control execution urgency:

- **Low** - Execute when convenient (lower fees)
- **Normal** - Standard execution
- **High** - Expedited execution
- **Critical** - Immediate execution (goal rebalancing)

### Auto-Execution

Link orders to goals for automatic execution:

1. Create order with `goalId`
2. System monitors goal progress
3. Executes automatically when rebalancing needed

---

## Transaction Limits

Protect yourself from runaway algorithms:

| Limit Type | Default  | Purpose              |
| ---------- | -------- | -------------------- |
| Daily      | $50,000  | Daily spending cap   |
| Weekly     | $200,000 | Weekly spending cap  |
| Monthly    | $500,000 | Monthly spending cap |

**To increase limits:**

1. Go to Settings → Transaction Limits
2. Request limit increase
3. Provide verification documents

---

## Fees & Costs

### Provider Fees

| Provider  | Buy/Sell | Transfer   | Additional    |
| --------- | -------- | ---------- | ------------- |
| **Bitso** | 0.1%     | N/A        | Minimum 5 MXN |
| **Plaid** | N/A      | $0.25-0.50 | Per transfer  |
| **Belvo** | N/A      | MXN 3-8    | SPEI fee      |

### Dhanam Platform Fee

**Premium Tier:** Included in subscription (no per-transaction fees)

---

## Security Best Practices

### 1. Enable 2FA

Protect high-value transactions:

- Go to Settings → Security
- Enable TOTP 2FA
- Save backup codes

### 2. Use Unique Idempotency Keys

Prevent duplicate orders:

- Each order gets a unique key automatically
- Resubmitting same key returns original order

### 3. Review Before Executing

Always verify:

- ✅ Correct account
- ✅ Correct amount
- ✅ Correct asset (for crypto)
- ✅ Fees are acceptable

### 4. Monitor Execution

Check execution history:

- View all attempts
- Review error messages
- Track fees paid

### 5. Set Reasonable Limits

Configure limits based on your needs:

- Start with lower limits
- Increase as needed
- Monitor usage regularly

---

## Troubleshooting

### Order Stuck in "Pending Verification"

**Solution:** Enter your 2FA code

1. Check your authenticator app
2. Enter the 6-digit code
3. Click "Verify & Execute"

### Order Failed with "Insufficient Balance"

**Solution:** Check account balance

1. Go to Accounts
2. Verify current balance
3. Account for fees (add ~2% buffer)

### Order Failed with "Provider Error"

**Solution:** Check provider status

1. Visit provider status page
2. Wait for service restoration
3. Retry order when ready

### Order Cancelled Unexpectedly

**Possible Reasons:**

- Order expired (>24 hours old)
- Account credentials expired
- Provider maintenance
- Limit exceeded

**Solution:** Create new order with updated details

---

## FAQs

### Q: How long does execution take?

**A:** Varies by provider:

- **Bitso:** Instant (seconds)
- **Plaid:** Same-day ACH (hours) or standard ACH (1-3 days)
- **Belvo:** SPEI transfers (same-day or next-day)

### Q: Can I cancel an executing order?

**A:** No, once execution starts it cannot be cancelled. You can only cancel orders in "Pending Verification" or "Pending Execution" status.

### Q: What happens if execution fails?

**A:** The system will:

1. Mark order as failed
2. Log error details
3. Refund any fees (if applicable)
4. Allow you to review and retry

### Q: Are there minimum order amounts?

**A:** Yes, varies by provider:

- **Bitso:** 0.001 (currency units)
- **Plaid:** $1.00
- **Belvo:** MXN 1.00

### Q: Can I execute orders outside my space?

**A:** No, orders are scoped to spaces. Each space has its own order history and limits.

### Q: How do I get help?

**A:** Contact support:

- Email: support@dhan.am
- In-app chat
- Help Center: https://dhan.am

---

## Next Steps

- ✅ Create your first order
- ✅ Explore dry-run mode
- ✅ Link orders to goals
- ✅ Set up automated rebalancing
- ✅ Monitor execution history

**Ready to automate?** → [Goal Rebalancing Guide](./goal-rebalancing-user-guide.md)
