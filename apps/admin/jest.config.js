const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  displayName: 'admin',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@dhanam/(.*)$': '<rootDir>/../../packages/$1/src',
  },
  testMatch: [
    '<rootDir>/src/**/*.test.{js,jsx,ts,tsx}',
    '<rootDir>/test/**/*.test.{js,jsx,ts,tsx}',
  ],
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
  watchPathIgnorePatterns: ['<rootDir>/.next/'],
  collectCoverageFrom: ['src/**/*.{js,jsx,ts,tsx}', '!src/**/*.d.ts', '!src/**/index.ts'],
  coverageDirectory: './coverage',
  transformIgnorePatterns: ['node_modules/(?!(.*\\.mjs$|.*\\.js$))'],
};

module.exports = createJestConfig(customJestConfig);
