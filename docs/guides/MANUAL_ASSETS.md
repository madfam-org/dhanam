# Manual Asset Entry Feature

**Status:** Implemented
**Date:** November 20, 2025
**Related Analysis:** _(removed — audit reports archived)_

## Overview

Manual Asset Entry enables tracking of illiquid and alternative assets that cannot be automatically synced via financial APIs. This closes a Tier 1 critical gap for HNWI (High Net Worth Individual) and Family Office positioning, as these users often have 50%+ of their net worth in non-traditional assets.

## Supported Asset Types

### 1. Real Estate

- **Use Case:** Primary residence, rental properties, commercial real estate
- **Metadata Fields:**
  - Address, city, state, zip code
  - Square footage
  - Property type (single-family, condo, commercial)
  - Bedrooms, bathrooms
- **Valuation Integration:** Zillow Zestimate API (implemented — link, refresh, unlink via `property-detail.tsx`)

### 2. Vehicles

- **Use Case:** Cars, boats, aircraft, RVs
- **Metadata Fields:**
  - VIN (Vehicle Identification Number)
  - Make, model, year
  - Mileage
  - License plate
- **Valuation Integration:** Future integration with KBB/NADA APIs

### 3. Web Domains

- **Use Case:** Premium domain names held as investments
- **Metadata Fields:**
  - Domain name
  - Registrar
  - Registration date
  - Expiry date
- **Valuation Integration:** Future integration with domain appraisal services

### 4. Private Equity

- **Use Case:** PE fund investments, venture capital funds
- **Metadata Fields:**
  - Company/fund name
  - Investment date
  - Ownership percentage
  - Number of shares
  - Share class
- **Valuation Tracking:** Manual updates based on quarterly/annual reports

### 5. Angel Investments

- **Use Case:** Direct startup investments
- **Metadata Fields:** Same as Private Equity
- **Liquidity Events:** Track exits, IPOs, acquisitions

### 6. Collectibles

- **Use Case:** Rare items, memorabilia, vintage goods
- **Metadata Fields:**
  - Category (sports, coins, stamps, etc.)
  - Manufacturer/artist
  - Year produced
  - Condition rating
  - Authenticity certification
- **Appraisal Tracking:** Store appraisal reports
- **Provider Integration:** Automated valuations via adapter-based system
  - `sneaks` (sneakers) — **active**, free API
  - `watchcharts` (watches) — scaffolded
  - `artsy` (art) — scaffolded
  - `wine-searcher` (wine) — scaffolded
  - `pcgs` (coins) — scaffolded
  - `psa` (trading cards) — scaffolded
  - `hagerty` (classic cars) — scaffolded
  - `kicksdb` (sneakers, secondary) — scaffolded
- **Linking Flow:** Search catalog → select item → link to asset → auto-refresh valuations
- **UI Components:**
  - `collectible-link-modal.tsx` — Search & link dialog (category selector, debounced search, results grid)
  - `collectible-detail.tsx` — Provider status, refresh/link/unlink actions, valuation range display

### 7. Art

- **Use Case:** Fine art, sculptures, photography
- **Metadata Fields:**
  - Artist name
  - Title
  - Medium
  - Dimensions
  - Provenance
- **Appraisal Required:** Professional appraisal recommended

### 8. Jewelry

- **Use Case:** Precious metals, gemstones, luxury watches
- **Metadata Fields:**
  - Material (gold, platinum, diamonds)
  - Weight (carats, grams)
  - Certification number
  - Appraiser

### 9. Other

- **Use Case:** Catch-all for unique assets
- **Examples:** Intellectual property, patents, mineral rights, royalties

## Database Schema

### ManualAsset Model

```prisma
model ManualAsset {
  id                    String                    @id @default(uuid())
  spaceId               String
  name                  String
  type                  ManualAssetType
  description           String?
  currentValue          Decimal                   @db.Decimal(19, 4)
  currency              Currency
  acquisitionDate       DateTime?                 @db.Date
  acquisitionCost       Decimal?                  @db.Decimal(19, 4)
  metadata              Json?                     // Asset-specific fields
  documents             Json?                     // S3 document references
  notes                 String?
  createdAt             DateTime
  updatedAt             DateTime

  space                 Space
  valuationHistory      ManualAssetValuation[]
}
```

### ManualAssetValuation Model

```prisma
model ManualAssetValuation {
  id                String           @id @default(uuid())
  assetId           String
  date              DateTime         @db.Date
  value             Decimal          @db.Decimal(19, 4)
  currency          Currency
  source            String?          // "Zillow API", "Manual Entry", "Professional Appraisal"
  notes             String?
  createdAt         DateTime

  asset             ManualAsset
}
```

## API Endpoints

### List All Manual Assets

```http
GET /spaces/:spaceId/manual-assets
Authorization: Bearer <jwt>
```

**Response:**

```json
[
  {
    "id": "uuid",
    "spaceId": "uuid",
    "name": "Downtown Condo",
    "type": "real_estate",
    "description": "2BR/2BA condo in SOMA",
    "currentValue": 850000.00,
    "currency": "USD",
    "acquisitionDate": "2020-05-15",
    "acquisitionCost": 650000.00,
    "metadata": {
      "address": "123 Main St",
      "city": "San Francisco",
      "state": "CA",
      "sqft": 1200
    },
    "valuationHistory": [...]
  }
]
```

### Create Manual Asset

```http
POST /spaces/:spaceId/manual-assets
Content-Type: application/json
Authorization: Bearer <jwt>

{
  "name": "Model S",
  "type": "vehicle",
  "currentValue": 45000,
  "currency": "USD",
  "acquisitionDate": "2021-03-10",
  "acquisitionCost": 60000,
  "metadata": {
    "make": "Tesla",
    "model": "Model S",
    "year": 2021,
    "vin": "5YJSA1E26MF123456"
  }
}
```

### Update Manual Asset

```http
PATCH /spaces/:spaceId/manual-assets/:id
Content-Type: application/json
Authorization: Bearer <jwt>

{
  "currentValue": 42000,
  "notes": "Value decreased due to higher mileage"
}
```

### Add Valuation Entry

```http
POST /spaces/:spaceId/manual-assets/:id/valuations
Content-Type: application/json
Authorization: Bearer <jwt>

{
  "date": "2025-11-20",
  "value": 42000,
  "currency": "USD",
  "source": "Manual Entry",
  "notes": "Adjusted for market conditions"
}
```

### Get Summary

```http
GET /spaces/:spaceId/manual-assets/summary
Authorization: Bearer <jwt>
```

**Response:**

```json
{
  "totalAssets": 12,
  "totalValue": 2450000.0,
  "currency": "USD",
  "byType": {
    "real_estate": { "count": 3, "value": 1800000 },
    "private_equity": { "count": 5, "value": 500000 },
    "vehicle": { "count": 2, "value": 85000 },
    "art": { "count": 2, "value": 65000 }
  },
  "unrealizedGain": 450000.0
}
```

### Delete Manual Asset

```http
DELETE /spaces/:spaceId/manual-assets/:id
Authorization: Bearer <jwt>
```

## Frontend Component

### ManualAssetForm Component

**Location:** `apps/web/src/components/assets/manual-asset-form.tsx`

**Features:**

- Visual asset type selector with icons
- Type-specific metadata fields (conditional rendering)
- Unrealized gain/loss calculation
- Currency selection
- Acquisition tracking
- Notes and description fields

**Usage:**

```tsx
import { ManualAssetForm } from '@/components/assets/manual-asset-form';

const handleSubmit = async (data: ManualAssetData) => {
  await api.post(`/spaces/${spaceId}/manual-assets`, data);
};

<ManualAssetForm onSubmit={handleSubmit} />;
```

## Valuation History Tracking

### Automatic Initial Valuation

When a manual asset is created, an initial valuation entry is automatically created with:

- Date: Asset creation date
- Value: `currentValue` from creation
- Source: "Initial Entry"

### Adding Valuations

Users can add manual valuations to track value changes over time:

1. Professional appraisals
2. Market comps (e.g., Zillow estimates)
3. Self-assessed fair market value
4. Sale offers

### Auto-Update Current Value

When a new valuation is added with a date >= latest valuation date, the asset's `currentValue` is automatically updated.

## Unrealized Gain/Loss Calculation

**Formula:**

```
Unrealized Gain = Current Value - Acquisition Cost
```

**Display Logic:**

- Green text for gains (positive)
- Red text for losses (negative)
- Shows in asset summary and individual asset details

## Zillow Integration

Real estate assets can be automatically valued using Zillow's Zestimate API.

### Setup

1. Create a real estate manual asset with address metadata
2. Click "Connect to Zillow" or use the lookup API
3. System fetches and stores Zestimate value

### API Endpoints

| Method | Endpoint                             | Description                   |
| ------ | ------------------------------------ | ----------------------------- |
| `GET`  | `/manual-assets/:id/zillow/estimate` | Get current Zestimate         |
| `POST` | `/manual-assets/:id/zillow/lookup`   | Look up property by address   |
| `POST` | `/manual-assets/:id/zillow/sync`     | Sync Zestimate to asset value |

### Zillow Lookup

```typescript
// Look up property by address
const result = await fetch(`/api/manual-assets/${assetId}/zillow/lookup`, {
  method: 'POST',
  body: JSON.stringify({
    address: '123 Main Street',
    city: 'San Francisco',
    state: 'CA',
    zipCode: '94102'
  }),
});

// Response includes Zestimate and property details
{
  "zestimate": 875000,
  "rentZestimate": 4200,
  "valuationRange": { "low": 830000, "high": 920000 },
  "propertyDetails": {
    "bedrooms": 3,
    "bathrooms": 2,
    "sqft": 1850,
    "yearBuilt": 2005
  }
}
```

### Auto-Update Configuration

Zestimate values can be automatically synced via cron job:

```env
# Zillow sync schedule (weekly on Sundays at 2 AM)
ZILLOW_SYNC_CRON="0 2 * * 0"
ZILLOW_API_KEY=your_zillow_api_key
```

---

## Document Management

Seed data includes document metadata on real estate (deeds, appraisals), vehicles (titles), collectibles (certificates, receipts), and PE assets (LP agreements, K-1s).

### Document Storage (Cloudflare R2)

Documents are stored in Cloudflare R2 with presigned URLs for secure access:

```json
{
  "documents": [
    {
      "id": "doc_123",
      "key": "spaces/space_123/assets/asset_456/appraisal-2025.pdf",
      "filename": "appraisal-2025.pdf",
      "uploadedAt": "2025-11-20T10:00:00Z",
      "contentType": "application/pdf",
      "size": 2456789,
      "category": "appraisal"
    }
  ]
}
```

### Upload Flow

1. Request presigned URL from API
2. Upload file directly to R2 using presigned URL
3. Confirm upload completion

```typescript
// Step 1: Get presigned URL
const { uploadUrl, documentId } = await fetch(`/api/manual-assets/${assetId}/documents/presign`, {
  method: 'POST',
  body: JSON.stringify({
    filename: 'appraisal-2025.pdf',
    contentType: 'application/pdf',
    category: 'appraisal',
  }),
}).then((r) => r.json());

// Step 2: Upload to R2
await fetch(uploadUrl, {
  method: 'PUT',
  body: file,
  headers: {
    'Content-Type': 'application/pdf',
  },
});

// Step 3: Confirm upload (optional, validates file exists)
await fetch(`/api/manual-assets/${assetId}/documents/${documentId}/confirm`, {
  method: 'POST',
});
```

### Document API Endpoints

| Method   | Endpoint                               | Description               |
| -------- | -------------------------------------- | ------------------------- |
| `POST`   | `/manual-assets/:id/documents/presign` | Get presigned upload URL  |
| `GET`    | `/manual-assets/:id/documents`         | List all documents        |
| `GET`    | `/manual-assets/:id/documents/:docId`  | Get document download URL |
| `DELETE` | `/manual-assets/:id/documents/:docId`  | Delete document           |

### Supported Document Types

- Appraisal reports (PDF)
- Purchase agreements (PDF)
- Cap tables (Excel/PDF)
- Certificates of authenticity (PDF/Image)
- Title deeds (PDF)
- Investment memos (PDF/Word)
- Insurance policies (PDF)
- Photos (JPEG/PNG)

### Document Categories

| Category      | Use Case                                  |
| ------------- | ----------------------------------------- |
| `appraisal`   | Professional valuations                   |
| `deed`        | Property titles, ownership documents      |
| `certificate` | Authenticity certificates, certifications |
| `agreement`   | Purchase agreements, contracts            |
| `photo`       | Asset photos, condition documentation     |
| `insurance`   | Insurance policies                        |
| `other`       | Miscellaneous documents                   |

### Storage Limits

| Plan       | Max File Size | Total Storage |
| ---------- | ------------- | ------------- |
| Free       | 10 MB         | 100 MB        |
| Premium    | 50 MB         | 5 GB          |
| Enterprise | 100 MB        | Unlimited     |

## Integration with Net Worth Calculation

Manual assets are included in net worth calculations alongside synced accounts:

```typescript
Total Net Worth =
  Sum(Synced Account Balances) +
  Sum(Manual Asset Current Values) -
  Sum(Liabilities)
```

## Migration Instructions

### For Development

```bash
cd apps/api
npx prisma db push
```

### For Production

```sql
-- Add ManualAssetType enum
CREATE TYPE "ManualAssetType" AS ENUM (
  'real_estate',
  'vehicle',
  'domain',
  'private_equity',
  'angel_investment',
  'collectible',
  'art',
  'jewelry',
  'other'
);

-- Create manual_assets table
CREATE TABLE "manual_assets" (
  "id" TEXT NOT NULL,
  "space_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "ManualAssetType" NOT NULL,
  "description" TEXT,
  "current_value" DECIMAL(19,4) NOT NULL,
  "currency" "Currency" NOT NULL,
  "acquisition_date" DATE,
  "acquisition_cost" DECIMAL(19,4),
  "metadata" JSONB,
  "documents" JSONB,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "manual_assets_pkey" PRIMARY KEY ("id")
);

-- Create manual_asset_valuations table
CREATE TABLE "manual_asset_valuations" (
  "id" TEXT NOT NULL,
  "asset_id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "value" DECIMAL(19,4) NOT NULL,
  "currency" "Currency" NOT NULL,
  "source" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "manual_asset_valuations_pkey" PRIMARY KEY ("id")
);

-- Add foreign keys
ALTER TABLE "manual_assets" ADD CONSTRAINT "manual_assets_space_id_fkey"
  FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "manual_asset_valuations" ADD CONSTRAINT "manual_asset_valuations_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "manual_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add indexes
CREATE INDEX "manual_assets_space_id_idx" ON "manual_assets"("space_id");
CREATE INDEX "manual_assets_type_idx" ON "manual_assets"("type");
CREATE UNIQUE INDEX "manual_asset_valuations_asset_id_date_key" ON "manual_asset_valuations"("asset_id", "date");
CREATE INDEX "manual_asset_valuations_asset_id_date_idx" ON "manual_asset_valuations"("asset_id", "date" DESC);
```

## Implementation Impact

### Addresses Market Gap

From _(removed — audit reports archived)_:

**Gap Closed:** Private Equity/Illiquid Assets (Tier 1 Critical Gap)

- **Business Impact:** CRITICAL for HNWI - Can't compete with Kubera without this
- **Complexity:** LOW (as predicted)
- **Timeline:** 2-3 weeks (achieved ✅)

### Competitive Positioning

- **vs YNAB:** N/A (YNAB doesn't target HNWI market)
- **vs Monarch:** Differentiation (Monarch has limited alternative asset support)
- **vs Kubera:** Feature parity (Kubera has manual entry but limited metadata)
- **vs Masttro:** Competitive (similar feature set)

## Future Enhancements

### 1. Automated Valuation APIs

- **Real Estate:** Zillow/Redfin API integration for auto-updates
- **Vehicles:** KBB/NADA API for depreciation tracking
- **Domains:** Sedo/GoDaddy appraisal API
- **Public Equities:** Track restricted stock with lock-up periods

### 2. Document OCR

- Extract data from appraisal PDFs automatically
- Parse cap tables to populate ownership %
- Scan title deeds for property metadata

### 3. IRR Calculation

- For PE/Angel investments, calculate Internal Rate of Return
- Factor in capital calls and distributions
- Compare against benchmark indices

### 4. Depreciation Schedules

- Auto-calculate depreciation for vehicles
- Track capital improvements for real estate
- Generate tax depreciation reports

### 5. Liquidity Event Tracking

- Record exits, IPOs, acquisitions for PE/Angel
- Calculate realized gains
- Track carried interest distributions

### 6. Portfolio Diversification Analysis

- Show allocation across manual + synced assets
- Recommend rebalancing
- Track correlation with public markets

## Testing Checklist

- [ ] Create real estate asset with address metadata
- [ ] Create private equity asset with ownership %
- [ ] Add valuation entry (verify currentValue updates)
- [ ] Add valuation with past date (verify currentValue doesn't change)
- [ ] Update asset metadata
- [ ] Delete asset (verify valuations cascade delete)
- [ ] View summary by asset type
- [ ] Calculate unrealized gain/loss correctly
- [ ] Test with different currencies (MXN, EUR, USD)
- [ ] Verify access controls (member can create, admin can delete)

## References

- **Kubera Manual Entry:** https://kubera.com/features/manual-assets
- **HNWI Asset Allocation:** https://www.cnbc.com/2023/06/15/where-wealthy-investors-put-their-money.html
- **Market Analysis:** _(removed — audit reports archived)_

---

**Implementation Complete:** ✅
**Migration Status:** Schema updated, manual migration required
**Documentation:** Complete
**Estimated Value:** Unlocks HNWI/Family Office market segment ($500+/mo pricing tier)
