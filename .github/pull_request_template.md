## Description

<!-- Provide a brief description of the changes in this PR -->

## Type of Change

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📝 Documentation update
- [ ] 🎨 Code refactoring (no functional changes)
- [ ] ⚡ Performance improvement
- [ ] ✅ Test coverage improvement
- [ ] 🔧 Configuration change

## Related Issues

<!-- Link to related issues using #issue_number -->

Closes #

## Changes Made

<!-- List the specific changes made in this PR -->

-
-
-

## Testing

### Test Coverage

- [ ] Unit tests added/updated
- [ ] E2E tests added/updated (if applicable)
- [ ] Coverage threshold met (80%+)
- [ ] All existing tests pass

### Manual Testing

<!-- Describe the manual testing performed -->

- [ ] Tested locally with `pnpm dev`
- [ ] Tested with `./scripts/test-ci.sh`
- [ ] Tested on staging environment (if applicable)

**Test Steps:**

1.
2.
3.

**Expected Behavior:**

**Actual Behavior:**

## Screenshots (if applicable)

<!-- Add screenshots to help explain your changes -->

## Database Changes

- [ ] No database changes
- [ ] New migration added
- [ ] Migration tested locally
- [ ] Migration is reversible
- [ ] Updated seed data (if needed)

## Documentation

- [ ] Updated README.md (if needed)
- [ ] Updated API documentation (if needed)
- [ ] Updated code comments
- [ ] Updated TypeScript types
- [ ] Updated translation files (if UI changes)

## Checklist

### Code Quality

- [ ] Code follows the project's style guidelines
- [ ] Self-review of code completed
- [ ] No console.log or debugging code left
- [ ] No commented-out code
- [ ] Meaningful commit messages

### Security

- [ ] No sensitive data exposed (API keys, passwords, etc.)
- [ ] No operator secrets, real RFCs, or MADFAM PII in the public diff (see `scripts/check-public-repo-leakage.py`)
- [ ] Input validation added where necessary
- [ ] SQL injection prevention verified (if applicable)
- [ ] XSS prevention verified (if applicable)
- [ ] Authentication/authorization checks added (if applicable)

### Performance

- [ ] No N+1 queries introduced
- [ ] Database queries optimized
- [ ] Unnecessary re-renders avoided (React)
- [ ] Large files/assets optimized

### i18n (if applicable)

- [ ] Spanish translations added
- [ ] English translations added
- [ ] Translation keys follow naming conventions
- [ ] Currency/date formatting uses locale utilities

## CI/CD

- [ ] GitHub Actions workflows pass
- [ ] Linting passes (`pnpm lint`)
- [ ] Type checking passes
- [ ] All tests pass locally
- [ ] Coverage report reviewed

## Deployment Notes

<!-- Any special instructions for deployment? -->

- [ ] No special deployment steps required
- [ ] Requires environment variable changes (list below)
- [ ] Requires database migration
- [ ] Requires cache invalidation
- [ ] Requires service restart

**Environment Variables:**

```env
# Add any new environment variables here
```

## Rollback Plan

<!-- How to rollback if this change causes issues? -->

1.
2.

## Additional Context

<!-- Add any other context about the PR here -->

---

## Reviewer Checklist

- [ ] Code changes reviewed
- [ ] Tests reviewed and coverage verified
- [ ] Documentation reviewed
- [ ] Security considerations reviewed
- [ ] Performance implications considered
- [ ] Database changes reviewed (if applicable)
- [ ] Ready to merge
