# Dhanam Documentation

Last updated: 2026-05-19

This is the canonical human and agent documentation map for Dhanam. Prefer this
file over older phase summaries when choosing what to read first.

## Start Here

| Document                                                            | Use                                                                                |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [Repository README](../README.md)                                   | Product overview, local quick start, common commands                               |
| [Development Guide](DEVELOPMENT.md)                                 | Local setup, ports, env files, testing workflow                                    |
| [Deployment Guide](DEPLOYMENT.md)                                   | Enclii-first deploy, staging, rollback, current rollout blockers                   |
| [Stability Audit 2026-05-19](STABILITY_AUDIT_2026-05-19.md)         | Current truth about production, staging, DNS, health, and remaining stability gaps |
| [Tech Debt Register](TECH_DEBT.md)                                  | Current technical debt, active stability gaps, and historical debt archive         |
| [Documentation Audit 2026-05-19](DOCUMENTATION_AUDIT_2026-05-19.md) | Docs accuracy, organization, link hygiene, and remaining documentation debt        |
| [API Reference](API.md)                                             | REST API overview and endpoint examples                                            |
| [Mobile Guide](MOBILE.md)                                           | React Native and Expo app notes                                                    |

## Architecture And Operations

| Document                                                | Use                                                                               |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [Architecture Overview](architecture/ARCHITECTURE.md)   | Current system shape: Next.js, NestJS, Postgres, Redis, Enclii, Cloudflare Tunnel |
| [Software Specification](architecture/SOFTWARE_SPEC.md) | Product and technical specification; some infrastructure sections are historical  |
| [Infrastructure Guide](INFRASTRUCTURE.md)               | Monitoring, admin, and infrastructure notes                                       |
| [Launch Operations](LAUNCH_OPERATIONS.md)               | Launch checklist and operator tasks                                               |
| [Backup And Restore](BACKUP_RESTORE.md)                 | Backup and restore runbooks                                                       |
| [Sentry Setup](SENTRY_SETUP.md)                         | Error monitoring setup                                                            |
| [Credential Onboarding](CREDENTIAL_ONBOARDING.md)       | Provider credential activation runbook                                            |

Production operations are Enclii-first. Raw `kubectl`, `helm`, provider CLIs,
SSH, `docker exec`, or direct container access are break-glass/bootstrap only;
record the missing Enclii adapter gap when raw access is unavoidable.

## Development And Testing

| Document                                                      | Use                                                              |
| ------------------------------------------------------------- | ---------------------------------------------------------------- |
| [Testing Overview](testing/TEST_SUMMARY.md)                   | Current test layers and how to run them                          |
| [Latest Verification Snapshot](testing/TEST_RESULTS.md)       | Most recent local verification summary                           |
| [API Test Coverage Guide](../apps/api/TEST_COVERAGE_GUIDE.md) | API Jest, coverage, chaos, and DB-backed test notes              |
| [Migration Checklist](MIGRATION_CHECKLIST.md)                 | Historical Janua/domain migration notes                          |
| [Dogfooding Quickstart](DOGFOODING_QUICKSTART.md)             | Historical internal dogfooding guide; verify commands before use |

## Product And Feature Guides

| Document                                                                       | Use                                        |
| ------------------------------------------------------------------------------ | ------------------------------------------ |
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

| ADR                                                         | Decision                               |
| ----------------------------------------------------------- | -------------------------------------- |
| [ADR-001](adr/001-nestjs-fastify.md)                        | NestJS with Fastify                    |
| [ADR-002](adr/002-prisma-orm.md)                            | Prisma ORM                             |
| [ADR-003](adr/003-multi-provider-strategy.md)               | Multi-provider financial data strategy |
| [ADR-004](adr/004-janua-auth-integration.md)                | Janua authentication                   |
| [ADR-005](adr/005-enclii-deployment.md)                     | Enclii deployment                      |
| [ADR-006](adr/006-mobile-state-management.md)               | Mobile state management                |
| [Conekta/Janua Dependency](adr/conekta-janua-dependency.md) | Billing dependency notes               |

## App, Package, And Module Docs

| Area                  | Docs                                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Admin app             | [apps/admin/README.md](../apps/admin/README.md)                                                                   |
| API e2e               | [apps/api/test/e2e/README.md](../apps/api/test/e2e/README.md)                                                     |
| Billing API module    | [apps/api/src/modules/billing/README.md](../apps/api/src/modules/billing/README.md)                               |
| Provider orchestrator | [apps/api/src/modules/providers/orchestrator/README.md](../apps/api/src/modules/providers/orchestrator/README.md) |
| API modules           | Module-local `README.md` files under [apps/api/src/modules](../apps/api/src/modules/)                             |
| UI package            | [packages/ui/README.md](../packages/ui/README.md)                                                                 |
| Shared package        | [packages/shared/README.md](../packages/shared/README.md)                                                         |
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

For agents: read `AGENTS.md`, this index, `STABILITY_AUDIT_2026-05-19.md`,
and the specific source/module docs for the files you are touching.

## Historical Reports

The `docs/reports/`, `docs/testing/`, `docs/guides/*SUMMARY*.md`, and phase
summary files preserve implementation history. They are useful for context, but
they may mention superseded AWS/Fargate, `dhanam.io`, old ports, or earlier test
counts. The archived March 2026 tech-debt log lives at
[reports/TECH_DEBT_2026-03-21.md](reports/TECH_DEBT_2026-03-21.md). When a
historical report conflicts with this index, `AGENTS.md`, `DEPLOYMENT.md`,
current manifests, or source code, treat the current files as authoritative and
update the report only if it is still used operationally.

## Documentation Standards

- Put durable operational and developer docs under `docs/`.
- Put module-local implementation docs beside the module.
- Link from this index when adding a durable doc.
- Mark historical or session-specific docs explicitly.
- Use relative links for internal references.
- Keep production operations Enclii-first and record any missing Enclii adapter
  rather than normalizing raw infrastructure access.
