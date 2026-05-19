# Database Migrations Guide

## Overview

This guide documents our database migration strategy using Prisma Migrate for production-safe schema changes.

## Why Migrations Over db:push

- **Production Safety**: `db:push` directly modifies the database without version control
- **Rollback Support**: Migrations can be rolled back if issues occur
- **Team Collaboration**: Migration files are tracked in git for team synchronization
- **Audit Trail**: Complete history of all schema changes
- **Data Preservation**: Migrations can include custom SQL for data transformations

## Migration Workflow

### Development Environment

```bash
# 1. Make changes to schema.prisma
# 2. Create a migration
pnpm db:migrate:dev --name descriptive_name

# This will:
# - Generate migration SQL files
# - Apply migration to database
# - Regenerate Prisma Client
```

### Production/Staging Environment

```bash
# 1. Deploy migration (no prompts, fails on warning)
pnpm db:migrate:deploy

# 2. If migration fails, rollback
pnpm db:migrate:rollback
```

## Migration Best Practices

### 1. Naming Conventions

Use descriptive names that indicate the change:

```bash
# Good
pnpm db:migrate:dev --name add_user_preferences_table
pnpm db:migrate:dev --name add_index_to_transactions_date
pnpm db:migrate:dev --name make_email_unique_on_users

# Bad
pnpm db:migrate:dev --name update
pnpm db:migrate:dev --name changes
```

### 2. Breaking Changes - Use Multi-Step Migrations

For breaking changes (renaming columns, changing types), use this pattern:

**Step 1: Add new field (backward compatible)**

```prisma
model User {
  email     String  @unique
  emailNew  String? @unique  // New field
}
```

**Step 2: Deploy data migration**

```sql
-- In migration file, add custom SQL
UPDATE users SET email_new = email WHERE email_new IS NULL;
```

**Step 3: Make new field required**

```prisma
model User {
  email     String  @unique
  emailNew  String  @unique  // Now required
}
```

**Step 4: Drop old field**

```prisma
model User {
  emailNew  String  @unique
}
```

**Step 5: Rename field**

```prisma
model User {
  email  String  @unique  // Renamed back
}
```

### 3. Data Migrations

When you need to transform data:

```sql
-- 20250117_migrate_currency_format.sql

-- Migrate old currency format to new format
UPDATE accounts
SET metadata = jsonb_set(
  metadata,
  '{currency_format}',
  '"ISO_4217"'
)
WHERE metadata->>'currency_format' IS NULL;

-- Add check to ensure data integrity
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM accounts WHERE metadata->>'currency_format' IS NULL) THEN
    RAISE EXCEPTION 'Migration failed: Some accounts still have null currency_format';
  END IF;
END $$;
```

### 4. Index Management

Add indexes in separate migrations for large tables:

```bash
# Separate migration for performance-critical indexes
pnpm db:migrate:dev --name add_index_transactions_date_amount

# In migration SQL, use CONCURRENTLY for zero-downtime
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_date_amount
ON transactions(date DESC, amount);
```

### 5. Rollback Strategy

Every migration should have a rollback plan:

```sql
-- migration_up.sql
ALTER TABLE users ADD COLUMN verified_at TIMESTAMP;
UPDATE users SET verified_at = NOW() WHERE email_verified = true;

-- migration_down.sql (manual rollback)
ALTER TABLE users DROP COLUMN verified_at;
```

## Common Migration Patterns

### Adding a Required Field

```prisma
// Step 1: Add as optional
model User {
  newField  String?
}

// Step 2: Backfill data
// (in migration SQL)

// Step 3: Make required
model User {
  newField  String
}
```

### Renaming a Table

```sql
-- Use ALTER TABLE instead of DROP/CREATE
ALTER TABLE old_name RENAME TO new_name;

-- Update all foreign key constraints
ALTER TABLE other_table
  RENAME CONSTRAINT fk_old_name TO fk_new_name;
```

### Changing Column Type

```sql
-- Safe type conversions
ALTER TABLE accounts
  ALTER COLUMN balance TYPE DECIMAL(19,4)
  USING balance::DECIMAL(19,4);

-- Always test on staging first!
```

## Pre-Production Checklist

Before deploying migrations to production:

- [ ] Migration tested on local database
- [ ] Migration tested on staging with production-like data volume
- [ ] Rollback plan documented
- [ ] Performance impact assessed (use EXPLAIN ANALYZE)
- [ ] Team reviewed migration code
- [ ] Backup created before deployment
- [ ] Downtime window scheduled (if needed)
- [ ] Monitoring alerts configured

## Emergency Rollback Procedure

If a migration causes issues in production:

```bash
# 1. Immediately stop application deployments
# 2. Check migration status
pnpm prisma migrate status

# 3. If migration is partial, resolve manually
# 4. Restore from backup if needed
# 5. Apply rollback migration

# 6. Post-mortem: Document what went wrong
```

## Monitoring Migration Health

```sql
-- Check for failed migrations
SELECT * FROM _prisma_migrations
WHERE finished_at IS NULL OR rollback_at IS NOT NULL;

-- Check migration duration
SELECT
  migration_name,
  started_at,
  finished_at,
  finished_at - started_at AS duration
FROM _prisma_migrations
ORDER BY started_at DESC
LIMIT 10;
```

## CI/CD Integration

```yaml
# .github/workflows/migrations.yml
- name: Check migrations
  run: |
    pnpm prisma migrate diff \
      --from-schema-datamodel prisma/schema.prisma \
      --to-schema-datasource $DATABASE_URL \
      --script > diff.sql

    # Fail if there are pending migrations
    if [ -s diff.sql ]; then
      echo "Error: Schema drift detected"
      cat diff.sql
      exit 1
    fi
```

## Resources

- [Prisma Migrate Docs](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Migration Troubleshooting](https://www.prisma.io/docs/guides/migrate/production-troubleshooting)
- Team Slack: #database-migrations
