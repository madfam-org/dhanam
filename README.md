# Dhanam Ledger

> **A comprehensive budget and wealth tracking application with ESG crypto insights, targeting LATAM-first users with multilingual support.**

[![Test Coverage](https://github.com/madfam-io/dhanam/actions/workflows/test-coverage.yml/badge.svg)](https://github.com/madfam-io/dhanam/actions/workflows/test-coverage.yml)
[![Lint](https://github.com/madfam-io/dhanam/actions/workflows/lint.yml/badge.svg)](https://github.com/madfam-io/dhanam/actions/workflows/lint.yml)
[![codecov](https://codecov.io/gh/madfam-io/dhanam/branch/main/graph/badge.svg)](https://codecov.io/gh/madfam-io/dhanam)
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

| Service      | Domain          | Status               |
| ------------ | --------------- | -------------------- |
| Web App      | `app.dhan.am`   | ✅ Running on Enclii |
| Landing Page | `dhan.am`       | ✅ Running on Enclii |
| API Backend  | `api.dhan.am`   | ✅ Running on Enclii |
| Admin Panel  | `admin.dhan.am` | ✅ Running on Enclii |

**Authentication**: Janua SSO via `@janua/react-sdk` (OIDC with PKCE, handled by SDK)

- Client ID: `jnc_uE2zp9ume_Fd6jMl1elL6wqjiECM711t`
- Issuer: `https://auth.madfam.io`
- Social logins: GitHub, Google via Janua
- Auth mode: `AUTH_MODE=janua` (production default)

**Infrastructure**: 2-Node Hetzner Cluster via [Enclii PaaS](https://github.com/madfam-org/enclii)

- Production workloads on "The Sanctuary" (AX41-NVMe)
- CI/CD builds on "The Forge" (CPX11)
- Zero-trust ingress via Cloudflare Tunnel

## Tech Stack

- **Frontend**: Next.js 15/16, React Native + Expo
- **Backend**: NestJS (Fastify), PostgreSQL, Redis
- **Infrastructure**: Docker, Enclii PaaS (bare metal K8s)
- **Build**: Turborepo, pnpm monorepo

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker & Docker Compose
- PostgreSQL 15 (via Docker)
- Redis 7 (via Docker)

### Development Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/dhanam.git
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
   cp apps/web/.env.example apps/web/.env
   ```

6. **Run database migrations**

   ```bash
   pnpm db:push
   ```

7. **Seed the database (optional)**

   ```bash
   pnpm db:seed
   ```

   This creates a demo user (demo@dhanam.app / demo123) with sample data.

8. **Start development servers**

   ```bash
   pnpm dev
   ```

   This starts:
   - API server at http://localhost:4010
   - Web dashboard at http://localhost:3040
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
│   ├── k8s/          # Kubernetes manifests (production, staging, monitoring, argocd)
│   └── monitoring/   # Alert rules (deprecated — see k8s/monitoring/)
└── scripts/          # Development scripts
```

## Available Scripts

- `pnpm dev` - Start all apps in development mode
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

- **Authentication**: JWT with refresh token rotation
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
pnpm test:cov

# Run E2E tests (requires DB + Redis)
pnpm test:e2e

# Run contract tests (no services needed)
cd apps/api && pnpm test:contract

# Run Playwright E2E (starts dev server automatically)
cd apps/web && npx playwright test

# Run tests in watch mode
pnpm test:watch
```

### Test Infrastructure

- **API**: 3500+ unit tests, E2E journey tests, contract tests for Stripe/Plaid/Belvo
- **Web**: 500+ unit tests across 65 suites, 9 Playwright E2E specs including accessibility (WCAG AA)
- **Admin**: 22 test suites covering all 11 components and 11 pages
- **Mobile**: 6 test suites with jest-expo
- **CI/CD**: 6 parallel test jobs (API, web, mobile, admin, contract, Playwright) on every PR
- **Coverage Target**: 95%+ on API, 80%+ on frontend
- **Coverage Reporting**: Integrated with Codecov for trend tracking

For detailed testing documentation, see:

- [Test Coverage Guide](apps/api/TEST_COVERAGE_GUIDE.md) - Comprehensive testing guide
- [Test Summary](docs/testing/TEST_SUMMARY.md) - Testing approach overview
- [Test Results](docs/testing/TEST_RESULTS.md) - Latest test results

## Deployment

The application is deployed via **Enclii** to bare metal K8s (GitOps with ArgoCD):

1. **Staging**: Push to `main` → `deploy-staging.yml` patches digest-pinned staging images and ArgoCD reconciles.
2. **Production**: `promote-to-prod.yml` manually promotes a soaked staging digest, or Enclii auto-deploys when configured.
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

The admin panel at `apps/web/(admin)/admin/` provides:

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

- [Architecture Overview](ARCHITECTURE.md) - High-level system design
- [Full Architecture Details](docs/architecture/ARCHITECTURE.md) - Complete architecture
- [Software Specification](docs/architecture/SOFTWARE_SPEC.md) - Technical specs
- [Infrastructure Guide](docs/INFRASTRUCTURE.md) - Infrastructure setup
- [API Specification](API_SPECIFICATION.yaml) - OpenAPI spec

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
- [`CLAUDE.md`](CLAUDE.md) — Agent guidance for Claude Code
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
