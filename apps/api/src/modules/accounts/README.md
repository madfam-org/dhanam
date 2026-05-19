# Accounts Module

> Bank, investment, crypto, and manual account management with multi-provider integration and household ownership views.

## Purpose

The Accounts module manages all financial account types within a Space, supporting both manually-created accounts and externally-linked accounts via providers (Belvo, Plaid, Bitso). It provides balance tracking, account synchronization, and the Yours/Mine/Ours household ownership model for multi-user financial visibility.

## Key Entities

| Entity                   | Description                                                        |
| ------------------------ | ------------------------------------------------------------------ |
| Account                  | Financial account with type, balance, currency, and provider info  |
| AccountOwnership         | Ownership designation: individual (single owner) or joint (shared) |
| AccountSharingPermission | Granular sharing permissions between household members             |

## Account Types

| Type         | Description                                  |
| ------------ | -------------------------------------------- |
| `checking`   | Bank checking accounts                       |
| `savings`    | Bank savings accounts                        |
| `credit`     | Credit cards and lines of credit             |
| `investment` | Brokerage and investment accounts            |
| `crypto`     | Cryptocurrency wallets and exchange accounts |
| `other`      | Miscellaneous account types                  |

## API Endpoints

| Endpoint                                           | Method | Description                                     |
| -------------------------------------------------- | ------ | ----------------------------------------------- |
| `/spaces/:spaceId/accounts`                        | GET    | List all accounts in space (filterable by type) |
| `/spaces/:spaceId/accounts`                        | POST   | Create manual account                           |
| `/spaces/:spaceId/accounts/connect`                | POST   | Connect external account via provider           |
| `/spaces/:spaceId/accounts/:accountId`             | GET    | Get account details                             |
| `/spaces/:spaceId/accounts/:accountId`             | PATCH  | Update account (name, balance for manual)       |
| `/spaces/:spaceId/accounts/:accountId`             | DELETE | Delete account                                  |
| `/spaces/:spaceId/accounts/:accountId/sync`        | POST   | Trigger account sync (connected accounts only)  |
| `/spaces/:spaceId/accounts/:accountId/ownership`   | PATCH  | Update ownership (yours/mine/ours)              |
| `/spaces/:spaceId/accounts/by-ownership/:filter`   | GET    | Get accounts by ownership filter                |
| `/spaces/:spaceId/accounts/net-worth/by-ownership` | GET    | Get aggregated net worth by ownership           |

## Service Architecture

```
AccountsController
       |
       v
AccountsService
       |
       +---> PrismaService (database operations)
       +---> LoggerService (audit logging)
       +---> Provider Orchestrator (Belvo/Plaid/Bitso integration)
```

## Data Flow

**Manual Account Creation:**

1. User submits account details (name, type, currency, balance)
2. Service creates account with `provider: 'manual'`
3. Balance updates require manual PATCH requests

**Connected Account Linking:**

1. User initiates connection via `/connect` endpoint
2. Service routes to appropriate provider module (Belvo, Plaid, Bitso)
3. Provider handles OAuth/API flow and returns linked accounts
4. Accounts created with encrypted credentials stored via KMS

**Account Synchronization:**

1. User triggers sync via POST to `/sync`
2. Background job queued via BullMQ
3. Provider fetches latest balance and transactions
4. Account updated with new data and `lastSyncedAt` timestamp

**Ownership Management (Yours/Mine/Ours):**

- `yours`: Accounts owned by current user (`ownership: 'individual'`, `ownerId: userId`)
- `mine`: Accounts owned by other household members
- `ours`: Joint/shared accounts (`ownership: 'joint'`, `ownerId: null`)

## Error Handling

| Error                           | HTTP Status | Description                                       |
| ------------------------------- | ----------- | ------------------------------------------------- |
| Account not found               | 404         | Account does not exist in space                   |
| Invalid provider                | 400         | Unknown provider specified                        |
| Cannot sync manual              | 400         | Attempted sync on manual account                  |
| Cannot update connected balance | 400         | Attempted manual balance update on linked account |
| Individual requires ownerId     | 400         | Missing ownerId for individual ownership          |
| Joint should not have ownerId   | 400         | Provided ownerId for joint account                |

## Related Modules

| Module       | Relationship                      |
| ------------ | --------------------------------- |
| Transactions | Transactions belong to accounts   |
| Providers    | External account linking and sync |
| Spaces       | Accounts scoped to spaces         |
| Users        | Account ownership and sharing     |

## Testing

```bash
# Run accounts module tests
pnpm test -- accounts

# Run with coverage
pnpm test:cov -- accounts
```

---

**Module**: `accounts`
**Last Updated**: January 2025
