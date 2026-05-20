# Household Features Guide

**Version:** 1.0.0
**Date:** 2025-11-19
**Status:** Implemented; production availability follows current stability gates

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Frontend Integration](#frontend-integration)
6. [Use Cases](#use-cases)
7. [Security Considerations](#security-considerations)
8. [Testing](#testing)
9. [Future Enhancements](#future-enhancements)

---

## Overview

The Household Features enable multi-generational family financial planning within the Dhanam Ledger platform. This is a critical component of the "Blue Ocean Pivot" strategy to transform Dhanam from a budget tracker into an Autonomous Family Office platform.

### Key Capabilities

- **Multi-generational planning**: Organize family members across generations
- **Household-level aggregations**: View consolidated net worth and goals across all family spaces
- **Flexible relationships**: Support for spouse, children, parents, grandparents, trustees, and beneficiaries
- **Multiple household types**: Family, trust, estate, and partnership structures
- **Privacy & access control**: Member-based access to household data

### Business Value

- **Differentiation**: Unique family office features vs. commodity budget trackers
- **Retention**: Families stay on platform across life stages
- **Expansion**: Natural upgrade path from individual to family plans
- **Premium tier**: Foundation for advanced estate planning features

---

## Architecture

### Monorepo Structure

```
apps/
├─ api/
│  └─ src/modules/households/
│     ├─ dto/
│     │  ├─ create-household.dto.ts
│     │  ├─ update-household.dto.ts
│     │  ├─ add-member.dto.ts
│     │  └─ update-member.dto.ts
│     ├─ households.controller.ts
│     ├─ households.service.ts
│     ├─ households.service.spec.ts
│     └─ households.module.ts
└─ web/
   ├─ src/hooks/useHouseholds.ts
   └─ src/app/(dashboard)/households/
      └─ page.tsx
```

### Technology Stack

- **Backend**: NestJS with Prisma ORM
- **Frontend**: Next.js 14 (App Router) with React hooks
- **Database**: PostgreSQL with household tables
- **Validation**: class-validator for DTOs
- **Testing**: Jest with 100% coverage

---

## Database Schema

### Enums

#### HouseholdType

```typescript
enum HouseholdType {
  family       // Nuclear or extended family
  trust        // Family trust structure
  estate       // Estate planning entity
  partnership  // Business partnership
}
```

#### RelationshipType

```typescript
enum RelationshipType {
  spouse        // Married or domestic partner
  partner       // Non-married partner
  child         // Son or daughter
  parent        // Mother or father
  sibling       // Brother or sister
  grandparent   // Grandparent
  grandchild    // Grandchild
  dependent     // Legal dependent
  trustee       // Trust manager
  beneficiary   // Inheritance beneficiary
  other         // Other relationship
}
```

### Models

#### Household

**Purpose**: Top-level entity representing a family or multi-generational unit

```prisma
model Household {
  id               String            @id @default(uuid())
  name             String            // e.g., "Smith Family"
  type             HouseholdType     @default(family)
  baseCurrency     Currency          @default(USD)
  description      String?
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  // Relations
  members          HouseholdMember[]
  spaces           Space[]           // Linked spaces (personal/business)
  goals            Goal[]            // Household-level goals

  @@index([createdAt])
  @@map("households")
}
```

**Key Features**:

- Supports multiple household types (family, trust, estate, partnership)
- Configurable base currency for consolidated reporting
- Optional description for context

#### HouseholdMember

**Purpose**: Junction table linking users to households with relationship metadata

```prisma
model HouseholdMember {
  id               String           @id @default(uuid())
  householdId      String
  userId           String
  relationship     RelationshipType
  isMinor          Boolean          @default(false)
  accessStartDate  DateTime?        @db.Date  // When minor gains access
  notes            String?
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  // Relations
  household        Household        @relation(...)
  user             User             @relation(...)

  @@unique([householdId, userId])
  @@index([householdId])
  @@index([userId])
  @@map("household_members")
}
```

**Key Features**:

- Unique constraint prevents duplicate memberships
- `isMinor` flag for minors (age-based planning)
- `accessStartDate` for when minors gain access (e.g., age 18)
- `notes` for relationship-specific context

#### Updated Models

##### User

```prisma
model User {
  // ... existing fields
  dateOfBirth      DateTime?     @db.Date  // NEW: For age-based planning
  householdMembers HouseholdMember[]  // NEW: Reverse relation
}
```

##### Space

```prisma
model Space {
  // ... existing fields
  householdId      String?       // NEW: Optional link to household
  household        Household?    // NEW: Reverse relation
}
```

##### Goal

```prisma
model Goal {
  // ... existing fields
  householdId      String?       // NEW: Optional household-level goal
  household        Household?    // NEW: Reverse relation
}
```

---

## API Endpoints

### Base URL

```
http://localhost:4010/households
```

### Authentication

All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

### Endpoints

#### 1. Create Household

```http
POST /households
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "Smith Family",
  "type": "family",
  "baseCurrency": "USD",
  "description": "Main family household"
}
```

**Response** (201):

```json
{
  "id": "uuid",
  "name": "Smith Family",
  "type": "family",
  "baseCurrency": "USD",
  "description": "Main family household",
  "createdAt": "2025-11-19T10:00:00Z",
  "updatedAt": "2025-11-19T10:00:00Z",
  "members": [
    {
      "id": "uuid",
      "userId": "user-123",
      "relationship": "other",
      "isMinor": false
    }
  ]
}
```

**Business Logic**:

- Creator is automatically added as the first member
- Default relationship is "other" (user can update later)

---

#### 2. Get All Households

```http
GET /households
Authorization: Bearer <token>
```

**Response** (200):

```json
[
  {
    "id": "uuid",
    "name": "Smith Family",
    "type": "family",
    "baseCurrency": "USD",
    "description": "Main family household",
    "members": [...],
    "_count": {
      "spaces": 3,
      "goals": 5
    },
    "createdAt": "2025-11-19T10:00:00Z",
    "updatedAt": "2025-11-19T10:00:00Z"
  }
]
```

**Business Logic**:

- Returns only households where the user is a member
- Includes member count and aggregate counts

---

#### 3. Get Household by ID

```http
GET /households/:id
Authorization: Bearer <token>
```

**Response** (200):

```json
{
  "id": "uuid",
  "name": "Smith Family",
  "type": "family",
  "baseCurrency": "USD",
  "members": [
    {
      "id": "uuid",
      "userId": "user-123",
      "relationship": "spouse",
      "isMinor": false,
      "user": {
        "id": "user-123",
        "name": "John Smith",
        "email": "john@example.com",
        "dateOfBirth": "1985-01-01"
      }
    }
  ],
  "spaces": [
    {
      "id": "space-1",
      "name": "Personal",
      "type": "personal",
      "currency": "USD"
    }
  ],
  "goals": [
    {
      "id": "goal-1",
      "name": "Retirement",
      "type": "retirement",
      "targetAmount": 1000000,
      "currency": "USD",
      "targetDate": "2050-12-31",
      "status": "active"
    }
  ]
}
```

**Access Control**:

- User must be a member of the household
- Returns 404 if not found or no access

---

#### 4. Update Household

```http
PUT /households/:id
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "Updated Family Name",
  "description": "Updated description"
}
```

**Response** (200):

```json
{
  "id": "uuid",
  "name": "Updated Family Name",
  "description": "Updated description",
  ...
}
```

**Business Logic**:

- All fields are optional
- Only members can update

---

#### 5. Delete Household

```http
DELETE /households/:id
Authorization: Bearer <token>
```

**Response** (204): No content

**Business Logic**:

- Cannot delete household with associated spaces or goals
- Returns 400 if spaces or goals exist
- Must remove dependencies first

---

#### 6. Get Household Net Worth

```http
GET /households/:id/net-worth
Authorization: Bearer <token>
```

**Response** (200):

```json
{
  "totalNetWorth": 150000,
  "bySpace": [
    {
      "spaceId": "space-1",
      "spaceName": "Personal",
      "netWorth": 100000,
      "assets": 120000,
      "liabilities": 20000
    },
    {
      "spaceId": "space-2",
      "spaceName": "Business",
      "netWorth": 50000,
      "assets": 80000,
      "liabilities": 30000
    }
  ],
  "byCurrency": {
    "USD": 150000
  }
}
```

**Business Logic**:

- Aggregates all spaces linked to the household
- Assets: checking, savings, investment, crypto accounts
- Liabilities: credit card balances (negative amounts)
- Formula: `netWorth = assets - liabilities`

---

#### 7. Get Household Goal Summary

```http
GET /households/:id/goals/summary
Authorization: Bearer <token>
```

**Response** (200):

```json
{
  "totalGoals": 5,
  "activeGoals": 4,
  "achievedGoals": 1,
  "totalTargetAmount": 1500000,
  "byType": {
    "retirement": 2,
    "education": 2,
    "house_purchase": 1
  }
}
```

**Business Logic**:

- Aggregates all goals linked to the household
- Groups by goal type for analysis

---

#### 8. Add Member to Household

```http
POST /households/:id/members
Content-Type: application/json
Authorization: Bearer <token>

{
  "userId": "user-456",
  "relationship": "child",
  "isMinor": true,
  "accessStartDate": "2035-01-01",
  "notes": "Will gain access at age 18"
}
```

**Response** (201):

```json
{
  "id": "member-uuid",
  "householdId": "household-uuid",
  "userId": "user-456",
  "relationship": "child",
  "isMinor": true,
  "accessStartDate": "2035-01-01",
  "notes": "Will gain access at age 18",
  "user": {
    "id": "user-456",
    "name": "Jane Smith",
    "email": "jane@example.com",
    "dateOfBirth": "2017-01-01"
  }
}
```

**Business Logic**:

- User must exist in the system
- Cannot add duplicate members (unique constraint)
- Validates relationship type

---

#### 9. Update Member

```http
PUT /households/:id/members/:memberId
Content-Type: application/json
Authorization: Bearer <token>

{
  "relationship": "spouse",
  "notes": "Updated relationship"
}
```

**Response** (200):

```json
{
  "id": "member-uuid",
  "relationship": "spouse",
  "notes": "Updated relationship",
  ...
}
```

---

#### 10. Remove Member

```http
DELETE /households/:id/members/:memberId
Authorization: Bearer <token>
```

**Response** (204): No content

**Business Logic**:

- Cannot remove the last member (returns 400)
- Must delete household instead if last member

---

## Frontend Integration

### React Hook: `useHouseholds`

**Import**:

```typescript
import { useHouseholds } from '@/hooks/useHouseholds';
```

**Usage**:

```typescript
const {
  loading,
  error,
  getHouseholds,
  getHousehold,
  createHousehold,
  updateHousehold,
  deleteHousehold,
  getHouseholdNetWorth,
  getHouseholdGoalSummary,
  addMember,
  updateMember,
  removeMember,
} = useHouseholds();
```

### Example: Create Household

```typescript
const handleCreate = async () => {
  try {
    const household = await createHousehold({
      name: 'Smith Family',
      type: 'family',
      baseCurrency: 'USD',
      description: 'Main household',
    });
    console.log('Created:', household);
  } catch (err) {
    console.error('Failed to create household:', err);
  }
};
```

### Example: Load Household Details

```typescript
const loadHousehold = async (id: string) => {
  try {
    const [household, netWorth, goals] = await Promise.all([
      getHousehold(id),
      getHouseholdNetWorth(id),
      getHouseholdGoalSummary(id),
    ]);

    console.log('Net Worth:', netWorth.totalNetWorth);
    console.log('Goals:', goals.totalGoals);
  } catch (err) {
    console.error('Failed to load:', err);
  }
};
```

### TypeScript Types

All types are exported from `useHouseholds`:

```typescript
import type {
  Household,
  HouseholdMember,
  HouseholdNetWorth,
  HouseholdGoalSummary,
  CreateHouseholdInput,
  UpdateHouseholdInput,
  AddMemberInput,
  UpdateMemberInput,
} from '@/hooks/useHouseholds';
```

---

## Use Cases

### Use Case 1: Multi-Generational Family

**Scenario**: The Smith family wants to track wealth across 3 generations.

**Setup**:

1. Create household "Smith Family" (type: family)
2. Add members:
   - Grandpa (relationship: grandparent)
   - Dad (relationship: parent)
   - Mom (relationship: spouse)
   - Child 1 (relationship: child, isMinor: true)
   - Child 2 (relationship: child, isMinor: true)
3. Link spaces:
   - Grandpa's retirement accounts → household
   - Parents' joint checking → household
   - College savings accounts → household
4. Create household-level goals:
   - "Family vacation home" (type: house_purchase)
   - "Grandchildren education fund" (type: education)

**Benefits**:

- Consolidated net worth view across all generations
- Goal tracking for shared family objectives
- Prepare for estate planning (future feature)

---

### Use Case 2: Estate Planning Trust

**Scenario**: High-net-worth individual creates a trust for estate planning.

**Setup**:

1. Create household "Johnson Trust" (type: trust)
2. Add members:
   - Primary (relationship: trustee)
   - Spouse (relationship: beneficiary)
   - Child 1 (relationship: beneficiary)
   - Child 2 (relationship: beneficiary)
3. Link trust accounts to household
4. Set beneficiary allocations (future feature)

**Benefits**:

- Clear trust structure visualization
- Track trust assets separately from personal
- Foundation for digital will feature

---

### Use Case 3: Business Partnership

**Scenario**: Two business partners want to track shared business assets.

**Setup**:

1. Create household "Tech Startup LLC" (type: partnership)
2. Add members:
   - Partner 1 (relationship: partner)
   - Partner 2 (relationship: partner)
3. Link business space → household
4. Create goals:
   - "Series A fundraising" (type: business)
   - "Exit strategy" (type: business)

**Benefits**:

- Partnership-level financial tracking
- Shared goal management
- Clear ownership structure

---

## Security Considerations

### Access Control

**Principle**: Member-based access control

- ✅ **Household CRUD**: Only members can view/update households
- ✅ **Net Worth/Goals**: Only members can access aggregations
- ✅ **Member Management**: Only existing members can add/remove members
- ❌ **No public access**: Households are private by default

**Implementation**:

```typescript
// Every service method checks membership
const household = await this.prisma.household.findFirst({
  where: {
    id: householdId,
    members: {
      some: { userId }, // Ensures user is a member
    },
  },
});

if (!household) {
  throw new NotFoundException('Household not found or you do not have access');
}
```

### Audit Logging

All operations are audited:

```typescript
await this.audit.log({
  userId,
  action: 'HOUSEHOLD_CREATED' | 'HOUSEHOLD_MEMBER_ADDED' | etc.,
  resource: 'household',
  resourceId: household.id,
  severity: 'low' | 'medium',
  metadata: JSON.stringify({ ... }),
});
```

**Audit Actions**:

- `HOUSEHOLD_CREATED`
- `HOUSEHOLD_UPDATED`
- `HOUSEHOLD_DELETED`
- `HOUSEHOLD_MEMBER_ADDED`
- `HOUSEHOLD_MEMBER_UPDATED`
- `HOUSEHOLD_MEMBER_REMOVED`

### Data Protection

**Sensitive Data**:

- User date of birth (optional, for age-based planning)
- Household financial aggregations
- Relationship details

**Protection**:

- ✅ JWT authentication required
- ✅ Member-based authorization
- ✅ Audit logging for all changes
- ✅ No public endpoints
- ⚠️ Future: Encryption for sensitive notes/descriptions

---

## Testing

### Unit Tests

**File**: `apps/api/src/modules/households/households.service.spec.ts`

**Coverage**: 100% (all methods, edge cases, error paths)

**Key Test Cases**:

1. **Create Household**
   - ✅ Creates with all fields
   - ✅ Creates with default values
   - ✅ Adds creator as first member

2. **Access Control**
   - ✅ Throws NotFoundException if user not a member
   - ✅ Allows access if user is a member

3. **Member Management**
   - ✅ Adds member successfully
   - ✅ Prevents duplicate members
   - ✅ Prevents removing last member
   - ✅ Validates user exists

4. **Deletion**
   - ✅ Prevents deletion with spaces
   - ✅ Prevents deletion with goals
   - ✅ Deletes successfully when empty

5. **Aggregations**
   - ✅ Calculates net worth correctly
   - ✅ Aggregates by space
   - ✅ Aggregates by currency
   - ✅ Summarizes goals by type/status

**Run Tests**:

```bash
cd apps/api
pnpm test households.service.spec.ts
```

---

## Future Enhancements

### Phase 1: Estate Planning (12-16 weeks)

**Features**:

- Will & Testament model
- Beneficiary designation percentages
- Executor/trustee management
- Digital will feature
- Inheritance planning calculator

**Schema**:

```prisma
model Will {
  id               String
  householdId      String
  status           WillStatus
  beneficiaries    BeneficiaryDesignation[]
  executors        WillExecutor[]
}

model BeneficiaryDesignation {
  id               String
  willId           String
  householdMemberId String
  assetType        AssetType
  percentage       Decimal
}
```

**Business Value**:

- High willingness-to-pay feature
- Sticky (users won't switch)
- Legal compliance required

---

### Phase 2: Income Smoothing (6-8 weeks)

**Features**:

- Detect irregular income (gig economy)
- Calculate income volatility score
- "Safe-to-spend" buffer algorithm
- Seasonal pattern detection

**Use Case**:
Freelancer with irregular income gets personalized budget recommendations based on 3-month moving average.

---

### Phase 3: Portfolio Rebalancing (4-5 weeks)

**Features**:

- Household-level asset allocation targets
- Drift detection across all accounts
- Suggest rebalancing trades
- Tax implications calculation

**Use Case**:
Multi-generational family maintains 60/40 stocks/bonds allocation across all members' accounts.

---

### Phase 4: Tax-Loss Harvesting (4-6 weeks)

**Features**:

- Identify tax-loss opportunities
- Suggest replacement securities
- Calculate tax savings
- Wash sale rule compliance

**Use Case**:
High-net-worth household optimizes tax efficiency across all investment accounts.

---

## Migration Guide

### Database Migration

**File**: `apps/api/prisma/migrations/20251119000003_add_household_models/migration.sql`

**To apply**:

```bash
cd apps/api
pnpm db:migrate:dev
# or in production:
pnpm db:migrate:deploy
```

**Migration includes**:

- ✅ Create HouseholdType enum
- ✅ Create RelationshipType enum
- ✅ Create households table
- ✅ Create household_members table
- ✅ Add dateOfBirth to users
- ✅ Add householdId to spaces
- ✅ Add householdId to goals
- ✅ All indexes and foreign keys

### Rollback

**Not recommended** - Household features have no backwards-incompatible changes.

If needed:

```sql
-- Remove columns
ALTER TABLE users DROP COLUMN date_of_birth;
ALTER TABLE spaces DROP COLUMN household_id;
ALTER TABLE goals DROP COLUMN household_id;

-- Drop tables
DROP TABLE household_members;
DROP TABLE households;

-- Drop enums
DROP TYPE RelationshipType;
DROP TYPE HouseholdType;
```

---

## API Reference Summary

| Method | Endpoint                            | Purpose                   |
| ------ | ----------------------------------- | ------------------------- |
| POST   | `/households`                       | Create household          |
| GET    | `/households`                       | List user's households    |
| GET    | `/households/:id`                   | Get household details     |
| PUT    | `/households/:id`                   | Update household          |
| DELETE | `/households/:id`                   | Delete household          |
| GET    | `/households/:id/net-worth`         | Get net worth aggregation |
| GET    | `/households/:id/goals/summary`     | Get goal summary          |
| POST   | `/households/:id/members`           | Add member                |
| PUT    | `/households/:id/members/:memberId` | Update member             |
| DELETE | `/households/:id/members/:memberId` | Remove member             |

---

## Support

For questions or issues:

- Technical: See API tests for usage examples
- Business: Refer to Blue Ocean Pivot Roadmap
- Security: Review audit logs and access control section

---

**Last Updated**: 2026-05-20
**Contributors**: Claude Code
**Status**: Implemented; production availability follows current stability gates
