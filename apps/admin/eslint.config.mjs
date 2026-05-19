// =============================================================================
// apps/admin — flat config (matches legacy .eslintrc.json — next/core-web-vitals only)
// =============================================================================

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import nextjs from '@dhanam/config/eslint/nextjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...nextjs,

  {
    settings: {
      next: {
        rootDir: __dirname,
      },
    },
  },

  // Local overrides matching the legacy .eslintrc.json
  {
    rules: {
      'no-unused-vars': 'off',
      'prettier/prettier': 'off',
    },
  },

  // TypeScript files: disable core no-undef. TypeScript itself enforces
  // identifier resolution against @types/react, lib.dom.d.ts, etc., so
  // `no-undef` in ESLint produces false positives for type-position
  // references (`React.ChangeEvent`, `JSX.Element`, `RequestInit`, `fetch`)
  // and Jest test globals (`jest`, `expect`, `it`, `describe`, `beforeEach`).
  // This matches @typescript-eslint's official recommendation:
  // https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-undef': 'off',
    },
  },

  {
    files: ['**/*.test.{ts,tsx}', 'test/**/*', '**/__tests__/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'max-lines': 'off',
    },
  },
];
