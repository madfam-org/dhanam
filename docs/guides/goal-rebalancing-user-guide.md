# Goal Rebalancing User Guide

## Overview

Dhanam's autonomous rebalancing system automatically maintains your target asset allocations, helping you stay on track to reach your financial goals without manual intervention.

---

## How It Works

1. **Set Target Allocations** - Define percentage breakdown across accounts
2. **Monitor Drift** - System checks daily for deviations > 5%
3. **Generate Actions** - Creates buy/sell recommendations
4. **Auto-Execute** - Optionally execute rebalancing orders automatically

---

## Setting Up Auto-Rebalancing

### Step 1: Create a Goal

1. Navigate to Goals
2. Click "Create Goal"
3. Enter goal details:
   - Name (e.g., "Retirement Fund")
   - Target amount
   - Target date
   - Priority

### Step 2: Add Account Allocations

1. Click "Add Allocation"
2. Select account
3. Set target percentage
4. Repeat until 100% allocated

**Example:**

```
Goal: Retirement Fund ($100,000)
Allocations:
  - Stocks Account: 60%
  - Bonds Account: 30%
  - Cash Account: 10%
```

### Step 3: Review Rebalancing Settings

The system will:

- ✅ Check allocations daily at 2 AM
- ✅ Generate rebalancing actions if drift > 5%
- ✅ Create high-priority orders automatically
- ✅ Track progress towards goal

---

## Understanding Drift

**Drift** = How far current allocation is from target

**Example:**

```
Target: 60% Stocks ($60,000)
Current: 55% Stocks ($55,000)
Drift: 8.33% ← Exceeds 5% threshold!
```

**Rebalancing Action:** Buy $5,000 in stocks

---

## Rebalancing Dashboard

View pending rebalancing recommendations:

1. Go to Goal details
2. Click "Rebalancing" tab
3. See recommended actions:
   - Buy actions (green)
   - Sell actions (red)
   - Estimated value
   - Drift reason

### One-Click Execution

1. Review recommendations
2. Click "Execute Rebalancing"
3. System creates orders for all actions
4. Monitor execution progress

---

## Manual vs. Automatic

### Manual Rebalancing

- Review recommendations first
- Approve each rebalancing session
- Full control over timing

**Best for:** Hands-on investors

### Automatic Rebalancing

- System executes automatically
- No manual approval needed
- Runs daily at 2 AM

**Best for:** Passive investors

---

## Best Practices

### 1. Set Realistic Allocations

- Consider risk tolerance
- Account for liquidity needs
- Leave 2-5% buffer for fees

### 2. Choose Appropriate Drift Threshold

Default: 5%

- **Lower (2-3%)** - More frequent rebalancing, higher fees
- **Higher (7-10%)** - Less frequent, larger adjustments

### 3. Monitor Execution Costs

Track fees from rebalancing:

- Provider fees
- Slippage
- Tax implications (if applicable)

### 4. Review Progress Regularly

Check monthly:

- Goal progress percentage
- On-track status
- Required monthly contribution
- Allocation drift

---

## Progress Tracking

### Key Metrics

**Progress:** Current value / Target value × 100

**On Track:** Meeting linear projection to target date

**Required Monthly Contribution:** Amount needed per month to reach goal

**Days Remaining:** Time until target date

### Allocation Breakdown

For each account:

- Current value
- Target value
- Drift percentage
- Over/under allocated indicator

---

## FAQs

### Q: How often does rebalancing happen?

**A:** Daily analysis at 2 AM. Rebalancing only occurs if drift > threshold (default 5%).

### Q: Can I pause auto-rebalancing?

**A:** Yes, edit goal settings and disable auto-execution. You'll still see recommendations but must approve manually.

### Q: What if I don't have enough cash?

**A:** System will:

1. Sell over-allocated assets first
2. Use proceeds to buy under-allocated assets
3. Skip rebalancing if insufficient balance

### Q: Does rebalancing consider taxes?

**A:** Not currently. Consider tax implications before enabling auto-rebalancing for taxable accounts.

### Q: Can I exclude certain accounts?

**A:** Yes, simply don't add them to goal allocations. Only allocated accounts are rebalanced.

---

## Next Steps

- ✅ Create your first goal with allocations
- ✅ Review rebalancing recommendations
- ✅ Enable auto-rebalancing
- ✅ Monitor progress towards your goals

**Need help?** → [Transaction Execution Guide](./transaction-execution-user-guide.md)
