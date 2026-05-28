# Dhanam Dogfooding Quickstart

> [!NOTE]
> Historical document. For current status read
> [docs/README.md](../../README.md),
> [DEVELOPMENT.md](../../DEVELOPMENT.md), and
> [GA_REMEDIATION_ROADMAP.md](../../GA_REMEDIATION_ROADMAP.md). Current local
> API port is `4010`; LocalStack is not part of the default quick start.

> **Internal MADFAM guide for using Dhanam to track MADFAM finances**

## Quick Start (5 minutes)

### 1. Start Infrastructure

```bash
cd ~/labspace/dhanam

# Start local services (PostgreSQL, Redis, MailHog, LocalStack)
docker compose -f docker-compose.local.yml up -d

# Verify services are running
docker compose -f docker-compose.local.yml ps
```

**Services started:**

- PostgreSQL: `localhost:5432` (user: dhanam, pass: localdev)
- Redis: `localhost:6379`
- MailHog: `localhost:8025` (email UI) / `localhost:1025` (SMTP)
- LocalStack: `localhost:4566` (S3/KMS mock)
- Adminer: `localhost:8080` (DB admin UI)
- Redis Commander: `localhost:8081` (Redis admin UI)

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Setup Database

```bash
# Generate Prisma client
pnpm db:generate

# Push schema to database
pnpm db:push

# Seed with MADFAM finance data
cd apps/api && npx prisma db seed -- --preset madfam
```

### 4. Start Development Servers

```bash
# From project root
pnpm dev
```

**Apps running:**

- API: http://localhost:4010 (Swagger docs at /docs)
- Web: http://localhost:3000

### 5. Login

**MADFAM Admin Account:**

- Email: set via `MADFAM_ADMIN_EMAIL` when running `pnpm db:seed-madfam`
- Password: set via `MADFAM_ADMIN_PASSWORD` (generate with `openssl rand -base64 24`)

**Demo Account:**

- Email: `demo@dhanam.app`
- Password: value of `DEMO_USER_PASSWORD` from your local `.env`

---

## MADFAM Finance Tracking

The MADFAM seed creates a pre-configured business space with ecosystem-aligned categories:

Historical note: current taxonomy tracks Sim4D through Yantra4D and Primavera3D
maker-node quoting through Cotiza Studio. The examples below predate that
catalogue correction.

### Revenue Categories

- 💰 Revenue: sim4d Studio
- 💰 Revenue: Primavera3D
- 💰 Revenue: Fortuna
- 💰 Revenue: Dhanam Premium
- 💰 Revenue: Consulting

### Expense Categories (by Layer)

- **SOIL (Infrastructure)**: Janua Auth, Enclii CLI, Cloud hosting
- **STEM (Shared)**: geom-core, AVALA, Design system
- **FRUIT (Products)**: Product-specific development costs

### Pre-configured Features

- FY2025 Operations Budget
- Cost center tracking by product
- MXN/USD multi-currency support
- Monthly budget periods

---

## Key Workflows

### Track Development Costs

1. Go to **Transactions** → **Add Manual**
2. Select category (e.g., "🌱 Expense: sim4d Development")
3. Enter amount, date, and description
4. Transaction appears in budget tracking

### View Budget Status

1. Go to **Budgets** → **MADFAM Operations FY2025**
2. See spending vs. budget by category
3. Drill into category for transaction details

### Record Revenue

1. Go to **Transactions** → **Add Manual**
2. Select revenue category (e.g., "💰 Revenue: sim4d Studio")
3. Enter positive amount
4. Shows in cash flow and P&L views

### Generate Reports

1. Go to **Analytics** → **Reports**
2. Select date range and categories
3. Export to CSV or view charts

---

## Alternative: Shared Infrastructure Setup

If you have the MADFAM shared infrastructure running:

```bash
# Start shared infra (from solarpunk-foundry)
cd ~/labspace/solarpunk-foundry/ops/local
docker compose -f docker-compose.shared.yml up -d

# Start Dhanam with shared infra
cd ~/labspace/dhanam
docker compose -f docker-compose.dev.yml up -d
```

This connects to:

- Shared PostgreSQL with dedicated `dhanam_db` database
- Shared Redis (DB index 3)
- Shared MinIO for file storage
- Janua for SSO authentication

---

## Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker compose -f docker-compose.local.yml ps postgres

# Reset database
docker compose -f docker-compose.local.yml down -v
docker compose -f docker-compose.local.yml up -d
pnpm db:push
```

### Port Conflicts

If ports are in use, modify `docker-compose.local.yml`:

- PostgreSQL: Change `5432:5432`
- Redis: Change `6379:6379`
- Web: Set `PORT=3001` in `.env.local`

### Prisma Issues

```bash
# Regenerate client after schema changes
pnpm db:generate

# Reset and reseed
cd apps/api
npx prisma migrate reset --force
```

### View Emails

All emails are captured by MailHog:

- Open http://localhost:8025
- See registration confirmations, password resets, etc.

---

## Feature Status for Dogfooding

### Ready ✅

- User registration/login
- Space management (personal/business)
- Budget creation and tracking
- Manual transaction entry
- Category management
- Basic analytics dashboard
- Multi-currency support

### In Progress 🔄

- Bank integrations (Belvo/Plaid) - sandbox mode
- ESG scoring for crypto
- Goal tracking
- Household management

### Not Yet Available ❌

- Mobile app (React Native)
- Premium billing (Stripe)
- Full localization (Spanish incomplete)

---

## Feedback

Report issues or suggestions:

- GitHub Issues: https://github.com/madfam-io/dhanam/issues
- Tag with `dogfooding` label

---

_Last updated: November 2025_
