# Users Module

> User profile and preferences management with localization settings and account deletion.

## Purpose

The Users module manages authenticated user profiles, preferences, and account lifecycle. It handles profile retrieval including space memberships, preference updates for locale and timezone, and secure account deletion with proper cleanup of owned resources.

## Key Entities

| Entity    | Description                                    |
| --------- | ---------------------------------------------- |
| User      | User account with profile info and preferences |
| UserSpace | Membership linking users to spaces with roles  |
| Space     | Organizational container for financial data    |

## API Endpoints

| Endpoint    | Method | Description                          |
| ----------- | ------ | ------------------------------------ |
| `/users/me` | GET    | Get current user profile with spaces |
| `/users/me` | PATCH  | Update user profile and preferences  |
| `/users/me` | DELETE | Delete user account and cleanup      |

## Service Architecture

```
UsersController
       |
       v
UsersService
       |
       +---> PrismaService (database operations)
       +---> LoggerService (audit logging)
```

## Data Flow

**Profile Retrieval:**

1. User ID extracted from JWT token via `@CurrentUser` decorator
2. Service fetches user with space memberships
3. Response includes sanitized profile (excludes passwordHash, totpSecret)
4. Spaces array includes role for each membership

**Profile Update:**

1. User submits updated preferences
2. Service updates name, locale, and/or timezone
3. Update logged for audit trail
4. Sanitized user returned

**Account Deletion:**

1. Service identifies spaces where user is sole owner
2. Sole-owned spaces are deleted (cascades accounts, transactions)
3. User removed from shared spaces (memberships deleted)
4. User record deleted (cascades remaining data)
5. Deletion logged for audit compliance

## User Profile Response

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "locale": "es",
  "timezone": "America/Mexico_City",
  "emailVerified": true,
  "totpEnabled": false,
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-15T00:00:00Z",
  "spaces": [
    {
      "id": "uuid",
      "name": "Personal Finance",
      "type": "personal",
      "role": "owner"
    }
  ]
}
```

## Updateable Preferences

| Field      | Type   | Description                                 |
| ---------- | ------ | ------------------------------------------- |
| `name`     | string | Display name                                |
| `locale`   | enum   | Language preference: `en`, `es`             |
| `timezone` | string | IANA timezone (e.g., `America/Mexico_City`) |

## Security Notes

**Sanitized Fields:**

- `passwordHash` - Never exposed in API responses
- `totpSecret` - Never exposed in API responses

**Account Deletion Rules:**

- Sole-owned spaces are fully deleted
- Shared spaces transfer to remaining owners
- Operation runs in database transaction for atomicity

## Error Handling

| Error          | HTTP Status | Description                  |
| -------------- | ----------- | ---------------------------- |
| User not found | 404         | User does not exist          |
| Unauthorized   | 401         | Invalid or missing JWT token |

## Related Modules

| Module   | Relationship                          |
| -------- | ------------------------------------- |
| Auth     | Authentication and token management   |
| Spaces   | User membership and role management   |
| Accounts | Account ownership for Yours/Mine/Ours |

## Testing

```bash
# Run users module tests
pnpm test -- users

# Run with coverage
pnpm test:cov -- users
```

---

**Module**: `users`
**Last Updated**: January 2025
