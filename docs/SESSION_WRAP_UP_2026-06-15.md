# Session Wrap-Up — 2026-06-15

**Repos touched:** `madfam-org/dhanam`, `madfam-org/janua`  
**Operator focus:** Dhanam landing program execution, Spanish copy go-live, Janua website prod rollout closure  
**Read next session with:** [LANDING_REMEDIATION.md](LANDING_REMEDIATION.md), [DEPLOYMENT.md](DEPLOYMENT.md), [runbooks/BREAK_GLASS.md](runbooks/BREAK_GLASS.md)

---

## Executive summary

This session shipped the full **Dhanam landing remediation program (Phases A–G)** to production, fixed and deployed **Spanish hero copy** (PR #568), and closed **Janua website** production rollout (Tailwind v4 + Phase 2–3 UX).

Both products hit the same operational pattern: **git and GHCR were correct before the cluster rolled**. Production required explicit **ArgoCD hard refresh** (Dhanam) or **GHCR credential rotation + rollout** (Janua).

---

## Dhanam — production state (verified 2026-06-15)

| Surface      | URL                        | Status                                                |
| ------------ | -------------------------- | ----------------------------------------------------- |
| Landing (ES) | https://dhan.am/es         | Live — hero: **“Descubre hacia dónde va tu dinero…”** |
| Landing (EN) | https://dhan.am/en         | Live — Phases A–G shipped                             |
| App          | https://app.dhan.am        | Unchanged routing (auth/dashboard)                    |
| API          | https://api.dhan.am/health | Healthy                                               |
| Admin        | https://admin.dhan.am      | On prod manifest digests                              |

**Git:** `main` @ `f5f4cee2` — `deploy(prod): promote 2356f6e`

**Production digests** (`infra/k8s/production/kustomization.yaml`):

| Service      | Digest                                                                    |
| ------------ | ------------------------------------------------------------------------- |
| dhanam-web   | `sha256:f57893bcb4098ef5957cd64c5dfe74c4ec669655999af88ee8a5dfe4c3a52c8b` |
| dhanam-api   | `sha256:296485c1b24201994bfefc25428726d1ace9f0f2b2172b8d9011ed815e46aa27` |
| dhanam-admin | `sha256:45b85897626332c3f5fd5331db7256b9938c99d7869da9ef84b14b0e995633e9` |

**ArgoCD:** Application `dhanam-services` — `Healthy` / `Synced` on `main` @ `f5f4cee2`

**Quick verify:**

```bash
curl -fsSL https://dhan.am/es | grep -o 'Descubre hacia dónde va tu dinero'
curl -fsSL https://dhan.am/en | grep -o 'Know where your money'
```

---

## Dhanam — landing program status

Canonical plan: [LANDING_REMEDIATION.md](LANDING_REMEDIATION.md)  
Design tokens: [LANDING_DESIGN_SYSTEM.md](LANDING_DESIGN_SYSTEM.md)

| Phase    | Scope                          | PR   | Prod promote |
| -------- | ------------------------------ | ---- | ------------ |
| A        | Foundation, SSR, dedupe, OG    | #547 | Yes          |
| B        | Hero, nav, tokens, trust strip | #547 | Yes          |
| C        | Product scroll story           | #548 | Yes          |
| D        | Persona cards + avatars        | #549 | Yes          |
| E        | Social proof, trust, logos     | #550 | Yes          |
| F        | Conversion / pricing polish    | #551 | Yes          |
| G        | A11y, fonts, scroll analytics  | #552 | Yes          |
| Copy fix | ES hero `Sabe` → `Descubre`    | #568 | Yes          |

**Program status:** Phases A–G and ES hero copy are **live on production**. Remaining work is polish and proof, not core IA:

- ES / PT copy review (native speaker pass on new strings)
- Dashboard screenshots for scroll-story chapters (Phase C assets)
- Partner SVG logos + testimonial consent (Phase E assets)
- Visual regression baseline refresh after font swap (Phase G)
- Staging web smoke gap (`staging.dhan.am` may lag prod — known RFC 0001 item)

---

## Dhanam — deploy timeline (2026-06-15, Spanish copy)

1. **#568 merged** — `c60776fc` / merge `9c7f73b8` — i18n hero fix
2. **Staging** — workflow `Deploy to Staging` run **27577241820** — SUCCESS
3. **Promote** — workflow `Promote staging -> prod` run **27577545018** — web only — SUCCESS → commit `f5f4cee2`
4. **Post-promote** — run **27577844509** (manual `workflow_dispatch`) — manifest proof + Enclii callback OK; **GHA kubectl unreachable**
5. **Cluster reconcile** — hard refresh `dhanam-services` via local `KUBECONFIG=~/.kube/config-hetzner`; `dhanam-web` rolled to `f57893bc…`
6. **Verified** — https://dhan.am/es serves **Descubre…**

Incident write-up: [runbooks/incidents/2026-06-15-dhanam-web-prod-rollout.md](runbooks/incidents/2026-06-15-dhanam-web-prod-rollout.md)

---

## Janua — production state (verified 2026-06-15)

**Git:** `main` @ `53e7867e` (clean)

**Live:** https://janua.dev — styled marketing site with Phase 2–3 UX (Sora/DM Sans, brand tokens, legal pages, honest blog)

**ArgoCD app name:** `janua-services` (not `janua`)

**Incident + runbook:**

- [janua/docs/runbooks/incidents/2026-06-15-janua-website-prod-rollout.md](../../janua/docs/runbooks/incidents/2026-06-15-janua-website-prod-rollout.md)
- [janua/docs/runbooks/production-gitops-reconcile.md](../../janua/docs/runbooks/production-gitops-reconcile.md)

**Merged this session (Janua):** #419 (Tailwind v4), #420–#422 (promote/sync hardening), #423 (Phase 2–3 UX), #424 (CI ECR mirrors)

---

## Known platform gaps (carry forward)

| ID       | Gap                                                                                            | Impact                                            | Mitigation today                                                                           |
| -------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| TD-1004  | `promote-to-prod` pushes via `GITHUB_TOKEN` do **not** trigger `prod-post-promote.yml` on push | Post-promote skipped; cluster may lag git         | **Always** dispatch `prod-post-promote.yml` after promote, or hard-refresh Argo            |
| TD-1004  | `KUBECONFIG_PRODUCTION` unreachable from GitHub-hosted runners                                 | Argo refresh job in CI is no-op                   | Use local/ARC kubeconfig or Enclii `ops apps sync dhanam-services`                         |
| TD-1004  | ArgoCD can report **Synced** while pods still run old digest                                   | False confidence after promote                    | Run `scripts/production-rollout-proof.js dhanam-services` or compare pod image to manifest |
| RFC 0001 | Staging web/admin smoke incomplete                                                             | `staging.dhan.am` not authoritative for marketing | Use prod curl checks after promote                                                         |
| Catalog  | `prod-post-promote` catalog drift gate fails (informational)                                   | Non-blocking                                      | Run catalog sync when Production env secrets configured                                    |

---

## Operator cheat sheet — next promote

Pattern B manual gate (`min_soak_minutes: 30`, `require_smoke_pass: true`).

```bash
# 1. Confirm staging smoke run id from latest green "Deploy to Staging" on main
gh run list --workflow deploy-staging.yml --branch main --limit 3

# 2. Promote (component: all | api | web | admin)
gh workflow run promote-to-prod.yml \
  -f component=web \
  -f staging_smoke_run_id=<RUN_ID> \
  -f reason="..."

# 3. REQUIRED: post-promote (GITHUB_TOKEN push does not auto-trigger this)
gh workflow run prod-post-promote.yml \
  -f reason="Reconcile after promote ..."

# 4. If live site lags git, hard refresh Argo (break-glass)
export KUBECONFIG=~/.kube/config-hetzner   # or operator kubeconfig
kubectl -n argocd annotate application dhanam-services \
  argocd.argoproj.io/refresh=hard --overwrite
kubectl -n dhanam rollout status deployment/dhanam-web --timeout=300s

# 5. Proof
node scripts/production-rollout-proof.js dhanam-services
curl -fsSL https://dhan.am/es | grep -o 'Descubre hacia'
```

---

## Suggested next-session picks

**Product / landing (Dhanam)**

1. ES/PT copy review for all new landing strings (not just hero)
2. Capture Phase C dashboard screenshots; wire into scroll story
3. Phase E assets — partner logos, testimonials with consent
4. Playwright visual regression baseline after Fraunces/DM Sans (Phase G)
5. PMF widget re-enable when `@madfam/pmf-widget` publishes (see AGENTS.md)

**Platform / stability**

1. Fix post-promote trigger: use `workflow_run` on `promote-to-prod` completion, or PAT push, so reconcile is automatic
2. Wire `ENCLII_ROLLOUT_PROOF_ENABLED=true` + Enclii CLI on ARC runners
3. Staging web smoke in `deploy-staging.yml` for marketing routes
4. Commercial GA G2 proof ([COMMERCIAL_GA_EXECUTION.md](COMMERCIAL_GA_EXECUTION.md))

**Janua**

1. Add `GHCR_PAT` / `madfam-bot` to janua repo for reliable GHCR pulls (see Janua incident follow-ups)
2. Mirror Dhanam `prod-post-promote.yml` pattern on janua repo

---

## Files created or updated this session

| File                                                            | Purpose                                |
| --------------------------------------------------------------- | -------------------------------------- |
| `docs/LANDING_REMEDIATION.md`                                   | Canonical landing program (phases A–G) |
| `docs/LANDING_DESIGN_SYSTEM.md`                                 | Typography, tokens, components         |
| `docs/SESSION_WRAP_UP_2026-06-15.md`                            | This handoff                           |
| `docs/runbooks/incidents/2026-06-15-dhanam-web-prod-rollout.md` | Dhanam stale-Argo incident             |
| `packages/shared/src/i18n/es/landing.ts`                        | ES hero copy (#568)                    |
| `docs/README.md`, `docs/DEVELOPMENT.md`, `llms.txt`             | Index links to landing docs            |

---

**Documented:** 2026-06-15
