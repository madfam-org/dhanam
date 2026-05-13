# Backup & Restore Runbook

> [!IMPORTANT]
> MADFAM-ENCLII-FIRST-LEGACY-RAW v1: This document contains legacy raw infrastructure command examples.
> Routine production operations must use Enclii web, API, or CLI. Treat raw
> `kubectl`, `helm`, SSH, provider CLI/API, `docker exec`, and direct container
> access as platform bootstrap or documented break-glass only, and record any
> missing Enclii adapter gap.

## Overview

Dhanam uses PostgreSQL as its single durable datastore. Redis is used only for transient BullMQ job state and does not require backup.

**Recovery targets (per CLAUDE.md):**

- **RTO**: 4 hours (time to restore service)
- **RPO**: 24 hours (maximum data loss window)
- **Retention**: 30 days rolling

---

## Daily Logical Backup

Run via cron or CI scheduler. The wrapper script is at `scripts/backup-db.sh`.

```bash
# Manual invocation
./scripts/backup-db.sh
```

**What it does:**

1. Reads `DATABASE_URL` from environment (or `.env`)
2. Runs `pg_dump` with `--format=custom` for efficient compression
3. Names the dump `dhanam_YYYY-MM-DD_HHMMSS.dump`
4. Stores in `$BACKUP_DIR` (default: `/var/backups/dhanam`)
5. Removes dumps older than `$RETENTION_DAYS` (default: 30)

**Environment variables:**
| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | (required) | PostgreSQL connection string |
| `BACKUP_DIR` | `/var/backups/dhanam` | Where to store backup files |
| `RETENTION_DAYS` | `30` | Number of days to keep backups |

---

## Restore Procedures

### Full Database Restore

Restores the entire database from a backup dump. **This drops and recreates all tables.**

```bash
./scripts/restore-db.sh /path/to/dhanam_2026-03-20_020000.dump
```

### Partial Table Restore

To restore specific tables (e.g., after accidental deletion):

```bash
# List tables in a dump
pg_restore --list /path/to/backup.dump

# Restore only the Transaction table
pg_restore --dbname="$DATABASE_URL" \
  --data-only \
  --table=Transaction \
  /path/to/backup.dump
```

**Warning:** Partial restores may violate foreign key constraints. Disable triggers if needed:

```bash
pg_restore --dbname="$DATABASE_URL" \
  --data-only \
  --disable-triggers \
  --table=Transaction \
  /path/to/backup.dump
```

---

## Disaster Recovery Procedure

**Scenario:** Complete database loss, need to restore from backup.

1. **Provision new PostgreSQL instance** (or verify existing instance is accessible)
2. **Restore latest backup:**
   ```bash
   ./scripts/restore-db.sh /var/backups/dhanam/latest.dump
   ```
3. **Run Prisma migrations** to ensure schema is current:
   ```bash
   cd apps/api && npx prisma migrate deploy
   ```
4. **Verify data integrity:**
   ```bash
   cd apps/api && npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM \"User\"; SELECT COUNT(*) FROM \"Transaction\";"
   ```
5. **Restart API pods:**
   ```bash
   kubectl rollout restart deployment/dhanam-api -n dhanam
   ```
6. **Verify health endpoint:** `curl https://api.dhan.am/health`

**Expected RTO:** < 4 hours (including provisioning and data transfer)

---

## Redis (No Backup Needed)

Redis stores only transient BullMQ job queues (sync jobs, notification dispatch, etc.). On Redis loss:

- Jobs in progress will be retried by their producers
- Pending jobs will be re-enqueued by the next scheduled cycle
- No user data is stored in Redis

---

## Monitoring

- **Alert on backup failure:** Ensure cron job exit code is monitored
- **Alert on backup age:** Warn if latest backup is > 26 hours old
- **Alert on backup size:** Warn if dump size drops > 50% vs previous (indicates possible data loss)

---

## Testing

Backups should be tested quarterly by restoring to a staging database:

```bash
# Restore to staging
DATABASE_URL="$STAGING_DATABASE_URL" ./scripts/restore-db.sh /var/backups/dhanam/latest.dump

# Run API test suite against restored data
cd apps/api && DATABASE_URL="$STAGING_DATABASE_URL" pnpm test
```
