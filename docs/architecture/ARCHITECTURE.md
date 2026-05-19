# Dhanam Ledger Architecture

> **Quick Reference**: For complete architecture documentation, see [Full Architecture Details](docs/architecture/ARCHITECTURE.md)

## System Overview

Dhanam Ledger is a full-stack financial management platform built as a monorepo using Turborepo and pnpm. The system provides personal and business budgeting, wealth tracking, and ESG crypto insights for LATAM-first users.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Clients                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Web App    │  │  Mobile App  │  │   API Docs   │      │
│  │  (Next.js)   │  │ (React Native│  │   (Swagger)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway / CDN                         │
│                   (CloudFront / ALB)                         │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend Services                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            NestJS API (Fastify)                       │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │  │
│  │  │   Auth   │  │  Spaces  │  │   Transactions   │   │  │
│  │  └──────────┘  └──────────┘  └──────────────────┘   │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │  │
│  │  │ Budgets  │  │ Accounts │  │    Analytics     │   │  │
│  │  └──────────┘  └──────────┘  └──────────────────┘   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  PostgreSQL  │  │    Redis     │  │   BullMQ     │      │
│  │   (Prisma)   │  │   (Cache)    │  │   (Jobs)     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              External Integrations                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Belvo   │  │  Plaid   │  │  Bitso   │  │ Banxico  │   │
│  │ (Mexico) │  │  (US)    │  │ (Crypto) │  │ (FX API) │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

### Frontend

- **Web**: Next.js 14 (App Router), Tailwind CSS, shadcn/ui, Zustand, React Query
- **Mobile**: React Native 0.73, Expo, React Navigation

### Backend

- **Framework**: NestJS with Fastify
- **Database**: PostgreSQL 15 with Prisma ORM
- **Cache**: Redis 7
- **Queue**: BullMQ for background jobs
- **Auth**: JWT with refresh tokens, TOTP 2FA

### Infrastructure

- **Container**: Docker & Docker Compose
- **Orchestration**: AWS ECS/Fargate
- **IaC**: Terraform
- **CI/CD**: GitHub Actions
- **Monitoring**: Sentry, PostHog

### Monorepo Tools

- **Package Manager**: pnpm 8
- **Build System**: Turborepo
- **Code Quality**: ESLint, Prettier, TypeScript strict mode

## Key Features

### Multi-Tenant Architecture

- **Spaces**: Personal and Business financial contexts
- **Role-Based Access**: Owner, Admin, Member permissions
- **Data Isolation**: Space-scoped queries and transactions

### Security

- **Authentication**: Argon2id password hashing, JWT (15min) + refresh tokens (30d)
- **Encryption**: AES-256-GCM for sensitive data (provider tokens, credentials)
- **2FA**: TOTP-based two-factor authentication
- **Audit Logging**: All sensitive operations tracked

### Provider Integrations

- **Belvo**: Mexico bank accounts (OAuth, read-only)
- **Plaid**: US bank accounts (Link SDK, webhooks)
- **Bitso**: Crypto exchange (API integration)
- **Blockchain**: Non-custodial wallet tracking (ETH, BTC via public APIs)

### Background Processing

- **Sync Jobs**: Hourly account balance and transaction updates
- **FX Rates**: Daily currency exchange rate updates (Banxico API)
- **Email Jobs**: Weekly summaries, monthly reports
- **Cashflow**: 60-day forecast generation

### ESG Scoring

- Integration with Dhanam package for crypto asset ESG metrics
- Environmental, Social, Governance composite scores
- Transparent methodology with source links

## Database Schema (Simplified)

```sql
-- Core entities
User (id, email, passwordHash, totpEnabled)
Space (id, name, type: PERSONAL | BUSINESS)
SpaceMember (userId, spaceId, role)
Account (id, spaceId, provider, type, balance)
Transaction (id, accountId, amount, category, date)
Budget (id, spaceId, categoryId, limit, period)
AssetValuation (id, accountId, value, date)

-- Provider integration
Connection (id, spaceId, provider, status, tokens_encrypted)
SyncLog (id, connectionId, status, itemsProcessed)

-- Analytics
DailySnapshot (id, spaceId, netWorth, date)
CashflowForecast (id, spaceId, predictedBalance, forecastDate)
```

## Deployment

### Development

```bash
# Start local infrastructure
pnpm dev:infra

# Start all services
pnpm dev
```

### Production

- **Hosting**: AWS ECS on Fargate
- **Database**: RDS PostgreSQL (Multi-AZ)
- **Cache**: ElastiCache Redis
- **Storage**: S3 for static assets
- **CDN**: CloudFront for global distribution

## Documentation

For detailed architecture documentation:

- **[Full Architecture Details](docs/architecture/ARCHITECTURE.md)** - Complete system design
- **[Software Specification](docs/architecture/SOFTWARE_SPEC.md)** - Technical specifications
- **[Infrastructure Guide](docs/INFRASTRUCTURE.md)** - Infrastructure components
- **[API Documentation](docs/API.md)** - Backend API reference

## Performance Targets

- Page loads: <1.5s (p95)
- API responses: <200ms (p95)
- Account sync: <15s for manual refresh
- Uptime: 99.9% availability target

## Security & Compliance

- Data encryption at rest (AWS KMS)
- TLS 1.3 for data in transit
- OWASP Top 10 protection
- Regular security audits
- GDPR-compliant data handling

---

For implementation details, contribution guidelines, and development setup, see the [README](README.md).
