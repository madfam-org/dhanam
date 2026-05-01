# MADFAM Internal Finance Configuration

**Purpose:** Use Dhanam to track MADFAM ecosystem finances - dogfooding our own finance tool.

## Quick Start

```bash
# From dhanam/apps/api directory
cd apps/api

# Run MADFAM seed (after running migrations)
pnpm db:seed:madfam
```

## Configuration Overview

### Admin User
- **Email:** admin@madfam.io
- **Role:** Owner / Top Admin — `isAdmin: true`, `subscriptionTier: admin`
- **SSO:** Linked to Janua identity. Login at `https://app.dhan.am/login`
- **Retention:** All documents ingested under this account use the **20-year** R2 archival prefix (`retention-20y/`)
- **Karafiel:** One-to-one compliance link to Karafiel for all ingested transactional documents

### Spaces Created

| Space ID | Name | Currency | Purpose |
|----------|------|----------|---------|
| madfam-operations | MADFAM Operations | USD | Main operations tracking |
| madfam-sim4d | sim4d Business Unit | USD | sim4d product P&L |
| madfam-primavera | Primavera3D Factory | MXN | Factory operations |
| madfam-forgesight | ForgeSight Intelligence | USD | Data product P&L |

### Budget Categories

Categories aligned with MADFAM layer architecture:

#### Revenue (Income Tracking)
- 💰 Revenue: sim4d Studio
- 💰 Revenue: Primavera3D Factory
- 💰 Revenue: ForgeSight
- 💰 Revenue: Consulting

#### Infrastructure (SOIL Layer)
- 🏗️ Infra: Cloud Services - $5,000/year
- 🏗️ Infra: Domains & DNS - $500/year
- 🏗️ Infra: Security & Compliance - $2,000/year
- 🏗️ Infra: Development Tools - $1,500/year

#### Product Costs (FRUIT Layer)
- 🎨 Product: sim4d Operations - $3,000/year
- 🏭 Product: Primavera3D Materials - $10,000/year
- 🔍 Product: ForgeSight Data - $1,000/year
- 📊 Product: Dhanam Hosting - $500/year

#### People & Operations
- 👥 Team: Contractors - $15,000/year
- 👥 Team: Benefits & Perks - $2,000/year
- 📚 Team: Training & Learning - $1,500/year

#### Marketing & Growth
- 📣 Marketing: Advertising - $3,000/year
- 📣 Marketing: Content & Design - $1,000/year
- 🤝 Growth: Events & Networking - $2,000/year

#### Legal & Administrative
- ⚖️ Legal: IP & Trademarks - $2,000/year
- 📋 Admin: Accounting & Tax - $3,000/year
- 🏢 Admin: Office & Supplies - $500/year

#### ESG & Sustainability
- 🌱 ESG: Carbon Offsets - $500/year
- 🌍 ESG: Community Initiatives - $1,000/year

### Accounts

| Account | Type | Currency | Use Case |
|---------|------|----------|----------|
| MADFAM Operations (USD) | Checking | USD | Main operations |
| MADFAM Operations (MXN) | Checking | MXN | Mexico operations |
| MADFAM Crypto Holdings | Investment | USD | Crypto treasury |

## Integration Points

### Janua SSO
The `finance@madfam.org` user should authenticate via Janua:

```typescript
// JanuaAuthBridge automatically syncs SSO to Dhanam auth
// No additional configuration needed if Janua is running
```

### Document Compliance Ingestion
Dhanam now supports native PDF/image ingestion of transactional documents directly linked to Karafiel.

#### Ingest a receipt or invoice

```bash
# Upload a PDF receipt (authenticated as admin@madfam.io)
curl -X POST https://api.dhan.am/v1/compliance/ingest \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -F "file=@invoice-2026-04.pdf" \
  -F "spaceId=<YOUR_SPACE_ID>" \
  -F "category=invoice"
```

#### Response
```json
{
  "complianceRecordId": "uuid",
  "karafielId": "KAR-ABC123...",
  "retentionPolicy": "20_YEARS",
  "extractionEngine": "native",
  "transactionSummary": {
    "date": "2026-04-30",
    "amount": 1250.00,
    "currency": "MXN",
    "merchant": "Proveedor SA de CV",
    "confidence": 0.92
  }
}
```

The extraction engine will:
1. **Native**: Use GPT-4o-mini vision to parse the document.
2. **Selva fallback**: If confidence < 0.5, route automatically to Selva for deep agentic analysis.
3. **Karafiel sealing**: Send extracted metadata + R2 storage URI to Karafiel for NOM-151 compliance.
4. **20-year archival**: Original PDF stored under `spaces/{spaceId}/compliance/retention-20y/` in R2.

#### Required secrets (activate via Enclii)
```bash
enclii secrets set OPENAI_API_KEY=sk-...         --service dhanam-api
enclii secrets set SELVA_API_KEY=...              --service dhanam-api
enclii secrets set KARAFIEL_API_KEY=...           --service dhanam-api
enclii secrets set KARAFIEL_API_URL=https://api.karafiel.madfam.io  --service dhanam-api
```

### Bank Feeds (Pending Belvo activation)
- **Plaid:** For US bank accounts
- **Belvo:** For Mexican bank accounts (BBVA, Banorte, etc.) — awaiting credentials
- **Manual ingestion:** Use `POST /v1/compliance/ingest` to feed PDFs/images while Belvo is being provisioned

### Accounting Import (Future)
- Import from QuickBooks/Xero via CSV
- Historical transaction backfill

## Usage Patterns

### Recording Revenue

```bash
# sim4d subscription revenue
POST /v1/spaces/madfam-operations/transactions
{
  "accountId": "madfam-operations-usd",
  "amount": 99.00,
  "currency": "USD",
  "date": "2025-01-15",
  "description": "sim4d Studio - Monthly subscription",
  "merchant": "Stripe",
  "categoryId": "<revenue-sim4d-category-id>"
}
```

### Tracking Expenses

```bash
# Cloud infrastructure expense
POST /v1/spaces/madfam-operations/transactions
{
  "accountId": "madfam-operations-usd",
  "amount": -450.00,
  "currency": "USD", 
  "date": "2025-01-01",
  "description": "AWS Monthly - January 2025",
  "merchant": "Amazon Web Services",
  "categoryId": "<infra-cloud-category-id>"
}
```

### Viewing Reports

Access via Dhanam web dashboard:
- `/dashboard` - Overview of all spaces
- `/budgets` - Budget vs actual by category
- `/transactions` - Full transaction history
- `/esg` - ESG metrics and sustainability tracking

## Development Workflow

### Local Development

```bash
# Start Dhanam API
cd apps/api
pnpm dev

# Start Dhanam Web
cd apps/web
pnpm dev

# Access at http://localhost:3000
# Login as finance@madfam.org
```

### Reset and Re-seed

```bash
cd apps/api
pnpm db:migrate:reset  # Resets database
pnpm db:seed           # Demo data
pnpm db:seed:madfam    # MADFAM config (additive)
```

## Metrics & KPIs

Track these via Dhanam dashboards:

### Financial Health
- Monthly burn rate
- Runway (months of cash)
- Revenue growth MoM
- Gross margin by product

### Per-Product P&L
- sim4d: Revenue - (Infrastructure + Operations)
- Primavera3D: Revenue - (Materials + Operations)
- ForgeSight: Revenue - (Data costs + Operations)

### ESG Tracking
- Carbon footprint per product
- Community investment ratio
- Sustainability score

---

*This configuration enables MADFAM to practice what it preaches - using its own finance tool for internal operations.*
