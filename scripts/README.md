# Utility Scripts

This directory contains development and operations scripts for the Dhanam Ledger project.

## Development Scripts

### `dev-setup.sh`

Sets up the local development environment.

- Checks prerequisites (Node.js, pnpm, Docker)
- Creates environment files from templates
- Starts Docker containers
- Runs database migrations
- Seeds initial data

**Usage:**

```bash
./scripts/dev-setup.sh
```

### `dev-clean.sh`

Cleans development artifacts and resets the environment.

- Stops Docker containers
- Removes node_modules and build artifacts
- Cleans Turborepo cache
- Removes generated Prisma client

**Usage:**

```bash
./scripts/dev-clean.sh
```

### `manual-start.sh`

Manual startup script for development services.

- Starts PostgreSQL, Redis, and Mailhog containers
- Waits for services to be ready
- Displays connection information

**Usage:**

```bash
./scripts/manual-start.sh
```

## Database Scripts

### `fix-prisma.sh`

Fixes Prisma-related issues.

- Regenerates Prisma client
- Resets database connections
- Clears Prisma cache

**Usage:**

```bash
./scripts/fix-prisma.sh
```

### `seed-data.sh`

Seeds the database with sample data.

- Creates demo users and spaces
- Generates sample transactions
- Sets up budget examples
- Creates test accounts

**Usage:**

```bash
./scripts/seed-data.sh
```

## Testing Scripts

### `test.sh`

Runs the test suite.

- Executes unit and integration tests
- Generates coverage reports
- Runs across all packages

**Usage:**

```bash
./scripts/test.sh
```

### `test-ci.sh`

Simulates CI environment testing locally.

- Sets up test database
- Runs tests with CI configuration
- Generates coverage reports
- Uploads to Codecov (if configured)

**Usage:**

```bash
./scripts/test-ci.sh
```

### `test-runner.sh`

Advanced test runner with options.

- Supports test filtering
- Watch mode
- Coverage thresholds
- Parallel execution

**Usage:**

```bash
# Run specific test file
./scripts/test-runner.sh path/to/test.spec.ts

# Run tests in watch mode
./scripts/test-runner.sh --watch

# Run with coverage
./scripts/test-runner.sh --coverage
```

## Deployment Scripts

### `enclii-deploy.sh`

Triggers an Enclii deployment (fallback when auto-deploy is unavailable).

**Usage:**

```bash
./scripts/enclii-deploy.sh
```

### `deploy-dhanam.sh`

Deploys Dhanam services to the K8s cluster.

**Usage:**

```bash
./scripts/deploy-dhanam.sh
```

### `provision-db.sh`

Provisions the Dhanam database via the Enclii API (idempotent — safe to re-run).

- Calls `POST /v1/admin/provision/postgres` on switchyard-api
- Creates database, role, and extensions if they don't exist
- Auto-updates PgBouncer configuration

**Usage:**

```bash
export ENCLII_API_URL=https://api.enclii.com
export ENCLII_ADMIN_TOKEN=$(enclii auth token)
export DB_PASSWORD=<secure-password>
./scripts/provision-db.sh
```

### `setup-local.sh`

Sets up local infrastructure with Docker.

- Creates Docker networks
- Starts PostgreSQL container
- Starts Redis container
- Starts Mailhog for email testing
- Configures volume mounts

**Usage:**

```bash
./scripts/setup-local.sh
```

## Operations Scripts

### `queue-admin.sh`

Manages BullMQ job queues.

- Lists active jobs
- Retries failed jobs
- Clears completed jobs
- Pauses/resumes queues

**Usage:**

```bash
# List all queues
./scripts/queue-admin.sh list

# Retry failed jobs
./scripts/queue-admin.sh retry <queue-name>

# Clear completed jobs
./scripts/queue-admin.sh clear <queue-name>
```

## CLI Tools

### `dhanam`

Main CLI tool for development tasks.

- Database management
- User administration
- Data import/export
- Development utilities

**Usage:**

```bash
# Show available commands
./scripts/dhanam --help

# Create a new user
./scripts/dhanam user:create

# Reset database
./scripts/dhanam db:reset
```

### `dhanam-quick`

Quick access CLI for common tasks.

- Fast access to frequent operations
- Simplified command syntax
- Preset configurations

**Usage:**

```bash
# Quick setup
./scripts/dhanam-quick setup

# Quick reset
./scripts/dhanam-quick reset
```

## Script Conventions

### Exit Codes

- `0`: Success
- `1`: General error
- `2`: Missing prerequisite
- `3`: Configuration error
- `4`: Network/connection error

### Environment Variables

Most scripts respect these environment variables:

- `NODE_ENV`: Environment (development, staging, production)
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `ENCLII_API_URL`: Enclii switchyard-api URL (for provisioning)

### Logging

Scripts use consistent logging format:

- `[INFO]`: Informational messages
- `[WARN]`: Warning messages
- `[ERROR]`: Error messages
- `[SUCCESS]`: Success messages

## Adding New Scripts

When adding a new script:

1. Place it in the `scripts/` directory
2. Make it executable: `chmod +x scripts/your-script.sh`
3. Add a header comment with description and usage
4. Document it in this README
5. Use consistent exit codes and logging
6. Test on clean environment before committing

## Troubleshooting

### Script Permission Denied

```bash
chmod +x scripts/script-name.sh
```

### Command Not Found

Ensure you're running scripts from the repository root:

```bash
# From repo root
./scripts/script-name.sh

# Or make PATH available
export PATH="$PATH:$(pwd)/scripts"
```

### Environment Variables Not Set

Check your `.env` files in `apps/api/` and `apps/web/`:

```bash
ls -la apps/api/.env apps/web/.env
```

---

For more information, see the [Development Guide](../docs/DEVELOPMENT.md).
