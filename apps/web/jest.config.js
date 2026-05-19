const nextJest = require('next/jest');
const path = require('path');

// Resolve Zod v4 subpath exports that Jest cannot handle natively
const zodBase = path.dirname(require.resolve('zod'));
const zodV4CorePath = path.join(zodBase, 'v4', 'core', 'index.cjs');
const zodV4Path = path.join(zodBase, 'v4', 'index.cjs');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  displayName: 'web',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^~/(.*)$': '<rootDir>/src/$1',
    '^@dhanam/(.*)$': '<rootDir>/../../packages/$1/src',
    '^zod/v4/core$': zodV4CorePath,
    '^zod/v4$': zodV4Path,
  },
  testMatch: [
    '<rootDir>/src/**/*.test.{js,jsx,ts,tsx}',
    '<rootDir>/test/**/*.test.{js,jsx,ts,tsx}',
  ],
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
  watchPathIgnorePatterns: ['<rootDir>/.next/'],
  collectCoverageFrom: ['src/**/*.{js,jsx,ts,tsx}', '!src/**/*.d.ts', '!src/**/index.ts'],
  coverageDirectory: './coverage',
  coverageThreshold: {
    global: {
      branches: 30, // Baseline for web page smoke tests (Phase 6)
      functions: 30, // Baseline for web page smoke tests (Phase 6)
      lines: 30, // Baseline for web page smoke tests (Phase 6)
      statements: 30, // Baseline for web page smoke tests (Phase 6)
    },
  },
  transformIgnorePatterns: ['node_modules/(?!(.*\\.mjs$|.*\\.js$))'],
};

module.exports = createJestConfig(customJestConfig);
