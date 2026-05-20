# PP.2 — Dhanam staging audit vs RFC 0001

> [!IMPORTANT]
> MADFAM-ENCLII-FIRST-LEGACY-RAW v1: This document contains legacy raw infrastructure command examples.
> Routine production operations must use Enclii web, API, or CLI. Treat raw
> `kubectl`, `helm`, SSH, provider CLI/API, `docker exec`, and direct container
> access as platform bootstrap or documented break-glass only, and record any
> missing Enclii adapter gap.

> Last Updated: 2026-05-20
> RFC: [internal-devops/rfcs/0001-dev-staging-prod-pipeline.md](https://github.com/madfam-org/internal-devops/blob/main/rfcs/0001-dev-staging-prod-pipeline.md)
> Reference impl: [karafiel PP.1 — `infra/k8s/overlays/staging/`](https://github.com/madfam-org/karafiel/tree/main/infra/k8s/overlays/staging)
> Scope: historical audit with current status notes. PP.2b/PP.2c have since
> added the staging overlay, digest pinning, promote/rollback workflows, and
> staging docs. The remaining blockers are operational: ArgoCD registration,
> staging Vault/ESO values, and namespace-aware Enclii tunnel routes.

## TL;DR

At the original 2026-04-17 audit, Dhanam had a partially duplicated staging
pipeline. As of 2026-05-20, the repo has converged on a production-derived
Kustomize overlay at `infra/k8s/overlays/staging/`, a `dhanam-staging` ArgoCD
Application manifest, and digest-pinned staging images. The in-cluster
staging environment is still not live because the Application and
`enclii-dhanam-staging` namespace are not registered and staging tunnel routes
need a namespace-aware Enclii adapter. Enclii project metadata does include a
`staging` environment mapped to `enclii-dhanam-staging`; the missing piece is
the in-cluster ArgoCD Application/namespace/resources.

1. Staging manifests now inherit from production through
   `infra/k8s/overlays/staging/`.
2. Staging images are digest-pinned in git and newly built staging images are
   signed with GitHub Actions keyless cosign signatures.
3. Manual promote and rollback workflows exist; Dhanam remains a manual-gate
   service because it owns ecosystem billing.
4. The current desired path is GitOps: `deploy-staging.yml` patches the
   staging overlay digests and ArgoCD reconciles. The missing piece is
   registering `infra/argocd/dhanam-staging-application.yaml`.
5. Admin is now included in the staging overlay.

The remaining work is no longer the original YAML convergence. It is the
operational bootstrap needed to make the already-renderable staging tier live.

## Current state vs RFC 0001 — row-by-row

| Area                              | RFC 0001 expects                                                                                              | Dhanam today                                                                                                                                                                                                 | Status            | Resolution                                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Layout**                        | `infra/k8s/base/` + `overlays/{staging,production}/`                                                          | `infra/k8s/production/` remains the canonical base and `infra/k8s/overlays/staging/` imports it.                                                                                                             | Aligned enough    | Keep until the whole ecosystem is ready for a `base/` rename.                                                                                 |
| **Staging manifests**             | Overlay imports base + patches (replicas, env, ingress, secrets, HPA, digest)                                 | Staging overlay imports production, patches env, caps replicas, disables HPAs, pins digests, and includes all three apps.                                                                                    | Aligned           | Validate with `kubectl kustomize infra/k8s/overlays/staging`.                                                                                 |
| **Admin in staging**              | All three apps (api, web, admin) deploy to staging                                                            | API, web, and admin render in the staging overlay.                                                                                                                                                           | Aligned           | Keep admin in staging smoke once routes are live.                                                                                             |
| **Image pinning**                 | Digest (`sha256:...`) patched into `overlays/staging/kustomization.yaml` by CI                                | `deploy-staging.yml` patches digest-pinned API, web, and admin images and signs newly built digests.                                                                                                         | Aligned           | Keep staging digests reviewable in git; recent signed refreshes include `18fb956d`.                                                           |
| **Promotion**                     | `promote-to-prod.yml` (`workflow_dispatch`) takes staging digest -> production                                | Manual promote workflow exists, verifies deploy-staging cosign signatures, requires a successful staging smoke run id unless break-glass is selected, and Dhanam remains Pattern B due billing blast radius. | Aligned           | Prefer promote workflow after a green staging smoke.                                                                                          |
| **Rollback**                      | `rollback-prod.yml` workflow, RTO <5 min                                                                      | Rollback workflow exists.                                                                                                                                                                                    | Aligned           | Use workflow or Enclii rollback; raw `kubectl rollout undo` is break-glass only.                                                              |
| **ArgoCD staging Application**    | `dhanam-staging` App watches `infra/k8s/overlays/staging/`                                                    | Application manifest exists but is not registered in-cluster.                                                                                                                                                | Blocked           | Register `infra/argocd/dhanam-staging-application.yaml` after staging Vault/ESO values and namespace-aware tunnel routes are ready.           |
| **Deploy trigger mechanism**      | Commit digest -> ArgoCD reconciles (pull)                                                                     | Workflow patches digests and expects ArgoCD reconcile, but the staging Application is missing.                                                                                                               | Partially aligned | Register the Application; do not reintroduce push-based `kubectl apply -k` from CI.                                                           |
| **Soak period before promote**    | >=30 min in staging, validated by promote workflow                                                            | `.enclii.yml` declares manual promotion with 30-minute minimum soak and smoke requirement.                                                                                                                   | Aligned           | Enforce once staging is externally reachable.                                                                                                 |
| **Staging smoke test**            | Post-deploy smoke against `staging-<domain>/health`                                                           | Workflow has an HTTP smoke target, but the target is blocked by missing staging app/namespace/tunnel routes.                                                                                                 | Blocked           | Bring staging namespace, secrets, ArgoCD app, and tunnel routes live.                                                                         |
| **Replica counts**                | 1 in staging vs 2-N in prod, HPAs disabled/capped                                                             | Staging replicas render at 1 and HPAs are capped min=max=1.                                                                                                                                                  | Aligned           | Keep as-is.                                                                                                                                   |
| **Staging namespace**             | Enclii-registered staging namespace                                                                           | Enclii records `staging -> enclii-dhanam-staging`, but the namespace is not present in-cluster until the ArgoCD Application is registered or Enclii creates it.                                              | Partially aligned | Register `infra/argocd/dhanam-staging-application.yaml`; do not create a parallel legacy `dhanam-staging` namespace.                          |
| **Staging secrets**               | Separate staging-scoped secrets/secret paths                                                                  | Repo keeps K8s target names (`dhanam-secrets`, `dhanam-billing-secrets`, etc.) but reads staging Vault/ESO paths under `secret/dhanam/staging*` in `enclii-dhanam-staging`.                                  | Partially aligned | Populate staging Vault/ESO values through Enclii/Lockbox/Vault before registering the app. Raw Secret applies are bootstrap/break-glass only. |
| **Staging subdomain**             | `staging-<service>.<domain>` (e.g. `staging-api.dhan.am`)                                                     | DNS/custom-domain verification exists for staging hosts, but Enclii junctions currently route to production namespace services.                                                                              | Blocked           | Add a namespace-aware Enclii tunnel-route adapter targeting `*.enclii-dhanam-staging.svc.cluster.local`.                                      |
| **External service sandbox**      | Test/sandbox keys (Stripe test, Resend test, Janua staging tenant) in staging secrets. **No PAC in staging.** | Staging template and ExternalSecrets cover core, billing, provider, and Janua secrets under staging Vault paths. Values still need to be populated.                                                          | Partially aligned | Populate staging Vault/ESO values; never copy prod credentials.                                                                               |
| **DB: nightly masked restore**    | Prod→staging DB refresh, PII-masked, 03:00 UTC                                                                | Not implemented. Staging DB is whatever the operator seeded manually.                                                                                                                                        | Diverged          | RFC 0001 open question (masking tool choice). Out of scope for PP.2b. Track as separate infra work.                                           |
| **Promotion pattern declaration** | `.enclii.yml` `promotion:` key (manual vs auto)                                                               | Present: manual promotion, 30-minute minimum soak, smoke required.                                                                                                                                           | Aligned           | Keep as policy record.                                                                                                                        |

## Summary

- **Aligned or aligned enough**: layout, manifests, admin coverage, image
  pinning/signing, promotion signature validation, rollback workflows,
  promotion policy, replica counts.
- **Partially aligned**: deploy trigger, namespace, staging secrets.
- **Blocked operationally**: staging ArgoCD registration, HTTP smoke, and
  namespace-aware tunnel routes.
- **Deferred**: nightly prod-to-staging masked DB refresh.

## What Remains

1. Populate staging Vault/ESO values under `secret/dhanam/staging*`.
2. Register `infra/argocd/dhanam-staging-application.yaml`.
3. Add Enclii namespace-aware tunnel routes for staging hosts.
4. Re-run staging deploy smoke and then use the manual promotion gate.

## Cross-references

- RFC 0001 — `internal-devops/rfcs/0001-dev-staging-prod-pipeline.md`
- Runbook — `internal-devops/runbooks/staging-bootstrap.md`
- Reference impl — `karafiel/infra/k8s/overlays/staging/kustomization.yaml` + `karafiel/.github/workflows/staging-deploy-api.yml` (PP.1)
- This PR — `feat/pp-2-dhanam-staging-audit`
- Follow-up PRs — PP.2b (structural convergence), PP.2c (promote/rollback workflows)
