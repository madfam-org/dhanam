# API Modules

NestJS feature modules for the Dhanam API (`apps/api`). Each module should have a
local `README.md` describing purpose, main endpoints, jobs, and env vars.

**Index:** [Documentation map](../../../../docs/README.md) ·
[Architecture](../../../../docs/architecture/ARCHITECTURE.md) ·
[Billing module](billing/README.md) ·
[API app README](../../README.md)

## Core domain

| Module                                                     | README | Primary concern            |
| ---------------------------------------------------------- | ------ | -------------------------- |
| [users](users/README.md)                                   | Yes    | Users, profiles, GDPR      |
| [spaces](spaces/README.md)                                 | Yes    | Multi-tenant spaces, roles |
| [accounts](accounts/README.md)                             | Yes    | Financial accounts         |
| [transactions](transactions/README.md)                     | Yes    | Transaction ledger         |
| [categories](categories/README.md)                         | Yes    | Categories and rules       |
| [budgets](budgets/README.md)                               | Yes    | Budgets and periods        |
| [tags](tags/README.md)                                     | Yes    | Transaction tags           |
| [recurring](recurring/README.md)                           | Yes    | Recurring transactions     |
| [goals](goals/README.md)                                   | Yes    | Financial goals            |
| [households](households/README.md)                         | Yes    | Household ownership views  |
| [manual-assets](manual-assets/README.md)                   | Yes    | Manual asset tracking      |
| [collectibles-valuation](collectibles-valuation/README.md) | Yes    | Collectibles adapters      |
| [documents](documents/README.md)                           | Yes    | Document metadata / R2     |
| [search](search/README.md)                                 | Yes    | Search                     |
| [preferences](preferences/README.md)                       | Yes    | User preferences           |
| [onboarding](onboarding/README.md)                         | Yes    | Onboarding flows           |

## Providers and data ingestion

| Module                                                               | README | Primary concern                                 |
| -------------------------------------------------------------------- | ------ | ----------------------------------------------- |
| [providers](providers/README.md)                                     | Yes    | Provider umbrella index                         |
| [providers/orchestrator](providers/orchestrator/README.md)           | Yes    | Failover and routing                            |
| [providers/belvo](providers/belvo/README.md)                         | Yes    | Mexico banking (Belvo)                          |
| [providers/plaid](providers/plaid/README.md)                         | Yes    | US banking (Plaid)                              |
| [providers/mx](providers/mx/README.md)                               | Yes    | MX aggregation                                  |
| [providers/finicity](providers/finicity/README.md)                   | Yes    | Finicity                                        |
| [providers/bitso](providers/bitso/README.md)                         | Yes    | Crypto exchange                                 |
| [providers/blockchain](providers/blockchain/README.md)               | Yes    | On-chain addresses                              |
| [providers/defi](providers/defi/README.md)                           | Yes    | DeFi / Zapper                                   |
| [providers/connection-health](providers/connection-health/README.md) | Yes    | Connection health                               |
| [fx-rates](fx-rates/README.md)                                       | Yes    | FX (Banxico, etc.)                              |
| [fx](fx/README.md)                                                   | Yes    | Platform FX API (RFC 0011); see also `fx-rates` |

## Billing, platform, and ecosystem

| Module                                         | README | Primary concern                         |
| ---------------------------------------------- | ------ | --------------------------------------- |
| [billing](billing/README.md)                   | Yes    | Subscriptions, Stripe MX, POS, webhooks |
| [subscriptions](subscriptions/README.md)       | Yes    | Subscription records                    |
| [referral](referral/README.md)                 | Yes    | Referral rewards (PhyndCRM webhook)     |
| [webhook-outbound](webhook-outbound/README.md) | Yes    | Svix outbound webhooks                  |
| [events](events/README.md)                     | Yes    | Redis Streams billing events            |
| [integrations](integrations/README.md)         | Yes    | Third-party integrations                |
| [migration](migration/README.md)               | Yes    | Platform import API + LunchMoney wizard (PM-1, flag-gated) |

## Analytics, ML, and simulations

| Module                                                   | README | Primary concern       |
| -------------------------------------------------------- | ------ | --------------------- |
| [analytics](analytics/README.md)                         | Yes    | Reports and analytics |
| [ml](ml/README.md)                                       | Yes    | Categorization ML     |
| [simulations](simulations/README.md)                     | Yes    | Monte Carlo API       |
| [esg](esg/README.md)                                     | Yes    | ESG scoring           |
| [transaction-execution](transaction-execution/README.md) | Yes    | Transaction execution |

## Compliance, estate, and ops

| Module                                       | README | Primary concern              |
| -------------------------------------------- | ------ | ---------------------------- |
| [estate-planning](estate-planning/README.md) | Yes    | Wills, Life Beat             |
| [kyc](kyc/README.md)                         | Yes    | MetaMap KYC/AML              |
| [admin](admin/README.md)                     | Yes    | Platform admin, queues       |
| [jobs](jobs/README.md)                       | Yes    | BullMQ queues and processors |
| [email](email/README.md)                     | Yes    | SMTP and drip campaigns      |
| [storage](storage/README.md)                 | Yes    | R2 / object storage          |

## Experimental / low-traffic

| Module                               | README | Notes                              |
| ------------------------------------ | ------ | ---------------------------------- |
| [marketplace](marketplace/README.md) | Yes    | Connect marketplace scaffold (RFC) |
| [gaming](gaming/README.md)           | Yes    | Metaverse/gaming scaffold          |

## Documentation coverage

All **38** top-level API modules have a local `README.md` as of 2026-05-22.

## Adding a module README

Use this template:

1. **Purpose** — one paragraph
2. **Endpoints** — table with auth and status
3. **Jobs / queues** — if any
4. **Environment variables** — required vs optional
5. **Related docs** — link to `docs/guides/` or ADRs

Update this index when adding a module or README.

## Documentation debt

Tracked in [docs/TECH_DEBT.md](../../../../docs/TECH_DEBT.md) (TD-1008) and
[docs/DOCUMENTATION_AUDIT_2026-05-22.md](../../../../docs/DOCUMENTATION_AUDIT_2026-05-22.md).
