# Estate Planning Module

> Life Beat dead man's switch for estate planning with executor access, beneficiary management, and periodic check-in requirements.

## Purpose

The Estate Planning module provides digital estate planning tools including will management, beneficiary designations, and executor access provisioning. The "Life Beat" feature monitors user activity and triggers executor access after configurable inactivity periods, implementing a two-person activation rule for security.

## Key Entities

| Entity                   | Description                                 |
| ------------------------ | ------------------------------------------- |
| `Will`                   | Estate plan document with status lifecycle  |
| `BeneficiaryDesignation` | Asset allocation to household members       |
| `WillExecutor`           | Designated executor with priority order     |
| `ExecutorAssignment`     | Life Beat executor with verification status |
| `ExecutorAccessLog`      | Audit trail for executor actions            |

### Will Status Lifecycle

```
draft -> active -> executed
           |
           v
        revoked
```

### Beneficiary Designation

```typescript
interface BeneficiaryDesignation {
  willId: string;
  beneficiaryId: string; // Household member ID
  assetType: AssetType; // all_assets, crypto, real_estate, etc.
  assetId?: string; // Specific asset (optional)
  percentage: number; // Must sum to 100% per asset type
  conditions?: string; // Conditional inheritance
  notes?: string;
}
```

## API Endpoints

### Will Management

| Method   | Endpoint                        | Auth | Tier    | Description                      |
| -------- | ------------------------------- | ---- | ------- | -------------------------------- |
| `POST`   | `/wills`                        | JWT  | Premium | Create new will (draft)          |
| `GET`    | `/wills/household/:householdId` | JWT  | Premium | List household wills             |
| `GET`    | `/wills/:id`                    | JWT  | Premium | Get will details                 |
| `PUT`    | `/wills/:id`                    | JWT  | Premium | Update will                      |
| `DELETE` | `/wills/:id`                    | JWT  | Premium | Delete draft will                |
| `POST`   | `/wills/:id/activate`           | JWT  | Premium | Activate will (rate-limited)     |
| `POST`   | `/wills/:id/revoke`             | JWT  | Premium | Revoke active will               |
| `GET`    | `/wills/:id/validate`           | JWT  | Premium | Validate beneficiary allocations |

### Beneficiary Management

| Method   | Endpoint                                  | Auth | Description                 |
| -------- | ----------------------------------------- | ---- | --------------------------- |
| `POST`   | `/wills/:id/beneficiaries`                | JWT  | Add beneficiary designation |
| `PUT`    | `/wills/:id/beneficiaries/:beneficiaryId` | JWT  | Update designation          |
| `DELETE` | `/wills/:id/beneficiaries/:beneficiaryId` | JWT  | Remove beneficiary          |

### Executor Management

| Method   | Endpoint                           | Auth | Description     |
| -------- | ---------------------------------- | ---- | --------------- |
| `POST`   | `/wills/:id/executors`             | JWT  | Add executor    |
| `PUT`    | `/wills/:id/executors/:executorId` | JWT  | Update executor |
| `DELETE` | `/wills/:id/executors/:executorId` | JWT  | Remove executor |

### Life Beat Executor Access (ExecutorAccessService)

| Operation             | Description                                         |
| --------------------- | --------------------------------------------------- |
| `addExecutor`         | Assign an executor with email verification          |
| `verifyExecutor`      | Confirm executor via email link                     |
| `removeExecutor`      | Remove executor assignment                          |
| `getExecutors`        | List all assigned executors                         |
| `requestAccess`       | Executor requests access (triggers two-person rule) |
| `grantAccess`         | Provision time-limited read-only access             |
| `validateAccessToken` | Verify executor access token                        |
| `revokeAccess`        | Account holder revokes executor access              |
| `logExecutorAction`   | Audit executor activity                             |
| `getAccessLog`        | Retrieve access audit trail                         |

### Example Requests

```bash
# Create a will
POST /wills
Authorization: Bearer <token>
Content-Type: application/json
{
  "householdId": "household-uuid",
  "name": "My Estate Plan 2025",
  "notes": "Primary estate plan",
  "legalDisclaimer": true
}

# Add beneficiary
POST /wills/:id/beneficiaries
{
  "beneficiaryId": "member-uuid",
  "assetType": "all_assets",
  "percentage": 50,
  "conditions": "Upon reaching age 25"
}

# Add executor
POST /wills/:id/executors
{
  "executorId": "member-uuid",
  "isPrimary": true,
  "order": 1
}

# Activate will (requires validation)
POST /wills/:id/activate
```

## Service Architecture

```
EstatePlanningModule
    |
    +-- EstatePlanningController
    |       |
    |       +-- EstatePlanningService
    |               |
    |               +-- Will CRUD operations
    |               +-- Beneficiary management
    |               +-- Executor management
    |               +-- Allocation validation
    |               +-- Status transitions
    |
    +-- ExecutorAccessService (Life Beat)
    |       |
    |       +-- Executor assignment
    |       +-- Email verification flow
    |       +-- Two-person activation rule
    |       +-- Time-limited access tokens
    |       +-- Audit logging
    |
    +-- Dependencies
            |
            +-- AuditService (action logging)
            +-- PrismaService (database)
            +-- Subscription guard (Premium tier)
```

## Data Flow

### Will Activation Flow

```
1. User creates will (status: draft)
2. Add beneficiaries with percentage allocations
3. Add at least one executor
4. Accept legal disclaimer
5. Request activation (POST /wills/:id/activate)
6. System validates:
   - At least one beneficiary
   - At least one executor
   - Legal disclaimer accepted
   - Allocations sum to 100% per asset type
7. Revoke any existing active will for household
8. Activate new will
9. Audit log created
```

### Life Beat Executor Access Flow

```
1. Account holder adds executor (email sent for verification)
2. Executor verifies via email link
3. If account holder becomes inactive:
   a. Executor requests access
   b. System checks inactivity threshold (lifeBeatAlertDays)
   c. If two-person rule applies, second executor must confirm
   d. Time-limited access token generated (7 days)
4. Executor accesses account with read-only permissions
5. All actions logged for audit
6. If account holder returns, they can revoke access
```

### Two-Person Activation Rule

```
IF verified_executors > 1 THEN
    Access requires confirmation from another executor
ELSE
    Single executor can request access directly
```

## Configuration

### Rate Limiting

| Endpoint                   | Limit      | Window |
| -------------------------- | ---------- | ------ |
| `POST /wills/:id/activate` | 3 requests | 1 hour |
| `POST /wills/:id/revoke`   | 5 requests | 1 hour |

### Access Token Settings

```typescript
const ACCESS_TOKEN_CONFIG = {
  expiresIn: 7, // Days
  tokenLength: 32, // Bytes (64 hex chars)
  readOnlyAccess: true, // Always read-only
};
```

### Inactivity Thresholds

User-configurable `lifeBeatAlertDays` array determines when executor access becomes available. Example: `[30, 60, 90]` sends alerts at 30 and 60 days, allows access at 90 days.

### Validation Rules

1. **Beneficiary allocations**: Must sum to exactly 100% per asset type
2. **Executor requirement**: At least one executor required for activation
3. **Legal disclaimer**: Must be accepted before activation
4. **Household membership**: Beneficiaries and executors must be household members
5. **Status restrictions**: Cannot modify executed wills

## Related Modules

| Module       | Relationship                                     |
| ------------ | ------------------------------------------------ |
| `households` | Provides household membership for access control |
| `billing`    | Premium tier required for estate planning        |
| `audit`      | All estate actions are audit logged              |
| `users`      | Activity tracking for Life Beat                  |

## Testing

```bash
# Run estate planning tests
pnpm test -- estate-planning

# Run with coverage
pnpm test:cov -- estate-planning
```

### Test Files

- `estate-planning.service.spec.ts` - Will management tests
- `executor-access.service.spec.ts` - Life Beat access tests

### Key Test Scenarios

1. Will CRUD operations and status transitions
2. Beneficiary allocation validation (100% rule)
3. Executor assignment and verification
4. Two-person activation rule
5. Access token generation and validation
6. Inactivity threshold checks
7. Audit log creation
8. Premium tier enforcement
9. Rate limiting enforcement

## Security Considerations

- **Read-only access**: Executors can only view, not modify
- **Time-limited tokens**: Access expires after 7 days
- **Two-person rule**: Prevents single-point-of-failure
- **Full audit trail**: All executor actions logged
- **Email verification**: Executors must verify identity
- **Premium-only**: Feature limited to paying users
- **Rate limiting**: Prevents abuse of activation/revocation

---

**Module**: `estate-planning`
**Last Updated**: January 2025
