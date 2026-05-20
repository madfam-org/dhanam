# Dhanam Ledger Deployment Guide

> [!IMPORTANT]
> MADFAM-ENCLII-FIRST-LEGACY-RAW v1: This document contains legacy raw infrastructure command examples.
> Routine production operations must use Enclii web, API, or CLI. Treat raw
> `kubectl`, `helm`, SSH, provider CLI/API, `docker exec`, and direct container
> access as platform bootstrap or documented break-glass only, and record any
> missing Enclii adapter gap.

> **Last Updated**: 2026-05-20

## Overview

Dhanam deploys to bare-metal Kubernetes via **Enclii** (MADFAM's PaaS) and
ArgoCD GitOps. The intended primary method is Enclii-controlled build/deploy
plus manual promotion; the current public production runtime is the ArgoCD
`dhanam-services` Application syncing `infra/k8s/production/` into the
`dhanam` namespace. There is no AWS/ECS/Fargate infrastructure.

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

### Current Production Runtime Gap

As of 2026-05-20, public production traffic is served from the legacy/live
`dhanam` namespace through the ArgoCD `dhanam-services` Application. Enclii
also exposes project environments named `prod` (`enclii-dhanam-prod`) and
`production` (`dhanam`), but a verified `enclii deploy --env prod` produced a
healthy Enclii deployment record while the `enclii-dhanam-prod` namespace did
not exist in the cluster.

Until Enclii's production environment mapping is repaired, do not assume an
Enclii `prod` deployment record means the public site changed. Verify the live
ArgoCD digest and public HTTP behavior. Use GitOps digest promotion into
`infra/k8s/production/kustomization.yaml` as the auditable production path;
raw `kubectl set image` remains break-glass only.

Production digests must be signed. `deploy-staging.yml` now signs API, web,
and admin images with GitHub Actions keyless cosign signatures, and
`promote-to-prod.yml` verifies the candidate digest was signed by
`deploy-staging.yml@refs/heads/main` before it writes a production commit.
Staging digests that predate this change must be rebuilt by the staging
workflow before they are promotable. The break-glass K8s workflows also sign
their images before committing production digests; their direct
`kubectl set image` steps currently fail from GitHub-hosted runners because
the cluster API is not reachable, so ArgoCD reconciliation of the signed digest
is the effective deployment mechanism.

---

## Deployment Methods

### Auto-Deploy / Promotion

Pushes to `main` run CI and the staging image pipeline. Production changes
should be promoted through the manual promotion workflow or an Enclii deploy
that is confirmed to affect the live production namespace:

```bash
git push origin main
# CI builds/test gates run; staging image digests are updated
# Production is promoted manually after validation
```

Verify Enclii release state first:

```bash
enclii releases dhanam-web --project dhanam -n 5
enclii deployments list --limit 10
```

Then verify the live public runtime through the production preflight:

```bash
scripts/production-preflight.sh
```

### Manual Deploy via Enclii CLI

```bash
enclii deploy --file infra/enclii/services/dhanam-web.yaml --env prod --wait \
  --change-ticket https://github.com/madfam-org/dhanam/commit/<sha> \
  --smoke-endpoint https://dhan.am/
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
| `deploy-staging.yml`   | Push to main    | Build/sign staging images and patch digests   |
| `deploy-k8s.yml`       | Manual dispatch | Break-glass API K8s deploy                    |
| `deploy-web-k8s.yml`   | Manual dispatch | Break-glass web image build/sign + K8s deploy |
| `deploy-admin-k8s.yml` | Manual dispatch | Break-glass admin-only K8s deploy             |
| `promote-to-prod.yml`  | Manual dispatch | Verify/signature-gate soaked staging digest   |
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

### Secrets

Routine secret reads and writes must go through Enclii/Lockbox/Vault/ESO, not
raw Kubernetes. The production template is kept for bootstrap and review at
`infra/k8s/production/secrets-template.yaml`.

Key secret resources:

| Secret                   | Contents                                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dhanam-secrets`         | `DATABASE_URL`, `REDIS_URL`, `ENCRYPTION_KEY`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, provider keys |
| `dhanam-billing-secrets` | `STRIPE_MX_*`, `PADDLE_*`                                                                                                                                   |

Use Enclii for routine updates:

```bash
enclii secrets list dhanam-api --env production
enclii secrets set BELVO_SECRET_KEY_ID=<value> --service dhanam-api --secret --env production
```

If Enclii lacks an adapter for a required secret operation, record the adapter
gap before using any raw Kubernetes bootstrap/break-glass path.

### Image Pull Secret

Create or rotate image pull secrets through Enclii/Lockbox when available. Raw
`kubectl create secret docker-registry` is bootstrap/break-glass only.

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

Staging manifests are in `infra/k8s/overlays/staging/` and import the
production base with staging-specific env, single replicas, disabled HPAs,
staging-scoped Vault/ESO paths, and digest-pinned images. `deploy-staging.yml`
builds and signs API, web, and admin images, patches their digests into the
staging overlay, and lets the `dhanam-staging` ArgoCD Application reconcile
into the Enclii-registered `enclii-dhanam-staging` namespace.

Required staging hostnames:

| Service | Host                            |
| ------- | ------------------------------- |
| Web     | `https://staging.dhan.am`       |
| Admin   | `https://staging-admin.dhan.am` |
| API     | `https://staging-api.dhan.am`   |

The root `enclii.yaml` declares these hostnames for Enclii domain
reconciliation. The Cloudflare tunnel must route them to the
`enclii-dhanam-staging` namespace services; see
`infra/k8s/production/_cloudflare-routes-reference.yaml`.

As of 2026-05-20, Enclii custom-domain verification and Cloudflare DNS CNAMEs
exist for all three staging hostnames. Staging is still not production-grade:
the ArgoCD Application is not registered in-cluster, the
`enclii-dhanam-staging` namespace is absent, staging Vault/ESO paths must be
populated, and Enclii `junctions add` currently maps hostnames to production
namespace services instead of staging. Treat staging tunnel-route apply as an
Enclii adapter gap until a namespace-aware route operation exists.

### Current Enclii Policy Blocker

On 2026-05-19, Enclii deployment records for `dhanam-api` and `dhanam-admin`
showed failed roll-forward attempts blocked by Kyverno:

```text
verify-image-signatures:
  autogen-check-signature: kyverno.io/verify-images annotation cannot be changed
```

`enclii ops policy waiver-plan` can plan a waiver, but apply is currently
blocked because the concrete adapter is not wired in this Enclii build. Until
that adapter or the Enclii deployment reconciler is fixed, do not treat a
ready release as proof that production has rolled forward.

On 2026-05-20, ArgoCD also rejected an unsigned staging web digest during
production promotion:

```text
failed to verify image ghcr.io/madfam-org/dhanam/web@sha256:cdb413...:
  .attestors[0].entries[0].keyless: no matching signatures
```

The signed digest
`sha256:126661e221a67a335eddaf885c142464f82c50f2edb7c6730f79f801548bf054`
was then built by `deploy-web-k8s.yml`, committed to production, and
successfully reconciled by ArgoCD. The workflow still reported failure because
its direct `kubectl set image` step could not connect to the cluster API from
the GitHub runner.

### Current Enclii Staging Route Gap

On 2026-05-20, `enclii domains add` and `enclii providers cloudflare dns-apply`
successfully created and verified:

- `staging-api.dhan.am`
- `staging.dhan.am`
- `staging-admin.dhan.am`

`enclii junctions add` was tested and then reverted because it created tunnel
routes to `http://dhanam-*.dhanam.svc.cluster.local:80`, which is production,
not staging. Required staging routes are:

- `staging-api.dhan.am` -> `http://dhanam-api.enclii-dhanam-staging.svc.cluster.local:80`
- `staging.dhan.am` -> `http://dhanam-web.enclii-dhanam-staging.svc.cluster.local:80`
- `staging-admin.dhan.am` -> `http://dhanam-admin.enclii-dhanam-staging.svc.cluster.local:80`

Do not leave staging hostnames pointed at production services. Use an Enclii
namespace-aware tunnel-route adapter when available; raw Cloudflare edits are
break-glass only.

---

## Rollback

### Application Rollback

```bash
enclii rollback dhanam-api --env production
enclii rollback dhanam-web --env production
enclii rollback dhanam-admin --env production
enclii ps --env production
```

Raw `kubectl rollout undo` is break-glass only and must be recorded with the
actor, reason, target deployment, commands executed, result, and follow-up
Enclii adapter gap or incident link.

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

| Endpoint                          | Description                             |
| --------------------------------- | --------------------------------------- |
| `GET /health`                     | Root basic health for external monitors |
| `GET /health/full`                | Full root health with queues/providers  |
| `GET /v1/monitoring/health`       | Versioned full API health               |
| `GET /v1/monitoring/health/live`  | API liveness probe                      |
| `GET /v1/monitoring/health/ready` | API readiness probe                     |
| `GET /api/health`                 | Web/admin Next.js health endpoint       |

Run the public DNS/HTTP preflight before and after promotion:

```bash
scripts/production-preflight.sh
```

Use `scripts/production-preflight.sh --include-staging` only after the staging
ArgoCD Application, namespace, Vault/ESO values, and tunnel routes are active.

---

## Troubleshooting

### Pod Issues

```bash
enclii ps --env production --wide
enclii logs dhanam-api --env production --since 1h --level error
enclii observe dhanam-api --env production
```

If direct pod inspection is unavoidable because Enclii lacks the needed adapter,
document it as break-glass and record the Enclii adapter gap.

### Database Connection Issues

```bash
enclii secrets list dhanam-api --env production
enclii logs dhanam-api --env production --since 30m --level error
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
- `infra/k8s/overlays/staging/` — staging overlay
- `infra/k8s/monitoring/` — Prometheus, Grafana, Alertmanager
- `infra/k8s/argocd/` — ArgoCD Application CRD
