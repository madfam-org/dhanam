# Dhanam Ledger API Documentation

> **Live OpenAPI:** When the API is running, Swagger UI is at `{base}/docs`
> (e.g. `http://localhost:4010/docs` locally). Prefer Swagger for endpoint
> accuracy; this file is a narrative index that may drift from source.
>
> **Export:** See [api/README.md](api/README.md) for `pnpm --filter @dhanam/api openapi:export`.

## Overview

The Dhanam Ledger API is a RESTful API built with NestJS and Fastify, providing comprehensive financial management capabilities with ESG crypto insights.

**Base URL**: `https://api.dhan.am/v1` (Production) | `http://localhost:4010` (Development)

**API Version**: v1.0.0

## Authentication

### JWT Token Authentication

The API uses JWT tokens for authentication with rotating refresh tokens.

```http
Authorization: Bearer <access_token>
```

### Token Lifecycle

- **Access Token**: 15 minutes lifetime
- **Refresh Token**: 30 days lifetime, rotates on use
- **2FA Required**: For admin operations and sensitive actions

### Authentication Endpoints

#### POST /auth/login

Login with email and password.

```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**

```json
{
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe",
    "locale": "en",
    "twoFactorEnabled": false
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900
  }
}
```

#### POST /auth/refresh

Refresh access token using refresh token.

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### POST /auth/logout

Logout and invalidate tokens.

#### POST /auth/register

Create new user account.

```json
{
  "name": "John Doe",
  "email": "user@example.com",
  "password": "securepassword",
  "locale": "en"
}
```

## Core Resources

### Spaces

Spaces represent isolated financial environments (Personal/Business).

#### GET /spaces

List user's spaces.

**Response:**

```json
[
  {
    "id": "space_123",
    "name": "Personal Finances",
    "type": "personal",
    "currency": "USD",
    "createdAt": "2024-01-01T00:00:00Z",
    "accounts": [
      {
        "id": "acc_123",
        "name": "Chase Checking",
        "balance": 2500.0,
        "provider": "plaid"
      }
    ]
  }
]
```

#### POST /spaces

Create a new space.

```json
{
  "name": "Business Accounts",
  "type": "business",
  "currency": "MXN"
}
```

#### PUT /spaces/:id

Update space details.

#### DELETE /spaces/:id

Delete space (admin only).

### Accounts

Financial accounts connected through various providers.

#### GET /accounts

List accounts for a space.

**Query Parameters:**

- `spaceId` (required): Space identifier
- `provider`: Filter by provider (plaid, belvo, bitso, manual)
- `type`: Filter by account type (checking, savings, credit, crypto, investment)

**Response:**

```json
[
  {
    "id": "acc_123",
    "name": "Chase Checking",
    "type": "checking",
    "provider": "plaid",
    "currency": "USD",
    "balance": 2500.0,
    "lastSyncedAt": "2024-01-01T12:00:00Z",
    "isActive": true,
    "metadata": {
      "institutionName": "Chase",
      "accountNumber": "****1234",
      "routingNumber": "****5678"
    }
  }
]
```

#### POST /accounts/sync

Trigger manual account synchronization.

```json
{
  "spaceId": "space_123",
  "accountIds": ["acc_123", "acc_456"]
}
```

#### PUT /accounts/:id

Update account settings.

```json
{
  "name": "My Checking Account",
  "isActive": false
}
```

#### DELETE /accounts/:id

Disconnect account.

### Transactions

Financial transactions with auto-categorization.

#### GET /transactions

List transactions for a space.

**Query Parameters:**

- `spaceId` (required): Space identifier
- `accountId`: Filter by account
- `categoryId`: Filter by category
- `type`: Filter by type (income, expense, transfer)
- `startDate`: ISO date string
- `endDate`: ISO date string
- `limit`: Number of results (default: 50, max: 200)
- `offset`: Pagination offset
- `search`: Search in description and merchant name

**Response:**

```json
{
  "transactions": [
    {
      "id": "txn_123",
      "amount": -45.67,
      "currency": "USD",
      "description": "Starbucks Coffee",
      "merchantName": "Starbucks",
      "date": "2024-01-01T10:00:00Z",
      "type": "expense",
      "status": "posted",
      "category": {
        "id": "cat_123",
        "name": "Coffee & Dining",
        "color": "#FF6B35"
      },
      "account": {
        "id": "acc_123",
        "name": "Chase Checking"
      },
      "location": {
        "address": "123 Main St, New York, NY",
        "coordinates": {
          "lat": 40.7128,
          "lon": -74.006
        }
      },
      "tags": ["business-expense", "client-meeting"]
    }
  ],
  "pagination": {
    "total": 1250,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

#### POST /transactions

Create manual transaction.

```json
{
  "spaceId": "space_123",
  "accountId": "acc_123",
  "amount": -25.5,
  "description": "Coffee with client",
  "merchantName": "Local Café",
  "date": "2024-01-01T14:30:00Z",
  "categoryId": "cat_123",
  "tags": ["business", "client-meeting"]
}
```

#### PUT /transactions/:id

Update transaction (categorization, tags).

```json
{
  "categoryId": "cat_456",
  "tags": ["updated-category"],
  "notes": "Updated categorization"
}
```

#### POST /transactions/categorize

Bulk categorize transactions using rules.

```json
{
  "spaceId": "space_123",
  "transactionIds": ["txn_123", "txn_456"],
  "categoryId": "cat_789"
}
```

### Budgets

Budget management with category-based tracking.

#### GET /budgets

List budgets for a space.

**Query Parameters:**

- `spaceId` (required): Space identifier
- `period`: Filter by period (monthly, quarterly, yearly)
- `status`: Filter by status (active, exceeded, completed)

**Response:**

```json
[
  {
    "id": "budget_123",
    "name": "Monthly Food Budget",
    "amount": 800.0,
    "spent": 456.78,
    "remaining": 343.22,
    "currency": "USD",
    "period": "monthly",
    "startDate": "2024-01-01",
    "endDate": "2024-01-31",
    "status": "active",
    "categories": [
      {
        "id": "cat_123",
        "name": "Groceries",
        "allocated": 500.0,
        "spent": 278.45
      },
      {
        "id": "cat_124",
        "name": "Restaurants",
        "allocated": 300.0,
        "spent": 178.33
      }
    ],
    "alerts": {
      "threshold": 80,
      "enabled": true
    }
  }
]
```

#### POST /budgets

Create new budget.

```json
{
  "spaceId": "space_123",
  "name": "Q1 Marketing Budget",
  "amount": 5000.0,
  "period": "quarterly",
  "startDate": "2024-01-01",
  "endDate": "2024-03-31",
  "categoryIds": ["cat_123", "cat_124"],
  "alertThreshold": 75
}
```

#### PUT /budgets/:id

Update budget.

#### DELETE /budgets/:id

Delete budget.

### Categories

Transaction categories with auto-categorization rules.

#### GET /categories

List categories for a space.

**Response:**

```json
[
  {
    "id": "cat_123",
    "name": "Food & Dining",
    "color": "#FF6B35",
    "icon": "restaurant",
    "type": "expense",
    "parentId": null,
    "isSystem": false,
    "rules": [
      {
        "id": "rule_123",
        "condition": "merchant_contains",
        "value": "starbucks",
        "priority": 100
      }
    ],
    "subcategories": [
      {
        "id": "cat_124",
        "name": "Coffee",
        "parentId": "cat_123"
      }
    ]
  }
]
```

#### POST /categories

Create new category.

```json
{
  "spaceId": "space_123",
  "name": "Business Travel",
  "color": "#2196F3",
  "icon": "airplane",
  "type": "expense",
  "parentId": "cat_parent",
  "rules": [
    {
      "condition": "description_contains",
      "value": "uber",
      "priority": 90
    }
  ]
}
```

#### PUT /categories/:id

Update category.

#### DELETE /categories/:id

Delete category.

## Provider Integrations

### Plaid (US Banking)

#### POST /providers/plaid/create-link

Create Plaid Link token for account connection.

```json
{
  "spaceId": "space_123",
  "userId": "user_123"
}
```

**Response:**

```json
{
  "linkToken": "link-sandbox-12345...",
  "expiration": "2024-01-01T01:00:00Z"
}
```

#### POST /providers/plaid/exchange-token

Exchange public token for access token after Plaid Link.

```json
{
  "spaceId": "space_123",
  "publicToken": "public-sandbox-12345...",
  "metadata": {
    "institution": {
      "name": "Chase",
      "institution_id": "ins_1"
    },
    "accounts": [
      {
        "id": "account_1",
        "name": "Chase Checking",
        "type": "depository",
        "subtype": "checking"
      }
    ]
  }
}
```

#### POST /providers/plaid/webhook

Plaid webhook handler (internal use).

### Belvo (Mexican Banking)

#### POST /providers/belvo/create-link

Create Belvo Link session.

```json
{
  "spaceId": "space_123",
  "institution": "banamex"
}
```

#### POST /providers/belvo/connect

Connect Belvo account with credentials.

```json
{
  "spaceId": "space_123",
  "institution": "banamex",
  "username": "user123",
  "password": "secure_password"
}
```

#### POST /providers/belvo/webhook

Belvo webhook handler (internal use).

### Bitso (Cryptocurrency)

#### POST /providers/bitso/connect

Connect Bitso account with API credentials.

```json
{
  "spaceId": "space_123",
  "apiKey": "your_api_key",
  "apiSecret": "your_api_secret"
}
```

**Response:**

```json
{
  "accounts": [
    {
      "id": "bitso_btc",
      "name": "Bitcoin",
      "symbol": "BTC",
      "balance": 0.025,
      "balanceUSD": 1250.0
    }
  ],
  "message": "Successfully connected Bitso account"
}
```

#### POST /providers/bitso/sync

Sync Bitso account balances.

## ESG Scoring

Environmental, Social, and Governance scoring for cryptocurrency assets.

#### GET /esg/scores

Get ESG scores for a space's crypto assets.

**Query Parameters:**

- `spaceId` (required): Space identifier

**Response:**

```json
{
  "portfolioScore": {
    "environmental": 65,
    "social": 78,
    "governance": 82,
    "overall": 75,
    "grade": "B+"
  },
  "scores": [
    {
      "symbol": "BTC",
      "name": "Bitcoin",
      "environmental": 15,
      "social": 75,
      "governance": 85,
      "overall": 58,
      "grade": "C",
      "energyIntensity": 707000,
      "carbonFootprint": 345.6,
      "balance": 0.025,
      "balanceUSD": 1250.0,
      "weight": 0.6
    },
    {
      "symbol": "ETH",
      "name": "Ethereum",
      "environmental": 75,
      "social": 80,
      "governance": 88,
      "overall": 81,
      "grade": "A-",
      "energyIntensity": 35,
      "carbonFootprint": 2.1,
      "balance": 5.5,
      "balanceUSD": 8250.0,
      "weight": 0.4
    }
  ],
  "trends": [
    {
      "date": "2024-01-01",
      "environmental": 63,
      "social": 76,
      "governance": 80,
      "overall": 73
    }
  ],
  "impactMetrics": {
    "totalCarbonFootprint": 347.7,
    "renewableEnergyScore": 45,
    "lowCarbonAllocation": 40
  }
}
```

#### GET /esg/methodology

Get ESG scoring methodology documentation.

**Response:**

```json
{
  "version": "2.0",
  "framework": "Dhanam ESG Framework",
  "components": {
    "environmental": {
      "weight": 0.4,
      "factors": [
        "Energy consumption per transaction",
        "Carbon footprint",
        "Renewable energy usage",
        "Consensus mechanism efficiency"
      ]
    },
    "social": {
      "weight": 0.3,
      "factors": [
        "Financial inclusion",
        "Community governance",
        "Developer activity",
        "Educational resources"
      ]
    },
    "governance": {
      "weight": 0.3,
      "factors": ["Protocol governance", "Transparency", "Regulatory compliance", "Risk management"]
    }
  },
  "grading": {
    "A+": "90-100",
    "A": "80-89",
    "B": "70-79",
    "C": "60-69",
    "D": "40-59",
    "F": "0-39"
  }
}
```

## AI Categorization

Machine learning-powered transaction categorization with learning loop.

### GET /ml/corrections

List category corrections for a space.

**Query Parameters:**

- `spaceId` (required): Space identifier
- `status`: Filter by status (pending, applied, rejected)
- `limit`: Number of results (default: 50)
- `offset`: Pagination offset

**Response:**

```json
{
  "corrections": [
    {
      "id": "corr_123",
      "transactionId": "txn_456",
      "originalCategoryId": "cat_food",
      "correctedCategoryId": "cat_business",
      "merchantName": "Starbucks",
      "normalizedMerchant": "starbucks",
      "confidence": 0.85,
      "status": "applied",
      "createdAt": "2025-01-15T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 125,
    "limit": 50,
    "offset": 0
  }
}
```

### POST /ml/corrections

Submit a category correction to train the ML model.

```json
{
  "transactionId": "txn_456",
  "correctedCategoryId": "cat_business",
  "applyToSimilar": true
}
```

**Response:**

```json
{
  "correctionId": "corr_123",
  "affectedTransactions": 15,
  "message": "Correction applied to 15 similar transactions"
}
```

### POST /ml/retrain

Trigger a manual ML model retrain (admin only).

**Response:**

```json
{
  "jobId": "job_789",
  "status": "queued",
  "estimatedCompletion": "2025-01-15T11:00:00Z"
}
```

---

## DeFi/Web3 Positions

Track DeFi protocol positions via Zapper API integration.

### GET /defi/positions

List DeFi positions for a space.

**Query Parameters:**

- `spaceId` (required): Space identifier
- `protocol`: Filter by protocol (uniswap, aave, compound, etc.)
- `network`: Filter by network (ethereum, polygon, arbitrum, etc.)

**Response:**

```json
{
  "positions": [
    {
      "id": "pos_123",
      "protocol": "uniswap-v3",
      "network": "ethereum",
      "type": "liquidity-pool",
      "label": "ETH/USDC Pool",
      "tokens": [
        {
          "symbol": "ETH",
          "balance": 1.5,
          "balanceUSD": 3750.0
        },
        {
          "symbol": "USDC",
          "balance": 3500,
          "balanceUSD": 3500.0
        }
      ],
      "totalValueUSD": 7250.0,
      "unrealizedGain": 450.0,
      "apy": 12.5,
      "lastUpdated": "2025-01-15T10:00:00Z"
    }
  ],
  "summary": {
    "totalValueUSD": 45000.0,
    "byProtocol": {
      "uniswap-v3": 15000.0,
      "aave-v3": 20000.0,
      "lido": 10000.0
    },
    "byNetwork": {
      "ethereum": 35000.0,
      "polygon": 7000.0,
      "arbitrum": 3000.0
    }
  }
}
```

### POST /defi/wallets

Connect a wallet address for DeFi tracking.

```json
{
  "spaceId": "space_123",
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f8e123",
  "label": "Main DeFi Wallet",
  "networks": ["ethereum", "polygon", "arbitrum"]
}
```

### POST /defi/sync

Trigger a manual sync of DeFi positions.

```json
{
  "spaceId": "space_123",
  "walletIds": ["wallet_123", "wallet_456"]
}
```

---

## Estate Planning - Life Beat

Dead man's switch functionality for estate planning.

### GET /estate-planning/life-beat/config

Get Life Beat configuration for a household.

**Query Parameters:**

- `householdId` (required): Household identifier

**Response:**

```json
{
  "enabled": true,
  "checkInInterval": "weekly",
  "lastCheckIn": "2025-01-10T09:00:00Z",
  "nextCheckInDue": "2025-01-17T09:00:00Z",
  "escalationDays": [30, 60, 90],
  "currentEscalationLevel": 0,
  "executorId": "member_456",
  "notificationChannels": ["email", "sms"]
}
```

### PUT /estate-planning/life-beat/config

Update Life Beat configuration.

```json
{
  "householdId": "hh_123",
  "enabled": true,
  "checkInInterval": "biweekly",
  "escalationDays": [30, 60, 90],
  "executorId": "member_456",
  "notificationChannels": ["email"]
}
```

### POST /estate-planning/life-beat/check-in

Record a check-in to reset the escalation timer.

```json
{
  "householdId": "hh_123"
}
```

**Response:**

```json
{
  "lastCheckIn": "2025-01-15T10:00:00Z",
  "nextCheckInDue": "2025-01-29T10:00:00Z",
  "escalationReset": true
}
```

### POST /estate-planning/life-beat/emergency-access

Grant emergency access to executor (triggered by escalation).

```json
{
  "householdId": "hh_123",
  "executorId": "member_456",
  "accessLevel": "read-only",
  "expiresAt": "2025-02-15T00:00:00Z"
}
```

---

## Zillow Integration

Automated real estate valuations for manual assets.

### GET /manual-assets/:id/zillow/estimate

Get Zillow Zestimate for a real estate asset.

**Response:**

```json
{
  "zestimate": 875000.0,
  "rentZestimate": 4200.0,
  "currency": "USD",
  "lastUpdated": "2025-01-14T00:00:00Z",
  "valuationRange": {
    "low": 830000.0,
    "high": 920000.0
  },
  "propertyDetails": {
    "bedrooms": 3,
    "bathrooms": 2,
    "sqft": 1850,
    "yearBuilt": 2005
  }
}
```

### POST /manual-assets/:id/zillow/lookup

Look up Zillow data by address.

```json
{
  "address": "123 Main Street",
  "city": "San Francisco",
  "state": "CA",
  "zipCode": "94102"
}
```

### POST /manual-assets/:id/zillow/sync

Sync current Zestimate to asset valuation.

**Response:**

```json
{
  "previousValue": 850000.0,
  "newValue": 875000.0,
  "source": "Zillow Zestimate",
  "valuationCreated": true
}
```

---

## Collectibles Valuation

Automated market valuations for collectible assets (sneakers, watches, art, wine, coins, trading cards, classic cars).

### GET /manual-assets/collectibles/categories

Get available collectible categories and provider status.

**Response:**

```json
[
  { "category": "sneaker", "provider": "sneaks", "available": true },
  { "category": "watch", "provider": "watchcharts", "available": false },
  { "category": "art", "provider": "artsy", "available": false },
  { "category": "wine", "provider": "wine-searcher", "available": false },
  { "category": "coin", "provider": "pcgs", "available": false },
  { "category": "trading_card", "provider": "psa", "available": false },
  { "category": "classic_car", "provider": "hagerty", "available": false },
  { "category": "sneaker", "provider": "kicksdb", "available": false }
]
```

### GET /manual-assets/collectibles/search

Search collectible catalog by category.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| category | string | Yes | e.g. `sneaker` |
| q | string | Yes | Search query |
| limit | number | No | Max results (default 10) |

**Response:**

```json
[
  {
    "externalId": "CW2288-111",
    "provider": "sneaks",
    "category": "sneaker",
    "name": "Nike Air Jordan 1 Retro High OG Chicago",
    "brand": "Nike",
    "referenceNumber": "CW2288-111",
    "imageUrl": "https://...",
    "currentMarketValue": 320,
    "currency": "USD"
  }
]
```

### POST /manual-assets/:id/collectible/link

Link a manual asset to a collectible catalog item for automatic valuations.

**Body:**

```json
{
  "externalId": "CW2288-111",
  "provider": "sneaks",
  "category": "sneaker"
}
```

### POST /manual-assets/:id/collectible/unlink

Remove collectible provider link from an asset.

### POST /manual-assets/:id/collectible/refresh

Manually refresh the valuation from the linked provider.

**Response:**

```json
{
  "success": true,
  "previousValue": 300,
  "newValue": 320
}
```

---

## Gaming / Metaverse Economy

Multi-platform gaming asset tracking with staking, P2E earnings, guild management, and governance.

### GET /gaming/portfolio

Get aggregated gaming portfolio for a space.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| spaceId | string | Yes | Space identifier |

**Response:**

```json
{
  "platforms": [
    {
      "platform": "sandbox",
      "label": "The Sandbox",
      "chain": "polygon",
      "totalValueUsd": 14550,
      "tokensCount": 1,
      "stakingValueUsd": 6750,
      "stakingApy": 8.5,
      "landCount": 3,
      "nftCount": 0,
      "monthlyEarningsUsd": 503
    }
  ],
  "earnings": [{ "platform": "sandbox", "source": "staking", "amountUsd": 48, "color": "#F1C40F" }],
  "guilds": [
    {
      "platform": "axie",
      "guildName": "Ronin Raiders",
      "role": "manager",
      "scholarCount": 5,
      "revenueSharePercent": 30,
      "monthlyIncomeUsd": 200
    }
  ],
  "chains": [
    { "chain": "polygon", "totalValueUsd": 14550, "platformCount": 1, "platforms": ["sandbox"] }
  ],
  "parcels": [
    {
      "coordinates": "(-12, 45)",
      "size": "3x3",
      "rentalStatus": "rented",
      "monthlyRental": 150,
      "platform": "The Sandbox"
    }
  ],
  "nfts": [
    {
      "name": "BAYC #7291",
      "collection": "Bored Ape Yacht Club",
      "currentValue": 18500,
      "acquisitionCost": 32000
    }
  ],
  "proposals": [
    {
      "id": "SIP-42",
      "title": "Creator Fund Allocation Q1 2026",
      "status": "active",
      "dao": "Sandbox DAO"
    }
  ],
  "totalVotesCast": 14,
  "votingPower": 15000,
  "votingPowerToken": "SAND"
}
```

### GET /gaming/platforms

List supported gaming platforms.

### GET /gaming/earnings

Get earnings streams by platform and source.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| spaceId | string | Yes | Space identifier |
| period | string | No | Time period (e.g. `30d`, `90d`) |

### GET /gaming/nfts

Get all gaming NFTs for a space.

### GET /gaming/:platform/positions

Get positions for a specific gaming platform.

---

## Long-Term Projections

10-30 year cashflow forecasting with Monte Carlo simulation.

### GET /projections/long-term

Get long-term projection for a space.

**Query Parameters:**

- `spaceId` (required): Space identifier
- `years`: Projection horizon (10, 20, 30) - default: 30
- `scenarios`: Number of Monte Carlo runs (100-10000) - default: 1000

**Response:**

```json
{
  "projection": {
    "horizon": 30,
    "scenarios": 1000,
    "assumptions": {
      "inflationRate": 0.03,
      "incomeGrowthRate": 0.025,
      "portfolioReturn": 0.07,
      "portfolioVolatility": 0.15
    },
    "outcomes": {
      "median": {
        "year10": 450000,
        "year20": 1200000,
        "year30": 2500000
      },
      "percentile10": {
        "year10": 280000,
        "year20": 650000,
        "year30": 1100000
      },
      "percentile90": {
        "year10": 680000,
        "year20": 2100000,
        "year30": 5200000
      }
    },
    "successProbability": 0.87,
    "runOutYear": null
  },
  "yearByYear": [
    {
      "year": 1,
      "projectedNetWorth": 155000,
      "projectedIncome": 120000,
      "projectedExpenses": 95000,
      "projectedSavings": 25000
    }
  ]
}
```

### POST /projections/long-term

Create a custom projection with specific parameters.

```json
{
  "spaceId": "space_123",
  "years": 25,
  "scenarios": 5000,
  "assumptions": {
    "inflationRate": 0.035,
    "incomeGrowthRate": 0.02,
    "retirementAge": 65,
    "retirementSpending": 80000
  },
  "lifeEvents": [
    {
      "year": 5,
      "type": "home_purchase",
      "amount": -150000
    },
    {
      "year": 18,
      "type": "college",
      "amount": -200000
    },
    {
      "year": 22,
      "type": "retirement",
      "incomeChange": -100000
    }
  ]
}
```

### GET /projections/scenarios

List saved projection scenarios.

### POST /projections/scenarios/compare

Compare multiple projection scenarios.

```json
{
  "scenarioIds": ["scen_123", "scen_456", "scen_789"]
}
```

---

## Document Upload

Cloudflare R2 storage for manual asset attachments.

### POST /manual-assets/:id/documents/presign

Get a presigned URL for document upload.

```json
{
  "filename": "appraisal-2025.pdf",
  "contentType": "application/pdf",
  "category": "appraisal"
}
```

**Response:**

```json
{
  "uploadUrl": "https://r2.example.com/presigned/...",
  "documentId": "doc_123",
  "expiresAt": "2025-01-15T11:00:00Z"
}
```

### GET /manual-assets/:id/documents

List documents attached to an asset.

**Response:**

```json
{
  "documents": [
    {
      "id": "doc_123",
      "filename": "appraisal-2025.pdf",
      "category": "appraisal",
      "contentType": "application/pdf",
      "size": 2456789,
      "uploadedAt": "2025-01-10T10:00:00Z",
      "downloadUrl": "https://r2.example.com/signed/..."
    }
  ]
}
```

### DELETE /manual-assets/:id/documents/:docId

Delete a document attachment.

---

## Analytics & Reporting

### GET /analytics/dashboard

Get dashboard analytics for a space.

**Query Parameters:**

- `spaceId` (required): Space identifier
- `period`: Time period (7d, 30d, 90d, 1y)

**Response:**

```json
{
  "netWorth": {
    "current": 125000.0,
    "change": 2500.0,
    "changePercent": 2.04,
    "trend": "up"
  },
  "cashFlow": {
    "income": 8500.0,
    "expenses": 6200.0,
    "net": 2300.0,
    "period": "30d"
  },
  "accounts": {
    "total": 8,
    "banking": 5,
    "crypto": 2,
    "investment": 1
  },
  "budgetCompliance": {
    "onTrack": 4,
    "atRisk": 2,
    "exceeded": 1
  },
  "topCategories": [
    {
      "category": "Food & Dining",
      "amount": 856.78,
      "percentage": 13.8
    },
    {
      "category": "Transportation",
      "amount": 654.32,
      "percentage": 10.6
    }
  ]
}
```

### GET /analytics/forecast

Get 60-day cashflow forecast.

**Response:**

```json
{
  "forecast": [
    {
      "week": "2024-01-01",
      "projectedIncome": 2125.0,
      "projectedExpenses": 1850.0,
      "netFlow": 275.0,
      "confidence": 0.85
    }
  ],
  "summary": {
    "totalProjectedIncome": 17000.0,
    "totalProjectedExpenses": 14800.0,
    "netCashFlow": 2200.0,
    "riskFactors": ["High seasonal spending variation", "Irregular income patterns"]
  }
}
```

## Error Handling

### HTTP Status Codes

- `200 OK` - Successful request
- `201 Created` - Resource created successfully
- `204 No Content` - Successful request with no response body
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict
- `422 Unprocessable Entity` - Validation errors
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Validation failed for the provided data",
    "details": [
      {
        "field": "email",
        "message": "Must be a valid email address",
        "code": "INVALID_EMAIL"
      }
    ],
    "timestamp": "2024-01-01T12:00:00Z",
    "requestId": "req_123456"
  }
}
```

### Common Error Codes

- `UNAUTHORIZED` - Authentication token invalid or expired
- `FORBIDDEN` - Insufficient permissions for the operation
- `VALIDATION_FAILED` - Request validation errors
- `RESOURCE_NOT_FOUND` - Requested resource doesn't exist
- `DUPLICATE_RESOURCE` - Resource already exists
- `PROVIDER_ERROR` - External provider integration error
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INSUFFICIENT_FUNDS` - Account balance insufficient
- `SYNC_IN_PROGRESS` - Account sync already in progress

## Rate Limiting

API requests are limited to prevent abuse:

- **General endpoints**: 1000 requests per hour per user
- **Authentication endpoints**: 10 requests per minute per IP
- **Provider sync endpoints**: 5 requests per minute per account
- **Bulk operations**: 100 requests per hour per user

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1641024000
```

## Webhooks

### Webhook Security

All webhooks include HMAC signatures for verification:

```http
X-Dhanam-Signature: sha256=1234567890abcdef...
```

### Account Sync Webhook

Triggered when account synchronization completes:

```json
{
  "event": "account.sync.completed",
  "timestamp": "2024-01-01T12:00:00Z",
  "data": {
    "spaceId": "space_123",
    "accountId": "acc_123",
    "transactionsAdded": 15,
    "balanceUpdated": true,
    "syncDuration": 2345
  }
}
```

### Budget Alert Webhook

Triggered when budget thresholds are exceeded:

```json
{
  "event": "budget.alert.threshold_exceeded",
  "timestamp": "2024-01-01T12:00:00Z",
  "data": {
    "budgetId": "budget_123",
    "spaceId": "space_123",
    "currentSpent": 850.0,
    "budgetAmount": 1000.0,
    "threshold": 80,
    "percentageSpent": 85
  }
}
```

## SDKs and Libraries

### JavaScript/TypeScript SDK

```bash
npm install @dhanam/sdk
```

```typescript
import { DhanamAPI } from '@dhanam/sdk';

const dhanam = new DhanamAPI({
  apiKey: 'your_api_key',
  baseURL: 'https://api.dhan.am/v1',
});

// Get spaces
const spaces = await dhanam.spaces.list();

// Get transactions
const transactions = await dhanam.transactions.list({
  spaceId: 'space_123',
  limit: 50,
});
```

### Python SDK

```bash
pip install dhanam-python
```

```python
from dhanam import DhanamAPI

dhanam = DhanamAPI(
    api_key='your_api_key',
    base_url='https://api.dhan.am/v1'
)

# Get spaces
spaces = dhanam.spaces.list()

# Get transactions
transactions = dhanam.transactions.list(
    space_id='space_123',
    limit=50
)
```

## Testing

### Sandbox Environment

Test API endpoints in sandbox mode:

**Base URL**: `https://staging-api.dhan.am/v1`

### Test Credentials

```json
{
  "email": "demo@dhanam.app",
  "password": "<DEMO_USER_PASSWORD>"
}
```

### Mock Data

The sandbox environment includes:

- Sample transactions across multiple categories
- Pre-configured budgets and categories
- Mock ESG scoring data
- Simulated provider connections

## Support

- **API Status**: `https://api.dhan.am/v1/monitoring/health`
- **Documentation**: [repository docs](https://github.com/madfam-org/dhanam/tree/main/docs)
- **Developer Support**: [dev@dhan.am](mailto:dev@dhan.am)
- **Discord Community**: [discord.gg/dhanam](https://discord.gg/dhanam)

---

**Last Updated**: 2026-05-20
**API Version**: v1.1.0
