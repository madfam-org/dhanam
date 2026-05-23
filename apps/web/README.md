# Dhanam Web

Next.js 15 user dashboard and marketing surfaces for Dhanam (`app.dhan.am`,
`dhan.am`).

## Quick reference

| Item       | Value                                          |
| ---------- | ---------------------------------------------- |
| Local URL  | `http://localhost:3040`                        |
| Production | `https://app.dhan.am`, `https://dhan.am`       |
| Package    | `@dhanam/web`                                  |
| API env    | `NEXT_PUBLIC_API_URL=http://localhost:4010/v1` |

## Documentation

| Document                                                        | Use                        |
| --------------------------------------------------------------- | -------------------------- |
| [Development guide](../../docs/DEVELOPMENT.md)                  | Env files, ports, commands |
| [Architecture](../../docs/architecture/ARCHITECTURE.md)         | System overview            |
| [API reference](../../docs/API.md)                              | Backend endpoints          |
| [Billing integration](../../docs/guides/BILLING_INTEGRATION.md) | Checkout and subscriptions |
| [Repository README](../../README.md)                            | Monorepo quick start       |

## Commands

```bash
pnpm --filter @dhanam/web dev
pnpm --filter @dhanam/web build
pnpm --filter @dhanam/web test
pnpm --dir apps/web exec playwright test --project=chromium
```

## Key paths

| Path                    | Purpose                      |
| ----------------------- | ---------------------------- |
| `src/app/`              | App Router pages             |
| `src/components/`       | UI components                |
| `src/lib/providers.tsx` | Janua provider and auth sync |
| `src/stores/`           | Zustand client state         |

Authentication uses `@janua/react-sdk` (OIDC/PKCE). Do not add alternate SSO
providers.

## Shared packages

- `@dhanam/ui` — shared components
- `@dhanam/shared` — types and i18n
