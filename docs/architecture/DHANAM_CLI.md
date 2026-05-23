# Dhanam CLI - One-Line Platform Management

> [!NOTE]
> Historical local-CLI concept doc. Verify commands against
> [../DEVELOPMENT.md](../DEVELOPMENT.md) and current package scripts before
> using. Current local API port is `4010`, and production operations are
> Enclii-first.

## Quick Start

```bash
# Make executable (first time only)
chmod +x ./dhanam

# Start everything with one command
./dhanam up

# That's it! Platform is ready at http://localhost:3000
```

## Features

### 🚀 Single Command Startup

- **`./dhanam up`** - Starts everything automatically:
  - Docker infrastructure (PostgreSQL, Redis, Mailhog, LocalStack)
  - Installs all dependencies
  - Sets up database schema
  - Seeds comprehensive demo data
  - Builds shared packages
  - Starts API and Web servers
  - Ready in ~60-90 seconds

### 🎭 Demo User Personas

The platform includes multiple pre-configured user personas for testing:

1. **Guest Access** (No login required)
   - Click "Try as Guest" on login page
   - Read-only access to demo data
   - Perfect for quick demos

2. **Individual User** (maria@dhanam.demo / `DEMO_USER_PASSWORD`)
   - Young professional with personal finances
   - Connected accounts: BBVA, Nu, Amex, Bitso
   - Monthly budget tracking
   - ESG crypto portfolio

3. **Small Business Owner** (carlos@business.com / `DEMO_USER_PASSWORD`)
   - Restaurant owner with personal & business spaces
   - Multiple account types
   - Quarterly business budgeting
   - 2FA enabled

4. **Enterprise Admin** (admin@enterprise.com / `DEMO_USER_PASSWORD`)
   - Multi-currency corporate accounts
   - Annual budget planning
   - Team management features
   - Advanced ESG reporting

5. **Platform Admin** (admin@dhanam.app / admin123)
   - Full administrative access
   - User management
   - Feature flags control
   - Audit log access

### 📊 Pre-Seeded Demo Data

- 90 days of transaction history
- Multiple account types (checking, savings, credit, crypto, investment)
- Realistic Mexican market data (OXXO, Soriana, BBVA, etc.)
- Budget categories with spending patterns
- ESG scores for crypto assets
- 30 days of valuation snapshots
- Categorization rules

## Commands

### Core Commands

```bash
./dhanam up       # Start everything
./dhanam down     # Stop everything
./dhanam status   # Check platform status
./dhanam demo     # Open browser to demo
./dhanam reset    # Clean reset to fresh state
./dhanam logs     # View application logs
```

### Command Details

#### `up` / `start`

Performs complete platform initialization:

1. Checks prerequisites (Node, Docker, pnpm)
2. Creates environment files
3. Starts Docker services
4. Sets up LocalStack (S3, KMS)
5. Installs dependencies
6. Creates database schema
7. Seeds demo data
8. Builds packages
9. Starts servers

#### `down` / `stop`

Gracefully shuts down:

- Stops application servers
- Stops Docker containers
- Preserves data for next startup

#### `status`

Shows health of all components:

- Docker infrastructure
- API server
- Web dashboard
- PostgreSQL database
- Redis cache

#### `demo`

- Checks if platform is running
- Auto-starts if needed
- Opens browser to demo page

#### `reset` / `clean`

Complete cleanup (with confirmation):

- Removes all Docker volumes
- Cleans build artifacts
- Deletes node_modules
- Resets to fresh state

#### `logs` / `log`

Interactive log viewer:

1. API Server logs
2. Web Dashboard logs
3. Docker services logs
4. Setup/installation logs

## Access Points

After running `./dhanam up`:

| Service         | URL                       | Description           |
| --------------- | ------------------------- | --------------------- |
| Web Dashboard   | http://localhost:3000     | Main application      |
| API Docs        | http://localhost:4010/api | Swagger documentation |
| Database Admin  | http://localhost:8080     | Adminer interface     |
| Email Viewer    | http://localhost:8025     | Mailhog UI            |
| Redis Commander | http://localhost:8081     | Redis management      |

## Environment Configuration

The CLI automatically creates `.env` files with:

- Database connections
- JWT secrets (auto-generated)
- Email configuration (Mailhog)
- AWS LocalStack settings
- Provider sandbox credentials
- Feature flags

## Prerequisites

The CLI checks for:

- Node.js v20+
- pnpm 8+
- Docker & Docker Compose

Missing pnpm will be auto-installed. Docker must be installed manually.

## Troubleshooting

### Platform won't start

```bash
./dhanam status    # Check component health
./dhanam logs      # View error logs
./dhanam reset     # Clean restart if needed
```

### Port conflicts

Default ports used:

- 3000: Web dashboard
- 4000: API server
- 5432: PostgreSQL
- 6379: Redis
- 8025: Mailhog
- 8080: Adminer
- 8081: Redis Commander

### Docker issues

```bash
docker compose -f docker-compose.local.yml ps  # Check containers
docker compose -f docker-compose.local.yml logs # View Docker logs
```

## Demo Workflow

1. Start platform: `./dhanam up`
2. Open browser: `./dhanam demo`
3. Choose access method:
   - Click "Try as Guest" for instant demo
   - Login with any demo account
4. Explore features:
   - Dashboard with charts
   - Account connections
   - Budget management
   - Transaction categorization
   - ESG scoring
   - Multi-space support

## Development Tips

- Guest sessions expire after 1 hour
- All demo users have realistic data
- Provider integrations use sandbox mode
- Emails are captured in Mailhog
- Database changes persist between restarts
- Use `./dhanam reset` for fresh start

## Architecture

The CLI orchestrates:

```
┌─────────────────────────────────────┐
│           ./dhanam CLI              │
├─────────────────────────────────────┤
│  Docker Infrastructure              │
│  ├─ PostgreSQL (database)           │
│  ├─ Redis (cache/queues)            │
│  ├─ Mailhog (email testing)         │
│  └─ LocalStack (AWS services)       │
├─────────────────────────────────────┤
│  Application Stack                  │
│  ├─ API (NestJS on :4000)          │
│  ├─ Web (Next.js on :3000)         │
│  └─ Mobile (React Native)           │
├─────────────────────────────────────┤
│  Demo Data Layer                    │
│  ├─ 5 User Personas                 │
│  ├─ 18 Connected Accounts           │
│  ├─ 750+ Transactions               │
│  └─ ESG Scores & Analytics          │
└─────────────────────────────────────┘
```

## Security Notes

- Guest access is read-only
- Demo accounts use simple passwords (not for production)
- JWT secrets are auto-generated for each setup
- Provider credentials use sandbox mode
- Admin features restricted to admin users

## Support

For issues or questions:

1. Check logs: `./dhanam logs`
2. Review status: `./dhanam status`
3. Clean restart: `./dhanam reset && ./dhanam up`
4. Check Docker: `docker ps`
5. Review this documentation

---

**Built with ❤️ for seamless development and demos**
