# Dhanam Mobile

React Native + Expo client for Dhanam.

## Quick reference

| Item    | Value                                     |
| ------- | ----------------------------------------- |
| Package | `@dhanam/mobile`                          |
| API env | Same public vars as web (`EXPO_PUBLIC_*`) |

## Documentation

| Document                                                | Use                         |
| ------------------------------------------------------- | --------------------------- |
| [Mobile guide](../../docs/MOBILE.md)                    | Expo setup, builds, testing |
| [Development guide](../../docs/DEVELOPMENT.md)          | Monorepo commands           |
| [Architecture](../../docs/architecture/ARCHITECTURE.md) | System overview             |
| [Launch operations](../../docs/LAUNCH_OPERATIONS.md)    | App store checklist         |

## Commands

```bash
pnpm --filter @dhanam/mobile dev
pnpm --filter @dhanam/mobile test
```

Mobile test depth is limited relative to API/web; see
[Tech debt TD-1007](../../docs/TECH_DEBT.md).

## Shared packages

- `@dhanam/shared` — types and utilities

React is pinned to 18 at the monorepo root until Expo supports a safe React 19
migration ([TD-1006](../../docs/TECH_DEBT.md)).
