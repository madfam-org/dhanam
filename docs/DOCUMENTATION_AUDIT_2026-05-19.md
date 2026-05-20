# Documentation Audit - 2026-05-19

Last refreshed: 2026-05-20

## Scope

This audit reviewed the documentation entrypoints, root LLM context, app/package
READMEs, operations docs, testing docs, and current source/config references.
The goal was to make the docs truthful, easier to navigate, and safer for both
humans and AI agents.

## Current Documentation Doctrine

Authoritative current docs:

- [AGENTS.md](../AGENTS.md) - canonical agent operating contract
- [README.md](../README.md) - product overview and quick start
- [docs/README.md](README.md) - canonical documentation map
- [docs/DEVELOPMENT.md](DEVELOPMENT.md) - local developer workflow
- [docs/DEPLOYMENT.md](DEPLOYMENT.md) - Enclii-first deploy/runbook
- [docs/STABILITY_AUDIT_2026-05-19.md](STABILITY_AUDIT_2026-05-19.md) -
  current production/staging stability truth
- [docs/architecture/ARCHITECTURE.md](architecture/ARCHITECTURE.md) - current
  architecture map
- [tools/agent-manifest.json](../tools/agent-manifest.json) - machine-readable
  repo metadata

Historical/session docs remain useful context, but they should not override
current source, manifests, Enclii specs, `AGENTS.md`, or the stability audit.
The 2026-05-20 wrap-up updated the primary status docs to reflect green hosted
CI, green staging API smoke, production full health with zero failed queue
backlog, and the remaining Enclii adapter gaps.

## Findings

### Fixed In This Pass

- Root README status was refreshed after production remediation. It now links
  to the stability audit and separates green live health from the remaining
  rollout and Enclii adapter blockers.
- Root README and development docs referenced stale repository, ports, scripts,
  env files, and test commands. They now align with `package.json`,
  app package scripts, and local ports `4010`, `3040`, and `3400`.
- `docs/README.md` referenced a non-existent `docs/audits/` tree and stale
  `MADFAM_INTERNAL_FINANCE.md`. It is now the canonical current documentation
  map.
- `docs/INDEX.md` duplicated stale navigation. It is now a stable redirect to
  `docs/README.md`.
- `docs/DEVELOPMENT.md` still described LocalStack, Terraform, generic
  `docker-compose`, old `dhanam.io` hosts, old ports, and root scripts that did
  not exist. It was rewritten around current commands and Enclii doctrine.
- `docs/architecture/ARCHITECTURE.md` described AWS ECS/Fargate, CloudFront,
  RDS, ElastiCache, Terraform, Next.js 14, and old ports. It now describes the
  current Enclii/Cloudflare/NestJS/Next.js architecture.
- Testing docs contained stale 2025 Prisma failure reports and obsolete tiny
  test-suite counts. `TEST_SUMMARY.md` and `TEST_RESULTS.md` now identify the
  current layered test strategy and latest verification snapshot.
- The root `TECH_DEBT.md` was a stale March 2026 log with current-looking
  placement. It now redirects to the current `docs/TECH_DEBT.md`, and the March
  log is preserved under `docs/reports/`.
- Deployment docs normalized raw Kubernetes for secrets, rollback, pod
  inspection, and troubleshooting. They now put Enclii first and explicitly mark
  raw access as break-glass/bootstrap.
- AI context files now point agents to the docs index, stability audit, and
  manifest before historical docs.
- `.env.example` files now match the documented local API port and CORS/app URL
  expectations.
- Current primary docs were link-scanned together: root README, docs index,
  development, deployment, architecture, testing, stability, documentation
  audit, LLM context, ecosystem, admin README, and agent instructions.

### Remaining Documentation Debt

- Several historical reports under `docs/reports/`, `docs/guides/*SUMMARY*.md`,
  `docs/testing/*SESSION*.md`, and older phase docs still mention AWS/Fargate,
  `dhanam.io`, old ports, or older test counts. They should either be archived
  under a clearly named historical folder or get a standard historical banner.
- Some feature guides link to planned companion guides that do not exist yet
  (`AUTH_GUIDE.md`, `JANUA_INTEGRATION.md`, `WEALTH_GUIDE.md`, and similar).
  These should be replaced with links to current source/module docs or written
  if they are still needed.
- `docs/API.md` is useful as a broad reference, but examples still include
  older `dhanam.io` support/status URLs in later sections. The live API surface
  should eventually be regenerated from Swagger/OpenAPI to avoid manual drift.
- `docs/MOBILE.md`, `docs/DOGFOODING_QUICKSTART.md`, and
  `docs/architecture/DHANAM_CLI.md` still carry old local port assumptions in
  places. They are now treated as secondary/historical until refreshed.
- `docs/architecture/SOFTWARE_SPEC.md` still contains AWS assumptions. It should
  be reviewed as a product specification and either updated or labeled as an
  original implementation spec.

## Organization Recommendation

Keep the current folder structure, but make the status explicit:

- `docs/` for current durable documentation and indexes.
- `docs/architecture/` for current architecture plus historical specs clearly
  labeled.
- `docs/adr/` for durable decisions.
- `docs/guides/` for feature guides.
- `docs/testing/` for active test strategy and recent verification snapshots.
- `docs/reports/` for historical reports.
- `docs/rfcs/` for proposals.
- Module-local `README.md` files beside implementation code.

A future cleanup can move obsolete session reports into
`docs/reports/historical/` after confirming no automation or bookmarks depend on
their current paths.

## Link Hygiene

A local markdown-link scan found many broken links in historical docs before
this pass, especially references to the missing `docs/audits/` tree and planned
guides. The current primary docs have been corrected; remaining broken links are
mostly in historical or secondary guides and should be handled in the archival
pass described above.

Primary current-doc scan status: passed for the active entrypoint set listed in
the fixed-items section.
