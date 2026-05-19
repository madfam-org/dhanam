# Spaces Module

> Multi-tenant space management for personal and business financial separation.

## Purpose

The Spaces module provides the foundational multi-tenant architecture for Dhanam. Each space represents an isolated financial environment (personal or business) where users can manage accounts, transactions, budgets, and goals independently. Spaces support collaborative access with role-based permissions, enabling households or teams to share financial management responsibilities.

## Key Entities

### Space

The primary container for financial data segregation.

| Field       | Type     | Description                      |
| ----------- | -------- | -------------------------------- |
| `id`        | UUID     | Unique identifier                |
| `name`      | string   | Display name for the space       |
| `type`      | enum     | `personal` or `business`         |
| `currency`  | enum     | Default currency (MXN, USD, EUR) |
| `createdAt` | datetime | Creation timestamp               |
| `updatedAt` | datetime | Last modification timestamp      |

### SpaceMember (UserSpace)

Junction table linking users to spaces with role assignments.

| Field      | Type     | Description               |
| ---------- | -------- | ------------------------- |
| `userId`   | UUID     | Reference to user         |
| `spaceId`  | UUID     | Reference to space        |
| `role`     | enum     | Member's permission level |
| `joinedAt` | datetime | When the user joined      |

### Role Hierarchy

Roles follow a strict hierarchy for permission checks:

| Role     | Level | Capabilities                                   |
| -------- | ----- | ---------------------------------------------- |
| `owner`  | 4     | Full control, delete space, transfer ownership |
| `admin`  | 3     | Manage members, modify settings                |
| `member` | 2     | Create/edit transactions, budgets              |
| `viewer` | 1     | Read-only access                               |

## API Endpoints

### Space Management

| Method   | Endpoint           | Description                      | Required Role |
| -------- | ------------------ | -------------------------------- | ------------- |
| `GET`    | `/spaces`          | List all spaces for current user | -             |
| `POST`   | `/spaces`          | Create a new space               | -             |
| `GET`    | `/spaces/:spaceId` | Get space details                | viewer        |
| `PATCH`  | `/spaces/:spaceId` | Update space settings            | owner, admin  |
| `DELETE` | `/spaces/:spaceId` | Delete space permanently         | owner         |

### Member Management

| Method   | Endpoint                           | Description         | Required Role |
| -------- | ---------------------------------- | ------------------- | ------------- |
| `GET`    | `/spaces/:spaceId/members`         | List all members    | viewer        |
| `POST`   | `/spaces/:spaceId/members`         | Invite a new member | owner, admin  |
| `PATCH`  | `/spaces/:spaceId/members/:userId` | Update member role  | owner         |
| `DELETE` | `/spaces/:spaceId/members/:userId` | Remove member       | owner, admin  |

### Request/Response Examples

**Create Space**

```json
// POST /spaces
{
  "name": "Personal Finance",
  "type": "personal",
  "currency": "MXN"
}

// Response 201
{
  "id": "uuid",
  "name": "Personal Finance",
  "type": "personal",
  "currency": "MXN",
  "role": "owner",
  "createdAt": "2025-01-25T00:00:00Z",
  "updatedAt": "2025-01-25T00:00:00Z"
}
```

**Invite Member**

```json
// POST /spaces/:spaceId/members
{
  "email": "partner@example.com",
  "role": "member"
}
```

## Service Architecture

```
SpacesController
       │
       ▼
  SpacesService
       │
       ├──► PrismaService (database operations)
       │
       └──► LoggerService (audit logging)

Guards:
  ├── JwtAuthGuard (authentication)
  └── SpaceGuard (space membership verification)

Decorators:
  ├── @CurrentUser() - Extract authenticated user
  └── @RequireRole() - Role-based access control
```

### Key Services

- **SpacesService**: Core business logic for space CRUD operations
- **SpaceGuard**: Validates user membership in requested space
- **RequireRole Decorator**: Enforces role-based permissions

## Data Flow

### Space Creation

```
1. User submits CreateSpaceDto
2. SpacesService.createSpace() called
3. Space created in database
4. Creator automatically added as 'owner'
5. Audit log entry created
6. Space returned with owner role attached
```

### Member Invitation

```
1. Admin/Owner submits InviteMemberDto
2. SpaceGuard verifies requester's membership
3. RequireRole decorator checks role level
4. Target user looked up by email
5. Duplicate membership check
6. UserSpace record created
7. Audit log entry created
8. Member details returned
```

### Role Update Flow

```
1. Owner submits UpdateMemberRoleDto
2. Ownership protection: Cannot demote last owner
3. Role hierarchy validation
4. UserSpace record updated
5. Audit log entry created
```

## Error Handling

| Error                 | Status | Condition                                      |
| --------------------- | ------ | ---------------------------------------------- |
| `NotFoundException`   | 404    | Space or user not found                        |
| `BadRequestException` | 400    | User already member, removing self, last owner |
| `ForbiddenException`  | 403    | Insufficient role level for operation          |

### Error Messages

- "Space not found" - Invalid space ID or no access
- "User not found" - Email not registered
- "User is already a member" - Duplicate invitation attempt
- "Space must have at least one owner" - Owner protection
- "Cannot remove yourself" - Self-removal prevention
- "Cannot remove the only owner" - Owner preservation
- "Access denied. Required role: X, user role: Y" - Role violation

## Related Modules

| Module         | Relationship                          |
| -------------- | ------------------------------------- |
| `accounts`     | Accounts belong to spaces             |
| `transactions` | Transactions scoped to space accounts |
| `budgets`      | Budgets created within spaces         |
| `goals`        | Goals associated with spaces          |
| `categories`   | Category rules per space              |
| `recurring`    | Recurring patterns per space          |
| `households`   | Spaces can belong to households       |

## Testing

### Test Location

```
apps/api/src/modules/spaces/__tests__/
```

### Test Coverage Areas

- Space CRUD operations
- Member invitation and removal
- Role hierarchy enforcement
- Owner protection rules
- Access control validation
- Concurrent membership scenarios

### Running Tests

```bash
# Unit tests
pnpm test -- spaces

# With coverage
pnpm test:cov -- spaces
```

---

**Module**: `spaces`
**Last Updated**: January 2025
