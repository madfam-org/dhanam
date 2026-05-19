# ADR-005: Enclii Deployment Platform

## Status

**Accepted** - January 2025

## Context

Dhanam requires a deployment platform that supports:

1. **Auto-Deployment**: Push to main → automatic deploy
2. **Zero-Downtime**: Financial app cannot have deployment interruptions
3. **Scalability**: Handle traffic spikes during market hours
4. **Cost Efficiency**: Predictable costs for a startup
5. **Observability**: Logs, metrics, and traces for debugging
6. **MADFAM Integration**: Work with Janua auth and shared infrastructure

Options considered:

1. **Vercel**: Great DX, expensive at scale, limited backend support
2. **Railway**: Simple, good pricing, limited control
3. **AWS ECS/Fargate**: Full control, complex setup
4. **Kubernetes (self-managed)**: Maximum control, high operational overhead
5. **Enclii**: MADFAM's deployment platform, bare-metal K8s

## Decision

Use **Enclii** (MADFAM's internal deployment platform) for all production deployments.

### Why Enclii

1. **MADFAM Ecosystem Alignment**
   - Same platform as other MADFAM products
   - Shared infrastructure costs
   - Integrated with Janua for authentication
   - Unified monitoring and alerting

2. **Bare-Metal Kubernetes Performance**
   - No cloud provider abstraction overhead
   - Direct hardware access for consistent performance
   - Cost predictability (no variable cloud pricing)
   - Better latency for LATAM users (Mexico-based infrastructure)

3. **Developer Experience**
   - Explicit service specs in `infra/enclii/services/`
   - Compatibility `.enclii.yml` for the web service
   - GitHub integration for auto-deploy
   - Preview environments for PRs
   - Built-in secrets management

4. **Financial App Requirements**
   - Zero-downtime rolling deployments
   - Horizontal pod autoscaling
   - Database connection pooling
   - Redis for session/cache

### Architecture

```
GitHub Main Branch
        │
        ▼ (push event)
┌─────────────────────────────────────────────────────┐
│                  Enclii Platform                     │
│              (Bare-Metal Kubernetes)                 │
├─────────────────────────────────────────────────────┤
│  1. Build Phase                                     │
│     └── Docker build from Dockerfile                │
│     └── Push to internal registry                   │
│                                                     │
│  2. Deploy Phase                                    │
│     └── Rolling update (zero-downtime)              │
│     └── Health checks before traffic switch         │
│     └── Automatic rollback on failure               │
│                                                     │
│  3. Runtime                                         │
│     └── HPA (Horizontal Pod Autoscaler)            │
│     └── Ingress with TLS termination               │
│     └── Internal service mesh                       │
└─────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────┐
│              Production Services                     │
├─────────────────────────────────────────────────────┤
│  api.dhan.am     → NestJS API (3 replicas min)     │
│  app.dhan.am     → Next.js Web (2 replicas min)    │
│  admin.dhan.am  → Admin Dashboard (1 replica)      │
└─────────────────────────────────────────────────────┘
```

### Configuration

Service-level Enclii specs live in `infra/enclii/services/`:

- `dhanam-web.yaml` builds `apps/web/Dockerfile` and serves `app.dhan.am`, `dhan.am`, and `www.dhan.am`.
- `dhanam-api.yaml` builds `apps/api/Dockerfile` and serves `api.dhan.am`.
- `dhanam-admin.yaml` builds `apps/admin/Dockerfile` and serves `admin.dhan.am`.

The root `.enclii.yml` is retained as the compatibility entrypoint for Enclii's single-file deploy flow and mirrors `dhanam-web.yaml`. The root `enclii.yaml` is the domain/status manifest, not a service reconciliation input.

Use Enclii-first service reconciliation when metadata drifts:

```bash
enclii services-sync --dir infra/enclii/services --project dhanam --reconcile-existing --dry-run
enclii services-sync --dir infra/enclii/services --project dhanam --reconcile-existing
```

### Deployment Flow

```
1. Developer pushes to main branch
2. GitHub webhook triggers Enclii pipeline
3. Enclii builds Docker images
4. Images pushed to internal registry
5. Rolling deployment starts
   - New pods created (canary)
   - Health checks pass
   - Traffic gradually shifted
   - Old pods terminated
6. Deployment complete
7. Slack notification sent
```

### CI/CD Integration

GitHub Actions handle pre-deploy validation:

- `ci.yml`: Lint, type-check, unit tests
- `test-coverage.yml`: Coverage thresholds
- `check-migrations.yml`: Database migration validation

Enclii handles actual deployment (triggered after CI passes).

### Secrets Management

```bash
# Enclii CLI for secrets
enclii secrets set JANUA_API_KEY=xxx --service=api
enclii secrets set DATABASE_URL=xxx --service=api
enclii secrets set PLAID_SECRET=xxx --service=api
```

Secrets are:

- Encrypted at rest
- Injected as environment variables
- Not visible in logs or UI
- Audited for access

## Consequences

### Positive

- **Simplicity**: Single command deploy, no complex cloud configuration
- **Performance**: Bare-metal K8s, no cloud abstraction overhead
- **Cost Predictability**: Fixed infrastructure cost, no surprise bills
- **Integration**: Native Janua auth, shared monitoring
- **Control**: Full access to underlying infrastructure if needed

### Negative

- **Vendor Lock-in**: Tied to MADFAM infrastructure
- **Limited Regions**: Currently only mx-central (expanding)
- **Ecosystem**: Smaller than AWS/GCP (fewer integrations)
- **Documentation**: Internal docs, smaller community

### Mitigations

- Terraform configs in `infra/terraform/` for AWS fallback
- Docker-based deployments are portable
- Standard Kubernetes manifests exportable
- Disaster recovery plan includes cloud failover

## Monitoring & Observability

Enclii provides:

- **Logs**: Structured JSON logs, 30-day retention
- **Metrics**: Prometheus-compatible, Grafana dashboards
- **Traces**: OpenTelemetry integration
- **Alerts**: PagerDuty/Slack integration

```typescript
// Structured logging in NestJS
this.logger.log({
  event: 'transaction_sync_complete',
  userId: user.id,
  provider: 'belvo',
  transactionCount: 150,
  durationMs: 2340,
});
```

## Related Decisions

- [ADR-001](./001-nestjs-fastify.md): NestJS containerization
- [ADR-004](./004-janua-auth-integration.md): Janua auth (same infrastructure)

## References

- [Enclii Documentation](https://docs.enclii.com) (internal)
- [Kubernetes Deployment Best Practices](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- `.enclii.yml` in project root
- `infra/enclii/services/`
