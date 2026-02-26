# CLAUDE.md

> **See also:** [`llms.txt`](llms.txt) for a concise project overview with links, and [`llms-full.txt`](llms-full.txt) for expanded inlined content. For machine-readable metadata, see [`tools/agent-manifest.json`](tools/agent-manifest.json).

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## ⚠️ CRITICAL: MADFAM Ecosystem Dependencies

**READ THIS FIRST before any auth, deployment, or infrastructure work.**

### Authentication & Authorization: JANUA

Dhanam uses **Janua** (MADFAM's own SSO platform) for ALL authentication.

- **OIDC Issuer**: `https://auth.madfam.io`
- **Janua API**: `https://api.janua.dev`
- **DO NOT** implement custom auth, use third-party providers (Auth0, Clerk, etc.), or bypass Janua.

### Deployment & DevOps: ENCLII

Dhanam uses **Enclii** (MADFAM's own deployment platform) for ALL production deployments.

- **Config file**: `.enclii.yml` (project root)
- **Domain manifest**: `enclii.yaml` (project root) — declares domains for auto-provisioning
- **Auto-deploy**: Enabled on `main` branch
- **Flow**: Push to main → Enclii detects → Builds → Deploys to bare metal K8s
- On push to main, Enclii's webhook reads `enclii.yaml` and auto-provisions DNS + tunnel routes
- Only dhanam-web domains listed (dhan.am, www, app); api/admin domains managed via static tunnel config

**To deploy**: Simply push to main. Enclii handles everything automatically.

**GitHub Actions Workflows** (`.github/workflows/`):
- `ci.yml`, `lint.yml`, `test-coverage.yml` - CI/CD quality gates (run on all PRs)
- `check-migrations.yml` - Database migration validation
- `publish-packages.yml` - Tag-triggered npm publish to npm.madfam.io (manual dispatch with dry-run)
- `deploy-enclii.yml`, `deploy-k8s.yml`, `deploy-web-k8s.yml` - Manual/fallback deployment options
- Primary production deployment is via **Enclii auto-deploy**, not GitHub Actions

### Production URLs
- Web: `https://app.dhan.am`
- Admin: `https://admin.dhanam.com`
- API: `https://api.dhan.am`

---

## Project Overview

This is the Dhanam Ledger project - a comprehensive budget and wealth tracking application that unifies personal and business financial management with ESG crypto insights. It targets LATAM-first users with multilingual support (English/Spanish).

**Core Features:**
- Personal and business budgeting with category caps and rules-based auto-categorization
- AI-powered transaction categorization with machine learning and user correction loop
- Wealth tracking with net worth calculations and asset allocation views
- DeFi/Web3 portfolio tracking via Zapper API (Uniswap, Aave, Compound, Curve, Lido, and more)
- ESG scoring for crypto assets using the Dhanam package
- Read-only financial data integration (Belvo for MX, Plaid for US, Bitso for crypto)
- 60-day cashflow forecasting with weekly granularity
- 10-30 year long-term projections with Monte Carlo simulation
- Life Beat dead man's switch for estate planning with executor access
- Zillow integration for automated real estate valuations
- Yours/Mine/Ours household ownership views
- Document storage via Cloudflare R2 for manual asset attachments
- TOTP 2FA security with JWT + rotating refresh tokens

## Architecture

**Monorepo Structure (Turborepo + pnpm):**
```
apps/
├─ admin/         # Next.js 16 admin dashboard (port 3400)
├─ api/           # NestJS (Fastify) backend (port 4010)
├─ mobile/        # React Native + Expo app
└─ web/           # Next.js 15 user dashboard (port 3040)
packages/
├─ billing-sdk/   # Typed client for Dhanam billing API (@dhanam/billing-sdk)
├─ config/        # ESLint, tsconfig, prettier presets
├─ esg/           # Dhanam ESG adapters
├─ shared/        # Shared TS utils, types, i18n
├─ simulations/   # Monte Carlo & scenario analysis engines
└─ ui/            # Reusable UI components (shadcn-ui)
infra/
└─ docker/        # Local dev docker-compose
```

**Tech Stack:**
- Frontend: Next.js (React), React Native + Expo
- Backend: NestJS (Fastify), Prisma + PostgreSQL, Redis (BullMQ)
- Infrastructure: Enclii (bare metal K8s)
- Analytics: PostHog
- ESG: Dhanam package integration

## Development Commands

When the codebase is implemented, use these commands:

```bash
# Local infrastructure
pnpm dev:infra    # Start docker compose (postgres, redis, mailhog)
pnpm db:push      # Prisma schema sync
pnpm db:seed      # Seed demo data

# Development servers
pnpm dev:api      # Backend at http://localhost:4010
pnpm dev:web      # Web dashboard at http://localhost:3040
pnpm dev:admin    # Admin dashboard at http://localhost:3400
pnpm dev:mobile   # Expo dev client

# Quality checks
pnpm lint         # ESLint across monorepo
pnpm test         # Run test suites
turbo lint        # Turborepo lint
turbo test        # Turborepo test
```

## Key Implementation Guidelines

**Security First:**
- All provider tokens (Belvo, Plaid, Bitso) must be encrypted at rest using AES-256-GCM
- Implement Argon2id for password hashing with breach checks
- Use short-lived JWT (≤15m) with rotating refresh tokens (≤30d)
- TOTP 2FA required for admin operations, optional for users
- Webhook HMAC verification for all provider integrations

**Data Architecture:**
- Multi-tenant via Spaces (Personal + Business entities)
- Normalize all financial data into common schema regardless of provider
- Daily valuation snapshots for wealth tracking trends  
- Rules engine for transaction auto-categorization
- ESG scores computed via Dhanam package and cached

**Localization:**
- Default Spanish (ES) for Mexico region, English elsewhere
- Currency formatting for MXN/USD/EUR with Banxico FX rates
- All user-facing text must support i18n via packages/shared/i18n

**Performance Requirements:**
- Page loads <1.5s p95
- Manual account refresh <15s
- Bulk transaction operations (100+ items) <2s p95  
- Background sync every hour via BullMQ queues

**Provider Integration Patterns:**
- **Belvo** (Mexico): OAuth flow → encrypted token storage → 90+ day transaction history
- **Plaid** (US): Link flow → webhook updates → balance/transaction sync
- **MX** (US/Canada): Aggregation API → multi-institution support
- **Finicity** (US): Open Banking API → Mastercard-backed data access
- **Bitso** (crypto exchange): API integration → real-time crypto positions
- **Blockchain** (on-chain): ETH/BTC/xPub address tracking (non-custodial, no secrets)
- **Zapper** (DeFi): API integration → protocol positions across 7 networks (Ethereum, Polygon, Arbitrum, Optimism, Base, Avalanche, BSC)
- **Zillow** (Real Estate): Property valuation API → automated Zestimate updates for manual assets
- **Collectibles** (sneakers/watches/art/wine/coins/cards/cars): Adapter-based valuation → sneaks-api (free, sneakers), scaffolded for WatchCharts, Artsy, Wine-Searcher, PCGS, PSA, Hagerty, KicksDB

The provider orchestrator (`apps/api/src/modules/providers/orchestrator/`) handles failover and multi-provider redundancy.

## Testing Strategy

- Unit tests for auth, rules engine, and provider adapters
- Contract tests for all webhook handlers
- Snapshot tests for ESG score calculations
- Synthetic monitors for provider connection health
- Seeded demo Space for manual QA flows

## Database Schema Highlights

Key entities and relationships:
- Users → Spaces (1:many) → Accounts → Transactions
- Spaces → Budgets → Categories (with rules)
- Daily valuation snapshots for wealth trends
- ESG asset scores linked to crypto accounts
- Audit logs for all sensitive operations

## ESG Integration

Uses the Dhanam package (https://github.com/aldoruizluna/Dhanam) for:
- Crypto asset ESG composite scoring (E/S/G components)
- Environmental impact metrics (energy intensity estimates)
- Transparent methodology page with sources and limitations
- Future expansion to equities/ETF ESG scoring

## Admin & Analytics

**PostHog Events:** sign_up, onboarding_complete, connect_initiated, connect_success, sync_success, budget_created, rule_created, txn_categorized, alert_fired, view_net_worth, export_data

**Admin Features:** User search, read-only impersonation with audit trails, feature flags, comprehensive audit logging

## Environment Setup

Each app requires environment configuration:
- API: Database, Redis, JWT keys, provider credentials (Belvo/Plaid/Bitso), Banxico API
- Web: API URL, PostHog key, default locale
- Mobile: Same as web for Expo public variables

The application targets 99.9% availability with RTO 4h and daily backups.
