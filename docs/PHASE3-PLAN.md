# Phase 3: Advanced Features - Implementation Plan

## Overview

Extend Dhanam's autonomous family office with sophisticated trading, scheduling, and tax optimization capabilities.

---

## Features to Implement

### 1. Advanced Order Types ⭐ **Priority: High**

**Capabilities:**

- Stop-loss orders (sell when price drops below threshold)
- Take-profit orders (sell when price reaches target)
- Trailing stop orders (dynamic stop-loss that follows price)
- One-cancels-other (OCO) orders
- Good-til-canceled (GTC) orders

**Database Changes:**

```prisma
// Add to schema.prisma
enum AdvancedOrderType {
  stop_loss
  take_profit
  trailing_stop
  oco  // One cancels other
}

model TransactionOrder {
  // ... existing fields

  // Advanced order fields
  advancedType      AdvancedOrderType?  @map("advanced_type")
  stopPrice         Decimal?            @db.Decimal(19, 4) @map("stop_price")
  takeProfitPrice   Decimal?            @db.Decimal(19, 4) @map("take_profit_price")
  trailingAmount    Decimal?            @db.Decimal(19, 4) @map("trailing_amount")  // Fixed amount
  trailingPercent   Decimal?            @db.Decimal(5, 2) @map("trailing_percent")  // Percentage
  linkedOrderId     String?             @map("linked_order_id")  // For OCO
  highestPrice      Decimal?            @db.Decimal(19, 4) @map("highest_price")  // For trailing stop tracking
}
```

**Implementation:**

- Price monitoring service (cron job every 5 minutes)
- Trigger evaluation logic
- Automatic order conversion (advanced → market order)
- Notification system for triggers

---

### 2. Scheduled & Recurring Orders ⭐ **Priority: High**

**Capabilities:**

- One-time scheduled orders (execute at specific datetime)
- Recurring orders (daily/weekly/monthly)
- Dollar-cost averaging (DCA) automation
- Scheduled rebalancing

**Database Changes:**

```prisma
enum RecurrencePattern {
  once
  daily
  weekly
  monthly
  quarterly
}

model TransactionOrder {
  // ... existing fields

  // Scheduling fields
  scheduledFor      DateTime?           @map("scheduled_for")
  recurrence        RecurrencePattern?
  recurrenceDay     Int?                @map("recurrence_day")  // Day of week (1-7) or month (1-31)
  recurrenceEnd     DateTime?           @map("recurrence_end")
  nextExecutionAt   DateTime?           @map("next_execution_at")
  executionCount    Int                 @default(0) @map("execution_count")
  maxExecutions     Int?                @map("max_executions")
}
```

**Implementation:**

- Scheduling service (cron job every hour)
- Recurrence calculator
- DCA strategy templates
- Calendar integration

---

### 3. Multi-Currency FX Conversion ⭐ **Priority: Medium**

**Capabilities:**

- Real-time exchange rates from multiple sources
- Automatic currency conversion in rebalancing
- Multi-currency portfolio views
- FX fee calculation

**Database Changes:**

```prisma
model ExchangeRate {
  id            String   @id @default(uuid())
  fromCurrency  Currency @map("from_currency")
  toCurrency    Currency @map("to_currency")
  rate          Decimal  @db.Decimal(19, 8)
  source        String   // e.g., 'banxico', 'ecb', 'coinbase'
  validAt       DateTime @map("valid_at")
  createdAt     DateTime @default(now()) @map("created_at")

  @@unique([fromCurrency, toCurrency, source, validAt])
  @@index([fromCurrency, toCurrency, validAt(sort: Desc)])
  @@map("exchange_rates")
}

model FxConversion {
  id                String   @id @default(uuid())
  orderId           String   @map("order_id")
  fromCurrency      Currency @map("from_currency")
  toCurrency        Currency @map("to_currency")
  fromAmount        Decimal  @db.Decimal(19, 4) @map("from_amount")
  toAmount          Decimal  @db.Decimal(19, 4) @map("to_amount")
  exchangeRate      Decimal  @db.Decimal(19, 8) @map("exchange_rate")
  fxFees            Decimal  @db.Decimal(19, 4) @map("fx_fees")
  provider          String   // FX provider
  createdAt         DateTime @default(now()) @map("created_at")

  order             TransactionOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@map("fx_conversions")
}
```

**Implementation:**

- Exchange rate fetcher service
- Rate caching (15-minute TTL)
- FX provider abstraction (Banxico, ECB, Wise API)
- Conversion calculator

---

### 4. Tax-Loss Harvesting ⭐ **Priority: Medium**

**Capabilities:**

- Identify realized losses for tax purposes
- Wash sale detection (30-day rule)
- Tax-lot tracking (FIFO, LIFO, specific identification)
- Annual tax report generation

**Database Changes:**

```prisma
enum TaxLotMethod {
  fifo  // First in, first out
  lifo  // Last in, first out
  hifo  // Highest in, first out
  specific  // Specific identification
}

model TaxLot {
  id                String      @id @default(uuid())
  userId            String      @map("user_id")
  spaceId           String      @map("space_id")
  accountId         String      @map("account_id")
  assetSymbol       String      @map("asset_symbol")

  // Purchase details
  purchaseOrderId   String      @map("purchase_order_id")
  purchaseDate      DateTime    @map("purchase_date")
  quantity          Decimal     @db.Decimal(19, 8)
  costBasis         Decimal     @db.Decimal(19, 4) @map("cost_basis")  // Total cost
  costPerUnit       Decimal     @db.Decimal(19, 8) @map("cost_per_unit")

  // Sale details (if sold)
  soldOrderId       String?     @map("sold_order_id")
  saleDate          DateTime?   @map("sale_date")
  salePrice         Decimal?    @db.Decimal(19, 4) @map("sale_price")
  realizedGainLoss  Decimal?    @db.Decimal(19, 4) @map("realized_gain_loss")
  holdingPeriod     Int?        @map("holding_period")  // Days held
  isLongTerm        Boolean     @default(false) @map("is_long_term")  // > 365 days

  // Wash sale tracking
  washSaleBlocked   Boolean     @default(false) @map("wash_sale_blocked")
  relatedLotId      String?     @map("related_lot_id")

  createdAt         DateTime    @default(now()) @map("created_at")
  updatedAt         DateTime    @updatedAt @map("updated_at")

  space             Space       @relation(fields: [spaceId], references: [id], onDelete: Cascade)
  account           Account     @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@index([userId, spaceId, accountId])
  @@index([assetSymbol, saleDate])
  @@index([purchaseDate, saleDate])
  @@map("tax_lots")
}

model TaxHarvestingOpportunity {
  id                String   @id @default(uuid())
  userId            String   @map("user_id")
  spaceId           String   @map("space_id")
  accountId         String   @map("account_id")
  assetSymbol       String   @map("asset_symbol")

  // Opportunity details
  taxLotIds         String[] @map("tax_lot_ids")
  currentPrice      Decimal  @db.Decimal(19, 8) @map("current_price")
  unrealizedLoss    Decimal  @db.Decimal(19, 4) @map("unrealized_loss")
  quantity          Decimal  @db.Decimal(19, 8)
  washSaleRisk      Boolean  @map("wash_sale_risk")
  daysUntilSafe     Int?     @map("days_until_safe")  // Days until wash sale period ends

  // Recommendations
  recommended       Boolean  @default(true)
  executedOrderId   String?  @map("executed_order_id")

  identifiedAt      DateTime @default(now()) @map("identified_at")
  expiresAt         DateTime @map("expires_at")  // Opportunities expire daily

  space             Space    @relation(fields: [spaceId], references: [id], onDelete: Cascade)
  account           Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@index([userId, spaceId, expiresAt])
  @@map("tax_harvesting_opportunities")
}
```

**Implementation:**

- Tax lot tracking service
- Wash sale detector
- Opportunity scanner (daily cron)
- Tax report generator

---

### 5. Portfolio Backtesting ⭐ **Priority: Low**

**Capabilities:**

- Historical strategy testing
- Performance metrics calculation
- Risk analysis (Sharpe ratio, max drawdown)
- What-if scenarios

**Database Changes:**

```prisma
model BacktestStrategy {
  id                String   @id @default(uuid())
  userId            String   @map("user_id")
  name              String
  description       String?  @db.Text

  // Strategy parameters
  rebalanceFrequency String  @map("rebalance_frequency")  // daily, weekly, monthly
  targetAllocations  Json    @map("target_allocations")   // Asset allocations
  driftThreshold     Decimal @db.Decimal(5, 2) @map("drift_threshold")

  // Backtest period
  startDate         DateTime @map("start_date")
  endDate           DateTime @map("end_date")
  initialCapital    Decimal  @db.Decimal(19, 4) @map("initial_capital")

  // Results
  finalValue        Decimal? @db.Decimal(19, 4) @map("final_value")
  totalReturn       Decimal? @db.Decimal(9, 4) @map("total_return")  // Percentage
  annualizedReturn  Decimal? @db.Decimal(9, 4) @map("annualized_return")
  sharpeRatio       Decimal? @db.Decimal(9, 4) @map("sharpe_ratio")
  maxDrawdown       Decimal? @db.Decimal(9, 4) @map("max_drawdown")
  volatility        Decimal? @db.Decimal(9, 4)

  status            String   @default("pending")  // pending, running, completed, failed
  executedAt        DateTime? @map("executed_at")
  completedAt       DateTime? @map("completed_at")

  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  @@index([userId, status])
  @@map("backtest_strategies")
}
```

**Implementation:**

- Historical price data fetcher
- Backtest simulator
- Performance calculator
- Results visualizer

---

## Implementation Priority

### Phase 3a (Week 1):

1. ✅ Advanced order types (stop-loss, take-profit, trailing stop)
2. ✅ Price monitoring service
3. ✅ Scheduled execution

### Phase 3b (Week 2):

4. ✅ Recurring orders
5. ✅ Multi-currency FX conversion
6. ✅ Exchange rate service

### Phase 3c (Week 3):

7. ✅ Tax-loss harvesting basics
8. ✅ Tax lot tracking
9. ✅ Wash sale detection

### Phase 3d (Week 4):

10. ✅ Backtesting framework
11. ✅ Performance metrics
12. ✅ Documentation

---

## Technical Considerations

### Performance:

- Price monitoring every 5 minutes (acceptable load)
- Scheduled jobs run hourly (low impact)
- FX rates cached for 15 minutes
- Tax calculations run daily

### Security:

- Advanced orders require same OTP verification
- Scheduled orders respect order limits
- Tax lot data is user-scoped and private

### Testing:

- Mock price feeds for advanced order tests
- Time-based tests for scheduling
- Historical data fixtures for backtesting

---

## Success Criteria

- [ ] Users can create stop-loss and take-profit orders
- [ ] Trailing stop orders adjust automatically
- [ ] Scheduled orders execute at correct time
- [ ] Recurring DCA orders work reliably
- [ ] Multi-currency rebalancing uses FX conversion
- [ ] Tax-loss opportunities identified correctly
- [ ] Wash sale detection prevents violations
- [ ] Backtest results match expected metrics
- [ ] All features documented
- [ ] 90%+ test coverage

---

## Next Steps

1. Extend database schema with new models
2. Implement price monitoring service
3. Create advanced order evaluation logic
4. Build scheduling service
5. Implement FX conversion
6. Add tax-loss harvesting
7. Create backtesting framework
8. Write comprehensive tests
9. Document all features
10. Deploy to staging for testing

---

**Estimated Effort:** 4 weeks

**Dependencies:** Phase 2 completion, price data API integration

**Risk:** Price data availability, FX rate source reliability, tax law complexity

---

## Phase 4: Compliance & Agentic Document Intelligence

> **Status:** In Progress (started 2026-05-01)

### Goals

Equip Dhanam to ingest, parse, and permanently archive any transactional document (PDF receipts, invoices, CFDI, bank statements, images) with first-class compliance traceability via Karafiel and intelligent fallback to the Selva agentic inference network.

---

### 1. Compliance Document Ingestion ✅ **Shipped 2026-05-01**

**Endpoint:** `POST /v1/compliance/ingest`

**Pipeline:**

1. Accept `multipart/form-data` PDF or image (max 25 MB)
2. Upload original to Cloudflare R2 under tier-based retention prefix:
   - Admin → `retention-20y/` (20 years)
   - Premium → `retention-10y/` (10 years)
   - Pro → `retention-7y/` (7 years)
   - Essentials → `retention-5y/` (5 years)
   - Community → `retention-3y/` (3 years)
3. Extract structured transaction metadata via **GPT-4o-mini vision** (native)
4. If confidence < 0.5 or extraction fails → **Selva fallback** (`X-Agent: dhanam-document-extractor`)
5. Dispatch metadata + R2 URI to **Karafiel** for NOM-151 compliance seal
6. Persist `ComplianceRecord` with Karafiel 1:1 link and retention label

---

### 2. Belvo Bank Feed Integration ✅ **Configured 2026-05-01**

- Corrected secret names in Enclii: `BELVO_SECRET_KEY_ID` / `BELVO_SECRET_KEY_PASSWORD`
- Configured `BELVO_BASE_URL`, `BELVO_ENV`, `CORS_ORIGINS`
- Verified connection to Belvo Sandbox (Innovaciones MADFAM / Aldo)
- **Pending:** Wait for deployment sync and test first bank link for `admin@madfam.io`.

---

### 3. Enclii Status Display Remediation ⏳ **In Investigation**

- Identified bug where services show `0/0 replicas` despite being healthy.
- Root cause: Missing live Kubernetes status enrichment in `switchyard-api` for externally managed deployments.
- **Planned:** Implement `k8sClient.GetDeploymentStatusInfo` enrichment in `GetService` and `getProjectServicesOverview` handlers.

---

### 3. Karafiel Deep Integration 🔲 **Planned**

- Activate `KARAFIEL_API_KEY` and `KARAFIEL_API_URL` secrets
- Re-seal all `PENDING-*` compliance records created during mock period
- Add cron job `reprocess-pending-compliance-records` to retry failed seals
- Surface Karafiel seal status in Admin Dashboard

---

### 4. Agentic Ingestion via Selva MCP 🔲 **Planned**

- Expose `dhanam.ingest_document(file_url, space_id, category)` as an MCP tool within Selva
- Enables any Selva-powered agent (Chief of Staff, Autoswarm) to directly feed receipts and invoices into Dhanam without human intervention
- Priority for `admin@madfam.io` MADFAM operations ingestion

---

### 5. R2 Lifecycle Policy Automation 🔲 **Planned**

- Configure Cloudflare R2 bucket lifecycle rules via Terraform/Enclii to automatically expire objects at the correct prefix after retention period
- Purge objects at `retention-3y/` after 3 years, `retention-20y/` after 20 years, etc.
- Emit a `document.purged` webhook to Karafiel before deletion for audit trail

---

## Phase 4 Success Criteria

- [x] Admin tier users can upload PDFs via `POST /v1/compliance/ingest` with 20-year retention
- [x] Extraction engine falls back to Selva automatically on low-confidence documents
- [x] `ComplianceRecord` model tracks Karafiel seal status per document
- [x] Corrected Belvo secret names in Enclii configuration
- [ ] Belvo bank feed active for `admin@madfam.io`
- [ ] All `PENDING-*` compliance records re-sealed after Karafiel credentials provisioned
- [ ] MCP tool registered in Selva for agentic ingestion
- [ ] R2 lifecycle policies configured for all retention tiers
- [ ] Fix Enclii `0/0 replicas` display bug (Switchyard API/UI status sync)

---

**Estimated Completion:** 2026-06-01
**Owner:** MADFAM Engineering
**Dependencies:** Belvo credentials, Karafiel API key, Selva MCP registry
