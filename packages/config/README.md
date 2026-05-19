# @dhanam/config

> Shared ESLint and TypeScript configurations for the Dhanam monorepo.

## Overview

This package provides standardized build and linting configurations across all Dhanam applications and packages:

- **ESLint Configs**: Base, NestJS, Next.js, and React Native presets
- **TypeScript Configs**: Base and platform-specific compiler options
- **Code Quality**: Consistent standards for file size, imports, and formatting

## Installation

```bash
# From monorepo root (already a workspace dependency)
pnpm add -D @dhanam/config
```

## Quick Start

### ESLint Configuration

```javascript
// apps/api/.eslintrc.js
module.exports = {
  extends: ['@dhanam/config/eslint/nestjs'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
```

```javascript
// apps/web/.eslintrc.js
module.exports = {
  extends: ['@dhanam/config/eslint/nextjs'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
```

```javascript
// apps/mobile/.eslintrc.js
module.exports = {
  extends: ['@dhanam/config/eslint/react-native'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
```

### TypeScript Configuration

```json
// apps/api/tsconfig.json
{
  "extends": "@dhanam/config/typescript/nestjs.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

```json
// apps/web/tsconfig.json
{
  "extends": "@dhanam/config/typescript/nextjs.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

```json
// apps/mobile/tsconfig.json
{
  "extends": "@dhanam/config/typescript/react-native.json",
  "compilerOptions": {
    "baseUrl": "."
  }
}
```

## Available Configurations

### ESLint Presets

| Config                | Use Case                | Extends                                          |
| --------------------- | ----------------------- | ------------------------------------------------ |
| `eslint/base`         | Packages and libraries  | ESLint recommended, TypeScript, Import, Prettier |
| `eslint/nestjs`       | NestJS API applications | Base + NestJS patterns                           |
| `eslint/nextjs`       | Next.js applications    | Base + React, JSX-a11y                           |
| `eslint/react-native` | React Native apps       | Base + React Native, React Hooks                 |

### TypeScript Presets

| Config                         | Use Case               | Target                         |
| ------------------------------ | ---------------------- | ------------------------------ |
| `typescript/base.json`         | Packages and libraries | ES2022                         |
| `typescript/nestjs.json`       | NestJS applications    | ES2022, Node module resolution |
| `typescript/nextjs.json`       | Next.js applications   | ES2022, Bundler resolution     |
| `typescript/react-native.json` | React Native apps      | ESNext, React Native JSX       |

## Key Rules

### File Size Limits

All configurations enforce an 800-line limit per file (excluding comments and blank lines):

```javascript
'max-lines': ['error', { max: 800, skipBlankLines: true, skipComments: true }]
```

### Import Organization

Imports are automatically organized into groups with alphabetical sorting:

```javascript
'import/order': ['error', {
  groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
  'newlines-between': 'always',
  alphabetize: { order: 'asc', caseInsensitive: true }
}]
```

### TypeScript Strict Mode

All configs enable strict TypeScript checking:

- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noImplicitReturns: true`
- `noFallthroughCasesInSwitch: true`
- `noUncheckedIndexedAccess: true`

### Unused Variable Handling

Unused variables are errors, but underscore-prefixed variables are allowed:

```javascript
'@typescript-eslint/no-unused-vars': ['error', {
  argsIgnorePattern: '^_',
  varsIgnorePattern: '^_',
  caughtErrorsIgnorePattern: '^_'
}]
```

## Architecture

```
packages/config/
├── eslint/
│   ├── base.js           # Base ESLint config
│   ├── nestjs.js         # NestJS-specific rules
│   ├── nextjs.js         # Next.js-specific rules
│   └── react-native.js   # React Native-specific rules
├── typescript/
│   ├── base.json         # Base TypeScript config
│   ├── nestjs.json       # NestJS TypeScript config
│   ├── nextjs.json       # Next.js TypeScript config
│   └── react-native.json # React Native TypeScript config
├── package.json
└── README.md
```

## Dependencies

**Peer Dependencies (ESLint):**

- `eslint` (^8.0.0)
- `typescript` (^5.0.0)

**Included Plugins:**

- `@typescript-eslint/eslint-plugin`
- `@typescript-eslint/parser`
- `eslint-config-prettier`
- `eslint-plugin-import`
- `eslint-plugin-jsx-a11y`
- `eslint-plugin-prettier`
- `eslint-plugin-react`
- `eslint-plugin-react-hooks`
- `eslint-plugin-react-native`

## Customization

To override rules in your application:

```javascript
// apps/api/.eslintrc.js
module.exports = {
  extends: ['@dhanam/config/eslint/nestjs'],
  rules: {
    // Increase line limit for specific files
    'max-lines': ['error', { max: 1000 }],
    // Allow console.log in development
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
  },
  overrides: [
    {
      files: ['**/*.spec.ts', '**/*.test.ts'],
      rules: {
        // Relax rules for tests
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
};
```

## Related Packages

| Package                                           | Relationship               |
| ------------------------------------------------- | -------------------------- |
| [`@dhanam/shared`](../shared/README.md)           | Uses this config for build |
| [`@dhanam/esg`](../esg/README.md)                 | Uses this config for build |
| [`@dhanam/simulations`](../simulations/README.md) | Uses this config for build |
| [`@dhanam/ui`](../ui/README.md)                   | Uses Next.js config preset |

## Ignored Patterns

All configs ignore:

- `node_modules/`
- `dist/`
- `build/`
- `.next/`
- `.turbo/`
- `coverage/`
- `*.config.js`
- `*.config.ts`

---

**Package**: `@dhanam/config`
**Version**: 0.1.0
**License**: AGPL-3.0
**Last Updated**: January 2025
