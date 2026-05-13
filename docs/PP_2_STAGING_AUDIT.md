# PP.2 — Dhanam staging audit vs RFC 0001

> [!IMPORTANT]
> MADFAM-ENCLII-FIRST-LEGACY-RAW v1: This document contains legacy raw infrastructure command examples.
> Routine production operations must use Enclii web, API, or CLI. Treat raw
> `kubectl`, `helm`, SSH, provider CLI/API, `docker exec`, and direct container
> access as platform bootstrap or documented break-glass only, and record any
> missing Enclii adapter gap.

> Last Updated: 2026-04-17
> RFC: [internal-devops/rfcs/0001-dev-staging-prod-pipeline.md](https://github.com/madfam-org/internal-devops/blob/main/rfcs/0001-dev-staging-prod-pipeline.md)
> Reference impl: [karafiel PP.1 — `infra/k8s/overlays/staging/`](https://github.com/madfam-org/karafiel/tree/main/infra/k8s/overlays/staging)
> Scope: audit only — this PR ships the document + a CLAUDE.md cross-reference; yaml/workflow convergence is **deferred** to PP.2b (see "Convergence actions" below).

## TL;DR

Dhanam already has a working staging pipeline: a `dhanam-staging` namespace,
a Kustomize layer that overrides replicas + `NODE_ENV`, and a
`deploy-staging.yml` workflow that runs on every push to `main`. **It is not
RFC 0001-compliant** in the ways that matter for the MXN-flywheel rollout:

1. Staging manifests are **duplicated** from production (`api-deployment.yaml`
   - `web-deployment.yaml` are copies, not references), rather than inheriting
     via `resources: [../production]` the way Karafiel does.
2. Staging images are pinned to the **mutable `:main` tag**, not a digest.
   "The image that passed staging" is not an identifiable artefact, which
   breaks the "one image, promoted" rule of RFC 0001 § "Three tiers, one
   image, two overlays".
3. There is **no promotion workflow**. `deploy-k8s.yml` (API),
   `deploy-web-k8s.yml`, and `deploy-admin-k8s.yml` each write digests
   directly into `infra/k8s/production/kustomization.yaml` on every push to
   `main`. Prod is therefore fed by CI builds, not by a promotion from staging.
4. `deploy-staging.yml` uses `kubectl apply -k` (push-based) instead of
   ArgoCD reconcile (pull-based). ArgoCD only watches `infra/k8s/production/`
   today (`infra/argocd/config.json`); there is no Application pointing at
   `infra/k8s/staging/`.
5. Admin is not in the staging kustomization at all — only api + web.

None of these are blockers for PP.2 (this audit). They are the work items
for PP.2b (Dhanam staging convergence) and PP.2c (promotion workflow).

## Current state vs RFC 0001 — row-by-row

| Area                              | RFC 0001 expects                                                                                              | Dhanam today                                                                                                                                                                                        | Status         | Resolution                                                                                                                                                                                                                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Layout**                        | `infra/k8s/base/` + `overlays/{staging,production}/`                                                          | `infra/k8s/production/` (canonical base) + `infra/k8s/staging/` (sibling, duplicated)                                                                                                               | Diverged       | PP.2b: convert `staging/` to overlay referencing `../production` (Karafiel pattern). Phase 1 = keep `production/` as canonical base, skip the eventual `base/` rename.                                                                                                                       |
| **Staging manifests**             | Overlay imports base + patches (replicas, env, ingress, secrets, HPA, digest)                                 | Self-contained manifests duplicated from prod                                                                                                                                                       | Diverged       | PP.2b: delete `api-deployment.yaml` + `web-deployment.yaml` + `namespace.yaml` from `staging/` once overlay is proven to render equivalent YAML (`kustomize build infra/k8s/staging/`).                                                                                                      |
| **Admin in staging**              | All three apps (api, web, admin) deploy to staging                                                            | Only api + web. Admin absent.                                                                                                                                                                       | Diverged       | PP.2b: add admin-deployment to staging overlay; `deploy-admin-k8s.yml` needs a sibling staging workflow or the overlay picks admin up via inheritance.                                                                                                                                       |
| **Image pinning**                 | Digest (`sha256:...`) patched into `overlays/staging/kustomization.yaml` by `build-and-deploy-staging.yml`    | `newTag: main` — **mutable tag**                                                                                                                                                                    | Diverged       | PP.2b: CI writes digest via `kustomize edit set image dhanam-{api,web,admin}=ghcr.io/.../@sha256:<digest>`, like Karafiel `staging-deploy-api.yml` does.                                                                                                                                     |
| **Promotion**                     | `promote-to-prod.yml` (`workflow_dispatch`) takes staging digest → writes to `overlays/production/`           | No promote workflow. `deploy-{k8s,web-k8s,admin-k8s}.yml` commit digest directly to `infra/k8s/production/kustomization.yaml` on push.                                                              | Diverged       | PP.2c (separate PR): add `promote-to-prod.yml`, remove the direct-to-prod digest commits. Pattern B (manual gate) — Dhanam is billing, mistakes are expensive.                                                                                                                               |
| **Rollback**                      | `rollback-prod.yml` workflow, RTO <5 min                                                                      | None. Revert commit + rebuild.                                                                                                                                                                      | Diverged       | PP.2c: add `rollback-prod.yml` with target-digest input.                                                                                                                                                                                                                                     |
| **ArgoCD staging Application**    | `dhanam-staging` App watches `infra/k8s/staging/`                                                             | Only `dhanam` prod App exists (`infra/argocd/config.json`)                                                                                                                                          | Diverged       | PP.2b (infra work): register `dhanam-staging` Application. Operator checklist in `internal-devops/runbooks/staging-bootstrap.md` §2.                                                                                                                                                         |
| **Deploy trigger mechanism**      | Commit digest → ArgoCD reconciles (pull)                                                                      | `kubectl apply -k` direct from GH Actions (push)                                                                                                                                                    | Diverged       | PP.2b: once the staging overlay exists + the staging ArgoCD App is registered, `deploy-staging.yml` should patch the digest and exit — ArgoCD takes over. Removes the `KUBECONFIG_STAGING` secret from the workflow.                                                                         |
| **Soak period before promote**    | ≥30 min in staging, validated by promote workflow                                                             | N/A — no promotion                                                                                                                                                                                  | Deferred       | PP.2c.                                                                                                                                                                                                                                                                                       |
| **Staging smoke test**            | Post-deploy smoke against `staging-<domain>/health`                                                           | `kubectl rollout status` only. No HTTP health check against the staging URL.                                                                                                                        | Diverged       | PP.2b: add curl-retry smoke step to `deploy-staging.yml` (Karafiel has the template — 6 retries × 20s). Surgical change, ~15 lines.                                                                                                                                                          |
| **Replica counts**                | 1 in staging vs 2-N in prod, HPAs disabled/capped                                                             | API+web=1, HPA min=1/max=2                                                                                                                                                                          | Aligned        | Keep as-is.                                                                                                                                                                                                                                                                                  |
| **Staging namespace**             | `<service>-staging`                                                                                           | `dhanam-staging`                                                                                                                                                                                    | Aligned        | Keep.                                                                                                                                                                                                                                                                                        |
| **Staging secrets**               | Separate `<service>-staging-secrets` secret                                                                   | `dhanam-secrets` in `dhanam-staging` namespace (name collision with prod secret name, lives in different namespace — works, but ambiguous)                                                          | Aligned enough | Document the deviation. Renaming secrets is an infra cutover; **out of scope** per PR instructions.                                                                                                                                                                                          |
| **Staging subdomain**             | `staging-<service>.<domain>` (e.g. `staging-api.dhan.am`)                                                     | No ingress in staging overlay today (deployments only, no `Ingress` resource). Staging appears to be namespace-internal for now.                                                                    | Diverged       | PP.2b: add `ingress-staging.yaml` patch pointing at `staging-api.dhan.am` + `staging.dhan.am`. Requires Cloudflare DNS + tunnel route (ops action).                                                                                                                                          |
| **External service sandbox**      | Test/sandbox keys (Stripe test, Resend test, Janua staging tenant) in staging secrets. **No PAC in staging.** | `secrets-template.yaml` in `infra/k8s/staging/` lists DB, Redis, encryption, OIDC, NextAuth, JWT only. Billing (Stripe/Paddle) + provider (Belvo/Plaid/Bitso) secrets **not declared for staging.** | Diverged       | PP.2b: expand staging `secrets-template.yaml` to cover every secret the overlay's pods reference. Operator then populates `dhanam-billing-secrets` + `dhanam-provider-secrets` for `dhanam-staging` namespace. Until then, staging pods will CrashLoop on missing billing/provider env vars. |
| **DB: nightly masked restore**    | Prod→staging DB refresh, PII-masked, 03:00 UTC                                                                | Not implemented. Staging DB is whatever the operator seeded manually.                                                                                                                               | Diverged       | RFC 0001 open question (masking tool choice). Out of scope for PP.2b. Track as separate infra work.                                                                                                                                                                                          |
| **Promotion pattern declaration** | `.enclii.yml` `promotion:` key (manual vs auto)                                                               | Not present in `.enclii.yml`.                                                                                                                                                                       | Diverged       | PP.2c: add `promotion: { pattern: manual, min_soak_minutes: 30, require_smoke_pass: true }` — Dhanam is Pattern B (billing = critical).                                                                                                                                                      |

## Summary

- **Aligned**: 3 rows (namespace convention, replica counts, secret namespacing workaround)
- **Diverged (in-scope for PP.2b)**: 8 rows (layout, manifests, admin coverage, image pinning, staging smoke, ArgoCD App, trigger mechanism, ingress, secrets-template completeness)
- **Diverged (in-scope for PP.2c — new PR)**: 3 rows (promote workflow, rollback workflow, `.enclii.yml` promotion key)
- **Deferred (out of scope for Phase 1)**: 2 rows (nightly masked DB restore, secret rename)

## What PP.2 (this PR) ships

Per user instructions "do NOT rewrite Dhanam's deploy pipeline wholesale":

1. **This audit document** (`docs/PP_2_STAGING_AUDIT.md`).
2. **CLAUDE.md update** with a "Deployment Pipeline" section cross-referencing RFC 0001 and listing the divergences above.
3. **No YAML or workflow changes.** The convergence work is scoped to follow-up PRs so each diff is reviewable and reversible:
   - **PP.2b** — Kustomize overlay structure + digest pinning + staging smoke + admin inclusion + ingress patch + expanded staging secrets template. ETA ~200 lines of yaml + ~30 lines of workflow edits.
   - **PP.2c** — Promote + rollback workflows + `.enclii.yml` promotion key + removal of direct-to-prod digest commits from `deploy-{k8s,web-k8s,admin-k8s}.yml`. ETA ~250 lines net (adds two new workflows, trims three existing ones).

This split keeps each PR reviewable and avoids accidentally breaking the
currently-working production deploy path during the structural move.

## Cross-references

- RFC 0001 — `internal-devops/rfcs/0001-dev-staging-prod-pipeline.md`
- Runbook — `internal-devops/runbooks/staging-bootstrap.md`
- Reference impl — `karafiel/infra/k8s/overlays/staging/kustomization.yaml` + `karafiel/.github/workflows/staging-deploy-api.yml` (PP.1)
- This PR — `feat/pp-2-dhanam-staging-audit`
- Follow-up PRs — PP.2b (structural convergence), PP.2c (promote/rollback workflows)
