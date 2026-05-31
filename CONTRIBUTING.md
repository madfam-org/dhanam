# Contributing to Dhanam

Thank you for your interest in contributing to Dhanam! This document provides guidelines for contributing to the project.

## Development Setup

### Prerequisites

- Node.js 18+
- pnpm 9+
- Docker and Docker Compose
- PostgreSQL 15+

### Getting Started

```bash
# Clone the repository
git clone https://github.com/madfam/dhanam.git
cd dhanam

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Start development services
docker-compose up -d

# Run database migrations
pnpm db:push

# Start development server
pnpm dev
```

## Branch Strategy

We use a trunk-based development model:

- `main` - Production-ready code
- `feat/` - New features (e.g., `feat/esg-scoring`)
- `fix/` - Bug fixes
- `chore/` - Maintenance tasks
- `docs/` - Documentation updates

### Keeping local `main` in sync

Never commit directly on `main`. Always branch first:

```bash
git checkout main
git pull --ff-only origin main
git checkout -b fix/your-change
```

After a PR merges, refresh local `main`:

```bash
git checkout main
git pull --ff-only origin main
```

If `git pull --ff-only` fails, local `main` has diverged (usually from an old direct commit). Reset it:

```bash
git fetch origin
git reset --hard origin/main
```

Then recreate your work on a feature branch. The pre-push hook blocks pushes from `main` to prevent repeat drift.

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Scopes:** `web`, `mobile`, `api`, `auth`, `budget`, `crypto`, `banking`

## Pull Request Process

1. Create a branch from `main`
2. Make changes with clear commits
3. Write/update tests (80% coverage required)
4. Update documentation if needed
5. Open a PR with clear description
6. Request review and address feedback

### PR Checklist

- [ ] Tests pass (`pnpm test`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Type checking passes (`pnpm typecheck`)
- [ ] 80%+ test coverage for new code
- [ ] Demo mode still works correctly
- [ ] CHANGELOG.md updated for significant changes

## Code Standards

### TypeScript

- Strict mode enabled
- Explicit return types
- Use Zod for validation
- No `any` types

### Database

- Use Prisma for all database operations
- Write migrations for schema changes
- Add indexes for frequently queried fields
- Document data models

### Testing

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run specific test
pnpm test -- path/to/test.spec.ts
```

## Financial Calculations

When working with financial calculations:

### Accuracy Requirements

- Use Decimal.js for monetary calculations
- Never use floating point for money
- Round appropriately for currency (MXN: 2 decimals)
- Document all formulas

### Currency Handling

- Store amounts in smallest unit (centavos)
- Always store currency code with amount
- Use exchange rates from reliable sources
- Handle multi-currency properly

### ESG Scoring

When modifying ESG scoring:

1. Document scoring methodology
2. Cite data sources
3. Test edge cases
4. Validate against known benchmarks

## Security Guidelines

Financial data requires extra security:

- Never log sensitive data (account numbers, balances)
- Encrypt all PII at rest
- Use parameterized queries
- Validate all inputs
- Follow OWASP guidelines
- Report vulnerabilities to security@madfam.io

## Bank Integration

When working with bank integrations (Belvo, Plaid):

- Test with sandbox environments
- Handle rate limits gracefully
- Implement proper error handling
- Document webhook handling

## Demo Mode

Dhanam includes a demo mode. When making changes:

- Ensure demo mode continues to function
- Update mock data if new features added
- Test full demo flow before PR

## Getting Help

- **Issues**: Open a GitHub issue
- **Discussions**: Use GitHub Discussions

## License

By contributing, you agree that your contributions will be licensed under the AGPL-3.0 license.
