# Dhanam Reset Command Documentation

> [!IMPORTANT]
> MADFAM-ENCLII-FIRST-LEGACY-RAW v1: This document contains legacy raw infrastructure command examples.
> Routine production operations must use Enclii web, API, or CLI. Treat raw
> `kubectl`, `helm`, SSH, provider CLI/API, `docker exec`, and direct container
> access as platform bootstrap or documented break-glass only, and record any
> missing Enclii adapter gap.

## Overview

The `./dhanam reset` command provides a comprehensive cleanup and recovery system with multiple reset levels to handle different scenarios.

## Features

### Interactive Reset Menu

When running `./dhanam reset` without options, you'll see:

1. **Current Status Display**
   - Docker services status
   - Database volume existence
   - Application data size

2. **Reset Options**
   - Soft Reset (Level 1)
   - Hard Reset (Level 2)
   - Nuclear Reset (Level 3)
   - Fix Database (Level 4)

## Reset Levels

### 1️⃣ Soft Reset

**Purpose**: Quick cleanup while preserving data

**What it does:**

- ✅ Stops application servers
- ✅ Kills orphaned Node processes
- ✅ Clears application logs
- ✅ Removes cache files
- ✅ Cleans temporary build artifacts

**What it preserves:**

- ✓ Database data
- ✓ Docker volumes
- ✓ Dependencies (node_modules)
- ✓ Environment configurations

**Use when:**

- Application is misbehaving
- Need to clear logs and caches
- Want to restart cleanly without data loss

```bash
./dhanam reset
# Select option 1
```

### 2️⃣ Hard Reset

**Purpose**: Fresh start with clean data

**What it does:**

- ✅ Everything from Soft Reset
- ✅ Stops Docker containers
- ✅ Removes all Docker volumes
- ✅ Deletes database data
- ✅ Removes build artifacts
- ✅ Clears application data directory
- ✅ Removes environment files

**What it preserves:**

- ✓ Dependencies (node_modules)
- ✓ Package lock files
- ✓ Docker images

**Use when:**

- Need completely fresh data
- Database is corrupted
- Want to test initial setup flow
- Demo data needs to be regenerated

```bash
./dhanam reset
# Select option 2
```

### 3️⃣ Nuclear Reset

**Purpose**: Complete platform cleanup

**What it does:**

- ✅ Everything from Hard Reset
- ✅ Removes ALL Docker containers
- ✅ Removes Docker images
- ✅ Deletes all node_modules
- ✅ Clears pnpm store
- ✅ Removes lock files
- ✅ Clears all caches

**What it preserves:**

- ✓ Source code only

**Use when:**

- Switching Node/pnpm versions
- Resolving dependency conflicts
- Need absolute clean slate
- Before archiving project

**⚠️ Warning**: Requires typing "NUCLEAR" to confirm

```bash
./dhanam reset
# Select option 3
# Type: NUCLEAR
```

### 4️⃣ Fix Database

**Purpose**: Resolve database permission issues

**What it does:**

- ✅ Ensures PostgreSQL container is running
- ✅ Drops and recreates database
- ✅ Sets proper ownership and permissions
- ✅ Grants all privileges to dhanam user
- ✅ Regenerates Prisma client
- ✅ Attempts schema push

**Use when:**

- Getting Prisma P1010 errors
- Database permission denied
- Cannot connect to database
- Schema push failures

```bash
./dhanam reset
# Select option 4
```

## Quick Reset (CI/CD)

For automated environments, use the `--quick` flag:

```bash
./dhanam reset --quick
```

**What it does:**

- No confirmation required
- Stops Docker services with volume removal
- Removes build artifacts
- Clears data directory
- Returns immediately

**Perfect for:**

- CI/CD pipelines
- Automated testing
- Build scripts
- Cleanup jobs

## Usage Examples

### Typical Development Workflow

```bash
# After encountering issues
./dhanam reset        # Choose option 1 (Soft)
./dhanam up          # Restart platform
```

### Fresh Demo Environment

```bash
./dhanam reset        # Choose option 2 (Hard)
./dhanam up          # Creates fresh demo data
```

### Complete Reinstall

```bash
./dhanam reset        # Choose option 3 (Nuclear)
./dhanam up          # Rebuilds everything
```

### Database Issues

```bash
./dhanam reset        # Choose option 4 (Fix DB)
./dhanam up          # Start with fixed database
```

### CI/CD Pipeline

```yaml
# GitHub Actions example
- name: Clean environment
  run: ./dhanam reset --quick

- name: Start platform
  run: ./dhanam up
```

## Troubleshooting

### Reset Didn't Work?

1. Check for running processes:

   ```bash
   ps aux | grep -E "node|docker"
   ```

2. Manually stop Docker:

   ```bash
   docker ps -a | grep dhanam | awk '{print $1}' | xargs docker stop
   docker ps -a | grep dhanam | awk '{print $1}' | xargs docker rm
   ```

3. Force remove volumes:
   ```bash
   docker volume ls | grep dhanam | awk '{print $2}' | xargs docker volume rm
   ```

### Permission Denied

If you get permission errors:

```bash
sudo ./dhanam reset  # Use with caution
```

### Database Still Failing

After Fix Database option:

```bash
# Check PostgreSQL logs
docker logs dhanam-postgres --tail 50

# Test connection directly
docker exec dhanam-postgres psql -U dhanam -d dhanam -c "SELECT 1;"
```

## Recovery Process

If platform won't start after reset:

1. **Soft Reset First**

   ```bash
   ./dhanam reset  # Try option 1
   ```

2. **Then Hard Reset**

   ```bash
   ./dhanam reset  # Try option 2
   ```

3. **Fix Database**

   ```bash
   ./dhanam reset  # Try option 4
   ```

4. **Nuclear as Last Resort**
   ```bash
   ./dhanam reset  # Option 3 if all else fails
   ```

## What Gets Reset

| Component            | Soft | Hard | Nuclear | Fix DB |
| -------------------- | ---- | ---- | ------- | ------ |
| App Servers          | ✓    | ✓    | ✓       | -      |
| Logs                 | ✓    | ✓    | ✓       | -      |
| Cache                | ✓    | ✓    | ✓       | -      |
| Docker Containers    | -    | ✓    | ✓       | -      |
| Database Data        | -    | ✓    | ✓       | ✓      |
| Docker Volumes       | -    | ✓    | ✓       | -      |
| Docker Images        | -    | -    | ✓       | -      |
| node_modules         | -    | -    | ✓       | -      |
| Lock Files           | -    | -    | ✓       | -      |
| Environment Files    | -    | ✓    | ✓       | -      |
| Database Permissions | -    | -    | -       | ✓      |

## Best Practices

1. **Start with Soft Reset**
   - Least destructive
   - Preserves your work
   - Usually sufficient

2. **Use Hard Reset for:**
   - Fresh demo data
   - Clean testing environment
   - After major changes

3. **Nuclear Reset only when:**
   - Changing major versions
   - Dependency resolution fails
   - Complete fresh start needed

4. **Fix Database for:**
   - Prisma errors
   - Permission issues
   - Schema problems

5. **Always after reset:**
   ```bash
   ./dhanam up  # Restart platform
   ```

## Exit Codes

- `0`: Reset successful
- `1`: Reset failed or cancelled
- `130`: Interrupted (Ctrl+C)

## Related Commands

- `./dhanam up` - Start platform after reset
- `./dhanam status` - Check current state
- `./dhanam down` - Graceful shutdown
- `./dhanam logs` - View logs before reset

---

**Tip**: Save important data before running Hard or Nuclear resets!
