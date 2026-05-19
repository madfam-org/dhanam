# Dhanam Ledger Deployment Guide

> [!IMPORTANT]
> MADFAM-ENCLII-FIRST-LEGACY-RAW v1: This document contains legacy raw infrastructure command examples.
> Routine production operations must use Enclii web, API, or CLI. Treat raw
> `kubectl`, `helm`, SSH, provider CLI/API, `docker exec`, and direct container
> access as platform bootstrap or documented break-glass only, and record any
> missing Enclii adapter gap.

> **Last Updated**: 2026-05-19

## Overview

Dhanam deploys to bare-metal Kubernetes via **Enclii** (MADFAM's PaaS). The primary method is auto-deploy on push to `main`. There is no AWS/ECS/Fargate infrastructure.

### Production URLs

| Service          | URL                      |
| ---------------- | ------------------------ |
| Web Dashboard    | `https://app.dhan.am`    |
| Landing Page     | `https://dhan.am`        |
| Admin Dashboard  | `https://admin.dhan.am`  |
| API Backend      | `https://api.dhan.am`    |
| Auth (Janua SSO) | `https://auth.madfam.io` |

### Infrastructure

- **Cluster**: 2-node Hetzner bare metal
- **Production Node**: "The Sanctuary" (AX41-NVMe)
- **Build Node**: "The Forge" (CPX11)
- **Ingress**: Cloudflare Tunnel (zero-trust)
- **GitOps**: ArgoCD syncs from `infra/k8s/production/` with auto-sync, prune, and self-heal
- **Namespace**: `dhanam`

---

## Deployment Methods

### Auto-Deploy (Primary)

Push to `main` triggers Enclii auto-deploy:

```bash
git push origin main
# Enclii detects → builds Docker images → deploys to K8s
```

Verify deployment through Enclii:

```bash
enclii ps dhanam-api --env production
enclii ps dhanam-web --env production
enclii ps dhanam-admin --env production
```

### Manual Deploy via Enclii CLI

```bash
enclii deploy --app dhanam --env production
```

### Manual Deploy via kubectl (Break-Glass Only)

Use this only for platform bootstrap or documented incidents when Enclii is
unavailable or lacks the required adapter. Record the actor, reason, commands,
result, and follow-up Enclii adapter gap.

```bash
# Update image directly
kubectl -n dhanam set image deployment/dhanam-api \
  api=ghcr.io/madfam-org/dhanam/api:sha-<commit>

kubectl -n dhanam set image deployment/dhanam-web \
  web=ghcr.io/madfam-org/dhanam/web:sha-<commit>
```

### GitHub Actions Workflows

| Workflow               | Trigger         | Purpose                                       |
| ---------------------- | --------------- | --------------------------------------------- |
| `ci.yml`               | All PRs         | Lint, test, typecheck                         |
| `deploy-enclii.yml`    | Manual dispatch | Fallback Enclii deploy                        |
| `deploy-staging.yml`   | Push to main    | Auto-deploy staging (1 replica, `:main` tags) |
| `deploy-k8s.yml`       | Manual dispatch | Break-glass API K8s deploy                    |
| `deploy-web-k8s.yml`   | Manual dispatch | Break-glass web-only K8s deploy               |
| `deploy-admin-k8s.yml` | Manual dispatch | Break-glass admin-only K8s deploy             |
| `promote-to-prod.yml`  | Manual dispatch | Promote soaked staging digest to production   |
| `publish-packages.yml` | Tag / manual    | npm publish to npm.madfam.io                  |

---

## Database Provisioning

### Via Enclii API (Required Method)

Database provisioning **must** use the Enclii provisioning API per Law 7 (API Mandate). Direct `kubectl exec` into postgres pods is prohibited.

The endpoint is `POST /v1/admin/provision/postgres` on the `switchyard-api` service. It is **idempotent** — it checks `pg_database` and `pg_roles` before creating, so it is safe to re-run against an already-provisioned database.

**Request:**

```bash
curl -X POST "${ENCLII_API_URL}/v1/admin/provision/postgres" \
  -H "Authorization: Bearer ${ENCLII_ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "namespace": "dhanam",
    "spec": {
      "database_name": "dhanam",
      "role_name": "dhanam_user",
      "role_password": "'"${DB_PASSWORD}"'",
      "extensions": ["uuid-ossp", "pgcrypto"]
    }
  }'
```

**What it does:**

1. Validates SQL identifiers in `spec`
2. Checks if the database and role already exist (`pg_database` / `pg_roles`)
3. Creates the database and role if missing
4. Grants permissions
5. Installs requested extensions
6. Updates PgBouncer configuration automatically

**Prerequisites:**

- `POSTGRES_ADMIN_URL` must be set on the `switchyard-api` deployment
- Admin token: obtain via `enclii auth login`
- The `dhanam` namespace must exist in the cluster

**Convenience script:** `scripts/provision-db.sh` wraps this API call. See the script for usage.

### Via Enclii CLI

```bash
enclii onboard --db-name dhanam --db-password "${DB_PASSWORD}"
```

### Database Migrations

After provisioning, run Prisma migrations against the provisioned database:

```bash
cd apps/api
DATABASE_URL="postgresql://dhanam_user:${DB_PASSWORD}@<host>:5432/dhanam" \
  npx prisma migrate deploy
```

In CI/production, the `pnpm db:migrate:deploy` script handles this.

---

## Secrets Management

### K8s Secrets

The secrets template is at `infra/k8s/production/secrets-template.yaml`. Two Secret resources:

| Secret                   | Contents                                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dhanam-secrets`         | `DATABASE_URL`, `REDIS_URL`, `ENCRYPTION_KEY`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, provider keys |
| `dhanam-billing-secrets` | `STRIPE_MX_*`, `PADDLE_*`                                                                                                                                   |

```bash
# Create from template
cp infra/k8s/production/secrets-template.yaml infra/k8s/production/secrets.yaml
# Fill in values (DO NOT commit secrets.yaml)
kubectl apply -f infra/k8s/production/secrets.yaml

# Patch individual values
kubectl -n dhanam patch secret dhanam-secrets --type merge -p \
  '{"stringData":{"BELVO_SECRET_KEY_ID":"<value>"}}'
```

### Image Pull Secret

```bash
kubectl -n dhanam create secret docker-registry ghcr-credentials \
  --docker-server=ghcr.io \
  --docker-username=<github-username> \
  --docker-password=<github-pat-with-read-packages> \
  --docker-email=<email>
```

---

## Monitoring

All monitoring manifests live in `infra/k8s/monitoring/`.

| Component          | Description                                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| **Prometheus**     | ServiceMonitor scrapes `/metrics` on port 4300                                                                                |
| **PrometheusRule** | Alert rules CRD (error rate, latency, queue depth)                                                                            |
| **Alertmanager**   | Critical alerts (1h repeat), warnings (12h repeat); Slack/PagerDuty receivers                                                 |
| **Grafana**        | Auto-provisioned dashboards: request rate, error rate, p95 latency, auth failures, queue depth, DB/Redis health, pod restarts |

### Staging

Staging manifests are in `infra/k8s/staging/` — 1 replica, `:main` image tags. Auto-deployed on push to main via `deploy-staging.yml`.

---

## Rollback

### Application Rollback

```bash
# Roll back to previous revision
kubectl -n dhanam rollout undo deployment/dhanam-api
kubectl -n dhanam rollout undo deployment/dhanam-web

# Roll back to specific revision
kubectl -n dhanam rollout undo deployment/dhanam-api --to-revision=<N>

# Verify
kubectl -n dhanam rollout status deployment/dhanam-api
```

### Database Migration Rollback

Prisma does not natively support down migrations. To roll back a migration:

1. Identify the migration to revert in `apps/api/prisma/migrations/`
2. Write and apply a corrective SQL migration
3. Use `prisma migrate resolve --rolled-back <migration_name>` to mark it as rolled back

For critical data issues, restore from the daily PostgreSQL backup.

---

## Mobile Deployment

Mobile builds use EAS (Expo Application Services). Configuration is at `apps/mobile/eas.json`.

```bash
cd apps/mobile

# iOS
eas build --platform ios --profile production
eas submit --platform ios --latest

# Android
eas build --platform android --profile production
# Upload .aab from EAS dashboard to Google Play Console
```

---

## Health Checks

| Endpoint                | Description                                  |
| ----------------------- | -------------------------------------------- |
| `GET /health`           | Basic liveness check                         |
| `GET /health/database`  | PostgreSQL connectivity and connection count |
| `GET /health/providers` | Status of Plaid, Belvo, Bitso integrations   |

---

## Troubleshooting

### Pod Issues

```bash
# Check pod status
kubectl -n dhanam get pods
kubectl -n dhanam describe pod <pod-name>

# View logs
kubectl -n dhanam logs deployment/dhanam-api --tail=100
kubectl -n dhanam logs deployment/dhanam-api --previous  # crashed container

# Resource usage
kubectl -n dhanam top pods
```

### Database Connection Issues

```bash
# Verify secret is mounted
kubectl -n dhanam exec deployment/dhanam-api -- env | grep DATABASE_URL

# Check PgBouncer status (if applicable)
kubectl -n data logs deployment/pgbouncer --tail=50
```

### Provider API Issues

Check provider status pages:

- Plaid: https://status.plaid.com/
- Belvo: https://status.belvo.co/
- Bitso: https://status.bitso.com/

The provider orchestrator (`apps/api/src/modules/providers/orchestrator/`) handles failover automatically. Check BullMQ queue status in the admin panel at `/admin`.

### Enclii Issues

```bash
# Check Enclii deploy status
enclii status --app dhanam

# View Enclii build logs
enclii logs --app dhanam --build latest
```

---

## Configuration Reference

### Enclii

- `.enclii.yml` — app configuration (root)
- `enclii.yaml` — domain manifest for auto-provisioning (root)

### Kubernetes

- `infra/k8s/production/` — production manifests (kustomize)
- `infra/k8s/staging/` — staging overlay
- `infra/k8s/monitoring/` — Prometheus, Grafana, Alertmanager
- `infra/k8s/argocd/` — ArgoCD Application CRD
