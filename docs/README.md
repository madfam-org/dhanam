# Dhanam Documentation

Last updated: 2026-06-15

This is the canonical human and agent documentation map for Dhanam. Prefer this
file over older phase summaries when choosing what to read first.

## Monetization and First Peso

For revenue, checkout, billing, catalog, or entitlement work, start here — not the
GA/stability section below.

| Document                                                                          | Use                                                                                 |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [Monetization Session](MONETIZATION_SESSION.md)                                   | **Agent entrypoint** — read order, code anchors, private ops boundary               |
| [Monetization Path Readiness](MONETIZATION_PATH_READINESS.md)                     | Current gate table (G0–G9 slice), shipped work, ranked open tasks                   |
| [First Pesos Commercial GA](FIRST_PESOS_COMMERCIAL_GA_MONETIZATION_2026-06-01.md) | Full G0–G9 framework and first-peso proof bar                                       |
| [Stripe MXN Live Flip](runbooks/STRIPE_MXN_LIVE_FLIP.md)                          | Operator runbook to enable live MXN checkout                                        |
| [Catalog Truth 2026-05-20](CATALOG_TRUTH_2026-05-20.md)                           | Product catalog drift gate and production sync truth                                |
| [Tulana SKU and Catalog Handoff](TULANA_SKU_AND_CATALOG_HANDOFF_2026-05-29.md)    | Tulana readiness, billing catalogue mirror, and Selva-approved price apply contract |
| [Commercial GA Execution](COMMERCIAL_GA_EXECUTION.md)                             | G2 runbook: WS1–WS6 staging smoke, proof gates, GitHub secrets/vars                 |
| [Billing module](../apps/api/src/modules/billing/README.md)                       | Checkout, ledger, webhooks, entitlements (NestJS)                                   |
| [Billing SDK](../packages/billing-sdk/README.md)                                  | Ecosystem billing client                                                            |

Private operator sequencing and Phase 0 blockers (Vault/`dhanam-secrets`, cutover)
live in `internal-devops` — paths listed in [Monetization Session](MONETIZATION_SESSION.md).

## Start Here

| Document                                                                       | Use                                                                                 |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| [Repository README](../README.md)                                              | Product overview, local quick start, common commands                                |
| [Development Guide](DEVELOPMENT.md)                                            | Local setup, ports, env files, testing workflow                                     |
| [GA Remediation Roadmap](GA_REMEDIATION_ROADMAP.md)                            | Full program: technical stability GA, commercial GA, consumer GA (phases 0–7)       |
| [Public Repo Security Remediation](PUBLIC_REPO_SECURITY_REMEDIATION.md)        | G4: remove operator secrets from public git; CI leakage guard                       |
| [Full Remediation Plan](FULL_REMEDIATION_PLAN_G4_AND_OPERATOR_SLICE.md)        | 100% G4 sanitization + 100% admin@madfam.io operator prod slice (6-sprint program)  |
| [Roadmap](ROADMAP.md)                                                          | Stability priorities P0–P8 and milestones M1–M7                                     |
| [Commercial Stability Roadmap](COMMERCIAL_STABILITY_ROADMAP.md)                | Billing router and internal MADFAM POS completion plan                              |
| [Commercial GA Execution](COMMERCIAL_GA_EXECUTION.md)                          | G2 runbook: WS1–WS6 staging smoke, proof gates, GitHub secrets/vars                 |
| [Tulana SKU and Catalog Handoff](TULANA_SKU_AND_CATALOG_HANDOFF_2026-05-29.md) | Tulana readiness, billing catalogue mirror, and Selva-approved price apply contract |
| [Commercial Staging Credentials](COMMERCIAL_STAGING_CREDENTIALS.md)            | Vendor test-key checklist for staging commercial soak                               |
| [Deployment Guide](DEPLOYMENT.md)                                              | Enclii-first deploy, staging, rollback, current rollout blockers                    |
| [Stability Audit 2026-05-19](STABILITY_AUDIT_2026-05-19.md)                    | Current truth about production, staging, DNS, health, and remaining stability gaps  |
| [Stability Wrap-Up 2026-05-20](STABILITY_WRAP_UP_2026-05-20.md)                | Concise final status from the latest production-stability push                      |
| [Session Wrap-Up 2026-06-15](SESSION_WRAP_UP_2026-06-15.md)                    | **Latest handoff** — landing Phases A–G live, ES copy, deploy gaps, next picks      |
| [Tech Debt Register](TECH_DEBT.md)                                             | Current technical debt, active stability gaps, and historical debt archive          |
| [Documentation Audit 2026-05-22](DOCUMENTATION_AUDIT_2026-05-22.md)            | Latest corpus audit: coverage, interconnection, remediation backlog                 |
| [Documentation Audit 2026-05-19](DOCUMENTATION_AUDIT_2026-05-19.md)            | Prior audit (historical context)                                                    |
| [API Reference](API.md)                                                        | REST API narrative overview                                                         |
| [API index](api/README.md)                                                     | OpenAPI export, Swagger, specialized API docs                                       |
| [Mobile Guide](MOBILE.md)                                                      | React Native and Expo app notes                                                     |

## Architecture And Operations

| Document                                                                                                 | Use                                                                               |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [Architecture Overview](architecture/ARCHITECTURE.md)                                                    | Current system shape: Next.js, NestJS, Postgres, Redis, Enclii, Cloudflare Tunnel |
| [Software Specification](architecture/SOFTWARE_SPEC.md)                                                  | Product and technical specification; some infrastructure sections are historical  |
| [Infrastructure Guide](INFRASTRUCTURE.md)                                                                | Monitoring, admin, and infrastructure notes                                       |
| [Launch Operations](LAUNCH_OPERATIONS.md)                                                                | Launch checklist and operator tasks                                               |
| [Backup And Restore](BACKUP_RESTORE.md)                                                                  | Backup and restore runbooks                                                       |
| [Admin Dashboard](ADMIN_DASHBOARD.md)                                                                    | Admin app features and routes                                                     |
| [Sentry Setup](SENTRY_SETUP.md)                                                                          | Error monitoring setup                                                            |
| [Catalog Truth 2026-05-20](CATALOG_TRUTH_2026-05-20.md)                                                  | Product catalog drift gate and production sync truth                              |
| [Credential Onboarding](CREDENTIAL_ONBOARDING.md)                                                        | Provider credential activation runbook                                            |
| [PP.2 Staging Audit](PP_2_STAGING_AUDIT.md)                                                              | Staging pipeline gap analysis (RFC 0001)                                          |
| [Break-glass runbook](runbooks/BREAK_GLASS.md)                                                           | Documented raw-access procedures when Enclii adapters are missing                 |
| [Incident: dhanam-web prod rollout 2026-06-15](runbooks/incidents/2026-06-15-dhanam-web-prod-rollout.md) | Stale Argo sync after promote; post-promote dispatch required                     |
| [Compliance appendix](../claudedocs/README.md)                                                           | SOC2 / SRE historical procedures                                                  |

Production operations are Enclii-first. Raw `kubectl`, `helm`, provider CLIs,
SSH, `docker exec`, or direct container access are break-glass/bootstrap only;
record the missing Enclii adapter gap when raw access is unavoidable.

## Development And Testing

| Document                                                             | Use                                                              |
| -------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [Testing Overview](testing/TEST_SUMMARY.md)                          | Current test layers and how to run them                          |
| [Testing index](testing/README.md)                                   | Current vs archived test documentation                           |
| [Latest Verification Snapshot](testing/TEST_RESULTS.md)              | Most recent local verification summary                           |
| [API Test Coverage Guide](../apps/api/TEST_COVERAGE_GUIDE.md)        | API Jest, coverage, chaos, and DB-backed test notes              |
| [Migration Checklist](MIGRATION_CHECKLIST.md)                        | Historical Janua/domain migration notes                          |
| [Dogfooding Quickstart](reports/historical/DOGFOODING_QUICKSTART.md) | Historical internal dogfooding guide; verify commands before use |

## Product And Feature Guides

Full guide index: [guides/README.md](guides/README.md).

### Dhanam marketing landing (`dhan.am`)

| Document                                                            | Use                                                                                    |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [Landing Remediation Plan](LANDING_REMEDIATION.md)                  | **Canonical program** — competitive analysis, phases, tickets, tests, Dhanam vs MADFAM |
| [Landing Design System](LANDING_DESIGN_SYSTEM.md)                   | Typography, color tokens, motion, component specs for the Dhanam marketing site        |
| [Hero Tablet Showcase](HERO_IPAD_SHOWCASE.md)                       | 3D hero tablet + live embed demo (tour, screen insets, rate limits, test matrix)       |
| [Competitive Benchmarks](market-research/competitive-benchmarks.md) | Pricing and feature matrix (complements landing UX plan)                               |

| Document                                                                       | Use                                        |
| ------------------------------------------------------------------------------ | ------------------------------------------ |
| [All feature guides](guides/README.md)                                         | Complete guide catalog                     |
| [Billing Integration](guides/BILLING_INTEGRATION.md)                           | Billing and subscription integration notes |
| [AI Categorization](guides/AI_CATEGORIZATION_GUIDE.md)                         | Transaction categorization workflow        |
| [Goal Tracking](guides/GOAL_TRACKING_GUIDE.md)                                 | Goal tracking UX and behavior              |
| [Manual Assets](guides/MANUAL_ASSETS.md)                                       | Manual asset tracking                      |
| [Estate Planning](guides/ESTATE_PLANNING_GUIDE.md)                             | Life Beat and executor workflows           |
| [Household Features](guides/HOUSEHOLD_FEATURES_GUIDE.md)                       | Household ownership and sharing            |
| [Long-Term Projections](guides/LONG_TERM_PROJECTIONS_GUIDE.md)                 | Projection workflows                       |
| [Monte Carlo](guides/MONTE_CARLO_GUIDE.md)                                     | Simulation API and UX details              |
| [DeFi/Web3](guides/DEFI_WEB3_GUIDE.md)                                         | DeFi and crypto portfolio tracking         |
| [Multi-Provider Redundancy](guides/MULTI_PROVIDER_REDUNDANCY.md)               | Provider failover approach                 |
| [Transaction Execution User Guide](guides/transaction-execution-user-guide.md) | Transaction execution feature guide        |
| [Transaction Execution API](api/transaction-execution-api.md)                  | Transaction execution endpoint reference   |

## ADRs

| ADR                                                      | Decision                               |
| -------------------------------------------------------- | -------------------------------------- |
| [ADR-001](adr/001-nestjs-fastify.md)                     | NestJS with Fastify                    |
| [ADR-002](adr/002-prisma-orm.md)                         | Prisma ORM                             |
| [ADR-003](adr/003-multi-provider-strategy.md)            | Multi-provider financial data strategy |
| [ADR-004](adr/004-janua-auth-integration.md)             | Janua authentication                   |
| [ADR-005](adr/005-enclii-deployment.md)                  | Enclii deployment                      |
| [ADR-006](adr/006-mobile-state-management.md)            | Mobile state management                |
| [ADR-008](adr/008-integration-planes-janua-vs-direct.md) | Integration planes (Janua vs direct)   |
| [ADR-007 (superseded)](adr/conekta-janua-dependency.md)  | Historical Conekta/Janua billing notes |

## RFCs And Research

| Document                                                            | Use                         |
| ------------------------------------------------------------------- | --------------------------- |
| [Cross-Service Event Bus](rfcs/cross-service-event-bus.md)          | NATS event bus proposal     |
| [Connect Marketplace](rfcs/connect-marketplace.md)                  | Marketplace integration RFC |
| [Belvo Payments Evaluation](rfcs/belvo-payments-evaluation.md)      | Belvo payments evaluation   |
| [Pricing Tiers](market-research/pricing-tiers.md)                   | Market research             |
| [Competitive Benchmarks](market-research/competitive-benchmarks.md) | Competitive analysis        |

## Infrastructure Docs

| Document                                                   | Use                          |
| ---------------------------------------------------------- | ---------------------------- |
| [ArgoCD](../infra/k8s/argocd/README.md)                    | GitOps applications          |
| [Monitoring manifests](../infra/k8s/monitoring/README.md)  | Prometheus, Grafana, alerts  |
| [Enclii service specs](../infra/enclii/services/README.md) | Enclii reconciliation source |
| [Scripts](../scripts/README.md)                            | Dev and ops scripts          |
| [Doc link checker](../scripts/check-doc-links.py)          | Primary docs link hygiene    |

## App, Package, And Module Docs

| Area                  | Docs                                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| API app               | [apps/api/README.md](../apps/api/README.md)                                                                       |
| Web app               | [apps/web/README.md](../apps/web/README.md)                                                                       |
| Admin app             | [apps/admin/README.md](../apps/admin/README.md)                                                                   |
| Mobile app            | [apps/mobile/README.md](../apps/mobile/README.md)                                                                 |
| API module index      | [apps/api/src/modules/README.md](../apps/api/src/modules/README.md)                                               |
| API e2e               | [apps/api/test/e2e/README.md](../apps/api/test/e2e/README.md)                                                     |
| Billing module        | [apps/api/src/modules/billing/README.md](../apps/api/src/modules/billing/README.md)                               |
| Provider orchestrator | [apps/api/src/modules/providers/orchestrator/README.md](../apps/api/src/modules/providers/orchestrator/README.md) |
| UI package            | [packages/ui/README.md](../packages/ui/README.md)                                                                 |
| Shared package        | [packages/shared/README.md](../packages/shared/README.md)                                                         |
| Config package        | [packages/config/README.md](../packages/config/README.md)                                                         |
| Billing SDK           | [packages/billing-sdk/README.md](../packages/billing-sdk/README.md)                                               |
| ESG package           | [packages/esg/README.md](../packages/esg/README.md)                                                               |
| Simulations package   | [packages/simulations/README.md](../packages/simulations/README.md)                                               |

## AI-Agent And LLM Context

| Document                                            | Use                                 |
| --------------------------------------------------- | ----------------------------------- |
| [AGENTS.md](../AGENTS.md)                           | Canonical agent operating contract  |
| [CLAUDE.md](../CLAUDE.md)                           | Compatibility redirect to AGENTS.md |
| [llms.txt](../llms.txt)                             | Compact LLM context index           |
| [llms-full.txt](../llms-full.txt)                   | Expanded LLM context map            |
| [agent-manifest.json](../tools/agent-manifest.json) | Machine-readable repo metadata      |

For agents: read `AGENTS.md`, [Monetization Session](MONETIZATION_SESSION.md) for
revenue work (or this index for stability work), and the specific app/module docs
for the files you are touching.

## Historical Reports

The [docs/reports/historical/](reports/historical/README.md) tree preserves
implementation history (phase summaries, audits, archived test sessions). Useful
for context, but may mention superseded AWS/Fargate, `dhanam.io`, old ports, or
earlier test counts.

| Document                                                                              | Use                                         |
| ------------------------------------------------------------------------------------- | ------------------------------------------- |
| [Historical index](reports/historical/README.md)                                      | Archive layout and current-status links     |
| [Phase 2 summary](reports/historical/PHASE2-SUMMARY.md)                               | Transaction execution implementation (2025) |
| [Blue Ocean implementation summary](reports/historical/IMPLEMENTATION_SUMMARY.md)     | Q1 pivot report (2025)                      |
| [Phase 3 plan](reports/historical/PHASE3-PLAN.md)                                     | Advanced features plan (historical)         |
| [Implementation progress](reports/historical/architecture/IMPLEMENTATION_PROGRESS.md) | Competitive parity roadmap status (2025)    |
| [Audit summary](reports/historical/AUDIT_SUMMARY.md)                                  | Codebase audit (2025)                       |
| [Archived test sessions](reports/historical/testing/)                                 | Test coverage session reports               |
| [March 2026 tech-debt log](reports/TECH_DEBT_2026-03-21.md)                           | Archived tech-debt snapshot                 |

When a historical report conflicts with this index, `AGENTS.md`, `DEPLOYMENT.md`,
current manifests, or source code, treat the current files as authoritative and
update the report only if it is still used operationally.

## Documentation Standards

- Put durable operational and developer docs under `docs/`.
- Put module-local implementation docs beside the module.
- Link from this index when adding a durable doc.
- Mark historical or session-specific docs explicitly.
- Use relative links for internal references.
- Write implementation and technical documentation in English only.
- Keep production operations Enclii-first and record any missing Enclii adapter
  rather than normalizing raw infrastructure access.
