# @dhanam/shared

> Shared types, utilities, constants, and i18n for the Dhanam monorepo.

## Overview

This package provides the foundational building blocks used across all Dhanam applications:

- **Types**: TypeScript interfaces for accounts, transactions, budgets, users, spaces, and analytics
- **Utilities**: Currency formatting, date manipulation, and validation helpers
- **Constants**: Currencies, locales, error codes, and provider configurations
- **i18n**: Internationalization system supporting English (en) and Spanish (es)
- **React Hooks**: `useTranslation` hook and `I18nProvider` context

## Installation

```bash
# From monorepo root
pnpm add @dhanam/shared

# Already included as workspace dependency in other packages
```

## Quick Start

### Using Types

```typescript
import { Account, Transaction, Budget, User, Space, Locale } from '@dhanam/shared';

const account: Account = {
  id: 'acc_123',
  name: 'Checking Account',
  type: 'bank',
  balance: 1500.0,
  currency: 'USD',
  spaceId: 'space_456',
};
```

### Using Utilities

```typescript
import {
  formatCurrency,
  parseCurrency,
  formatDate,
  parseDate,
  isValidEmail,
  isValidUUID,
} from '@dhanam/shared';

// Currency formatting
const formatted = formatCurrency(1234.56, 'USD'); // "$1,234.56"
const mxn = formatCurrency(25000, 'MXN'); // "$25,000.00 MXN"

// Date formatting
const date = formatDate(new Date(), 'short'); // "1/15/2025"
const dateES = formatDate(new Date(), 'long', 'es'); // "15 de enero de 2025"

// Validation
const validEmail = isValidEmail('user@example.com'); // true
const validUUID = isValidUUID('550e8400-e29b-41d4-a716-446655440000'); // true
```

### Using i18n

```tsx
import { I18nProvider, useTranslation } from '@dhanam/shared';

// Wrap your app
function App() {
  return (
    <I18nProvider locale="es">
      <Dashboard />
    </I18nProvider>
  );
}

// Use translations in components
function Dashboard() {
  const { t, locale, setLocale } = useTranslation();

  return (
    <div>
      <h1>{t('common.welcome')}</h1>
      <p>{t('transactions.noTransactions')}</p>
      <button onClick={() => setLocale('en')}>{t('common.switchLanguage')}</button>
    </div>
  );
}
```

### Using Constants

```typescript
import {
  SUPPORTED_CURRENCIES,
  SUPPORTED_LOCALES,
  PROVIDER_TYPES,
  ERROR_CODES,
} from '@dhanam/shared';

// Available currencies
console.log(SUPPORTED_CURRENCIES); // ['USD', 'MXN', 'EUR', ...]

// Available locales
console.log(SUPPORTED_LOCALES); // ['en', 'es']

// Provider identifiers
console.log(PROVIDER_TYPES); // ['belvo', 'plaid', 'bitso', ...]
```

## API Reference

### Types

| Type                   | Description                              |
| ---------------------- | ---------------------------------------- |
| `Account`              | Bank, investment, or crypto account      |
| `Transaction`          | Financial transaction record             |
| `Budget`               | Budget with categories and limits        |
| `User`                 | User profile and preferences             |
| `Space`                | Personal or business financial space     |
| `Category`             | Transaction category                     |
| `RecurringTransaction` | Scheduled recurring transactions         |
| `Locale`               | Supported locale type (`'en'` \| `'es'`) |

### Utilities

#### Currency

| Function                                    | Description                      |
| ------------------------------------------- | -------------------------------- |
| `formatCurrency(amount, currency, locale?)` | Format number as currency string |
| `parseCurrency(value)`                      | Parse currency string to number  |
| `getCurrencySymbol(currency)`               | Get symbol for currency code     |
| `convertCurrency(amount, from, to, rate)`   | Convert between currencies       |

#### Date

| Function                            | Description                             |
| ----------------------------------- | --------------------------------------- |
| `formatDate(date, format, locale?)` | Format date with locale support         |
| `parseDate(value)`                  | Parse string to Date object             |
| `getRelativeTime(date, locale?)`    | Get relative time string ("2 days ago") |
| `isWithinRange(date, start, end)`   | Check if date is within range           |

#### Validation

| Function                | Description                            |
| ----------------------- | -------------------------------------- |
| `isValidEmail(email)`   | Validate email format                  |
| `isValidUUID(uuid)`     | Validate UUID format                   |
| `isValidCurrency(code)` | Check if currency code is supported    |
| `sanitizeInput(input)`  | Sanitize user input for XSS prevention |

### Constants

| Constant               | Description                         |
| ---------------------- | ----------------------------------- |
| `SUPPORTED_CURRENCIES` | Array of supported currency codes   |
| `SUPPORTED_LOCALES`    | Array of supported locale codes     |
| `PROVIDER_TYPES`       | Financial data provider identifiers |
| `ERROR_CODES`          | Standardized error code enum        |
| `DEFAULT_LOCALE`       | Default locale (`'es'`)             |
| `DEFAULT_CURRENCY`     | Default currency (`'MXN'`)          |

### i18n

| Export                | Description                               |
| --------------------- | ----------------------------------------- |
| `I18nProvider`        | React context provider for translations   |
| `useTranslation()`    | Hook returning `{ t, locale, setLocale }` |
| `withI18n(Component)` | HOC for class components                  |
| `translations`        | Raw translation objects                   |

## Architecture

```
packages/shared/
├── src/
│   ├── types/
│   │   ├── account.types.ts      # Account interfaces
│   │   ├── transaction.types.ts  # Transaction interfaces
│   │   ├── budget.types.ts       # Budget interfaces
│   │   ├── user.types.ts         # User interfaces
│   │   ├── space.types.ts        # Space interfaces
│   │   ├── analytics.types.ts    # Analytics interfaces
│   │   ├── auth.types.ts         # Authentication types
│   │   ├── common.types.ts       # Common/shared types
│   │   ├── recurring.types.ts    # Recurring transaction types
│   │   └── index.ts              # Type exports
│   ├── utils/
│   │   ├── currency.ts           # Currency formatting
│   │   ├── date.ts               # Date utilities
│   │   ├── validation.ts         # Validation helpers
│   │   ├── formatters.ts         # General formatters
│   │   └── index.ts              # Utility exports
│   ├── constants/
│   │   ├── currencies.ts         # Currency definitions
│   │   ├── locales.ts            # Locale definitions
│   │   ├── providers.ts          # Provider constants
│   │   ├── errors.ts             # Error code definitions
│   │   └── index.ts              # Constant exports
│   ├── i18n/
│   │   ├── en/                   # English translations
│   │   ├── es/                   # Spanish translations
│   │   └── index.ts              # i18n exports
│   ├── contexts/
│   │   └── I18nContext.tsx       # i18n React context
│   ├── hooks/
│   │   └── useTranslation.ts     # Translation hook
│   ├── test-utils.ts             # Testing utilities
│   └── index.ts                  # Public API exports
├── __tests__/
│   ├── currency.spec.ts
│   ├── date.spec.ts
│   ├── formatters.spec.ts
│   └── validation.spec.ts
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

## Translation Namespaces

| Namespace      | Description              |
| -------------- | ------------------------ |
| `common`       | General UI strings       |
| `auth`         | Authentication messages  |
| `transactions` | Transaction-related text |
| `budgets`      | Budget management text   |
| `accounts`     | Account management text  |
| `spaces`       | Space/entity text        |
| `wealth`       | Wealth tracking text     |
| `errors`       | Error messages           |
| `validations`  | Form validation messages |

## Dependencies

**Runtime:**

- `date-fns` - Date manipulation
- `zod` - Schema validation

**Peer:**

- `react` (^18.0.0) - Required for hooks and context

## Related Packages

| Package                                           | Relationship                      |
| ------------------------------------------------- | --------------------------------- |
| [`@dhanam/esg`](../esg/README.md)                 | Uses shared types for asset data  |
| [`@dhanam/simulations`](../simulations/README.md) | Uses shared types for projections |
| [`@dhanam/ui`](../ui/README.md)                   | Uses i18n and utility functions   |
| [`@dhanam/config`](../config/README.md)           | Provides build configuration      |

## Testing

```bash
# Run tests
pnpm test

# Watch mode
pnpm test --watch

# Type checking
pnpm typecheck
```

## Build

```bash
# Production build
pnpm build

# Development watch mode
pnpm dev
```

---

**Package**: `@dhanam/shared`
**Version**: 0.1.0
**License**: AGPL-3.0
**Last Updated**: January 2025
