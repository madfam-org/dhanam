# Dhanam Ledger

> **A comprehensive budget and wealth tracking application with ESG crypto insights, targeting LATAM-first users with multilingual support.**

[![Test Coverage](https://github.com/madfam-org/dhanam/actions/workflows/test-coverage.yml/badge.svg)](https://github.com/madfam-org/dhanam/actions/workflows/test-coverage.yml)
[![Lint](https://github.com/madfam-org/dhanam/actions/workflows/lint.yml/badge.svg)](https://github.com/madfam-org/dhanam/actions/workflows/lint.yml)
[![codecov](https://codecov.io/gh/madfam-org/dhanam/branch/main/graph/badge.svg)](https://codecov.io/gh/madfam-org/dhanam)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2-blue.svg)](https://reactjs.org/)
[![React Native](https://img.shields.io/badge/React%20Native-0.74-blue.svg)](https://reactnative.dev/)

## Features

### Core Financial Management

- 💰 **Multi-Space Management** - Separate personal and business finances
- 🏦 **Bank Integration** - Connect with Belvo (Mexico), Plaid (US), and Bitso (crypto)
- 📊 **Budget Tracking** - Category-based budgets with alerts and rules
- 💎 **Wealth Management** - Net worth tracking and asset allocation
- 🌱 **ESG Scoring** - Environmental, Social, and Governance metrics for crypto

### Smart Categorization

- 🤖 **AI-Powered Categorization** - Machine learning with learning loop
- 🔄 **Merchant Normalization** - Fuzzy matching for consistent categorization
- 📝 **User Corrections** - Train the model with your preferences

### Advanced Wealth Tracking

- 🌐 **DeFi/Web3 Portfolios** - Zapper integration for Uniswap, Aave, Compound, Curve, Lido, and more
- 🏠 **Zillow Real Estate** - Automated property valuations via Zestimate
- 👟 **Collectibles Valuation** - Automated market pricing for sneakers, watches, art, wine, coins, cards, and cars
- 📈 **10-30 Year Projections** - Retirement planning with Monte Carlo simulations
- 👥 **Yours/Mine/Ours Views** - Household ownership filtering and breakdown

### Estate Planning

- 📜 **Digital Wills** - Beneficiary designations and executor management
- 💓 **Life Beat** - Dead man's switch with 30/60/90 day escalation for executor access

### Platform & Security

- 📱 **Multi-Platform** - Web dashboard and mobile app
- 🔒 **Security First** - Janua SSO (OIDC/PKCE), 2FA, and encrypted data storage
- 🌎 **LATAM Focused** - Spanish/English support with MXN/USD currencies
- 📄 **Document Storage** - R2-backed attachments for manual assets

## Production Status

Snapshot: 2026-05-20. Public production routes respond, hosted CI is green, and
ArgoCD production rollout proof passes, but full-system stability is not yet
100%. See
[docs/STABILITY_AUDIT_2026-05-19.md](docs/STABILITY_AUDIT_2026-05-19.md) for
the current production, staging, DNS, health, and Enclii rollout blockers.

| Service      | Domain          | Status                                        |
| ------------ | --------------- | --------------------------------------------- |
| Web App      | `app.dhan.am`   | Public health passing                         |
| Landing Page | `dhan.am`       | Public health passing                         |
| API Backend  | `api.dhan.am`   | HTTP 200, full health degraded by queues only |
| Admin Panel  | `admin.dhan.am` | Public health passing                         |

**Authentication**: Janua SSO via `@janua/react-sdk` (OIDC with PKCE, handled by SDK)

- Client ID: `jnc_uE2zp9ume_Fd6jMl1elL6wqjiECM711t`
- Issuer: `https://auth.madfam.io`
- Social logins: GitHub, Google via Janua
- Auth mode: `AUTH_MODE=janua` (production default)

**Infrastructure**: Hetzner bare-metal Kubernetes via Enclii PaaS

- Zero-trust ingress via Cloudflare Tunnel
- Production operations are Enclii-first. Raw Kubernetes, Helm, SSH, provider
  CLIs, and direct container access are break-glass/bootstrap only.

## Tech Stack

- **Frontend**: Next.js 15.5.x, React 18, React Native + Expo
- **Backend**: NestJS 11 (Fastify), PostgreSQL, Redis, BullMQ
- **Infrastructure**: Enclii PaaS on bare-metal Kubernetes, Cloudflare Tunnel
- **Build**: Turborepo, pnpm 9.15 monorepo

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9.15.0
- Docker & Docker Compose
- PostgreSQL 15 (via Docker)
- Redis 7 (via Docker)

### Development Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/madfam-org/dhanam.git
   cd dhanam
   ```

2. **Configure NPM Registry**

   Dhanam uses MADFAM's private npm registry for internal packages. Create or update your `.npmrc`:

   ```bash
   # Add to your project's .npmrc or ~/.npmrc
   @madfam:registry=https://npm.madfam.io
   @dhanam:registry=https://npm.madfam.io
   @janua:registry=https://npm.madfam.io
   //npm.madfam.io/:_authToken=${NPM_MADFAM_TOKEN}
   ```

   Set the `NPM_MADFAM_TOKEN` environment variable with your registry token.

3. **Install dependencies**

   ```bash
   pnpm install
   ```

4. **Start infrastructure**

   ```bash
   pnpm dev:infra
   ```

   This starts PostgreSQL, Redis, and Mailhog in Docker containers.

5. **Set up environment variables**

   ```bash
   # Copy example env files
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env.local
   cp apps/admin/.env.example apps/admin/.env.local
   ```

6. **Run database migrations**

   ```bash
   pnpm db:generate
   pnpm db:migrate:dev
   ```

7. **Seed the database (optional)**

   ```bash
   pnpm db:seed
   ```

   Seed scripts require explicit `DEMO_USER_PASSWORD` and `ADMIN_PASSWORD`
   values in `apps/api/.env`.

8. **Start development servers**

   ```bash
   pnpm dev
   ```

   This starts:
   - API server at http://localhost:4010
   - Web dashboard at http://localhost:3040
   - Admin dashboard at http://localhost:3400
   - API documentation at http://localhost:4010/docs

## Project Structure

```
dhanam/
├── apps/
│   ├── admin/        # Next.js 15 admin dashboard (port 3400)
│   ├── api/          # NestJS backend API (port 4010)
│   ├── mobile/       # React Native mobile app (Expo)
│   └── web/          # Next.js 15 web dashboard (port 3040)
├── packages/
│   ├── config/       # Shared configuration (ESLint, tsconfig, prettier)
│   ├── esg/          # ESG scoring integration
│   ├── shared/       # Shared types, utils, and constants
│   ├── simulations/  # Monte Carlo & scenario analysis engines
│   └── ui/           # Reusable UI components (shadcn-ui)
├── infra/
│   ├── docker/       # Local dev docker-compose
│   ├── k8s/          # Kubernetes manifests (production, overlays, monitoring, argocd)
└── scripts/          # Development scripts
```

## Available Scripts

- `pnpm dev` - Start all apps in development mode
- `pnpm dev:api` - Start the API at http://localhost:4010
- `pnpm dev:web` - Start the web app at http://localhost:3040
- `pnpm dev:admin` - Start the admin app at http://localhost:3400
- `pnpm build` - Build all apps and packages
- `pnpm test` - Run tests across the monorepo
- `pnpm lint` - Lint all code
- `pnpm format` - Format code with Prettier
- `pnpm clean` - Clean all build artifacts
- `pnpm db:generate` - Generate Prisma client
- `pnpm db:push` - Push schema changes to database
- `pnpm db:seed` - Seed database with sample data
- `pnpm dev:infra` - Start local infrastructure
- `pnpm dev:infra:down` - Stop local infrastructure

## Development Workflow

### Creating a new feature

1. Create a feature branch

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following the existing patterns

3. Run tests and linting

   ```bash
   pnpm test
   pnpm lint
   ```

4. Commit with conventional commits
   ```bash
   git commit -m "feat: add new feature"
   ```

### Working with the API

The API uses a modular architecture with:

- **Core modules**: Infrastructure (Prisma, Redis, Crypto, Logger)
- **Feature modules**: Auth, Users, Spaces, Accounts, etc.
- **Shared code**: DTOs, guards, decorators

Example API endpoint:

```typescript
@Post('login')
@ApiOperation({ summary: 'Login user' })
async login(@Body() dto: LoginDto): Promise<AuthResponse> {
  return this.authService.login(dto);
}
```

### Working with the Frontend

The web app uses:

- **Next.js 15** with App Router (both web and admin)
- **Tailwind CSS** for styling
- **shadcn/ui** components
- **Zustand** for state management
- **React Query** for server state

Example component:

```typescript
// Login page uses @janua/react-sdk for SSO authentication
import { SignIn } from '@janua/react-sdk';

export default function LoginPage() {
  return (
    <Card>
      <SignIn redirectUrl="/dashboard" />
      <Button onClick={guestLogin}>Try Live Demo</Button>
    </Card>
  );
}
```

## Security

- **Authentication**: Janua SSO in production, with JWT/session support retained for API/test compatibility
- **2FA**: TOTP-based two-factor authentication
- **Encryption**: AES-256-GCM for sensitive data
- **Password**: Argon2id hashing
- **API Security**: Rate limiting, CORS, helmet
- **Audit Logging**: All sensitive operations logged

## API Documentation

When running in development, Swagger documentation is available at:
http://localhost:4010/docs

## Testing

We maintain 90%+ test coverage on the API with comprehensive unit, integration, and E2E tests. Frontend apps have full page-level smoke tests and Playwright E2E coverage.

```bash
# Run all tests
pnpm test

# Run tests with coverage report
pnpm --filter @dhanam/api test:cov

# Run E2E tests (requires DB + Redis)
pnpm --filter @dhanam/api test:e2e

# Run contract tests (no services needed)
pnpm --filter @dhanam/api test:contract

# Run Playwright E2E (starts dev server automatically)
pnpm --dir apps/web exec playwright test

# Run tests in watch mode
pnpm --filter @dhanam/api test:watch
```

### Test Infrastructure

- **API**: unit tests, E2E journey tests, contract tests for Stripe/Plaid/Belvo, and dedicated chaos tests
- **Web**: 500+ unit tests across 65 suites, 9 Playwright E2E specs including accessibility (WCAG AA)
- **Admin**: 22 test suites covering all 11 components and 11 pages
- **Mobile**: 6 test suites with jest-expo
- **CI/CD**: parallel test jobs for API, web, mobile, admin, contracts, and Playwright
- **Coverage Target**: 95%+ on API, 80%+ on frontend
- **Coverage Reporting**: Integrated with Codecov for trend tracking

For detailed testing documentation, see:

- [Test Coverage Guide](apps/api/TEST_COVERAGE_GUIDE.md) - Comprehensive testing guide
- [Test Summary](docs/testing/TEST_SUMMARY.md) - Testing approach overview
- [Test Results](docs/testing/TEST_RESULTS.md) - Latest test results

## Deployment

The application is deployed via **Enclii** to bare metal K8s (GitOps with ArgoCD):

1. **Staging**: Push to `main` → `deploy-staging.yml` builds/signs images and patches digest-pinned staging images. Current blocker: public staging smoke returns 404 until namespace-aware tunnel routes are repaired.
2. **Production**: `promote-to-prod.yml` manually promotes a soaked staging digest after a successful staging smoke run, unless an explicit break-glass bypass is recorded.
3. **Break glass**: `deploy-enclii.yml` / `deploy-{k8s,web-k8s,admin-k8s}.yml` are manual emergency paths only.

```bash
# Build Docker images (for local testing)
docker build -f apps/api/Dockerfile -t dhanam-api .
docker build -f apps/web/Dockerfile -t dhanam-web .
```

For complete deployment instructions, see [Deployment Guide](docs/DEPLOYMENT.md).

## Monitoring & Observability

- **Prometheus**: ServiceMonitor + PrometheusRule CRDs in `infra/k8s/monitoring/`
- **Alertmanager**: Routing for critical (1h) and warning (12h) alerts
- **Grafana**: Auto-provisioned dashboards for request rate, latency, errors, queues, DB/Redis health
- **ArgoCD**: GitOps sync from `infra/k8s/production/` — see `infra/k8s/argocd/README.md`

## Admin Panel (SRE Ops Center)

The standalone admin panel at `apps/admin` provides:

- System health monitoring (DB, Redis, queues, providers)
- Queue management (stats, retry failed, clear)
- Provider dashboard (health, latency, rate limits)
- GDPR compliance (data export, right-to-deletion)
- User/space management with audit trails

## Documentation

Comprehensive documentation is available in the [`docs/`](docs/) directory:

### Getting Started

- [Development Guide](docs/DEVELOPMENT.md) - Local development setup
- [API Documentation](docs/API.md) - Backend API reference
- [Mobile App Guide](docs/MOBILE.md) - React Native development

### Architecture & Design

- [Architecture Overview](docs/architecture/ARCHITECTURE.md) - High-level system design
- [Full Architecture Details](docs/architecture/ARCHITECTURE.md) - Complete architecture
- [Software Specification](docs/architecture/SOFTWARE_SPEC.md) - Technical specs
- [Infrastructure Guide](docs/INFRASTRUCTURE.md) - Infrastructure setup

### Operations & Deployment

- [Deployment Guide](docs/DEPLOYMENT.md) - Production deployment
- [Admin Dashboard](docs/ADMIN_DASHBOARD.md) - Admin features
- [Sentry Setup](docs/SENTRY_SETUP.md) - Error tracking
- [CI/CD Setup](docs/guides/CICD_IMPLEMENTATION_SUMMARY.md) - Build pipeline

### Reports

- [Documentation Index](docs/README.md) - Complete documentation index
- [Implementation Roadmap](docs/guides/IMPLEMENTATION_ROADMAP.md) - Project roadmap

## LLM & Agent Context

This project provides machine-readable context files for LLM agents:

- [`llms.txt`](llms.txt) — Concise project overview with documentation links ([llmstxt.org spec](https://llmstxt.org/))
- [`llms-full.txt`](llms-full.txt) — Expanded version with inlined critical content
- [`AGENTS.md`](AGENTS.md) — Canonical agent operating instructions
- [`CLAUDE.md`](CLAUDE.md) — Compatibility redirect for Claude Code
- [`tools/agent-manifest.json`](tools/agent-manifest.json) — Machine-readable project metadata

These files are also served at `https://dhan.am/llms.txt` and `https://dhan.am/llms-full.txt`.

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

AGPL-3.0 License - see LICENSE file for details

## Support

For issues and feature requests, please use the GitHub issue tracker.

---

Built with ❤️ for the LATAM community
