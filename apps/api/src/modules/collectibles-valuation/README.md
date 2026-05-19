# Collectibles Valuation Adapters

| Adapter               | Status          | API                                         | Required Env Var        |
| --------------------- | --------------- | ------------------------------------------- | ----------------------- |
| KicksDB (Sneakers)    | ACTIVE          | sneaks-api (bundled)                        | None (free)             |
| Artsy (Art)           | NOT_IMPLEMENTED | https://developers.artsy.net                | `ARTSY_API_KEY`         |
| WatchCharts (Watches) | NOT_IMPLEMENTED | https://watchcharts.com/api                 | `WATCHCHARTS_API_KEY`   |
| Wine-Searcher (Wine)  | NOT_IMPLEMENTED | https://api.wine-searcher.com               | `WINE_SEARCHER_API_KEY` |
| PCGS (Coins)          | NOT_IMPLEMENTED | https://www.pcgs.com/publicapi              | `PCGS_API_KEY`          |
| PSA (Cards)           | NOT_IMPLEMENTED | https://www.psacard.com/services/publicapi  | `PSA_API_KEY`           |
| Hagerty (Cars)        | NOT_IMPLEMENTED | https://www.hagerty.com/apps/valuationtools | `HAGERTY_API_KEY`       |

Each adapter implements the `CollectibleProviderAdapter` interface. See individual adapter files for implementation details.
