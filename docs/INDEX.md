# Dhanam Documentation

> *Personal and business financial management platform*

## Quick Navigation

| Document | Description |
|----------|-------------|
| [README](README.md) | Project overview and quick start |
| [CHANGELOG](../CHANGELOG.md) | Version history and changes |
| [CONTRIBUTING](../CONTRIBUTING.md) | Development guidelines |
| [SECURITY](../SECURITY.md) | Security policies |
| [llms.txt](../llms.txt) | LLM-readable project overview ([llmstxt.org](https://llmstxt.org/)) |
| [llms-full.txt](../llms-full.txt) | Expanded LLM context with inlined content |

## Getting Started

| Document | Description |
|----------|-------------|
| [Development Guide](DEVELOPMENT.md) | Local development setup |
| [Dogfooding Quickstart](DOGFOODING_QUICKSTART.md) | Internal testing guide |
| [MADFAM Internal Finance](MADFAM_INTERNAL_FINANCE.md) | Internal financial tracking |

## Architecture

| Document | Description |
|----------|-------------|
| [Architecture](architecture/) | System design documentation |
| [Infrastructure](INFRASTRUCTURE.md) | Cloud and services setup |
| [Implementation Summary](IMPLEMENTATION_SUMMARY.md) | Feature implementation details |

## Architecture Decision Records (ADRs)

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-001](adr/001-nestjs-fastify.md) | NestJS with Fastify over Express | Accepted |
| [ADR-002](adr/002-prisma-orm.md) | Prisma ORM for Database Access | Accepted |
| [ADR-003](adr/003-multi-provider-strategy.md) | Multi-Provider Financial Data Strategy | Accepted |
| [ADR-004](adr/004-janua-auth-integration.md) | Janua Authentication Integration | Accepted |
| [ADR-005](adr/005-enclii-deployment.md) | Enclii Deployment Platform | Accepted |

## API Documentation

| Document | Description |
|----------|-------------|
| [API Reference](API.md) | Full API documentation |
| [API Details](api/) | Endpoint specifications |
| [Swagger UI](/api/docs) | Interactive API explorer |

## Package Documentation

| Package | Description |
|---------|-------------|
| [@dhanam/shared](../packages/shared/README.md) | Types, utilities, constants, i18n |
| [@dhanam/config](../packages/config/README.md) | ESLint & TypeScript configurations |
| [@dhanam/esg](../packages/esg/README.md) | ESG scoring for crypto assets |
| [@dhanam/simulations](../packages/simulations/README.md) | Monte Carlo & scenario analysis |
| [@dhanam/billing-sdk](../packages/billing-sdk/README.md) | Billing API client (checkout, subscriptions, webhooks) |
| [@dhanam/ui](../packages/ui/README.md) | Reusable UI components |

## Module Documentation

### Core Modules

| Module | Description |
|--------|-------------|
| [accounts](../apps/api/src/modules/accounts/README.md) | Account management |
| [transactions](../apps/api/src/modules/transactions/README.md) | Transaction management |
| [budgets](../apps/api/src/modules/budgets/README.md) | YNAB-style budgeting |
| [categories](../apps/api/src/modules/categories/README.md) | Category & rules management |
| [spaces](../apps/api/src/modules/spaces/README.md) | Multi-tenant spaces |
| [users](../apps/api/src/modules/users/README.md) | User management |

### Analytics & Reporting

| Module | Description |
|--------|-------------|
| [analytics](../apps/api/src/modules/analytics/README.md) | Financial analytics |
| [simulations](../apps/api/src/modules/simulations/README.md) | Monte Carlo simulations |
| [goals](../apps/api/src/modules/goals/README.md) | Goal tracking |
| [esg](../apps/api/src/modules/esg/README.md) | ESG scoring API |

### Provider Integration

| Module | Description |
|--------|-------------|
| [providers/orchestrator](../apps/api/src/modules/providers/orchestrator/README.md) | Multi-provider coordination |
| [providers/belvo](../apps/api/src/modules/providers/belvo/README.md) | Mexico banking (Belvo) |
| [providers/plaid](../apps/api/src/modules/providers/plaid/README.md) | US banking (Plaid) |
| [providers/bitso](../apps/api/src/modules/providers/bitso/README.md) | Crypto exchange (Bitso) |
| [providers/defi](../apps/api/src/modules/providers/defi/README.md) | DeFi tracking (Zapper) |
| [providers/blockchain](../apps/api/src/modules/providers/blockchain/README.md) | Blockchain tracking |

### ML & Automation

| Module | Description |
|--------|-------------|
| [ml](../apps/api/src/modules/ml/README.md) | Transaction categorization ML |
| [recurring](../apps/api/src/modules/recurring/README.md) | Recurring transaction detection |
| [jobs](../apps/api/src/modules/jobs/README.md) | Background job processing |

### Billing & Admin

| Module | Description |
|--------|-------------|
| [billing](../apps/api/src/modules/billing/README.md) | Subscription & payments |
| [admin](../apps/api/src/modules/admin/README.md) | Admin functionality |

### Other Modules

| Module | Description |
|--------|-------------|
| [manual-assets](../apps/api/src/modules/manual-assets/README.md) | Manual asset tracking |
| [estate-planning](../apps/api/src/modules/estate-planning/README.md) | Estate planning (Life Beat) |
| [households](../apps/api/src/modules/households/README.md) | Household management |
| [fx-rates](../apps/api/src/modules/fx-rates/README.md) | Currency exchange rates |
| [storage](../apps/api/src/modules/storage/README.md) | Document storage (R2) |
| [email](../apps/api/src/modules/email/README.md) | Email service |
| [onboarding](../apps/api/src/modules/onboarding/README.md) | User onboarding |
| [search](../apps/api/src/modules/search/README.md) | Natural language search |

## Features

### Admin & Dashboard
| Document | Description |
|----------|-------------|
| [Admin Dashboard](ADMIN_DASHBOARD.md) | Admin interface guide |

### Mobile
| Document | Description |
|----------|-------------|
| [Mobile App](MOBILE.md) | Mobile application docs |

## Deployment

| Document | Description |
|----------|-------------|
| [Deployment Guide](DEPLOYMENT.md) | Production deployment |

## Development Phases

| Document | Description |
|----------|-------------|
| [Phase 2 Summary](PHASE2-SUMMARY.md) | Phase 2 completion report |
| [Phase 3 Plan](PHASE3-PLAN.md) | Upcoming features |

## Guides

| Document | Description |
|----------|-------------|
| [User Guides](guides/) | End-user documentation |

## Reports & Audits

| Document | Description |
|----------|-------------|
| [Audits](audits/) | Security and code audits |
| [Reports](reports/) | Analysis reports |

## Core Features

### Financial Tracking
- **Multi-currency Support** - 180+ currencies with live rates
- **Account Management** - Bank, investment, crypto accounts
- **Transaction Categorization** - AI-powered categorization

### Banking Integration
- **Plaid Integration** - US/Canada bank connections
- **Open Banking** - European PSD2 compliance
- **Manual Import** - CSV/QIF import support

### Analysis & Reporting
- **ESG Scoring** - Environmental, Social, Governance metrics
- **Cash Flow Analysis** - Income/expense trends
- **Tax Reporting** - Exportable tax reports

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Node.js, PostgreSQL, Redis
- **Mobile**: React Native (Expo)
- **Banking**: Plaid, Open Banking APIs

## LLM & Agent Context

| Document | Description |
|----------|-------------|
| [llms.txt](../llms.txt) | Concise project overview with documentation links |
| [llms-full.txt](../llms-full.txt) | Expanded version with inlined critical content |
| [CLAUDE.md](../CLAUDE.md) | Claude Code agent guidance |
| [agent-manifest.json](../tools/agent-manifest.json) | Machine-readable project metadata |

## MADFAM Ecosystem Integration

| App | Integration |
|-----|-------------|
| [Primavera3D](../../primavera3d) | Manufacturing cost tracking |
| [Digifab-Quoting](../../digifab-quoting) | Quote financial sync |
| [Forgesight](../../forgesight) | Project budget tracking |

---

*Last updated: January 2025*
