# Households Module

> Household and couple account management with consolidated financial views.

## Purpose

The Households module enables users to create household groups that aggregate multiple spaces and goals for unified financial oversight. It supports the "Yours/Mine/Ours" ownership model, allowing couples or families to maintain individual financial privacy while collaborating on shared objectives. The module provides consolidated net worth calculations and goal summaries across all household members.

## Key Entities

### Household

Container entity grouping related spaces and goals.

| Field          | Type     | Description                       |
| -------------- | -------- | --------------------------------- |
| `id`           | UUID     | Unique identifier                 |
| `name`         | string   | Household display name            |
| `type`         | enum     | Household type                    |
| `baseCurrency` | enum     | Default currency for aggregations |
| `description`  | string   | Optional description              |
| `createdAt`    | datetime | Creation timestamp                |
| `updatedAt`    | datetime | Last modification timestamp       |

### HouseholdType

| Type                | Description                  |
| ------------------- | ---------------------------- |
| `family`            | Traditional family household |
| `couple`            | Two-person partnership       |
| `roommates`         | Shared living arrangement    |
| `business_partners` | Business partnership         |
| `other`             | Custom arrangement           |

### HouseholdMember

Links users to households with relationship metadata.

| Field             | Type     | Description                      |
| ----------------- | -------- | -------------------------------- |
| `id`              | UUID     | Unique identifier                |
| `householdId`     | UUID     | Reference to household           |
| `userId`          | UUID     | Reference to user                |
| `relationship`    | enum     | Member's relationship type       |
| `isMinor`         | boolean  | Minor status (restricted access) |
| `accessStartDate` | datetime | When access becomes active       |
| `notes`           | string   | Member notes                     |
| `createdAt`       | datetime | Join timestamp                   |

### RelationshipType

| Type      | Description        |
| --------- | ------------------ |
| `spouse`  | Married partner    |
| `partner` | Unmarried partner  |
| `parent`  | Parent             |
| `child`   | Child              |
| `sibling` | Sibling            |
| `other`   | Other relationship |

## API Endpoints

### Household Management

| Method   | Endpoint          | Description            |
| -------- | ----------------- | ---------------------- |
| `POST`   | `/households`     | Create a new household |
| `GET`    | `/households`     | List user's households |
| `GET`    | `/households/:id` | Get household details  |
| `PUT`    | `/households/:id` | Update household       |
| `DELETE` | `/households/:id` | Delete household       |

### Aggregated Views

| Method | Endpoint                        | Description                |
| ------ | ------------------------------- | -------------------------- |
| `GET`  | `/households/:id/net-worth`     | Get consolidated net worth |
| `GET`  | `/households/:id/goals/summary` | Get goal summary           |

### Member Management

| Method   | Endpoint                            | Description           |
| -------- | ----------------------------------- | --------------------- |
| `POST`   | `/households/:id/members`           | Add household member  |
| `PUT`    | `/households/:id/members/:memberId` | Update member details |
| `DELETE` | `/households/:id/members/:memberId` | Remove member         |

### Request/Response Examples

**Create Household**

```json
// POST /households
{
  "name": "Smith Family",
  "type": "family",
  "baseCurrency": "USD",
  "description": "Family financial planning"
}
```

**Add Member**

```json
// POST /households/:id/members
{
  "userId": "uuid",
  "relationship": "spouse",
  "isMinor": false,
  "accessStartDate": "2025-01-01",
  "notes": "Co-owner of joint accounts"
}
```

**Net Worth Response**

```json
{
  "totalNetWorth": 250000.0,
  "bySpace": [
    {
      "spaceId": "uuid",
      "spaceName": "Joint Accounts",
      "netWorth": 150000.0,
      "assets": 160000.0,
      "liabilities": 10000.0
    },
    {
      "spaceId": "uuid",
      "spaceName": "Partner A Personal",
      "netWorth": 50000.0,
      "assets": 50000.0,
      "liabilities": 0
    },
    {
      "spaceId": "uuid",
      "spaceName": "Partner B Personal",
      "netWorth": 50000.0,
      "assets": 55000.0,
      "liabilities": 5000.0
    }
  ],
  "byCurrency": {
    "USD": 200000.0,
    "MXN": 50000.0
  }
}
```

**Goal Summary Response**

```json
{
  "totalGoals": 5,
  "activeGoals": 4,
  "achievedGoals": 1,
  "totalTargetAmount": 500000.0,
  "byType": {
    "retirement": 2,
    "emergency_fund": 1,
    "vacation": 1,
    "home_purchase": 1
  }
}
```

## Service Architecture

```
HouseholdsController
       │
       ▼
  HouseholdsService
       │
       ├──► PrismaService (database operations)
       │
       └──► AuditService (action logging)
```

### Key Service Methods

- **create()**: Create household with creator as initial member
- **findById()**: Fetch household with members, spaces, and goals
- **findByUser()**: List all households for a user
- **update()**: Modify household details
- **delete()**: Remove household (requires no associated spaces/goals)
- **addMember()**: Add user to household
- **updateMember()**: Modify member relationship/settings
- **removeMember()**: Remove member (cannot remove last member)
- **getNetWorth()**: Calculate consolidated net worth
- **getGoalSummary()**: Aggregate goal statistics

## Data Flow

### Household Creation

```
1. User submits CreateHouseholdDto
2. Household created in database
3. Creator automatically added as member (relationship: 'other')
4. Audit log entry created
5. Household returned with member details
```

### Net Worth Calculation

```
1. Verify user has household access
2. Fetch all spaces belonging to household
3. For each space:
   a. Sum account balances by type
   b. Credit accounts = liabilities
   c. Other accounts = assets
   d. Calculate space net worth
4. Aggregate totals across spaces
5. Group by currency for multi-currency view
```

### Member Addition

```
1. Verify requester has household access
2. Validate target user exists
3. Check for duplicate membership
4. Create HouseholdMember record
5. Audit log entry created
6. Return member with user details
```

### Deletion Protection

```
1. Check if household has associated spaces
2. Check if household has associated goals
3. If either > 0: Reject deletion with guidance
4. If clear: Delete household and members
```

## Error Handling

| Error                 | Status | Condition                                       |
| --------------------- | ------ | ----------------------------------------------- |
| `NotFoundException`   | 404    | Household, user, or member not found            |
| `BadRequestException` | 400    | Duplicate member, has associations, last member |

### Error Messages

- "Household not found or you do not have access"
- "User not found"
- "User is already a member of this household"
- "Household member not found"
- "Cannot delete household with associated spaces or goals. Please remove them first."
- "Cannot remove the last member of a household. Delete the household instead."

## Ownership Views (Yours/Mine/Ours)

The household structure supports three ownership perspectives:

| View      | Description                 | Implementation        |
| --------- | --------------------------- | --------------------- |
| **Yours** | Partner A's personal spaces | Filter by userId      |
| **Mine**  | Partner B's personal spaces | Filter by userId      |
| **Ours**  | Shared household spaces     | Filter by householdId |

This model enables:

- Individual financial privacy
- Collaborative household planning
- Consolidated net worth visibility
- Shared goal tracking

## Related Modules

| Module   | Relationship                    |
| -------- | ------------------------------- |
| `spaces` | Spaces can belong to households |
| `goals`  | Goals can be household-level    |
| `users`  | Members reference user accounts |
| `audit`  | Household actions are audited   |

## Testing

### Test Location

```
apps/api/src/modules/households/
  households.service.spec.ts
```

### Test Coverage Areas

- Household CRUD operations
- Member management
- Net worth calculations
- Goal aggregation
- Access control
- Deletion protection rules
- Last member protection
- Currency aggregation

### Running Tests

```bash
# Unit tests
pnpm test -- households

# With coverage
pnpm test:cov -- households
```

### Test Scenarios

- Create household with single member
- Add multiple members with different relationships
- Calculate net worth across multiple spaces
- Handle multi-currency aggregation
- Prevent deletion with associated data
- Remove member (not last)
- Update member relationships

---

**Module**: `households`
**Last Updated**: January 2025
