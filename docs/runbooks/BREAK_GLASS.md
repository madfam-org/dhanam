# Break-Glass Operations Runbook

Last updated: 2026-05-22

Routine production operations are **Enclii-first**. Use Enclii web, API, or CLI
before any raw infrastructure access.

This runbook documents **documented break-glass only** — when Enclii lacks an
adapter or the platform is unavailable. Every break-glass action must be
recorded.

## Before you break glass

1. Confirm Enclii cannot perform the operation (`enclii ops ...`, admin API, or
   documented workflow).
2. Open or reference an incident / change ticket.
3. Record: actor, reason, target service/environment, commands, result.
4. File or update an Enclii adapter gap in [Tech Debt](../TECH_DEBT.md)
   (TD-1004).

## Preferred alternatives (try first)

| Need                 | Enclii-first path                     | Dhanam admin API                           |
| -------------------- | ------------------------------------- | ------------------------------------------ |
| Pod logs             | `enclii logs dhanam-api -f`           | —                                          |
| Deploy / rollback    | `enclii deploy`, `enclii rollback`    | —                                          |
| Queue inspect        | Enclii adapter (gap)                  | `GET /v1/admin/queues`                     |
| Retry failed jobs    | Enclii adapter (gap)                  | `POST /v1/admin/queues/:name/retry-failed` |
| Clear stale failures | Enclii adapter (gap)                  | `POST /v1/admin/queues/:name/clear-failed` |
| Production promote   | `promote-to-prod.yml` + soak          | —                                          |
| Rollout proof        | `scripts/production-rollout-proof.js` | —                                          |
| Public health        | `scripts/production-preflight.sh`     | `GET /v1/monitoring/health`                |

## Break-glass scenarios

### Production queue remediation

**When:** Failed BullMQ jobs block health; admin token unavailable and Enclii
queue adapter not wired.

**Preferred:** Audited admin endpoints (platform admin JWT):

```http
GET  /v1/admin/queues
GET  /v1/admin/queues/:name/failed?limit=25
POST /v1/admin/queues/:name/retry-failed
POST /v1/admin/queues/:name/clear-failed
Body: { "confirm": true }
```

**Break-glass:** Direct BullMQ access from API pod — **failed jobs only**.
Never run whole-queue `clear` unless explicitly approved; it removes waiting,
active, completed, and delayed jobs.

**Record:** Queue names, job counts removed, incident link, TD-1004 follow-up.

Reference: [Stability Wrap-Up 2026-05-20](../STABILITY_WRAP_UP_2026-05-20.md).

### Database migration repair

**When:** Prisma migrate deploy fails in production; Enclii migration repair
adapter unavailable.

**Steps:**

1. Capture `prisma migrate status` output and PostgreSQL error.
2. Follow type-adaptive migration notes in repo (e.g. `product_tiers` repair).
3. Apply manual SQL only with reviewed script; resolve Prisma migration table.
4. Re-run migrate deploy through normal pipeline.

**Record:** Migration name, SQL summary, verification query, incident link.

### Raw Kubernetes / Helm deploy

**When:** Enclii and GitOps promotion paths are blocked; public surface at risk.

**Requirements:**

- Manual workflow: `deploy-enclii.yml`, `deploy-k8s.yml`, `deploy-web-k8s.yml`,
  or `deploy-admin-k8s.yml`
- `break_glass_ack=true` and incident/change reference (workflow enforced)

**Do not** use raw deploy for routine releases. Use
[Deployment Guide](../DEPLOYMENT.md) promotion path.

### ArgoCD hard refresh

**When:** Promote workflow succeeded but live digests lag ArgoCD source
( observed 2026-05-20 ).

**Break-glass:** Hard refresh `dhanam-services` Application, then run:

```bash
./scripts/production-rollout-proof.js
```

**Goal:** Eliminate this step via Phase 1 rollout truth work
([GA Remediation Roadmap](../GA_REMEDIATION_ROADMAP.md#phase-1--authoritative-rollout-truth-m3)).

### Kyverno policy waiver

**When:** Image verify policy blocks required rollout.

**Status:** `enclii ops policy waiver-plan --apply` adapter not wired (TD-1004).

**Break-glass:** Document waiver need; do not normalize manual cluster edits
without incident record.

### Staging tunnel routes

**When:** Staging hosts route to production namespace.

**Note:** `enclii junctions add` alone may target wrong namespace. Namespace-aware
apply is an Enclii adapter gap (TD-1002, TD-1004).

## Manual workflow gates

Production break-glass GitHub workflows require:

- Explicit incident or change reference
- `break_glass_ack=true`

See [Deployment Guide — workflows](../DEPLOYMENT.md).

## After break-glass

1. Run `scripts/production-preflight.sh` and full health check.
2. Update [Stability Wrap-Up](../STABILITY_WRAP_UP_2026-05-20.md) or tech debt
   if posture changed.
3. Open Enclii adapter gap or internal-devops follow-up so the next incident
   is Enclii-first.

## Related documents

- [Deployment Guide](../DEPLOYMENT.md)
- [GA Remediation Roadmap — Phase 2](../GA_REMEDIATION_ROADMAP.md#phase-2--enclii-first-operations)
- [Tech Debt TD-1004](../TECH_DEBT.md)
- [AGENTS.md](../../AGENTS.md)
