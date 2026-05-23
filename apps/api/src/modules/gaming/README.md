# Gaming Module

Last updated: 2026-05-22

Experimental metaverse/gaming portfolio views (The Sandbox and related platforms).
Aggregates positions, NFT inventory, and earnings for a space. Not on the core
consumer GA path.

## Related docs

- [DeFi/Web3 guide](../../../../docs/guides/DEFI_WEB3_GUIDE.md)
- [Module index](../README.md)

## API endpoints

Prefix: `/v1/gaming` (JWT required).

| Method | Path                        | Purpose                                       |
| ------ | --------------------------- | --------------------------------------------- |
| `GET`  | `/portfolio`                | Aggregated gaming portfolio (`spaceId` query) |
| `GET`  | `/platforms`                | Supported platforms                           |
| `GET`  | `/earnings`                 | Earnings summary                              |
| `GET`  | `/nfts`                     | NFT inventory                                 |
| `GET`  | `/:platform/positions`      | Positions for one platform                    |
| `GET`  | `/sandbox/land-floor-price` | Sandbox land floor (legacy)                   |
| `GET`  | `/sandbox/staking-apy`      | Sandbox staking APY (legacy)                  |
| `GET`  | `/positions`                | Sandbox gaming positions                      |

## Primary files

| File                               | Role                       |
| ---------------------------------- | -------------------------- |
| `gaming.controller.ts`             | REST API                   |
| `gaming.service.ts`                | Cross-platform aggregation |
| `sandbox.service.ts`               | The Sandbox-specific data  |
| `interfaces/platform.interface.ts` | Platform enum/types        |

## Environment variables

Platform API keys are provider-specific; configure in service implementations
when enabling live integrations. Defaults may return scaffold/cached data in dev.

## Status

Scaffold / low-traffic. Expand README with env vars and provider contracts when
gaming GA is scoped.
