# E2E Testing Documentation

## Overview

This directory contains comprehensive end-to-end tests for the Dhanam API, focusing on the onboarding flow and preferences management features. The tests are designed to simulate real user interactions and verify the complete functionality of the API.

## Test Structure

### Test Files

1. **onboarding-flow.e2e-spec.ts**
   - Complete onboarding journey testing (all 7 steps)
   - Partial onboarding with skip functionality
   - Step dependency validation
   - Reset functionality
   - Edge cases and error handling
   - Analytics tracking verification

2. **preferences-management.e2e-spec.ts**
   - User preferences CRUD operations
   - Space-specific preferences
   - Notification preferences
   - Preference templates
   - Import/export functionality
   - Preference history tracking
   - Integration with onboarding

### Helper Files

- **helpers/test.helper.ts**: Utility functions for test setup, data creation, and authentication
- **fixtures/onboarding.fixtures.ts**: Test data specific to onboarding scenarios
- **fixtures/preferences.fixtures.ts**: Test data for preferences testing
- **fixtures/test-data.fixtures.ts**: General test data for various scenarios

## Running Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run specific test file
pnpm test:e2e onboarding-flow

# Run with coverage
pnpm test:e2e --coverage

# Run in watch mode
pnpm test:e2e --watch
```

## Test Database Setup

The tests use a separate test database that is automatically created and cleaned up. The `TestHelper` class provides utilities for:

- Database cleanup between tests
- Creating test users, spaces, accounts, etc.
- Generating valid JWT tokens
- Simulating provider webhooks

## Key Testing Patterns

### 1. Authentication

```typescript
const user = await testHelper.createUser(userData);
const authToken = testHelper.generateAuthToken(user);
```

### 2. Request Testing

```typescript
const response = await request(app.getHttpServer())
  .post('/endpoint')
  .set('Authorization', `Bearer ${authToken}`)
  .send(requestData)
  .expect(expectedStatus);
```

### 3. Database State Verification

```typescript
const updatedUser = await prisma.user.findUnique({
  where: { id: userId },
});
expect(updatedUser.onboardingCompleted).toBe(true);
```

## Onboarding Flow Testing

The onboarding flow consists of 7 steps:

1. **Welcome** (required) - Auto-completed on registration
2. **Email Verification** (required) - Email confirmation
3. **Preferences** (required) - User preferences setup
4. **Space Setup** (required) - Create first space
5. **Connect Accounts** (optional) - Link financial providers
6. **First Budget** (optional) - Create initial budget
7. **Feature Tour** (optional) - Complete app tour

### Test Coverage

- ✅ Complete flow from registration to completion
- ✅ Skipping optional steps
- ✅ Step dependency enforcement
- ✅ Email verification token handling
- ✅ Progress tracking
- ✅ Reset functionality
- ✅ Error scenarios

## Preferences Testing

### User Preferences

- Language, timezone, currency settings
- Notification preferences
- Display preferences
- Financial year settings

### Space Preferences

- Auto-categorization settings
- Budget management options
- Export preferences
- Transaction handling rules

### Test Coverage

- ✅ Default preferences initialization
- ✅ Partial and full updates
- ✅ Validation of preference values
- ✅ Multi-space preference isolation
- ✅ Template application
- ✅ Import/export functionality
- ✅ Change history tracking

## Best Practices

1. **Test Isolation**: Each test should be independent and not rely on state from other tests
2. **Clean Database**: Always clean the database before and after test suites
3. **Realistic Data**: Use fixtures that represent real-world scenarios
4. **Error Testing**: Include tests for error cases and edge conditions
5. **Performance**: Monitor test execution time and optimize slow tests

## Debugging Tests

### Enable Debug Logging

```bash
DEBUG=* pnpm test:e2e
```

### Run Single Test

```typescript
it.only('should test specific scenario', async () => {
  // Test code
});
```

### Inspect Database State

```typescript
console.log(await prisma.user.findMany());
```

## Common Issues

1. **Database Connection**: Ensure test database is running
2. **Port Conflicts**: Check if port 4000 is available
3. **Token Expiry**: Use fresh tokens in each test
4. **Race Conditions**: Use `waitForCondition` helper for async operations

## Future Improvements

- [ ] Add performance benchmarking
- [ ] Implement test data factories
- [ ] Add visual regression testing for emails
- [ ] Create test coverage reports
- [ ] Add load testing scenarios
