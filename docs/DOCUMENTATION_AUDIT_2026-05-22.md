# Documentation Corpus Audit — 2026-05-22

This audit evaluates the full Dhanam documentation corpus for coverage,
accuracy, interconnection, and agent/human discoverability. It supersedes the
findings snapshot in [Documentation Audit 2026-05-19](DOCUMENTATION_AUDIT_2026-05-19.md)
for current planning; the May 19 file remains useful as historical context.

**Language policy:** Implementation and technical documentation are English
only. Product UI strings use i18n (`packages/shared/i18n`).

## Executive summary

| Dimension                    | Score        | Notes                                                                                                                      |
| ---------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Primary entrypoint health    | **Strong**   | 0 broken relative links across 15 primary docs (automated scan)                                                            |
| Agent / LLM context chain    | **Good**     | `AGENTS.md` → `llms.txt` → `docs/README.md`; minor drift in `llms-full.txt` and `agent-manifest.json` (fixed in this pass) |
| Operations & stability truth | **Strong**   | Stability wrap-up, roadmaps, tech debt, and GA program are cross-linked                                                    |
| API module local docs        | **Complete** | 38/38 top-level modules have `README.md`                                                                                   |
| App-level docs               | **Weak**     | Only `apps/admin/README.md` existed before this pass                                                                       |
| Feature guides index         | **Partial**  | 20+ guides exist; only ~12 linked from `docs/README.md`                                                                    |
| Historical doc hygiene       | **Weak**     | Session reports, phase summaries, and `claudedocs/` lack a standard banner and index                                       |
| API reference drift          | **Moderate** | `docs/API.md` is manually maintained (~1.6k lines); Swagger at `/docs` is source of truth for live surface                 |
| Infra / Enclii docs          | **Partial**  | Module READMEs under `infra/` exist but were under-linked from the docs index                                              |

**Overall:** The corpus is **well structured at the top** (index, agents, stability,
GA program) but **under-connected at the leaves** (apps, unindexed guides, missing
module READMEs, orphan compliance docs).

## Corpus inventory

| Category                            | Count    | Index status                                                              |
| ----------------------------------- | -------- | ------------------------------------------------------------------------- |
| Root + agent context                | 7        | Indexed (`README`, `AGENTS`, `ECOSYSTEM`, `llms.*`, `TECH_DEBT` redirect) |
| `docs/` top-level durable           | 25+      | Indexed in [docs/README.md](README.md)                                    |
| `docs/guides/`                      | 24       | Partially indexed                                                         |
| `docs/testing/` session reports     | 14       | Historical; only 2 in “current” index                                     |
| `docs/reports/`                     | 3+       | Historical section only                                                   |
| `docs/adr/`                         | 7        | Indexed                                                                   |
| `docs/rfcs/`                        | 3        | **Was not indexed** (added in this pass)                                  |
| `docs/market-research/`             | 2        | **Was not indexed** (added in this pass)                                  |
| `apps/api/src/modules/**/README.md` | 38 files | Hub at [modules/README.md](../apps/api/src/modules/README.md) (new)       |
| App READMEs                         | 4        | admin + api/web/mobile stubs (new)                                        |
| Package READMEs                     | 6/7      | `config` has README; all indexed                                          |
| `infra/**/README.md`                | 4        | Added to docs index                                                       |
| `claudedocs/`                       | 6        | **Orphan** — SOC2/SRE; should link from INFRASTRUCTURE or reports         |
| `.github/` docs                     | 3        | Partially reachable via guides                                            |

## Authoritative documentation stack

Read in this order (humans and agents):

1. [AGENTS.md](../AGENTS.md) — operating doctrine (Enclii-first, English-only implementation)
2. [docs/README.md](README.md) — canonical map
3. [docs/GA_REMEDIATION_ROADMAP.md](GA_REMEDIATION_ROADMAP.md) — implementation program
4. [docs/ROADMAP.md](ROADMAP.md) + [docs/COMMERCIAL_STABILITY_ROADMAP.md](COMMERCIAL_STABILITY_ROADMAP.md)
5. [docs/STABILITY_WRAP_UP_2026-05-20.md](STABILITY_WRAP_UP_2026-05-20.md) + [docs/TECH_DEBT.md](TECH_DEBT.md)
6. Task-specific module, app, infra, or guide docs

Live runtime truth wins over any doc when they conflict.

## Interconnection audit

### What works well

- **Stable legacy redirect:** [docs/INDEX.md](INDEX.md) → `docs/README.md`
- **Tech debt redirect:** root [TECH_DEBT.md](../TECH_DEBT.md) → `docs/TECH_DEBT.md`
- **Billing truth chain:** `catalog.yaml` → billing module README → commercial roadmap → GA roadmap
- **Deployment chain:** `DEPLOYMENT.md` ↔ `infra/enclii/services/` ↔ `.github/workflows/`
- **Architecture “Read next”** links to development, deployment, billing, orchestrator
- **Primary doc link scan:** 0 broken relative links (2026-05-22 automated check)

### Gaps fixed in this pass

| Gap                                            | Remediation                                                                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| No API module hub                              | [apps/api/src/modules/README.md](../apps/api/src/modules/README.md)                                                                         |
| Missing app READMEs                            | [apps/api/README.md](../apps/api/README.md), [apps/web/README.md](../apps/web/README.md), [apps/mobile/README.md](../apps/mobile/README.md) |
| RFCs and market research not in index          | Added to [docs/README.md](README.md)                                                                                                        |
| Infra READMEs not in index                     | Added to [docs/README.md](README.md)                                                                                                        |
| `llms-full.txt` missing GA roadmap             | Updated                                                                                                                                     |
| `tools/agent-manifest.json` missing GA roadmap | Updated                                                                                                                                     |
| `docs/INDEX.md` missing GA roadmap             | Updated                                                                                                                                     |

### Remaining interconnection gaps

| Gap                                                        | Severity | Recommendation                                                          |
| ---------------------------------------------------------- | -------- | ----------------------------------------------------------------------- |
| 11 API modules without `README.md`                         | Medium   | Add minimal module READMEs (see module hub “undocumented” table)        |
| `docs/API.md` manual drift                                 | Medium   | Generate from OpenAPI/Swagger; keep `API.md` as narrative index         |
| 12+ feature guides not in `docs/README.md`                 | Low      | Expand guide table or add [docs/guides/README.md](guides/README.md)     |
| `claudedocs/` not linked                                   | Low      | Link from [INFRASTRUCTURE.md](INFRASTRUCTURE.md) as compliance appendix |
| `docs/architecture/ARCHITECTURE.md` staging sentence stale | Low      | Says web/admin staging smoke gap; M2 complete per wrap-up — update      |
| Duplicate “roadmap” naming                                 | Low      | `docs/guides/IMPLEMENTATION_ROADMAP.md` is historical; keep banner      |
| Web session summaries in `apps/web/*.md`                   | Low      | Mark historical or move to `docs/reports/historical/`                   |
| No `docs/runbooks/BREAK_GLASS.md`                          | Medium   | Planned in GA roadmap Phase 2                                           |
| Swagger not linked from `API.md` prominently               | Low      | Add “Live API docs: `{API_URL}/docs`” at top of `API.md`                |
| `@dhanam/mobile` not in package index                      | Low      | Add when mobile README stabilizes                                       |

## API module documentation coverage

Top-level modules under `apps/api/src/modules/`:

| Module             | README | Priority for new README                 |
| ------------------ | ------ | --------------------------------------- |
| referral           | No     | **High** — ecosystem-facing             |
| webhook-outbound   | No     | **High** — product fan-out              |
| events             | No     | **High** — cross-service bus RFC        |
| providers (parent) | No     | **High** — index of provider submodules |
| documents          | No     | Medium                                  |
| tags               | No     | Medium                                  |
| kyc                | No     | Medium                                  |
| marketplace        | No     | Low (RFC stage)                         |
| migration          | No     | Low                                     |
| gaming             | No     | Low                                     |
| fx                 | No     | Low (see `fx-rates`)                    |
| All others         | Yes    | —                                       |

Provider submodules (`belvo`, `plaid`, `orchestrator`, etc.) are documented;
the parent `providers/` folder needs an index README linking them.

## App and package coverage

| Path               | Before audit | After audit                                            |
| ------------------ | ------------ | ------------------------------------------------------ |
| `apps/api/`        | No README    | README with links to modules, e2e, TEST_COVERAGE_GUIDE |
| `apps/web/`        | No README    | README with ports, env, test commands                  |
| `apps/admin/`      | README       | Unchanged (good)                                       |
| `apps/mobile/`     | No README    | README pointing to MOBILE.md                           |
| `packages/config/` | README       | Indexed                                                |
| `packages/ui/`     | README       | Indexed                                                |

## Historical and session documentation

**Problem:** ~40 files under `docs/testing/*SESSION*`, `docs/guides/*SUMMARY*`,
`docs/PHASE*.md`, and `claudedocs/` read as current unless the reader knows the
May 2026 stability push replaced them.

**Standard banner** (apply when touching historical files):

```markdown
> [!NOTE]
> Historical document. For current status read [docs/README.md](../README.md),
> [STABILITY_WRAP_UP_2026-05-20.md](STABILITY_WRAP_UP_2026-05-20.md), and
> [GA_REMEDIATION_ROADMAP.md](GA_REMEDIATION_ROADMAP.md).
```

**Recommended archive layout** (future PR):

```text
docs/reports/historical/   # phase summaries, session test reports
docs/guides/historical/    # superseded implementation summaries
```

Do not move files until link grep confirms no CI or external bookmarks break.

## Link hygiene

| Scope                      | Broken relative links                          |
| -------------------------- | ---------------------------------------------- |
| 15 primary entrypoint docs | 0                                              |
| All `docs/**/*.md`         | 1 (malformed path in a historical testing doc) |

External URLs were not crawled.

## Optimal documentation model (target state)

```text
AGENTS.md / llms.txt
    └── docs/README.md  (single human index)
            ├── GA_REMEDIATION_ROADMAP.md
            ├── ROADMAP.md / COMMERCIAL_STABILITY_ROADMAP.md
            ├── DEVELOPMENT.md / DEPLOYMENT.md / API.md
            ├── architecture/ARCHITECTURE.md
            ├── guides/README.md  (future: all feature guides)
            ├── apps/*/README.md
            ├── apps/api/src/modules/README.md
            │       └── modules/*/README.md
            ├── packages/*/README.md
            └── infra/**/README.md
```

## Remediation backlog (prioritized)

| Priority | Item                                                                 | Status                                                                         |
| -------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| P1       | READMEs for referral, webhook-outbound, events, providers            | **Done** (2026-05-22)                                                          |
| P1       | `docs/runbooks/BREAK_GLASS.md`                                       | **Done** (2026-05-22)                                                          |
| P2       | OpenAPI export + [docs/api/README.md](api/README.md)                 | **Done** (2026-05-22)                                                          |
| P2       | CI `check-doc-links.py --all-docs`                                   | **Done** (2026-05-22)                                                          |
| P2       | [docs/guides/README.md](guides/README.md) guide catalog              | **Done** (2026-05-22)                                                          |
| P2       | Refresh `ARCHITECTURE.md` staging status                             | Done prior pass                                                                |
| P3       | Move archived reports to `docs/reports/historical/`                  | **Done** — `historical/testing/` + phase summaries (2026-05-22)                |
| P3       | READMEs for documents, tags, kyc, migration, fx, gaming, marketplace | **Done** (2026-05-22)                                                          |
| P3       | Historical banner template                                           | **Done** — [\_templates/HISTORICAL_BANNER.md](_templates/HISTORICAL_BANNER.md) |
| P3       | Historical banners on remaining session reports                      | **Done** — archived guides + phase docs                                        |
| P4       | OpenAPI export local verification                                    | **Done** — Jest e2e harness (`openapi-export.e2e-spec.ts`)                     |

## Maintenance rules

1. New durable doc → add row to [docs/README.md](README.md).
2. New API module → add `README.md` + row in [modules/README.md](../apps/api/src/modules/README.md).
3. Stability or GA posture change → update wrap-up, tech debt, and roadmaps together.
4. Regenerate agent context when entrypoints change:
   `internal-devops/scripts/sync-agent-docs.py` (ecosystem script).
5. Run link scan before release (script below).

### Local link scan (primary docs)

```bash
python3 scripts/check-doc-links.py --primary
python3 scripts/check-doc-links.py --all-docs
```

## Sign-off

This audit documents corpus state as of **2026-05-22**. Next audit trigger:
GA milestone M3 (rollout truth) or any docs index restructure.
