# Providers Module

Last updated: 2026-05-22

Umbrella module for financial data provider integrations. On startup,
`ProvidersModule` registers Plaid, Belvo, MX, and Finicity with the
[orchestrator](orchestrator/README.md) for failover and redundancy.

## Related docs

- [Orchestrator](orchestrator/README.md) — multi-provider routing
- [Connection health](connection-health/README.md) — health checks and error messages
- [Credential onboarding](../../../../docs/CREDENTIAL_ONBOARDING.md) — activation runbook
- [Multi-provider redundancy guide](../../../../docs/guides/MULTI_PROVIDER_REDUNDANCY.md)
- [Module index](../README.md)

## Submodule index

| Submodule                                        | Region / use              | README |
| ------------------------------------------------ | ------------------------- | ------ |
| [orchestrator](orchestrator/README.md)           | Failover across providers | Yes    |
| [belvo](belvo/README.md)                         | Mexico banking            | Yes    |
| [plaid](plaid/README.md)                         | US banking                | Yes    |
| [mx](mx/README.md)                               | US/Canada aggregation     | Yes    |
| [finicity](finicity/README.md)                   | US open banking           | Yes    |
| [bitso](bitso/README.md)                         | Crypto exchange           | Yes    |
| [blockchain](blockchain/README.md)               | On-chain ETH/BTC/xPub     | Yes    |
| [defi](defi/README.md)                           | DeFi / Zapper             | Yes    |
| [connection-health](connection-health/README.md) | Connection monitoring     | Yes    |

## Registration flow

```text
ProvidersModule.onModuleInit()
  -> ProviderOrchestratorService.registerProvider(plaid)
  -> ProviderOrchestratorService.registerProvider(belvo)
  -> ProviderOrchestratorService.registerProvider(mx)
  -> ProviderOrchestratorService.registerProvider(finicity)
```

Bitso, blockchain, and DeFi are imported as separate modules and used by
account/sync flows without orchestrator registration in `providers.module.ts`.

## Health semantics

Production health reports provider connectivity per
[Credential onboarding](../../../../docs/CREDENTIAL_ONBOARDING.md). Belvo is
typically **required** for MX consumer GA; Plaid/Bitso may be **optional**
until credentialed. See [GA Remediation Roadmap — Phase 4](../../../../docs/GA_REMEDIATION_ROADMAP.md#phase-4--provider-health-semantics).

## Primary file

| File                  | Role                                                      |
| --------------------- | --------------------------------------------------------- |
| `providers.module.ts` | Aggregates provider submodules, orchestrator registration |

Each provider submodule owns its controller, service, webhooks, and DTOs.
