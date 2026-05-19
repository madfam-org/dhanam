# Manual Assets Module

> Track manually-entered assets including real estate, vehicles, valuables, and private equity investments with Zillow integration and document storage.

## Purpose

The Manual Assets module enables users to track assets that cannot be automatically synced through financial providers. It supports real estate properties with automated Zillow valuations, private equity investments with IRR/TVPI calculations, and document attachments via Cloudflare R2 storage.

## Key Entities

| Entity                 | Description                                              |
| ---------------------- | -------------------------------------------------------- |
| `ManualAsset`          | User-entered asset with type, value, and metadata        |
| `ManualAssetValuation` | Historical valuation entries for tracking value changes  |
| `PECashFlow`           | Private equity cash flows (capital calls, distributions) |
| `Document`             | Attached documents stored in Cloudflare R2               |

### Asset Types

```typescript
enum ManualAssetType {
  real_estate    // Properties with Zillow integration
  vehicle        // Cars, boats, motorcycles
  valuable       // Art, jewelry, collectibles
  private_equity // PE and angel investments
  other          // Catch-all category
}
```

### Real Estate Metadata

```typescript
interface RealEstateMetadata {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  sqft?: number;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  yearBuilt?: number;
  lotSize?: number;
  zpid?: string; // Zillow Property ID
  lastZillowSync?: string;
  zillowEnabled?: boolean;
}
```

## API Endpoints

### Core Asset Management

| Method   | Endpoint                                        | Auth | Description               |
| -------- | ----------------------------------------------- | ---- | ------------------------- |
| `GET`    | `/spaces/:spaceId/manual-assets`                | JWT  | List all manual assets    |
| `GET`    | `/spaces/:spaceId/manual-assets/summary`        | JWT  | Get totals by asset type  |
| `GET`    | `/spaces/:spaceId/manual-assets/:id`            | JWT  | Get single asset details  |
| `POST`   | `/spaces/:spaceId/manual-assets`                | JWT  | Create new manual asset   |
| `PATCH`  | `/spaces/:spaceId/manual-assets/:id`            | JWT  | Update asset              |
| `DELETE` | `/spaces/:spaceId/manual-assets/:id`            | JWT  | Delete asset (admin only) |
| `POST`   | `/spaces/:spaceId/manual-assets/:id/valuations` | JWT  | Add valuation entry       |

### Private Equity Endpoints

| Method   | Endpoint                                                    | Auth | Description                |
| -------- | ----------------------------------------------------------- | ---- | -------------------------- |
| `GET`    | `/spaces/:spaceId/manual-assets/pe/portfolio`               | JWT  | Get PE portfolio summary   |
| `GET`    | `/spaces/:spaceId/manual-assets/:id/performance`            | JWT  | Get IRR, TVPI, DPI metrics |
| `GET`    | `/spaces/:spaceId/manual-assets/:id/cash-flows`             | JWT  | List cash flows            |
| `POST`   | `/spaces/:spaceId/manual-assets/:id/cash-flows`             | JWT  | Add cash flow              |
| `DELETE` | `/spaces/:spaceId/manual-assets/:id/cash-flows/:cashFlowId` | JWT  | Delete cash flow           |

### Document Management

| Method   | Endpoint                                                         | Auth | Description                |
| -------- | ---------------------------------------------------------------- | ---- | -------------------------- |
| `GET`    | `/spaces/:spaceId/manual-assets/document-config`                 | JWT  | Get upload configuration   |
| `GET`    | `/spaces/:spaceId/manual-assets/:id/documents`                   | JWT  | List asset documents       |
| `POST`   | `/spaces/:spaceId/manual-assets/:id/documents/upload-url`        | JWT  | Get presigned upload URL   |
| `POST`   | `/spaces/:spaceId/manual-assets/:id/documents/confirm`           | JWT  | Confirm upload completion  |
| `GET`    | `/spaces/:spaceId/manual-assets/:id/documents/:key/download-url` | JWT  | Get presigned download URL |
| `DELETE` | `/spaces/:spaceId/manual-assets/:id/documents/:key`              | JWT  | Delete document            |

### Zillow Integration

| Method | Endpoint                                                 | Auth | Description             |
| ------ | -------------------------------------------------------- | ---- | ----------------------- |
| `POST` | `/spaces/:spaceId/manual-assets/:id/zillow/link`         | JWT  | Link property to Zillow |
| `POST` | `/spaces/:spaceId/manual-assets/:id/zillow/unlink`       | JWT  | Unlink from Zillow      |
| `POST` | `/spaces/:spaceId/manual-assets/:id/zillow/refresh`      | JWT  | Refresh Zestimate       |
| `GET`  | `/spaces/:spaceId/manual-assets/:id/zillow/summary`      | JWT  | Get valuation summary   |
| `POST` | `/spaces/:spaceId/manual-assets/real-estate/refresh-all` | JWT  | Refresh all properties  |

### Example Requests

```bash
# Create a real estate asset
POST /spaces/:spaceId/manual-assets
Content-Type: application/json
{
  "name": "Primary Residence",
  "type": "real_estate",
  "currentValue": 450000,
  "currency": "USD",
  "acquisitionDate": "2020-05-15",
  "acquisitionCost": 380000,
  "metadata": {
    "address": "123 Main St",
    "city": "Austin",
    "state": "TX",
    "zip": "78701",
    "sqft": 2400,
    "bedrooms": 4,
    "bathrooms": 3
  }
}

# Link to Zillow
POST /spaces/:spaceId/manual-assets/:id/zillow/link

# Add PE capital call
POST /spaces/:spaceId/manual-assets/:id/cash-flows
{
  "type": "capital_call",
  "amount": 50000,
  "currency": "USD",
  "date": "2024-01-15",
  "description": "Q1 2024 Capital Call"
}
```

## Service Architecture

```
ManualAssetsModule
    |
    +-- ManualAssetsController
    |       |
    |       +-- ManualAssetsService (CRUD operations)
    |       +-- PEAnalyticsService (IRR/TVPI calculations)
    |       +-- DocumentService (R2 document management)
    |       +-- RealEstateValuationService (Zillow integration)
    |
    +-- Dependencies
            |
            +-- SpacesService (access control)
            +-- ZillowService (valuation API)
            +-- R2StorageService (document storage)
            +-- PrismaService (database)
```

## Data Flow

### Zillow Valuation Flow

```
1. User links property (POST /zillow/link)
2. System looks up address via ZillowService
3. Store zpid in asset metadata
4. Fetch initial Zestimate
5. Update currentValue and create valuation entry
6. Scheduled refresh or manual trigger updates value
```

### Document Upload Flow

```
1. Client requests upload URL (POST /documents/upload-url)
2. Server generates presigned R2 URL (1-hour expiry)
3. Client uploads directly to R2
4. Client confirms upload (POST /documents/confirm)
5. Server records document metadata on asset
6. Download via presigned URLs (GET /documents/:key/download-url)
```

### PE Performance Calculation

```
Cash Flows -> IRR Calculation (Newton-Raphson)
           -> TVPI = (Distributions + NAV) / Paid-In
           -> DPI = Distributions / Paid-In
           -> RVPI = NAV / Paid-In
```

## Configuration

### Environment Variables

| Variable               | Description                         | Required        |
| ---------------------- | ----------------------------------- | --------------- |
| `ZILLOW_API_KEY`       | Zillow API key for property lookups | For real estate |
| `R2_ACCOUNT_ID`        | Cloudflare R2 account ID            | For documents   |
| `R2_ACCESS_KEY_ID`     | R2 access key                       | For documents   |
| `R2_SECRET_ACCESS_KEY` | R2 secret key                       | For documents   |
| `R2_BUCKET_NAME`       | R2 bucket name                      | For documents   |

### Document Categories

```typescript
const DOCUMENT_CATEGORIES = [
  'deed', // Property deeds
  'title', // Title documents
  'appraisal', // Appraisal reports
  'insurance', // Insurance policies
  'tax', // Tax documents
  'receipt', // Purchase receipts
  'certificate', // Certificates of authenticity
  'general', // General documents
];
```

### Allowed File Types

```typescript
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
```

## Related Modules

| Module                | Relationship                              |
| --------------------- | ----------------------------------------- |
| `spaces`              | Access control and organizational context |
| `storage`             | R2 document storage via R2StorageService  |
| `integrations/zillow` | Property valuation API                    |
| `wealth`              | Manual assets contribute to net worth     |

## Testing

```bash
# Run manual assets tests
pnpm test -- manual-assets

# Run with coverage
pnpm test:cov -- manual-assets
```

### Test Files

- `manual-assets.service.spec.ts` - Core service tests
- `manual-assets-mutations.service.spec.ts` - Create/update tests
- `manual-assets-valuation.service.spec.ts` - Valuation tests
- `document.service.spec.ts` - Document management tests

### Key Test Scenarios

1. CRUD operations for all asset types
2. Valuation history tracking
3. PE performance calculations (IRR accuracy)
4. Zillow link/unlink flow
5. Document upload/download presigned URLs
6. Access control verification
7. Summary calculations by type

---

**Module**: `manual-assets`
**Last Updated**: January 2025
