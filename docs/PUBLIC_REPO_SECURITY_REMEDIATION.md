# Public Repository Security Remediation

Last updated: 2026-05-23

Dhanam is a **public** repository. This program removes sensitive MADFAM
operational data from git, relocates operator intelligence to private surfaces,
and prevents regression via CI guards.

**Related:** [GA Remediation Roadmap](GA_REMEDIATION_ROADMAP.md) Phase 7 (G4),
[Tech Debt TD-1012](TECH_DEBT.md), [SECURITY.md](../SECURITY.md).

## Problem statement

The repo currently mixes three layers that must stay separate:

| Layer                                                     | Public git | Private ops / admin runtime               |
| --------------------------------------------------------- | ---------- | ----------------------------------------- |
| Product code (API, web, billing)                          | Yes        | —                                         |
| Public integration URLs (OIDC, `api.dhan.am`)             | Yes        | —                                         |
| MADFAM topology, Vault maps, real RFCs, operator defaults | **No**     | `internal-devops`, Enclii/Vault, admin DB |

There is **no dedicated platform ops config in the database today**. Operator
knowledge lives in `AGENTS.md`, `ECOSYSTEM.md`, `infra/k8s/`, and hardcoded
constants. Target state: **Janua identity + admin.dhan.am for actions**,
**Vault + internal-devops for topology**, **optional `PlatformConfig` rows for
org-specific import rules**.

## Gates

### G4 — Public repository hygiene (new)

| Criterion                                                          | Evidence                                        |
| ------------------------------------------------------------------ | ----------------------------------------------- |
| No real RFCs, passwords, or live secret patterns in tracked source | `scripts/check-public-repo-leakage.py` CI green |
| No hardcoded `admin@madfam.io` defaults in operator scripts        | Env-required imports                            |
| Crypto HMAC fails closed in production                             | Unit test + `NODE_ENV=production` guard         |
| Topology/Vault runbooks not in public tree                         | Redacted docs + pointers to `internal-devops`   |
| Agent/dev docs split from operator runbooks                        | Slim `AGENTS.md` + private ops doc              |

G4 is a **prerequisite for declaring open-source / public-repo GA** alongside G1–G3.

## Phases

### Phase 0 — Stop the bleeding (Week 1) ✅ shipped

| ID    | Task                                                                      | Owner    | Status |
| ----- | ------------------------------------------------------------------------- | -------- | ------ |
| P0.1  | Remove real RFCs from `madfam-csv-*`; env-based `MADFAM_BUSINESS_RFC`     | API      | Done   |
| P0.2  | Fix Maria seed password to use `DEMO_USER_PASSWORD`                       | API      | Done   |
| P0.3  | Remove insecure HMAC fallback in production                               | API      | Done   |
| P0.4  | Redact passwords in historical dogfooding doc                             | Docs     | Done   |
| P0.5  | `.gitignore` for `.claude/`, `.cursor/`                                   | Platform | Done   |
| P0.6  | Require env for `TARGET_USER_EMAIL` in import/migration scripts           | API      | Done   |
| P0.6b | Require env in `bootstrap-madfam-prod-env.sh` (no default operator email) | API      | Done   |
| P0.7  | CI leakage scanner (`check-public-repo-leakage.py`)                       | Platform | Done   |
| P0.8  | Verify `.claude/settings.local.json` never committed; rotate if leaked    | Ops      | Manual |

### Phase 1 — Document relocation (Week 2)

| ID   | Task                                                                           | Target home                                            |
| ---- | ------------------------------------------------------------------------------ | ------------------------------------------------------ |
| P1.1 | Move full `scripts/sync-catalog-prod.md` procedure                             | `internal-devops/runbooks/dhanam-catalog-sync-prod.md` |
| P1.2 | Move `docs/COMMERCIAL_STAGING_CREDENTIALS.md` (full Vault matrix)              | `internal-devops` + Enclii Lockbox doc                 |
| P1.3 | Redact `ECOSYSTEM.md` § Production topology (Hetzner node names)               | Public stub + private full doc                         |
| P1.4 | Redact `docs/DEPLOYMENT.md` node codenames                                     | Public Enclii-first summary                            |
| P1.5 | Trim `infra/k8s/production/external-secret.yaml` comments (property inventory) | Generic ESO reference in public                        |
| P1.6 | Redact stability audits with live digests/queue counts                         | Private incident log                                   |

Public repo keeps **pointers only**: “See MADFAM internal-devops runbook X.”

### Phase 2 — AGENTS.md diet (Week 2–3)

| ID   | Task                                                                                                                         |
| ---- | ---------------------------------------------------------------------------------------------------------------------------- |
| P2.1 | Split `AGENTS.md` → public **Agent Dev Guide** (build, test, modules)                                                        |
| P2.2 | Move Stripe MX operator runbooks, preview mechanics, Karafiel field lists to `internal-devops/ecosystem/dhanam-agent-ops.md` |
| P2.3 | Remove `innovacionesmadfam@madfam.io` and absolute home paths from public docs                                               |
| P2.4 | Regenerate `llms.txt` / agent sync after split                                                                               |

### Phase 3 — Admin runtime slice (Week 3–5)

| ID   | Task                                                                           | Status  |
| ---- | ------------------------------------------------------------------------------ | ------- |
| P3.1 | Prisma `PlatformConfig` model (`key`, `value` JSON, `scope`: platform/org)     | Done    |
| P3.2 | Admin API `GET/PATCH /v1/admin/platform-config/madfam-import`                  | Done    |
| P3.3 | Load MADFAM CSV routing from `PlatformConfig` when `PLATFORM_CONFIG_SOURCE=db` | Done    |
| P3.4 | Finish `internal-catalog.controller` + secret in Vault only                    | Planned |
| P3.5 | Audit log all platform-config mutations                                        | Done    |
| P3.6 | Admin UI MADFAM Import Settings panel                                          | Planned |

**Runtime contract:** `admin@madfam.io` Janua role → admin app → DB config. Git
never holds org-specific RFCs or space routing again.

### Phase 4 — Dev credential hygiene (Week 4)

| ID   | Task                                                                                    |
| ---- | --------------------------------------------------------------------------------------- |
| P4.1 | Replace shared `madfam_dev_password` / `dev-shared-janua-secret` with generate-on-setup |
| P4.2 | CI fails if banned password literals appear outside tests                               |
| P4.3 | `apps/admin/e2e` — remove default `AdminPassword123!`                                   |
| P4.4 | Document `openssl rand` flow in `DEVELOPMENT.md` only                                   |

### Phase 5 — Governance (ongoing)

| ID   | Task                                                         |
| ---- | ------------------------------------------------------------ |
| P5.1 | gitleaks/trufflehog in CI (or GitHub secret scanning alerts) |
| P5.2 | PR template checkbox: “No operator secrets or MADFAM PII”    |
| P5.3 | Quarterly re-run leakage audit                               |
| P5.4 | `SECURITY.md` public-repo section (done in Phase 0)          |

## Target architecture

```text
Public github.com/madfam-org/dhanam
  ├── App source, tests, placeholder IaC
  ├── ADR-008 integration planes (no topology)
  └── check-public-repo-leakage.py

admin.dhan.am + Janua (admin@madfam.io)
  ├── Queues, audit, POS, platform-config CRUD
  └── MADFAM org import rules (DB)

internal-devops (private) + Enclii/Vault
  ├── Node names, kubeconfig, SSH
  ├── Vault path catalogs, staging credential checklists
  └── Break-glass kubectl, catalog sync prod
```

## Environment variables (operator-only, never in git)

| Variable                                       | Purpose                                                 |
| ---------------------------------------------- | ------------------------------------------------------- |
| `TARGET_USER_EMAIL`                            | **Prod:** Janua operator account at app.dhan.am (Vault) |
| `MADFAM_BUSINESS_RFC`                          | Business RFC for CSV import routing                     |
| `MADFAM_SPACE_NAME_*`                          | Optional when prod already has `madfam-csv-*` accounts  |
| `MADFAM_ACCOUNT_SUFFIX_PARTNER`                | Default `-afac` (prod idempotency)                      |
| `MADFAM_IMPORT_ENV_FILE`                       | Gitignored operator env file path                       |
| `MADFAM_ADMIN_EMAIL`                           | Seed target admin (never hardcode in scripts)           |
| `DEMO_USER_PASSWORD` / `MADFAM_ADMIN_PASSWORD` | Seed only, from Vault locally                           |

## Production continuity (app.dhan.am)

Existing data under the operator Janua account must survive security refactors:

- Import **discovers** spaces from existing `madfam-csv-*` `providerAccountId` rows
- Partner suffix defaults to **`-afac`** (matches first prod import)
- Preflight: `apps/api/scripts/verify-madfam-import-compat.ts`
- Template: `apps/api/scripts/madfam-import.env.example` → `madfam-import.local.env`

## Sign-off checklist (G4)

| Item                                                             | Owner          | Done |
| ---------------------------------------------------------------- | -------------- | ---- |
| P0 tasks merged                                                  | API + Platform |      |
| CI leakage job green on `main`                                   | Platform       |      |
| No Critical/High findings in manual audit                        | Security       |      |
| internal-devops runbooks published (private)                     | Ops            |      |
| PlatformConfig shipped OR documented deferral with env-only path | API            |      |

---

Update this file and [TECH_DEBT.md](TECH_DEBT.md) TD-1012 / TD-1013 as phases complete.  
**100% program:** [Full Remediation Plan](FULL_REMEDIATION_PLAN_G4_AND_OPERATOR_SLICE.md)
