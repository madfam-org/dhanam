module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!.*((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg))',
  ],
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}', '<rootDir>/test/**/*.test.{ts,tsx}'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@dhanam/shared$': '<rootDir>/../../packages/shared/src',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!src/**/index.ts'],
  coverageDirectory: './coverage',
  coverageThreshold: {
    global: {
      branches: 50, // Baseline for mobile foundation tests (Phase 6)
      functions: 50, // Baseline for mobile foundation tests (Phase 6)
      lines: 50, // Baseline for mobile foundation tests (Phase 6)
      statements: 50, // Baseline for mobile foundation tests (Phase 6)
    },
  },
};
