# Incident: dhanam-web prod rollout lag (2026-06-15)

> **Status:** Resolved  
> **Severity:** P2 (marketing copy not live after promote)  
> **Change:** PR [#568](https://github.com/madfam-org/dhanam/pull/568) — Spanish hero `Sabe` → `Descubre`  
> **Operator runbook:** [BREAK_GLASS.md](../BREAK_GLASS.md) — ArgoCD hard refresh

---

## Summary

`promote-to-prod.yml` succeeded and updated `infra/k8s/production/kustomization.yaml`
with web digest `sha256:f57893bcb4098ef5957cd64c5dfe74c4ec669655999af88ee8a5dfe4c3a52c8b`,
but **https://dhan.am/es continued serving the old headline** (“Sabe hacia dónde va…”)
until ArgoCD `dhanam-services` was hard-refreshed and `dhanam-web` rolled out.

Git was correct; the cluster had not adopted the new digest despite ArgoCD reporting
**Synced** on an older revision until refresh.

---

## User-visible impact

- Spanish landing hero unchanged for ~15 minutes after prod promote
- English and other landing content from Phases A–G were already live from earlier promotes

---

## Root cause (two layers)

### Layer 1 — Post-promote workflow not auto-triggered

The promote job commits and pushes to `main` using `GITHUB_TOKEN`. GitHub Actions
**does not trigger downstream workflows** on pushes made by `GITHUB_TOKEN`.

`prod-post-promote.yml` is designed to run on that push but was **skipped** for
commit `f5f4cee2`. Manual `workflow_dispatch` (run **27577844509**) was required.

### Layer 2 — ArgoCD stale sync + GHA cluster unreachable

After manual post-promote:

- Enclii lifecycle callback succeeded
- `argocd-refresh-best-effort` job could not reach the cluster API from GitHub-hosted runners
- ArgoCD Application `dhanam-services` showed **Synced** while `dhanam-web` pods still ran
  digest `sha256:43bbc533…` (previous prod web)

Hard refresh from operator kubeconfig (`~/.kube/config-hetzner`) moved Argo to revision
`f5f4cee2` and triggered rollout to `sha256:f57893bc…`.

---

## Resolution timeline (2026-06-15 UTC)

1. **21:21** — #568 merged; staging deploy run **27577241820** SUCCESS
2. **21:27** — Promote run **27577545018** SUCCESS → `f5f4cee2`
3. **21:33** — Manual post-promote run **27577844509** SUCCESS (Enclii callback; GHA kubectl skipped)
4. **~21:35** — Hard refresh `dhanam-services`; `dhanam-web` rollout complete
5. **~21:36** — https://dhan.am/es verified: **“Descubre hacia dónde va tu dinero…”**

---

## Verification (post-fix)

```bash
curl -fsSL https://dhan.am/es | grep -o 'Descubre hacia dónde va tu dinero'

export KUBECONFIG=~/.kube/config-hetzner
kubectl -n dhanam get deployment dhanam-web \
  -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'
# ghcr.io/madfam-org/dhanam/web@sha256:f57893bcb4098ef5957cd64c5dfe74c4ec669655999af88ee8a5dfe4c3a52c8b
```

---

## Follow-up actions

| Priority | Action                                                                                           | Owner    |
| -------- | ------------------------------------------------------------------------------------------------ | -------- |
| P1       | Trigger post-promote via `workflow_run` on promote completion, or use PAT for promote push       | Platform |
| P2       | Document mandatory post-promote dispatch in [DEPLOYMENT.md](../../DEPLOYMENT.md) promote section | Platform |
| P2       | Enable rollout proof on ARC (`ENCLII_ROLLOUT_PROOF_ENABLED`, Enclii CLI)                         | Platform |
| P3       | Compare live pod digest in promote workflow summary (automated)                                  | Platform |

---

## Lessons learned

1. **Promote ≠ live** — Always verify running pod digest vs manifest after Pattern B promote.
2. **Argo Synced can lie** — Hard refresh when git revision advanced but pods did not roll.
3. **GITHUB_TOKEN push gap** — Post-promote must be explicit until trigger is fixed.
4. **Enclii-first** — Lifecycle callback alone did not roll pods; Argo refresh was still required.

---

**Documented:** 2026-06-15  
**Session handoff:** [SESSION_WRAP_UP_2026-06-15.md](../../SESSION_WRAP_UP_2026-06-15.md)
