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
> staging docs. The remaining blocker is operational ownership of
> namespace-aware Enclii tunnel route apply; staging itself is registered,
> synced, and smoke-tested.

## TL;DR

At the original 2026-04-17 audit, Dhanam had a partially duplicated staging
pipeline. As of 2026-05-20, the repo has converged on a production-derived
Kustomize overlay at `infra/k8s/overlays/staging/`, a `dhanam-staging` ArgoCD
Application, digest-pinned staging images, a live `enclii-dhanam-staging`
namespace, synced ExternalSecrets, and green API smoke. This follow-up source
landed full web/admin route smoke and staging API-origin proof, and hosted
`Deploy to Staging` run `26196989053` passed it for source `dd58fb39` before
committing staging digest refresh `7f7a0248`.

1. Staging manifests now inherit from production through
   `infra/k8s/overlays/staging/`.
2. Staging images are digest-pinned in git and newly built staging images are
   signed with GitHub Actions keyless cosign signatures.
3. Manual promote and rollback workflows exist; Dhanam remains a manual-gate
   service because it owns ecosystem billing.
4. The current desired path is GitOps: `deploy-staging.yml` patches the
   staging overlay digests and ArgoCD reconciles
   `infra/argocd/dhanam-staging-application.yaml`.
5. Admin is now included in the staging overlay.

The remaining work is no longer the original YAML convergence. It is repeated
proof plus an Enclii-owned operation for namespace-aware staging tunnel routes.

## Current state vs RFC 0001 — row-by-row

| Area                              | RFC 0001 expects                                                                                              | Dhanam today                                                                                                                                                                                                 | Status         | Resolution                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- | --------------------------------------------------------------------------------------------------- |
| **Layout**                        | `infra/k8s/base/` + `overlays/{staging,production}/`                                                          | `infra/k8s/production/` remains the canonical base and `infra/k8s/overlays/staging/` imports it.                                                                                                             | Aligned enough | Keep until the whole ecosystem is ready for a `base/` rename.                                       |
| **Staging manifests**             | Overlay imports base + patches (replicas, env, ingress, secrets, HPA, digest)                                 | Staging overlay imports production, patches env, caps replicas, disables HPAs, pins digests, and includes all three apps.                                                                                    | Aligned        | Validate with `kubectl kustomize infra/k8s/overlays/staging`.                                       |
| **Admin in staging**              | All three apps (api, web, admin) deploy to staging                                                            | API, web, and admin render in the staging overlay.                                                                                                                                                           | Aligned        | Keep admin in staging smoke once routes are live.                                                   |
| **Image pinning**                 | Digest (`sha256:...`) patched into `overlays/staging/kustomization.yaml` by CI                                | `deploy-staging.yml` patches digest-pinned API, web, and admin images and signs newly built digests.                                                                                                         | Aligned        | Keep staging digests reviewable in git; latest signed refresh is `7f7a0248` for source `dd58fb39`.  |
| **Promotion**                     | `promote-to-prod.yml` (`workflow_dispatch`) takes staging digest -> production                                | Manual promote workflow exists, verifies deploy-staging cosign signatures, requires a successful staging smoke run id unless break-glass is selected, and Dhanam remains Pattern B due billing blast radius. | Aligned        | Prefer promote workflow after a green staging smoke.                                                |
| **Rollback**                      | `rollback-prod.yml` workflow, RTO <5 min                                                                      | Rollback workflow exists.                                                                                                                                                                                    | Aligned        | Use workflow or Enclii rollback; raw `kubectl rollout undo` is break-glass only.                    |
| **ArgoCD staging Application**    | `dhanam-staging` App watches `infra/k8s/overlays/staging/`                                                    | Application is registered in `argocd`, targets `enclii-dhanam-staging`, and is Healthy/Synced at `7f7a0248`.                                                                                                 | Aligned        | Keep it reconciled by ArgoCD; do not reintroduce push-based `kubectl apply -k` from CI.             |
| **Deploy trigger mechanism**      | Commit digest -> ArgoCD reconciles (pull)                                                                     | Workflow patches digests; ArgoCD reconciles the staging overlay into `enclii-dhanam-staging`.                                                                                                                | Aligned        | Keep digest commits reviewable in git.                                                              |
| **Soak period before promote**    | >=30 min in staging, validated by promote workflow                                                            | `.enclii.yml` declares manual promotion with 30-minute minimum soak and smoke requirement.                                                                                                                   | Aligned        | Enforce once staging is externally reachable.                                                       |
| **Staging smoke test**            | Post-deploy smoke against `staging-<domain>/health`                                                           | Run `26196989053` built/signed all images for `dd58fb39`, patched digests as `7f7a0248`, and passed API, web, admin, and staging API-origin smoke.                                                           | Aligned        | Keep this hosted proof required before production promotion.                                        |
| **Replica counts**                | 1 in staging vs 2-N in prod, HPAs disabled/capped                                                             | Staging replicas render at 1 and HPAs are capped min=max=1.                                                                                                                                                  | Aligned        | Keep as-is.                                                                                         |
| **Staging namespace**             | Enclii-registered staging namespace                                                                           | `enclii-dhanam-staging` exists and is managed by the staging ArgoCD Application.                                                                                                                             | Aligned        | Do not create a parallel legacy `dhanam-staging` namespace.                                         |
| **Staging secrets**               | Separate staging-scoped secrets/secret paths                                                                  | Four staging ExternalSecrets are synced in `enclii-dhanam-staging`.                                                                                                                                          | Aligned        | Keep values staging-scoped; never copy prod credentials.                                            |
| **Staging subdomain**             | `staging-<service>.<domain>` (e.g. `staging-api.dhan.am`)                                                     | DNS/custom-domain verification exists and hosted smoke passes for `staging-api.dhan.am`, `staging.dhan.am`, and `staging-admin.dhan.am` with staging API-origin proof.                                       | Aligned        | Keep namespace-aware routes healthy and require hosted smoke to pass.                               |
| **External service sandbox**      | Test/sandbox keys (Stripe test, Resend test, Janua staging tenant) in staging secrets. **No PAC in staging.** | Staging ExternalSecrets cover core, billing, provider, and Janua secrets under staging Vault paths.                                                                                                          | Aligned        | Audit values periodically; never copy prod credentials.                                             |
| **DB: nightly masked restore**    | Prod→staging DB refresh, PII-masked, 03:00 UTC                                                                | Not implemented. Staging DB is whatever the operator seeded manually.                                                                                                                                        | Diverged       | RFC 0001 open question (masking tool choice). Out of scope for PP.2b. Track as separate infra work. |
| **Promotion pattern declaration** | `.enclii.yml` `promotion:` key (manual vs auto)                                                               | Present: manual promotion, 30-minute minimum soak, smoke required.                                                                                                                                           | Aligned        | Keep as policy record.                                                                              |

## Summary

- **Aligned or aligned enough**: layout, manifests, admin coverage, image
  pinning/signing, promotion signature validation, rollback workflows,
  promotion policy, replica counts.
- **Partially aligned**: namespace-aware tunnel route ownership remains an
  Enclii adapter gap even though current hosted smoke passes.
- **Blocked operationally**: Enclii-owned namespace-aware tunnel route apply.
- **Deferred**: nightly prod-to-staging masked DB refresh.

## What Remains

1. Add Enclii namespace-aware tunnel route apply for staging hosts.
2. Keep hosted staging API/web/admin smoke required for promotion.
3. Collect repeated staging deploy and manual promotion evidence.

## Cross-references

- RFC 0001 — `internal-devops/rfcs/0001-dev-staging-prod-pipeline.md`
- Runbook — `internal-devops/runbooks/staging-bootstrap.md`
- Reference impl — `karafiel/infra/k8s/overlays/staging/kustomization.yaml` + `karafiel/.github/workflows/staging-deploy-api.yml` (PP.1)
- This PR — `feat/pp-2-dhanam-staging-audit`
- Follow-up PRs — PP.2b (structural convergence), PP.2c (promote/rollback workflows)
