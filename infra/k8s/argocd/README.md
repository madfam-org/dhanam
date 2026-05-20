# ArgoCD GitOps for Dhanam

## Overview

ArgoCD provides GitOps-based continuous delivery for Dhanam's Kubernetes deployments. It watches the `infra/k8s/production/` directory on the `main` branch and automatically syncs cluster state to match.

## How It Works

1. **CI builds images** and updates digests in `infra/k8s/production/kustomization.yaml`
2. **CI commits** the digest change to `main`
3. **ArgoCD detects** the git change (polls every 3 minutes or via webhook)
4. **ArgoCD applies** the kustomize output to the `dhanam` namespace
5. **Self-heal** ensures manual cluster changes are reverted to match git

## Application CRD

`application.yaml` defines the ArgoCD Application resource with:

- **Source**: `infra/k8s/production/` on `main` branch
- **Destination**: `dhanam` namespace on the local cluster
- **Sync policy**: Auto-sync with prune and self-heal enabled
- **Retry**: 3 attempts with exponential backoff

## UI Access

ArgoCD UI is available at the cluster's ArgoCD ingress (typically `https://argocd.<cluster-domain>`). Use the ArgoCD admin credentials to view sync status, diffs, and deployment history.

## Manual Operations

```bash
# Check sync status
argocd app get dhanam

# Force sync
argocd app sync dhanam

# View diff without applying
argocd app diff dhanam

# Rollback to previous revision
argocd app rollback dhanam <revision>
```

## Staging

The staging environment is defined by `infra/k8s/overlays/staging/` and the
`infra/argocd/dhanam-staging-application.yaml` Application. It targets the
Enclii-registered namespace `enclii-dhanam-staging`; do not use the old
`infra/k8s/staging/` path or the legacy `dhanam-staging` namespace for new
work.
